class Supplier < ApplicationRecord
  has_many :purchases, dependent: :nullify
  # Supplies bought from them (bags, stickers, tape): expenses, not stock.
  has_many :expenses, dependent: :nullify

  include Located # country, region, exact place; locate(...), where_text

  # Many-to-many, in two steps: the pairings, then "through" them to the
  # products. This gives supplier.products, supplier.product_ids, and
  # supplier.product_ids = [4, 7] to replace the whole set.
  has_many :product_suppliers, dependent: :destroy
  has_many :products, through: :product_suppliers

  normalizes :name, with: ->(name) { name.squish }
  # Stored as +233242223333, the same as customers (see PhoneNumber). Not
  # unique here: two suppliers can share a shop's number.
  normalizes :phone, with: ->(phone) { PhoneNumber.normalize(phone) }

  validates :name, presence: true, length: { maximum: 60 }, uniqueness: { case_sensitive: false }
  # Required from now on. There is no NOT NULL in the database, because
  # suppliers saved before this rule may have no number yet; they are asked
  # for one the next time they are edited.
  validates :phone, presence: { message: "is needed so you can reach them" }
  validate :phone_is_a_number, if: -> { phone.present? }
  validates :note, length: { maximum: 500 }
  normalizes :location, with: ->(text) { text.to_s.squish.presence }
  validates :location, length: { maximum: 80 }

  scope :ordered, -> { order(Arel.sql("lower(name)")) }

  # Record that this supplier sells these products, leaving existing
  # pairings alone. insert_all writes every row in ONE statement, and
  # unique_by makes the database skip pairings that already exist, so it is
  # safe to call any number of times.
  def sells!(product_ids)
    rows = product_ids.uniq.map { |product_id| { supplier_id: id, product_id: product_id } }
    ProductSupplier.insert_all(rows, unique_by: %i[ supplier_id product_id ]) if rows.any?
  end

  # Saves the supplier and, if given, replaces the set of products they sell.
  # In a transaction because `product_ids=` writes to the database the moment
  # it is called; if the supplier then fails validation, that must be undone.
  def save_with_products(product_ids)
    saved = false

    transaction do
      saved = save
      self.product_ids = Product.where(id: product_ids).ids if saved && !product_ids.nil?
      raise ActiveRecord::Rollback unless saved
    end

    saved
  end

  private
    def phone_is_a_number
      errors.add(:phone, "doesn't look like a phone number. Try 024 123 4567, or +86 138 0013 8000 abroad") unless PhoneNumber.valid?(phone)
    end
end
