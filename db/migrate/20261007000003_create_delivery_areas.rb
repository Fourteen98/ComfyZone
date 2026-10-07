class CreateDeliveryAreas < ActiveRecord::Migration[8.1]
  def change
    # The places she delivers to, each with its usual fee: "East Legon, 25".
    # Managed in Settings > Delivery areas. Picking an area on an order
    # fills in the fee, which can still be changed for that one order.
    create_table :delivery_areas do |t|
      t.string :name, null: false
      t.integer :fee_pesewas, null: false, default: 0
      t.integer :position, null: false, default: 0
      t.boolean :active, null: false, default: true
      t.timestamps
    end
    add_index :delivery_areas, "lower(name)", unique: true, name: "index_delivery_areas_on_lower_name"
    add_check_constraint :delivery_areas, "fee_pesewas >= 0", name: "delivery_areas_fee_not_negative"

    # Where a customer usually is, so their next delivery starts filled in.
    # (customers.location, which already exists, holds the street or landmark.)
    add_reference :customers, :delivery_area, null: true, foreign_key: { on_delete: :nullify }

    # Where THIS order went. A copy of the choice at the time, like the price
    # snapshots: the customer may move, the order's history must not.
    # orders.delivery_fee_pesewas already holds the fee actually charged.
    add_reference :orders, :delivery_area, null: true, foreign_key: { on_delete: :nullify }
  end
end
