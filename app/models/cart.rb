# A shopper's basket.
#
# Not a database table. It lives in the session cookie, which Rails signs
# and encrypts, as a small hash:  { "12" => 2, "15" => 1 }  (variant id =>
# how many). That is enough for a guest: no account, nothing to clean up,
# and it follows them around the site.
#
#   cart = Cart.new(session)
#   cart.add(12, 2)
#   cart.lines        # => [#<Cart::Line variant=..., quantity=2, ...>]
#   cart.total_pesewas
#
# The cart holds NO stock. Stock is only taken when the order is placed
# (OrderTaker), so an abandoned basket never locks anything away.
class Cart
  MAX_LINES = 30  # a cookie is small (4 KB); this keeps it far inside that
  MAX_EACH = 20   # more than this of one thing is a wholesale chat, not a basket

  # bulk: this product's bulk price is on (enough of it in the basket, and
  # she offers it on the website). See BulkPricing.
  Line = Data.define(:variant, :quantity, :available, :bulk) do
    def unit_price_pesewas = BulkPricing.unit_price(variant, bulk: bulk)
    def normal_price_pesewas = variant.selling_price_pesewas
    def total_pesewas = unit_price_pesewas * quantity
    # She has fewer than they asked for (it sold since they added it).
    def short? = quantity > available
  end

  def initialize(session)
    @items = (session[:cart] ||= {})
  end

  def add(variant_id, quantity = 1)
    set(variant_id, @items[variant_id.to_s].to_i + quantity.to_i)
  end

  # quantity 0 (or less) removes the line.
  def set(variant_id, quantity)
    key = variant_id.to_s
    quantity = quantity.to_i.clamp(0, MAX_EACH)

    if quantity.zero?
      @items.delete(key)
    elsif @items.key?(key) || @items.size < MAX_LINES
      @items[key] = quantity
    end
  end

  def remove(variant_id) = @items.delete(variant_id.to_s)
  def clear = @items.clear
  def empty? = lines.empty?
  def count = @items.values.sum(&:to_i)

  # The basket as real records. Anything that can no longer be bought (the
  # product was taken off the shop, the size retired) silently drops out,
  # here AND from the cookie.
  def lines
    @lines ||= begin
      variants = Variant.active.joins(:product).merge(Product.on_shop)
        .where(id: @items.keys).includes(product: { photos: { image_attachment: :blob } }).index_by { |variant| variant.id.to_s }
      @items.select! { |id, _| variants.key?(id) }

      # How many of each PRODUCT (any size or colour) are in the basket.
      pieces = Hash.new(0)
      @items.each { |id, quantity| pieces[variants[id].product_id] += quantity.to_i }

      @items.map { |id, quantity|
        variant = variants[id]
        bulk = BulkPricing.applies?(variant.product, pieces: pieces[variant.product_id], shop: true)
        Line.new(variant: variant, quantity: quantity.to_i, available: [ variant.stock_on_hand, 0 ].max, bulk: bulk)
      }
    end
  end

  def total_pesewas = lines.sum(&:total_pesewas)

  # For OrderTaker.
  def to_order_lines
    lines.map { |line| { variant_id: line.variant.id, quantity: line.quantity } }
  end
end
