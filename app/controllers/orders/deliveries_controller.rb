# How an order reaches the buyer, and what that costs them.
class Orders::DeliveriesController < InertiaController
  require_permission "orders.create"

  # PATCH /orders/:order_id/delivery
  def update
    order = Order.find(params.expect(:order_id))
    details = params.expect(delivery: [ :delivery_method, :fee, :address, :area_id ])

    order.set_delivery!(delivery_method: details[:delivery_method], fee: details[:fee], address: details[:address],
                        area: DeliveryArea.active.find_by(id: details[:area_id]))
    redirect_to order_path(order), notice: "Delivery details saved."
  rescue ActiveRecord::RecordInvalid => problem
    redirect_to order_path(order), inertia: { errors: problem.record.errors }
  rescue Order::WrongStage => problem
    redirect_to order_path(order), alert: problem.message
  end
end
