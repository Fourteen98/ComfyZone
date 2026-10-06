# Moving an order along: packed, delivered, or one step back.
#
# `resource :stage` (singular) in the routes: an order has exactly one
# stage, so the URL needs no id of its own. PATCH /orders/7/stage
class Orders::StagesController < InertiaController
  require_permission "orders.fulfil"

  # PATCH /orders/:order_id/stage   { to: "packed" | "delivered" | "back" }
  def update
    order = Order.find(params.expect(:order_id))

    notice =
      case params[:to]
      when "packed"    then order.pack!      && "Packed. Ready to go out."
      when "delivered" then order.deliver!   && "Delivered."
      when "back"      then order.step_back! && "Moved back one step."
      else raise Order::WrongStage, "That isn't a stage an order can move to."
      end

    redirect_back_or_to order_path(order), notice: notice
  rescue Order::WrongStage => problem
    redirect_back_or_to order_path(order), alert: problem.message
  end
end
