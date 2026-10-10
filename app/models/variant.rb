# One sellable combination of a product's options: "M / Black".
# This is what gets stocked, purchased and sold.
class Variant < ApplicationRecord
  include HasMoney

  belongs_to :product
  has_many :stock_movements, dependent: :restrict_with_error
  has_many :purchase_items, dependent: :restrict_with_error
  has_many :order_items, dependent: :restrict_with_error
  # Waiting list entries for this size/colour (see StockRequest).
  has_many :stock_requests, dependent: :destroy

  scope :active, -> { where(active: true) }

  # nil price = "use the product's price".
  money :price, allow_nil: true

  before_create :assign_sku

  # [{ "name" => "Size", "label" => "M" }, ...] -> "M / Black"
  def self.name_for(option_values)
    option_values.empty? ? "Default" : option_values.map { |value| value["label"] }.join(" / ")
  end

  # The same choices as one comparable string, ignoring order and capitals:
  #   "colour=black|size=m"
  def self.key_for(option_values)
    option_values.map { |value| "#{value['name']}=#{value['label']}".downcase }.sort.join("|")
  end

  # What this variant sells for, in pesewas.
  def selling_price_pesewas
    price_pesewas || product.price_pesewas
  end

  # "Ankara wrap dress, M / Black", or just "Scrunchie" when the product
  # has no options. For messages and lists outside the product's own page.
  def full_name
    option_values.empty? ? product.name : "#{product.name}, #{name}"
  end

  # :out, :low or :ok, judged against the product's warning level.
  def stock_level
    if stock_on_hand <= 0
      :out
    elsif stock_on_hand <= product.low_stock_at
      :low
    else
      :ok
    end
  end

  # What the units on the shelf cost her, in pesewas.
  def stock_value_pesewas
    [ stock_on_hand, 0 ].max * average_cost_pesewas
  end

  # True once anything refers to this variant. From then on it can only be
  # switched off, never deleted, or history would point at nothing.
  def has_history?
    stock_movements.exists? || purchase_items.exists? || order_items.exists?
  end

  def price_overridden?
    !price_pesewas.nil?
  end

  private
    # CZ-0012-03 = product 12, its third variant. Numbers are never reused
    # within a product while a variant holding them exists.
    def assign_sku
      taken = product.all_variants.where.not(id: nil).pluck(:sku).map { |sku| sku[/\d+\z/].to_i }
      self.sku ||= format("CZ-%04d-%02d", product_id, (taken.max || 0) + 1)
    end
end
