# How the goods reached her, and what that cost.
#
# This changes a table that is already in use, so it follows the pattern
# from the roles migration: add, backfill, then tighten.
class AddDeliveryToPurchases < ActiveRecord::Migration[8.1]
  def up
    # "pickup"   = she (or someone she sent) went to collect the goods
    # "delivery" = the goods were brought to her
    add_column :purchases, :delivery_method, :string

    # What that trip or delivery cost. NOT NULL with a default needs no
    # backfill: existing rows simply get 0.
    add_column :purchases, :transport_cost_pesewas, :integer, null: false, default: 0

    # Purchases recorded before this change don't say how the goods arrived.
    # They are marked "delivery", and their old lump sum stays where it was,
    # in extra_costs_pesewas (now shown as "other fees"). No money moves, so
    # no cost that was already worked out changes.
    execute "UPDATE purchases SET delivery_method = 'delivery' WHERE delivery_method IS NULL"

    change_column_null :purchases, :delivery_method, false

    # Only these two values can ever be stored, whatever code writes the row.
    add_check_constraint :purchases, "delivery_method IN ('pickup', 'delivery')", name: "purchases_delivery_method_known"
  end

  def down
    remove_check_constraint :purchases, name: "purchases_delivery_method_known"
    remove_column :purchases, :transport_cost_pesewas
    remove_column :purchases, :delivery_method
  end
end
