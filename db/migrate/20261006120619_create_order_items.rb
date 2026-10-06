class CreateOrderItems < ActiveRecord::Migration[8.1]
  def change
    # One line of an order: "2 of Ankara wrap dress, M / Black".
    create_table :order_items do |t|
      t.references :order, null: false, foreign_key: { on_delete: :cascade }
      t.references :variant, null: false, foreign_key: true # refuses to delete a sold variant

      t.integer :quantity, null: false

      # SNAPSHOTS, copied at the moment of sale and never updated:
      #   what the customer was charged for one, and
      #   what one had cost her (the variant's average cost at that moment).
      # If she changes the price next week, or the next purchase costs more,
      # this order's revenue and profit must not change. History records
      # what happened, not what the catalogue says today.
      t.integer :unit_price_pesewas, null: false
      t.integer :unit_cost_pesewas, null: false, default: 0

      t.timestamps
    end

    add_index :order_items, %i[ order_id variant_id ], unique: true
    add_check_constraint :order_items, "quantity > 0", name: "order_items_quantity_positive"
  end
end
