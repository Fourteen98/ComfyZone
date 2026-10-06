class CreateRoles < ActiveRecord::Migration[8.1]
  def change
    create_table :roles do |t|
      t.string :name, null: false
      t.string :description

      # A Postgres array column: one role row holds its whole list of
      # permission keys, e.g. {"products.view","orders.create"}.
      # No join table needed, because the list of possible permissions is
      # defined in code (app/models/permission.rb), not in the database.
      t.string :permissions, array: true, null: false, default: []

      # true only for the built-in Owner role, which can do everything and
      # cannot be edited or deleted.
      t.boolean :system, null: false, default: false

      t.timestamps
    end

    # Role names are unique regardless of capitals ("Packer" == "packer").
    # The index enforces it in the database itself, so it holds even if two
    # requests arrive at the same moment.
    add_index :roles, "lower(name)", unique: true, name: "index_roles_on_lower_name"
  end
end
