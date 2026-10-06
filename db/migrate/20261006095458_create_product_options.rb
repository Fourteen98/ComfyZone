class CreateProductOptions < ActiveRecord::Migration[8.1]
  def change
    # The options ONE product comes in, e.g. for a dress:
    #   position 1: Size   -> M, L, XL
    #   position 2: Colour -> Black, Red
    #
    # The values are copied here from an option preset (or typed by hand).
    # They are deliberately not linked to the preset, so editing "Colours" in
    # Settings later never changes a product that already exists.
    create_table :product_options do |t|
      # `references` adds product_id, an index on it, and (with foreign_key)
      # a database rule that the product must exist.
      t.references :product, null: false, foreign_key: true

      t.string :name, null: false                 # "Size"
      t.integer :position, null: false, default: 1 # Size before Colour
      t.jsonb :values, null: false, default: []   # same shape as option_presets.values

      t.timestamps
    end

    # A product can't have two options both called "Size".
    add_index :product_options, "product_id, lower(name)", unique: true,
      name: "index_product_options_on_product_and_lower_name"
  end
end
