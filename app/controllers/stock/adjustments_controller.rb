# Correcting stock by hand: a recount, damage, loss, items found.
class Stock::AdjustmentsController < InertiaController
  require_permission "stock.adjust"

  # POST /stock/:stock_id/adjustments
  def create
    variant = Variant.find(params.expect(:stock_id))
    adjustment = StockAdjustment.new(adjustment_params.merge(variant: variant, user: Current.user))

    if adjustment.save
      redirect_to stock_path(variant), notice: "Stock updated. #{variant.full_name} now shows #{variant.reload.stock_on_hand}."
    else
      redirect_to stock_path(variant), inertia: { errors: adjustment.errors }
    end
  end

  private
    def adjustment_params
      params.expect(adjustment: [ :reason, :quantity, :note ])
    end
end
