# Bulk buyers pay less. One rule, used everywhere a price is worked out: the
# live screen, a recorded sale, editing an order, the website's cart and
# checkout.
#
# A product with a bulk price (say GH₵ 100 from 6 pieces, normally GH₵ 120)
# sells at that price on an order when:
#   - the order has 6 or more of THAT PRODUCT, in any sizes and colours, or
#   - the buyer is marked as a bulk buyer (then the count doesn't matter).
# On the website only if she ticked "offer the bulk price on the website".
#
# The bulk price never RAISES a price: a size already priced below it keeps
# its own price.
module BulkPricing
  module_function

  # Is the bulk price on, for this product, with this many pieces of it?
  def applies?(product, pieces:, bulk_buyer: false, shop: false)
    return false unless product.bulk?
    return true if bulk_buyer
    return false if shop && !product.bulk_on_shop?

    pieces >= product.bulk_min_quantity
  end

  # The price of one piece of this variant, at the normal or the bulk price.
  def unit_price(variant, bulk:)
    normal = variant.selling_price_pesewas
    bulk && variant.product.bulk? ? [ normal, variant.product.bulk_price_pesewas ].min : normal
  end

  # Brings every line of an order to the right price, normal or bulk. Called
  # after the lines change, so a 6th dress claimed later in the live also
  # drops the first 5 to the bulk price (and taking one off raises them back).
  #
  # A price she typed by hand (a special deal agreed with the buyer) is
  # neither the normal nor the bulk price, and is left alone.
  def apply!(order, shop: false)
    items = order.items.includes(variant: :product).to_a
    pieces = items.group_by { |item| item.variant.product_id }.transform_values { |lines| lines.sum(&:kept) }
    bulk_buyer = order.customer&.bulk_buyer?

    items.each do |item|
      normal = unit_price(item.variant, bulk: false)
      bulk = unit_price(item.variant, bulk: true)
      unless [ normal, bulk ].include?(item.unit_price_pesewas)
        # Typed by hand: her price stands, and it isn't "the bulk price".
        item.update!(bulk: false) if item.bulk
        next
      end

      on = bulk < normal && applies?(item.variant.product, pieces: pieces[item.variant.product_id], bulk_buyer: bulk_buyer, shop: shop)
      price = on ? bulk : normal
      item.update!(unit_price_pesewas: price, bulk: on) if item.unit_price_pesewas != price || item.bulk != on
    end
  end
end
