class AddReturnedQuantityToOrderItems < ActiveRecord::Migration[8.1]
  def change
    # How many of this line came back after delivery. "She kept the dress
    # and returned one of the two scarves" is quantity 2, returned 1.
    #
    # The original quantity is never changed: it is what was sold. What
    # still counts as a sale is quantity - returned_quantity.
    add_column :order_items, :returned_quantity, :integer, null: false, default: 0
    add_check_constraint :order_items, "returned_quantity >= 0 AND returned_quantity <= quantity", name: "order_items_returned_within_quantity"
  end
end
