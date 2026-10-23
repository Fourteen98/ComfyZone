# Something she sells. See the variants migration for the product/variant split.
class Product < ApplicationRecord
  include HasMoney

  MAX_OPTIONS = 3
  MAX_VARIANTS = 200
  MAX_PHOTOS = 5

  # optional: true because a product may have no category.
  belongs_to :category, optional: true

  # `validate: false`: we check options ourselves below, to give messages
  # more useful than Rails' default "Options is invalid".
  has_many :options, -> { order(:position) }, class_name: "ProductOption",
    dependent: :destroy, inverse_of: :product, validate: false
  # `variants` is what she can sell now. `all_variants` also includes retired
  # ones (a size she stopped offering but which has purchase or sales history).
  has_many :variants, -> { where(active: true).order(:position) }, inverse_of: :product
  has_many :all_variants, class_name: "Variant", dependent: :destroy, inverse_of: :product
  has_many :product_suppliers, dependent: :destroy
  has_many :suppliers, through: :product_suppliers
  has_many :photos, -> { order(:position, :id) }, class_name: "ProductPhoto", dependent: :destroy

  # Adds product.active?, product.archived!, Product.active, Product.archived ...
  enum :status, { active: "active", archived: "archived" }

  money :price
  # A lower price for buying many (see BulkPricing). Empty = no bulk price.
  money :bulk_price, allow_nil: true

  normalizes :name, with: ->(name) { name.squish }

  validates :name, presence: true, length: { maximum: 80 }, uniqueness: { case_sensitive: false }
  validates :description, length: { maximum: 1000 }
  validates :low_stock_at, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 10_000 }
  validate :options_make_sense
  validates :bulk_min_quantity, numericality: { only_integer: true, greater_than_or_equal_to: 2, less_than_or_equal_to: 10_000 }, allow_nil: true
  validate :bulk_price_is_complete

  scope :ordered, -> { order(Arel.sql("lower(name)")) }
  # What the public can see: she ticked "Show on the shop" and it isn't archived.
  scope :on_shop, -> { active.where(listed: true) }

  # The total of a product counted as one number (stock_pooled): all its
  # sizes and colours. Uses the variants already loaded, if they are.
  def pooled_total
    variants.sum { |variant| [ variant.stock_on_hand, 0 ].max }
  end

  # Has a bulk price set up.
  def bulk?
    bulk_price_pesewas.present? && bulk_min_quantity.present?
  end

  # /shop/12-ankara-wrap-dress. Rails calls to_param to build the :id part of
  # a URL; `Product.find("12-ankara-wrap-dress")` reads the leading number
  # and ignores the rest, so the words are only there for people (and Google).
  def shop_param
    "#{id}-#{name.parameterize}"
  end
  # ILIKE = case-insensitive LIKE. sanitize_sql_like stops a typed % or _
  # from acting as a wildcard.
  scope :search, ->(text) { where("name ILIKE ?", "%#{sanitize_sql_like(text.to_s.strip)}%") }

  # Saves the product, replaces its options with `definitions`, and brings
  # the variants in line. All or nothing.
  #
  #   product.save_with_options([
  #     { name: "Size", values: [{ label: "M" }, { label: "L" }] },
  #     { name: "Colour", values: [{ label: "Black", swatch: "#1a1a1a" }] }
  #   ])
  #
  # A transaction makes several database changes behave as one: if anything
  # inside fails, everything inside is undone. Without it, a failure halfway
  # could leave a product with new options but old variants.
  def save_with_options(definitions)
    saved = false

    transaction do
      options.destroy_all if persisted?
      Array(definitions).each_with_index do |definition, index|
        definition = definition.to_h.symbolize_keys
        options.build(name: definition[:name], values: definition[:values], position: index + 1)
      end

      if save
        VariantGenerator.new(self).sync!
        saved = true
      else
        # Undo the destroy_all above and leave the database as it was.
        raise ActiveRecord::Rollback
      end
    end

    saved
  end

  # Adds one choice to one of its options, and makes the variants for it:
  # "Colour: Green" on a dress in M, L and XL makes M / Green, L / Green and
  # XL / Green, with no stock and the product's price. Everything else is
  # kept as it is. Used while recording a purchase, when the colour that
  # just arrived isn't on the product yet.
  #
  #   product.add_option_value("Colour", label: "Green", swatch: "#2e7d32")
  #   # => the new variants, or false with product.errors
  def add_option_value(option_name, label:, swatch: nil)
    option = options.find { |candidate| candidate.name.casecmp?(option_name.to_s.squish) }
    label = label.to_s.squish
    if option.nil?
      errors.add(:base, "#{name} has no \"#{option_name}\" to add to")
    elsif label.empty?
      errors.add(:base, "Type the new #{option.name.downcase} first")
    elsif option.labels.any? { |existing| existing.casecmp?(label) }
      errors.add(:base, "#{name} already comes in #{label}")
    end
    return false if errors.any?

    before = all_variants.where(active: true).pluck(:id)
    transaction do
      option.values = option.values + [ { "label" => label, "swatch" => swatch.presence }.compact ]
      unless option.save
        errors.add(:base, option.errors.full_messages.first)
        raise ActiveRecord::Rollback
      end
      VariantGenerator.new(self).sync!
    end
    return false if errors.any?

    variants.reload.reject { |variant| before.include?(variant.id) }
  end

  # The lowest and highest selling price across its variants, in pesewas.
  def price_range
    prices = variants.map(&:selling_price_pesewas)
    [ prices.min || price_pesewas, prices.max || price_pesewas ]
  end

  # Put the photos in the order of the given ids; the first becomes the cover.
  # Ids that aren't this product's photos are ignored.
  def reorder_photos(ids)
    wanted = Array(ids).map(&:to_i)
    sorted = photos.sort_by { |photo| [ wanted.index(photo.id) || wanted.size, photo.position ] }

    transaction do
      sorted.each_with_index { |photo, index| photo.update_column(:position, index + 1) }
    end
    photos.reset
  end

  # How many variants the current options would produce.
  def variants_needed
    options.reject(&:marked_for_destruction?).map { |option| option.values.size }.reduce(1, :*)
  end

  private
    # Both boxes or neither. A bulk price above the normal one is a typo.
    def bulk_price_is_complete
      if bulk_price_pesewas.present? && bulk_min_quantity.blank?
        errors.add(:bulk_min_quantity, "is needed: from how many pieces does the bulk price start?")
      elsif bulk_min_quantity.present? && bulk_price_pesewas.blank?
        errors.add(:bulk_price, "is needed, or clear the number of pieces")
      elsif bulk_price_pesewas.present?
        errors.add(:bulk_price, "must be more than zero") unless bulk_price_pesewas.positive?
        errors.add(:bulk_price, "should be less than the normal price") if price_pesewas && bulk_price_pesewas >= price_pesewas
      end
    end

    def options_make_sense
      current = options.reject(&:marked_for_destruction?).reject(&:destroyed?)

      errors.add(:options, "can have at most #{MAX_OPTIONS} options") if current.size > MAX_OPTIONS

      current.each do |option|
        next if option.valid?

        problems = option.errors.map do |error|
          case error.attribute
          when :values then error.message              # "need at least one choice"
          when :name   then "needs a name"
          else error.full_message.downcase
          end
        end
        errors.add(:options, "#{option.name.presence || 'An option'}: #{problems.to_sentence}")
      end

      names = current.map { |option| option.name.to_s.downcase }
      errors.add(:options, "can't use the same option name twice") if names.uniq.size != names.size

      needed = current.map { |option| option.values.size }.reduce(1, :*)
      if needed > MAX_VARIANTS
        errors.add(:options, "would make #{needed} variants. The most a product can have is #{MAX_VARIANTS}")
      end
    end
end
