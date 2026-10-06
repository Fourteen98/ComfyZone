class CreateCustomers < ActiveRecord::Migration[8.1]
  def change
    # Someone who buys. On a live she usually knows only their TikTok name
    # at first; the phone number and location come later, when they pay.
    create_table :customers do |t|
      # Stored without the @ and in lower case, so "@Ama_K" and "ama_k" are
      # recognised as the same person.
      t.string :handle
      t.string :name
      t.string :phone
      t.string :location # area or town, for delivery
      t.text :note

      t.timestamps
    end

    # Unique, but only among rows that HAVE a handle. A plain unique index
    # would be fine too (Postgres lets many rows be NULL), but saying
    # `where:` makes the intent explicit and keeps the index small. This is
    # called a partial index.
    add_index :customers, :handle, unique: true, where: "handle IS NOT NULL"
    add_index :customers, :phone
  end
end
