# The basket page, and the three things you can do to it.
class Shop::CartController < Shop::BaseController
  # GET /cart
  def show
    render inertia: "Shop/Cart", props: { cart: cart_props }
  end

  # POST /cart/items   { variant_id:, quantity: }
  def add
    variant = Variant.active.joins(:product).merge(Product.on_shop).find_by(id: params[:variant_id])

    if variant.nil? || variant.stock_on_hand <= 0
      redirect_back_or_to root_path, alert: "Sorry, that one has just sold out."
    else
      cart.add(variant.id, params[:quantity].presence || 1)
      redirect_back_or_to shop_cart_path, notice: "Added to your bag."
    end
  end

  # PATCH /cart/items/:variant_id   { quantity: }
  def change
    cart.set(params[:variant_id], params[:quantity])
    redirect_to shop_cart_path
  end

  # DELETE /cart/items/:variant_id
  def remove
    cart.remove(params[:variant_id])
    redirect_to shop_cart_path, status: :see_other
  end
end
