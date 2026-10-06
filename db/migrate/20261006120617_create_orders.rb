class CreateOrders < ActiveRecord::Migration[8.1]
  def change
    # What one customer is buying. Created the moment something is claimed.
    create_table :orders do |t|
      t.references :customer, null: false, foreign_key: true
      # NULL for a sale made outside a live (a WhatsApp order, a walk-in).
      t.references :live_session, null: true, foreign_key: { on_delete: :nullify }
      t.references :user, null: false, foreign_key: true # who recorded it

      # The stages an order moves through:
      #   claimed -> paid -> packed -> delivered      (or cancelled)
      # Fixed in code on purpose: the app's logic depends on them.
      t.string :status, null: false, default: "claimed"

      # The sum of the lines, kept here so lists and totals don't have to add
      # up items every time. Recalculated whenever the lines change.
      t.integer :total_pesewas, null: false, default: 0

      t.datetime :cancelled_at
      t.text :note
      t.timestamps
    end

    add_index :orders, :status
    add_index :orders, :created_at
    add_check_constraint :orders, "status IN ('claimed', 'paid', 'packed', 'delivered', 'cancelled')", name: "orders_status_known"
  end
end
