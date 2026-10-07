class AddRegionsToLocations < ActiveRecord::Migration[8.1]
  def change
    # A location is now two levels:
    #
    #   region   one of Ghana's 16 regions. A fixed list, kept in code
    #            (app/models/region.rb): it changes about once a generation.
    #   place    the exact area or town: "East Legon", "Adum". These are the
    #            delivery_areas rows, and the list grows by itself: typing a
    #            place that isn't there yet adds it.
    #
    # Old places have no region yet (NULL). They keep working, and ask for
    # one the next time they are edited.
    add_column :delivery_areas, :region, :string
    add_index :delivery_areas, :region

    # A place name only has to be unique within its region: there is a
    # Nkwanta in more than one. So the old "unique everywhere" index goes,
    # and one on the pair replaces it.
    remove_index :delivery_areas, name: "index_delivery_areas_on_lower_name", column: "lower(name)", unique: true
    add_index :delivery_areas, "region, lower(name)", unique: true, name: "index_delivery_areas_on_region_and_lower_name"

    # Places are now listed by region and name, so the hand-set order goes.
    remove_column :delivery_areas, :position, :integer, null: false, default: 0

    # A customer's region is stored on the customer as well, because she
    # may know "Ashanti" without knowing the exact place. When a place IS
    # set, the model keeps this equal to the place's region.
    add_column :customers, :region, :string
    add_index :customers, :region
  end
end
