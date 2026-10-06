class CreatePurchases < ActiveRecord::Migration[8.1]
  def change
    # One restock: a set of items bought together on one day.
    create_table :purchases do |t|
      # Optional: a quick market buy may have no named supplier.
      # If a supplier is ever deleted, the purchase is kept (nullify).
      t.references :supplier, null: true, foreign_key: { on_delete: :nullify }

      # `date`, not `datetime`: the day matters, the time of day does not.
      t.date :purchased_on, null: false
      t.string :reference # her own note of an invoice or waybill number

      # Costs that belong to the whole purchase, not one item: transport,
      # shipping, duty, loading fees. Shared across the items when the goods
      # arrive, so every item carries its true ("landed") cost.
      t.integer :extra_costs_pesewas, null: false, default: 0

      # "ordered"  = paid for or on the way; stock NOT yet counted.
      # "received" = arrived; stock was added, and the purchase is locked.
      t.string :status, null: false, default: "ordered"
      t.datetime :received_at

      t.text :note
      # Who recorded it. Kept even if that person is later switched off
      # (people are never deleted).
      t.references :user, null: false, foreign_key: true

      t.timestamps
    end

    add_index :purchases, :purchased_on
    add_index :purchases, :status
  end
end
