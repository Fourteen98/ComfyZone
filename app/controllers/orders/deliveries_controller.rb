# How an order reaches the buyer, and what that costs them.
class Orders::DeliveriesController < InertiaController
  require_permission "orders.create"

  # PATCH /orders/:order_id/delivery
  def update
    order = Order.find(params.expect(:order_id))
    details = params.expect(delivery: [ :delivery_method, :fee, :address, :country, :region, :place ])

    order.set_delivery!(delivery_method: details[:delivery_method], fee: details[:fee], address: details[:address],
                        area: DeliveryArea.locate(country: details[:country].presence || Country::HOME, region: details[:region], name: details[:place]))
    redirect_to order_path(order), notice: "Delivery details saved."
  rescue ActiveRecord::RecordInvalid => problem
    redirect_to order_path(order), inertia: { errors: problem.record.errors }
  rescue Order::WrongStage => problem
    redirect_to order_path(order), alert: problem.message
  end
end
