# A delivered order coming back from the buyer, in whole or in part.
class Orders::ReturnsController < InertiaController
  require_permission "orders.refund"

  # POST /orders/:order_id/return
  #   { restock: true }                             everything
  #   { restock: true, items: { "41": 1, "42": 0 } } only one of line 41
  def create
    order = Order.find(params.expect(:order_id))
    # Params arrive as text or JSON; cast to a real true/false.
    restock = ActiveModel::Type::Boolean.new.cast(params[:restock])
    # { "41" => "1" } -> { 41 => 1 }. to_unsafe_h is fine here: the keys
    # are only ever used to look up this order's own items, as numbers.
    quantities = params[:items]&.to_unsafe_h&.to_h { |id, count| [ id.to_i, count.to_i ] }

    order.return_items!(by: Current.user, restock: restock, quantities: quantities)

    notice = order.returned? ? "Order returned." : "Return recorded. The order now covers what they kept."
    notice += restock ? " The items are back in stock." : " Stock was left as it is."
    notice += " There is money to give back." if order.balance_pesewas.negative?
    redirect_to order_path(order), notice: notice
  rescue Order::WrongStage => problem
    redirect_to order_path(order), alert: problem.message
  end
end
