# Resetting stock ("set these 12 to 0", or a full reset) writes one recount
# movement per item. stock_movements.batch ties those movements together, so
# the whole reset can be shown as one thing ("Reset 12 items at 14:02") and
# undone as one thing (see StockReset). Ordinary movements leave it empty.
class AddBatchToStockMovements < ActiveRecord::Migration[8.1]
  def change
    add_column :stock_movements, :batch, :string
    add_index :stock_movements, :batch
  end
end
