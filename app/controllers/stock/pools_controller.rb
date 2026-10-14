# Counting a product as one total (StockPool), or by size again.
#
#   PATCH  /stock/pool/:product_id   { total: 23 }   count as one total / change it
#   DELETE /stock/pool/:product_id                   back to counting by size
class Stock::PoolsController < InertiaController
  require_permission "stock.adjust"

  def update
    product = Product.find(params.expect(:product_id))
    StockPool.pool!(product: product, total: params[:total], user: Current.user)
    redirect_back_or_to stock_index_path, notice: "#{product.name}: #{product.reload.pooled_total} in stock, counted as one total."
  rescue ArgumentError => problem
    redirect_back_or_to stock_index_path, alert: problem.message
  end

  def destroy
    product = Product.find(params.expect(:product_id))
    StockPool.unpool!(product: product)
    redirect_to new_stock_count_path, notice: "#{product.name} is counted by size again. Count each size now, so the numbers are right."
  end
end
