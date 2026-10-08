# Correcting stock by hand: a recount, damage, loss, items found.
class Stock::AdjustmentsController < InertiaController
  require_permission "stock.adjust"

  # POST /stock/:stock_id/adjustments
  def create
    variant = Variant.find(params.expect(:stock_id))
    adjustment = StockAdjustment.new(adjustment_params.merge(variant: variant, user: Current.user))

    # From the stock list's quick form, go back to the list as it was
    # (same search, same tab); otherwise to the item's own page.
    back = params[:back] == "list" ? stock_index_path(q: params[:q].presence, show: params[:show].presence) : stock_path(variant)

    if adjustment.save
      redirect_to back, notice: "Stock updated. #{variant.full_name} now shows #{variant.reload.stock_on_hand}."
    else
      redirect_to back, inertia: { errors: adjustment.errors.to_hash.merge(adjusting: [ variant.id.to_s ]) }
    end
  end

  private
    def adjustment_params
      params.expect(adjustment: [ :reason, :quantity, :note ])
    end
end
