class AddStockToVariants < ActiveRecord::Migration[8.1]
  def change
    # How many are on hand right now. This is a CACHE: the truth is the sum
    # of the variant's stock_movements (next migration). It is kept here too
    # so lists and the live-sale screen can read it instantly without adding
    # up history. Only StockLedger may change it.
    add_column :variants, :stock_on_hand, :integer, null: false, default: 0

    # What one unit cost on average, including its share of transport and
    # fees. Updated every time stock arrives (a "moving average").
    add_column :variants, :average_cost_pesewas, :integer, null: false, default: 0

    # false = retired. Once a variant has purchases or stock history it can
    # no longer be deleted when its size or colour is unticked, so it is
    # switched off instead.
    add_column :variants, :active, :boolean, null: false, default: true

    # NOT NULL with a default needs no backfill: existing rows get the default.
  end
end
