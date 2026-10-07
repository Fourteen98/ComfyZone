# Checkout: who you are, how you want it, place the order.
class Shop::CheckoutController < Shop::BaseController
  include LocationPicker

  # A public form that takes stock when submitted. Without a limit, a script
  # could empty the shelves with fake orders in seconds. Five orders in ten
  # minutes from one address is plenty for a person.
  rate_limit to: 5, within: 10.minutes, only: :create,
    with: -> { redirect_to shop_checkout_path, alert: "Too many orders from this connection. Please try again in a few minutes." }

  # GET /checkout
  def show
    return redirect_to shop_cart_path if cart.empty?

    render inertia: "Shop/Checkout", props: {
      cart: cart_props,
      locations: public_locations,
      pay_online: false # Paystack: the next step
    }
  end

  # POST /checkout
  def create
    form = params.fetch(:checkout, {}).permit(:name, :phone, :delivery_method, :address, :note, where: %i[ country region place ])
    checkout = ShopOrder.new(cart: cart, **form.to_h.symbolize_keys)

    if checkout.save
      # The order page is found by its secret token, not its id.
      redirect_to shop_order_path(checkout.order.public_token), notice: "Thank you. Your order is in."
    else
      # A line that sold out is fixed in the bag, not on this form.
      back = checkout.errors.key?(:items) ? shop_cart_path : shop_checkout_path
      redirect_to back, inertia: { errors: checkout.errors.to_hash }, alert: checkout.errors[:items].first
    end
  end

  private
    # The same picker the back office uses, minus anything private. Places
    # are sent with their usual fee so the page can say "Delivery to Adum is
    # usually GH₵ 20" before they order.
    def public_locations
      location_options
    end
end
