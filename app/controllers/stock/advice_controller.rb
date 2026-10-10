# GET /admin/stock/advice?days=60&cover=4   "What to buy next" (RestockAdvisor)
class Stock::AdviceController < InertiaController
  require_permission "stock.view"

  def show
    advisor = RestockAdvisor.new(days: params[:days] || 60, cover_weeks: params[:cover] || 4)
    costs = can?("costs.view")

    render inertia: "Stock/Advice", props: {
      days: advisor.days,
      cover: advisor.cover_weeks,
      windows: RestockAdvisor::WINDOWS,
      covers: RestockAdvisor::COVERS,
      sees_costs: costs,
      buy: advisor.buy.map { |row| row_props(row, costs).merge(suggest: row.suggest, estimate_pesewas: costs ? row.estimate_pesewas : nil) },
      slow: advisor.slow.first(50).map { |row| row_props(row, costs).merge(tied_pesewas: costs ? row.tied_pesewas : nil) },
      slow_total_pesewas: costs ? advisor.slow.sum(&:tied_pesewas) : nil,
      best_options: advisor.best_options.map { |option, labels|
        { option: option, labels: labels.first(8).map { |label, units| { label: label, units: units } } }
      }
    }
  end

  private
    def row_props(row, costs)
      variant = row.variant
      {
        variant_id: variant.id,
        product_id: variant.product_id,
        product: variant.product.name,
        variant: variant.name,
        option_values: variant.option_values,
        sold: row.sold,
        per_week: row.per_week,
        on_hand: row.on_hand,
        weeks_left: row.weeks_left,
        waiting: row.waiting,
        unit_cost_pesewas: costs ? variant.average_cost_pesewas : nil
      }
    end
end
