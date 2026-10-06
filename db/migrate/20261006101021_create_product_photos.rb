class CreateProductPhotos < ActiveRecord::Migration[8.1]
  def change
    # One row per photo of a product. The image file itself is NOT in this
    # table: Active Storage keeps files on disk (or in cloud storage) and
    # tracks them in its own tables, created by the migration just before
    # this one. This table adds what Active Storage lacks: an order.
    #
    # position 1 is the cover photo, shown in lists.
    create_table :product_photos do |t|
      t.references :product, null: false, foreign_key: true
      t.integer :position, null: false, default: 1

      t.timestamps
    end

    add_index :product_photos, %i[ product_id position ]
  end
end
