class AddLowStockAtToProducts < ActiveRecord::Migration[8.1]
  def change
    # "Warn me when any size or colour of this product drops to this many."
    # Set per product, because a fast seller needs an earlier warning than a
    # slow one. 0 switches the warning off (out of stock is still flagged).
    #
    # NOT NULL with a default: existing products get 2 without a backfill.
    add_column :products, :low_stock_at, :integer, null: false, default: 2

    add_check_constraint :products, "low_stock_at >= 0", name: "products_low_stock_at_not_negative"
  end
end
