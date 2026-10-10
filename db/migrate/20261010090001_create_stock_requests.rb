# The waiting list: who asked for something that was sold out.
#
# "Do you have the kaftan in 3XL orange?" "Not now." That question is worth
# keeping twice over: when the 3XL orange comes back she can tell everyone
# who asked, and how many people asked is the best guide to what to buy
# next (see RestockAdvisor).
class CreateStockRequests < ActiveRecord::Migration[8.1]
  def change
    create_table :stock_requests do |t|
      t.references :customer, null: false, foreign_key: { on_delete: :cascade }
      t.references :variant, null: false, foreign_key: { on_delete: :cascade }
      t.integer :quantity, null: false, default: 1
      # Where it was asked: a live, a sale recorded by hand, the shop, or added by hand.
      t.string :source, null: false, default: "manual"
      t.string :note
      t.references :user, foreign_key: { on_delete: :nullify } # who wrote it down; empty from the shop
      t.datetime :told_at   # she has told them it is back
      t.datetime :closed_at # done with: they bought it, or no longer want it
      t.timestamps
    end

    # One open request per person per item. Asking twice doesn't make two
    # people waiting. (Partial: closed requests don't count.)
    add_index :stock_requests, %i[ customer_id variant_id ], unique: true, where: "closed_at IS NULL",
      name: "index_stock_requests_one_open_per_customer_and_variant"
    add_check_constraint :stock_requests, "quantity > 0", name: "stock_requests_quantity_positive"
    add_check_constraint :stock_requests, "source IN ('live', 'sale', 'shop', 'manual')", name: "stock_requests_source_known"
  end
end
