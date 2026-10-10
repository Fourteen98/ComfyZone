# Bulk buyers pay less. A product can have a BULK PRICE, given:
#   - when an order has at least `bulk_min_quantity` of that product
#     (any size, any colour: 3 M + 3 L Ankara dresses = 6 Ankara dresses), or
#   - always, to a customer marked as a bulk buyer.
#
# products.bulk_on_shop: whether the website offers it too. Off by default,
# so wholesale prices stay private until she chooses to show them.
# order_items.bulk: this line was charged the bulk price, so receipts and
# the order page can say so.
class AddBulkPricing < ActiveRecord::Migration[8.1]
  def change
    add_column :products, :bulk_price_pesewas, :integer
    add_column :products, :bulk_min_quantity, :integer
    add_column :products, :bulk_on_shop, :boolean, null: false, default: false
    # Both set or both empty; at least 2 pieces; a real price.
    add_check_constraint :products,
      "(bulk_price_pesewas IS NULL AND bulk_min_quantity IS NULL) OR (bulk_price_pesewas > 0 AND bulk_min_quantity >= 2)",
      name: "products_bulk_price_complete"

    add_column :customers, :bulk_buyer, :boolean, null: false, default: false
    add_column :order_items, :bulk, :boolean, null: false, default: false
  end
end
