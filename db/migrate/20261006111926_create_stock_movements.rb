class CreateStockMovements < ActiveRecord::Migration[8.1]
  def change
    # The stock ledger. Every change to stock is one row here, and rows are
    # never edited or deleted. To correct a mistake you add another row.
    #
    #   +12  purchase     balance 12
    #    -1  sale         balance 11
    #    -1  adjustment   balance 10   "found damaged"
    #
    # When a number looks wrong, this is how you find out why.
    create_table :stock_movements do |t|
      t.references :variant, null: false, foreign_key: true

      t.integer :quantity, null: false       # + in, - out. Never zero.
      t.integer :balance_after, null: false  # stock on hand right after this row
      t.string :reason, null: false          # "purchase", later "sale", "adjustment", "return"

      # What one unit cost, for movements that bring stock in.
      t.integer :unit_cost_pesewas

      # What caused it. `polymorphic: true` adds source_type + source_id, so
      # the same pair of columns can point at a Purchase now and an Order or
      # an Adjustment later, without a column for each.
      t.references :source, polymorphic: true, null: true

      t.references :user, null: true, foreign_key: true # who did it
      t.string :note

      # Only created_at: a row that is never edited has no use for updated_at.
      t.datetime :created_at, null: false
    end

    add_index :stock_movements, %i[ variant_id created_at ]
    add_check_constraint :stock_movements, "quantity <> 0", name: "stock_movements_quantity_not_zero"
  end
end
