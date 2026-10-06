# A delivered order coming back from the buyer.
class Orders::ReturnsController < InertiaController
  require_permission "orders.refund"

  # POST /orders/:order_id/return   { restock: true | false }
  def create
    order = Order.find(params.expect(:order_id))
    # Params arrive as text or JSON; cast to a real true/false.
    restock = ActiveModel::Type::Boolean.new.cast(params[:restock])

    order.return!(by: Current.user, restock: restock)
    notice = restock ? "Order returned. Its items are back in stock." : "Order returned. Stock was left as it is."
    redirect_to order_path(order), notice: notice
  rescue Order::WrongStage => problem
    redirect_to order_path(order), alert: problem.message
  end
end
