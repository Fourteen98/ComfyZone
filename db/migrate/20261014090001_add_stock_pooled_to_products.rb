# Some products' counts by size and colour drift ("we have 23 Amazon pants,
# but which sizes?"), while the TOTAL is right. products.stock_pooled lets
# such a product be counted as one number and still be sold by size and
# colour: any size can be sold while the total is above zero.
#
# The ledger still keeps stock per variant (see StockLedger.sell!), so stock
# value, profit and every report keep working unchanged.
class AddStockPooledToProducts < ActiveRecord::Migration[8.1]
  def change
    add_column :products, :stock_pooled, :boolean, null: false, default: false
  end
end
