class CreateCategories < ActiveRecord::Migration[8.1]
  def change
    # What kind of thing a product is: Dresses, Tops, Loungewear...
    create_table :categories do |t|
      t.string :name, null: false

      # A URL-friendly version of the name: "Two-piece sets" -> "two-piece-sets".
      # Used in addresses (/products?category=two-piece-sets) and later by the
      # storefront. It stays the same when the category is renamed, so links
      # people have saved or shared keep working.
      t.string :slug, null: false

      t.integer :position, null: false, default: 0 # her chosen order

      # Hidden categories stay on their products but are not offered when
      # adding new ones. Gentler than deleting.
      t.boolean :active, null: false, default: true

      t.timestamps
    end

    add_index :categories, "lower(name)", unique: true, name: "index_categories_on_lower_name"
    add_index :categories, :slug, unique: true
  end
end
