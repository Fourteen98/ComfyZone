# Parent of every public shop page. Three things make these different from
# the back office:
#
#   1. No login. `allow_unauthenticated_access` skips the "send them to the
#      login page" check that every other controller inherits.
#   2. There is a cart, kept in the session (see Cart).
#   3. Nothing private may ever be sent: no costs, no stock counts beyond
#      "only a few left", no other customers. Each controller here builds
#      its props by hand for that reason, never by reusing a back-office one.
class Shop::BaseController < InertiaController
  allow_unauthenticated_access
  # If a member of staff happens to be logged in, notice (it adds a "Back
  # office" link). resume_session returns nil for everyone else, no redirect.
  before_action :resume_session

  # Shared with every shop page, for the header.
  inertia_share do
    { shop: { cart_count: cart.count, staff: Current.user.present? } }
  end

  private
    def cart
      @cart ||= Cart.new(session)
    end

    # One line of the cart, as the pages show it.
    def line_props(line)
      variant = line.variant
      photo = variant.product.photos.first

      {
        variant_id: variant.id,
        product: variant.product.name,
        path: shop_product_path(variant.product.shop_param),
        option_values: variant.option_values,
        thumb_url: photo && rails_representation_path(photo.image.variant(:thumb)),
        quantity: line.quantity,
        available: [ line.available, Cart::MAX_EACH ].min, # the stepper's ceiling, not her real count
        short: line.short?,
        unit_price_pesewas: line.unit_price_pesewas,
        # Set when the bulk price is on: the normal price, to show crossed out.
        was_pesewas: line.unit_price_pesewas < line.normal_price_pesewas ? line.normal_price_pesewas : nil,
        total_pesewas: line.total_pesewas
      }
    end

    def cart_props
      { lines: cart.lines.map { |line| line_props(line) }, total_pesewas: cart.total_pesewas }
    end
end
