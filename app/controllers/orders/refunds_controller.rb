# Giving money back to a buyer. A separate controller from payments because
# it needs a different permission: taking money and handing it back are not
# the same level of trust.
class Orders::RefundsController < InertiaController
  require_permission "orders.refund"

  # POST /orders/:order_id/refunds
  def create
    order = Order.find(params.expect(:order_id))
    order.refund!(**refund_params.to_h.symbolize_keys, by: Current.user)
    redirect_to order_path(order), notice: "Refund recorded."
  rescue ActiveRecord::RecordInvalid => problem
    redirect_to order_path(order), inertia: { errors: problem.record.errors }
  end

  private
    def refund_params
      params.expect(refund: [ :amount, :via, :note ])
    end
end
