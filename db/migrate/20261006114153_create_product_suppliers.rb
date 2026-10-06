# Which suppliers sell which products.
#
# One supplier sells many products, and one product may be bought from
# several suppliers. That is a many-to-many relationship, and a relational
# database stores it as a third table with one row per pairing:
#
#   suppliers            product_suppliers             products
#   ---------            -----------------             --------
#   Kumasi Fabrics  <--  supplier 1, product 4   -->   Ankara wrap dress
#                   <--  supplier 1, product 7   -->   Kaftan maxi
#   Makola Traders  <--  supplier 2, product 4   -->   Ankara wrap dress
class CreateProductSuppliers < ActiveRecord::Migration[8.1]
  def up
    create_table :product_suppliers do |t|
      # Cascade both ways: if either side is deleted, the pairing is
      # meaningless and should go too. (Nothing else is deleted.)
      t.references :supplier, null: false, foreign_key: { on_delete: :cascade }
      t.references :product, null: false, foreign_key: { on_delete: :cascade }

      t.timestamps
    end

    # A pairing exists once or not at all.
    add_index :product_suppliers, %i[ supplier_id product_id ], unique: true

    # Backfill from history: every product she has already bought from a
    # supplier is, evidently, something that supplier sells.
    # INSERT ... SELECT copies the result of a query straight into a table,
    # in one statement, without loading anything into Ruby.
    execute <<~SQL
      INSERT INTO product_suppliers (supplier_id, product_id, created_at, updated_at)
      SELECT DISTINCT purchases.supplier_id, variants.product_id, NOW(), NOW()
      FROM purchase_items
      JOIN purchases ON purchases.id = purchase_items.purchase_id
      JOIN variants  ON variants.id  = purchase_items.variant_id
      WHERE purchases.supplier_id IS NOT NULL
    SQL
  end

  def down
    drop_table :product_suppliers
  end
end
