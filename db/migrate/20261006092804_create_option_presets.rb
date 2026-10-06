class CreateOptionPresets < ActiveRecord::Migration[8.1]
  def change
    # A preset is a reusable, ordered list of choices for one product option,
    # e.g. name "Letter sizes", option_name "Size", values S, M, L, XL.
    create_table :option_presets do |t|
      t.string :name, null: false        # what she picks from: "Letter sizes"
      t.string :option_name, null: false # what it fills in on a product: "Size"

      # jsonb stores structured data in one column. Here: an ordered list like
      #   [{"label": "Black", "swatch": "#1a1a1a"}, {"label": "Red", "swatch": "#b3202a"}]
      # The order of the list IS the display order, which is why sizes come
      # out S, M, L, XL and not alphabetically.
      #
      # Why not a separate option_values table? The values are never looked
      # up on their own, only read and saved together with their preset, and
      # products COPY them instead of linking to them. One column is simpler.
      t.jsonb :values, null: false, default: []

      t.integer :position, null: false, default: 0 # order in lists
      t.timestamps
    end

    add_index :option_presets, "lower(name)", unique: true, name: "index_option_presets_on_lower_name"
  end
end
