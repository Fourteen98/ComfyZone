# Setting what an item cost, for stock that didn't arrive through a purchase.
# See CostCorrection for why this exists.
class Stock::CostsController < InertiaController
  require_permission "stock.adjust"
  require_permission "costs.view" # you can't set a number you may not see

  # PATCH /stock/:stock_id/cost
  def update
    variant = Variant.find(params.expect(:stock_id))
    correction = CostCorrection.new(variant: variant, cost: params[:cost],
      whole_product: ActiveModel::Type::Boolean.new.cast(params[:whole_product]))

    if correction.save
      others = correction.changed - 1
      also = others.positive? ? " Also set for #{others} other #{'option'.pluralize(others)} of this product." : ""
      redirect_to stock_path(variant), notice: "Cost saved.#{also}"
    else
      redirect_to stock_path(variant), inertia: { errors: correction.errors }
    end
  end
end
