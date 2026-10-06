class CreateVariants < ActiveRecord::Migration[8.1]
  def change
    # A variant is one sellable combination: "M / Black".
    # RULE: every product has at least one variant. A product with no options
    # gets a single "Default" variant. Stock, purchases and sales will always
    # point at a variant, so there is only ever one code path.
    create_table :variants do |t|
      t.references :product, null: false, foreign_key: true

      t.string :name, null: false # "M / Black", ready to display

      # The choices that make up this variant, in option order:
      #   [{"name":"Size","label":"M"},{"name":"Colour","label":"Black","swatch":"#1a1a1a"}]
      t.jsonb :option_values, null: false, default: []

      # The same choices boiled down to one comparable string
      # ("colour=black|size=m"). Used to recognise a variant that already
      # exists when the product's options are edited, so its price (and later
      # its stock) is kept.
      t.string :combination_key, null: false, default: ""

      t.string :sku, null: false # a short unique code, e.g. CZ-0012-03

      # NULL means "use the product's price". A number overrides it, so a
      # 3XL can cost more than an M.
      t.integer :price_pesewas

      t.integer :position, null: false, default: 1
      t.timestamps
    end

    add_index :variants, :sku, unique: true
    # The database itself guarantees a product never has the same
    # combination twice.
    add_index :variants, %i[ product_id combination_key ], unique: true
  end
end
