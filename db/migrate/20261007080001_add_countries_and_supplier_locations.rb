class AddCountriesAndSupplierLocations < ActiveRecord::Migration[8.1]
  def up
    # --- Country, above region ------------------------------------------
    # Suppliers can be abroad (China, Türkiye), and so can buyers. The list
    # of countries is a constant (app/models/country.rb).
    add_column :delivery_areas, :country, :string
    add_column :customers, :country, :string
    add_index :customers, :country

    # Everything located so far has a Ghanaian region, so it is in Ghana.
    # That much is certain; rows with no region stay "not recorded".
    execute "UPDATE delivery_areas SET country = 'Ghana' WHERE region IS NOT NULL"
    execute "UPDATE customers SET country = 'Ghana' WHERE region IS NOT NULL"

    # A place abroad has no region, so the uniqueness rule has to cope with
    # region being NULL. In SQL, NULL never equals NULL, so a plain unique
    # index would happily allow "Guangzhou, China" twice. COALESCE turns the
    # NULL into '' for the purposes of the index only.
    remove_index :delivery_areas, name: "index_delivery_areas_on_region_and_lower_name"
    add_index :delivery_areas, "country, COALESCE(region, ''), lower(name)", unique: true, name: "index_delivery_areas_on_country_region_and_lower_name"

    # --- Suppliers get a location too ------------------------------------
    add_column :suppliers, :country, :string
    add_column :suppliers, :region, :string
    add_reference :suppliers, :delivery_area, null: true, foreign_key: { on_delete: :nullify }
    add_column :suppliers, :location, :string # market, street, shop number
  end

  def down
    remove_column :suppliers, :location
    remove_reference :suppliers, :delivery_area, foreign_key: true
    remove_columns :suppliers, :region, :country

    remove_index :delivery_areas, name: "index_delivery_areas_on_country_region_and_lower_name"
    # Places abroad can't exist under the old rules.
    execute "DELETE FROM delivery_areas WHERE region IS NULL AND country IS NOT NULL"
    add_index :delivery_areas, "region, lower(name)", unique: true, name: "index_delivery_areas_on_region_and_lower_name"

    remove_column :customers, :country
    remove_column :delivery_areas, :country
  end
end
