class CreateProducts < ActiveRecord::Migration[8.1]
  def change
    # A product is the thing she talks about on a live: "the Ankara wrap dress".
    # It is never sold directly. What gets stocked and sold is one of its
    # variants ("Ankara wrap dress, M, Red"), created in a later migration.
    create_table :products do |t|
      t.string :name, null: false
      t.text :description

      # Money is stored as a whole number of pesewas (GH₵ 120.50 -> 12050).
      # Never use float or decimal-as-float for money: 0.1 + 0.2 != 0.3 in
      # floating point, and those errors add up across hundreds of sales.
      # This is the default selling price; a variant may override it.
      t.integer :price_pesewas, null: false, default: 0

      # "active" or "archived". Products are archived, never deleted, because
      # past sales will point at them.
      t.string :status, null: false, default: "active"

      t.timestamps
    end

    add_index :products, "lower(name)", unique: true, name: "index_products_on_lower_name"
    add_index :products, :status
  end
end
