class AddFollowThroughToOrders < ActiveRecord::Migration[8.1]
  # Everything an order needs after the claim: how it reaches the buyer,
  # what has been paid, and when each stage happened.
  #
  # This migration uses `up` and `down` instead of `change`. Replacing a
  # check constraint is not something Rails can reverse by itself (it would
  # need to know the OLD rule), so we spell out both directions.
  def up
    # --- Delivery -----------------------------------------------------
    # NULL = not decided yet. Unlike purchases, an order starts without
    # this: during a live she records the claim and sorts delivery later.
    add_column :orders, :delivery_method, :string
    # What the buyer pays for delivery, on top of the goods. Kept apart from
    # total_pesewas on purpose: that money goes to the rider, so it must not
    # show up in her sales or her profit.
    add_column :orders, :delivery_fee_pesewas, :integer, null: false, default: 0
    add_column :orders, :delivery_address, :text

    # --- Money --------------------------------------------------------
    # A running total of the payments table, kept here for the same reason
    # variants keep stock_on_hand: lists and the dashboard read it instantly.
    # Only Order#record_payment! and Order#refund! change it.
    add_column :orders, :paid_pesewas, :integer, null: false, default: 0

    # --- When each stage happened ---------------------------------------
    add_column :orders, :paid_at, :datetime
    add_column :orders, :packed_at, :datetime
    add_column :orders, :delivered_at, :datetime
    add_column :orders, :returned_at, :datetime

    # A CHECK passes when the value is NULL, so "not decided yet" is allowed.
    add_check_constraint :orders, "delivery_method IN ('pickup', 'delivery')", name: "orders_delivery_method_known"
    add_check_constraint :orders, "delivery_fee_pesewas >= 0", name: "orders_delivery_fee_not_negative"
    add_check_constraint :orders, "paid_pesewas >= 0", name: "orders_paid_not_negative"

    # --- One more stage: returned -----------------------------------------
    # A constraint can't be edited, only dropped and added again.
    remove_check_constraint :orders, name: "orders_status_known"
    add_check_constraint :orders, "status IN ('claimed', 'paid', 'packed', 'delivered', 'cancelled', 'returned')", name: "orders_status_known"
  end

  def down
    # Going back, "returned" stops being allowed, so rows using it must be
    # moved somewhere first or the old rule could not be put back.
    execute "UPDATE orders SET status = 'cancelled' WHERE status = 'returned'"
    remove_check_constraint :orders, name: "orders_status_known"
    add_check_constraint :orders, "status IN ('claimed', 'paid', 'packed', 'delivered', 'cancelled')", name: "orders_status_known"

    remove_check_constraint :orders, name: "orders_paid_not_negative"
    remove_check_constraint :orders, name: "orders_delivery_fee_not_negative"
    remove_check_constraint :orders, name: "orders_delivery_method_known"
    remove_columns :orders, :delivery_method, :delivery_fee_pesewas, :delivery_address,
                   :paid_pesewas, :paid_at, :packed_at, :delivered_at, :returned_at
  end
end
