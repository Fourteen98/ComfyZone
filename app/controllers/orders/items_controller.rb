# Taking one line off an order ("she changed her mind about the scarf").
class Orders::ItemsController < InertiaController
  require_permission "orders.create"

  # DELETE /orders/:order_id/items/:id
  def destroy
    order = Order.find(params.expect(:order_id))
    item = order.items.find(params.expect(:id)) # through the order, so it must belong to it
    name = item.variant.full_name

    order.remove_item!(item, by: Current.user)
    redirect_back_or_to order_path(order), notice: "Removed #{name}. It is back in stock.", status: :see_other
  rescue Order::WrongStage => problem
    redirect_back_or_to order_path(order), alert: problem.message, status: :see_other
  end
end
