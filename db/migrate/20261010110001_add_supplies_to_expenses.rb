# Supplies bought for the business (polymer bags, delivery stickers, tape...)
# are expenses, not stock. Until now an expense was one amount. Now it can
# also say:
#   - WHO sold it   (supplier_id: the same suppliers as stock purchases, so a
#                    dealer's phone number lives in one place)
#   - WHAT was in it (expense_items: one line per kind of item)
#   - what DELIVERY cost on top (delivery_fee_pesewas)
# When an expense has lines, its amount is worked out from them: the lines
# plus delivery. An expense with no lines is still just an amount, as before.
class AddSuppliesToExpenses < ActiveRecord::Migration[8.1]
  def change
    add_reference :expenses, :supplier, foreign_key: true, null: true
    add_column :expenses, :delivery_fee_pesewas, :integer, null: false, default: 0
    add_check_constraint :expenses, "delivery_fee_pesewas >= 0", name: "expenses_delivery_fee_not_negative"

    create_table :expense_items do |t|
      t.references :expense, null: false, foreign_key: { on_delete: :cascade }
      t.string :name, null: false                   # "Polymer bags (medium)"
      t.integer :quantity, null: false
      t.integer :unit_cost_pesewas, null: false     # each, in pesewas
      t.timestamps
    end
    add_check_constraint :expense_items, "quantity > 0", name: "expense_items_quantity_positive"
    add_check_constraint :expense_items, "unit_cost_pesewas >= 0", name: "expense_items_unit_cost_not_negative"
    # For "what did we pay last time for polymer bags?", matched without case.
    add_index :expense_items, "lower(name)", name: "index_expense_items_on_lower_name"
  end
end
