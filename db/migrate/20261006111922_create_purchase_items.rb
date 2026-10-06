class CreatePurchaseItems < ActiveRecord::Migration[8.1]
  def change
    # One line of a purchase: "12 of Ankara wrap dress, M / Black at GH₵ 60".
    create_table :purchase_items do |t|
      # Delete a purchase and its lines go with it (cascade is right here:
      # a line means nothing without its purchase).
      t.references :purchase, null: false, foreign_key: { on_delete: :cascade }
      # No on_delete: the default is to REFUSE deleting a variant that a
      # purchase line points at. History must not lose what it refers to.
      t.references :variant, null: false, foreign_key: true

      t.integer :quantity, null: false
      t.integer :unit_cost_pesewas, null: false # what the supplier charged for one

      # Filled in when the goods are received: this line's goods cost plus
      # its share of the purchase's extra costs. Stored as a line TOTAL so
      # no pesewa is lost to rounding (a per-unit figure might not divide evenly).
      t.integer :landed_total_pesewas

      t.timestamps
    end

    # The same variant appears at most once per purchase.
    add_index :purchase_items, %i[ purchase_id variant_id ], unique: true

    # A CHECK constraint: the database itself refuses a zero or negative
    # quantity, whatever code is talking to it.
    add_check_constraint :purchase_items, "quantity > 0", name: "purchase_items_quantity_positive"
  end
end
