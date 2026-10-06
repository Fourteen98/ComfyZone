# One pairing of a supplier and a product they sell. This is the "join
# model" behind supplier.products and product.suppliers.
class ProductSupplier < ApplicationRecord
  belongs_to :supplier
  belongs_to :product

  validates :product_id, uniqueness: { scope: :supplier_id }
end
