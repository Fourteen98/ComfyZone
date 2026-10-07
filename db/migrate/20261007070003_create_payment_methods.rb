class CreatePaymentMethods < ActiveRecord::Migration[8.1]
  # A stand-in model, so this migration doesn't depend on app/models
  # (see lesson 16).
  class Method < ActiveRecord::Base
    self.table_name = "payment_methods"
  end

  def up
    # The ways money moves: Mobile money, Cash... Until now a fixed list in
    # the code (Payment::WAYS). Now rows she can add to, rename and reorder
    # in Settings > Payment methods.
    create_table :payment_methods do |t|
      # What payments.via and expenses.paid_via store. Set once, when the
      # method is created, and never changed, so renaming "Mobile money" to
      # "MoMo" doesn't orphan a single old payment.
      t.string :key, null: false
      t.string :name, null: false # what she sees; free to change
      t.boolean :wants_reference, null: false, default: false # ask for a transaction ID?
      t.integer :position, null: false, default: 0
      t.boolean :active, null: false, default: true
      t.timestamps
    end
    add_index :payment_methods, :key, unique: true
    add_index :payment_methods, "lower(name)", unique: true, name: "index_payment_methods_on_lower_name"

    # The four that existed in the code, with the same keys, so every
    # payment and expense already recorded still finds its method.
    [ [ "momo", "Mobile money", true ], [ "cash", "Cash", false ], [ "bank", "Bank transfer", true ], [ "other", "Other", false ] ]
      .each_with_index do |(key, name, wants_reference), index|
        Method.create!(key: key, name: name, wants_reference: wants_reference, position: index + 1)
      end
  end

  def down
    drop_table :payment_methods
  end
end
