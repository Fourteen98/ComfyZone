# The shopper's view of one order: the confirmation page, and where it has
# got to if they come back to the link later.
class Shop::OrdersController < Shop::BaseController
  # GET /order/:token
  def show
    order = Order.includes(items: { variant: { product: { photos: { image_attachment: :blob } } } }).find_by!(public_token: params[:token])

    render inertia: "Shop/Order", props: {
      order: {
        number: order.id,
        placed: order.created_at.strftime("%-d %B %Y, %-l:%M %P"),
        status: order.status,
        name: order.customer.name,
        delivery_method: order.delivery_method,
        delivery_address: order.delivery_address,
        delivery_fee_pesewas: order.delivery_fee_pesewas,
        # She hasn't set a usual fee for where they are: tell them she will confirm it.
        fee_to_confirm: order.delivery_method_delivery? && order.delivery_fee_pesewas.zero?,
        total_pesewas: order.total_pesewas,
        due_pesewas: order.due_pesewas,
        paid_pesewas: order.paid_pesewas,
        balance_pesewas: order.balance_pesewas,
        items: order.items.sort_by(&:id).map { |item|
          photo = item.variant.product.photos.first
          { name: item.variant.product.name, option_values: item.variant.option_values, quantity: item.kept,
            total_pesewas: item.kept * item.unit_price_pesewas,
            thumb_url: photo && rails_representation_path(photo.image.variant(:thumb)) }
        }
      }
    }
  end
end
