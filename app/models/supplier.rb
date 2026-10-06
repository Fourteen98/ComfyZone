class Supplier < ApplicationRecord
  has_many :purchases, dependent: :nullify

  # Many-to-many, in two steps: the pairings, then "through" them to the
  # products. This gives supplier.products, supplier.product_ids, and
  # supplier.product_ids = [4, 7] to replace the whole set.
  has_many :product_suppliers, dependent: :destroy
  has_many :products, through: :product_suppliers

  normalizes :name, with: ->(name) { name.squish }
  normalizes :phone, with: ->(phone) { phone.squish.presence }

  # Something dialable: digits with optional +, spaces, dashes or brackets,
  # and at least 7 digits. Deliberately loose; phone formats vary.
  PHONE = /\A\+?[\d\s\-()]{7,25}\z/

  validates :name, presence: true, length: { maximum: 60 }, uniqueness: { case_sensitive: false }
  # Required from now on. There is no NOT NULL in the database, because
  # suppliers saved before this rule may have no number yet; they are asked
  # for one the next time they are edited.
  validates :phone, presence: { message: "is needed so you can reach them" }
  validates :phone, format: { with: PHONE, message: "doesn't look like a phone number" },
    if: -> { phone.present? }
  validate :phone_has_enough_digits, if: -> { phone.present? }
  validates :note, length: { maximum: 500 }

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
    def phone_has_enough_digits
      errors.add(:phone, "doesn't look like a phone number") if phone.count("0-9") < 7 && errors[:phone].empty?
    end
end
