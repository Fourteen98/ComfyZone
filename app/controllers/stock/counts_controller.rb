# A stock take: count the shelves and correct many items on one screen.
class Stock::CountsController < InertiaController
  require_permission "stock.adjust"

  # GET /stock/count
  def new
    variants = Variant.active.joins(:product).merge(Product.active)
      .includes(:product).order(Arel.sql("lower(products.name), variants.position"))

    render inertia: "Stock/Count", props: {
      # Grouped by product, so the page reads like walking along a shelf.
      products: variants.group_by(&:product).map { |product, list|
        {
          id: product.id,
          name: product.name,
          variants: list.map { |variant|
            { id: variant.id, name: variant.name, option_values: variant.option_values, stock: variant.stock_on_hand }
          }
        }
      }
    }
  end

  # POST /stock/count   { counts: { "12" => "7", "13" => "" } }
  def create
    take = StockTake.new(user: Current.user, counts: params.fetch(:counts, {}).to_unsafe_h)

    if take.save
      notice = take.changed.zero? ? "Everything already matched. Nothing changed." : "Stock take saved. #{take.changed} #{'item'.pluralize(take.changed)} corrected."
      redirect_to stock_index_path, notice: notice
    else
      redirect_to new_stock_count_path, inertia: { errors: take.errors }
    end
  end
end
