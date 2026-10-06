class CreatePayments < ActiveRecord::Migration[8.1]
  def change
    # Money moving for an order. Like stock_movements, this is a ledger:
    # rows are added, never edited or deleted.
    #
    #   amount   via    reference
    #   +150.00  momo   "TX 4471..."     she was paid
    #    -50.00  cash                    she gave some back (a refund)
    #
    # orders.paid_pesewas is always the sum of this table for that order.
    create_table :payments do |t|
      # No on_delete: the database refuses to delete an order that has
      # payments. Money records must outlive everything.
      t.references :order, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true # who recorded it

      # Positive = money in, negative = money back to the buyer.
      t.integer :amount_pesewas, null: false

      # How the money moved: momo, cash, bank, other. Checked in the model
      # only (Payment::WAYS), not with a CHECK constraint, because this list
      # is likely to grow and may become a Settings screen.
      # (Not called "method": every Ruby object already has a `method`.)
      t.string :via, null: false

      t.string :reference # e.g. the MoMo transaction ID
      t.string :note
      t.timestamps
    end

    add_check_constraint :payments, "amount_pesewas <> 0", name: "payments_amount_not_zero"
  end
end
