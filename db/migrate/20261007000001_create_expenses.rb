class CreateExpenses < ActiveRecord::Migration[8.1]
  def change
    # Money the business spends that is NOT stock: packaging, data bundles,
    # riders she pays herself, adverts, rent. (What she pays for goods is a
    # purchase, and is already counted in the cost of each item sold.)
    create_table :expenses do |t|
      t.date :spent_on, null: false
      # Free text, not a table of its own: she can type any category, and
      # the form suggests the ones used before. Few rows, no logic hanging
      # off particular values, so a lookup table would be more machinery
      # than it earns. (Compare sales_channels, where code needs `kind`.)
      t.string :category, null: false
      t.integer :amount_pesewas, null: false
      t.string :note
      t.string :paid_via # momo, cash, bank... optional (see Payment::WAYS)
      t.references :user, null: false, foreign_key: true # who recorded it
      t.timestamps
    end

    add_index :expenses, :spent_on
    add_check_constraint :expenses, "amount_pesewas > 0", name: "expenses_amount_positive"
  end
end
