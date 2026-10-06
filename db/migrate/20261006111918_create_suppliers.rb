class CreateSuppliers < ActiveRecord::Migration[8.1]
  def change
    # Who she buys stock from.
    create_table :suppliers do |t|
      t.string :name, null: false
      t.string :phone
      t.text :note # where they are, what they sell, payment terms...

      t.timestamps
    end

    add_index :suppliers, "lower(name)", unique: true, name: "index_suppliers_on_lower_name"
  end
end
