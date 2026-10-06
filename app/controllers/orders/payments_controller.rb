# Recording money received for an order.
class Orders::PaymentsController < InertiaController
  require_permission "orders.fulfil"

  # POST /orders/:order_id/payments
  def create
    order = Order.find(params.expect(:order_id))
    payment = order.record_payment!(**payment_params.to_h.symbolize_keys, by: Current.user)

    left = order.balance_pesewas
    notice = "GH₵ #{Pesewas.to_input(payment.amount_pesewas)} received. "
    notice += left.positive? ? "GH₵ #{Pesewas.to_input(left)} still to pay." : "Paid in full."
    redirect_to order_path(order), notice: notice
  rescue ActiveRecord::RecordInvalid => problem
    # The model raised, carrying the payment. Its errors go back to the form.
    redirect_to order_path(order), inertia: { errors: problem.record.errors }
  rescue Order::WrongStage => problem
    redirect_to order_path(order), alert: problem.message
  end

  private
    def payment_params
      params.expect(payment: [ :amount, :via, :reference ])
    end
end
