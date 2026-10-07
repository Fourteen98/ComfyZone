# Placing an order from the shop: the checkout form, as an object.
#
#   checkout = ShopOrder.new(cart: cart, name: "Ama", phone: "024 222 3333",
#                            delivery_method: "delivery", where: { country:, region:, place: },
#                            address: "Near the mosque", note: "")
#   if checkout.save
#     checkout.order     # in the back office now, "To be paid", stock taken
#   else
#     checkout.errors
#   end
#
# It does very little itself. The real work (taking stock under a lock,
# refusing if something sold out, one transaction) is OrderTaker, the same
# class the live screen uses. A web order is just another sale, with no
# member of staff attached and the "Website" channel.
#
# Everything here is typed by a stranger, so it is stricter than the
# back-office forms: name and phone are required, and nothing a shopper
# types can change an EXISTING customer's details or add to her list of
# places.
class ShopOrder
  include ActiveModel::Model

  attr_accessor :cart, :name, :phone, :delivery_method, :where, :address, :note
  attr_reader :order

  validates :name, presence: { message: "is needed, so we know who to ask for" }, length: { maximum: 60 }
  validates :phone, presence: { message: "is needed, so we can reach you about your order" }
  validates :delivery_method, inclusion: { in: %w[ pickup delivery ], message: "is needed. Will you collect it, or should we send it?" }
  validates :address, length: { maximum: 300 }
  validates :note, length: { maximum: 300 }
  validate :cart_has_something
  validate :delivery_has_somewhere

  def save
    return false unless valid?

    taker = OrderTaker.new(
      customer: customer,
      user: nil,                       # nobody on staff recorded this
      sales_channel: SalesChannel.web,
      shop: true,                      # only listed products can be bought
      note: note.to_s.squish,
      lines: cart.to_order_lines,
      delivery: {
        delivery_method: delivery_method,
        fee: "",                       # blank = the place's usual fee, if she has set one
        address: full_address,
        area: (place if delivery_method == "delivery")
      }
    )

    if taker.save
      @order = taker.order
      cart.clear
      true
    else
      taker.errors.each { |error| errors.add(error.attribute, error.message) }
      false
    end
  end

  private
    # The same phone number is the same person (see Customer.for_sale). A
    # returning customer keeps the details she already has for them; only
    # blanks are filled. A new one is created from what was typed.
    def customer
      @customer ||= Customer.for_sale(name: name.to_s.squish, phone: phone).tap do |found|
        found.locate(**location, add_place: false) if found.new_record? && location
      end
    end

    def location
      return unless where.respond_to?(:to_h)

      { country: nil, region: nil, place: nil }.merge(where.to_h.symbolize_keys.slice(:country, :region, :place))
    end

    # The known place they picked, if it is one she already has.
    def place
      return unless location

      DeliveryArea.locate(country: location[:country].presence || Country::HOME, region: location[:region], name: location[:place], add: false)
    end

    # A town she doesn't have on her list isn't added to it (see above), so
    # it is kept in the address text instead, where she will read it.
    def full_address
      return address unless delivery_method == "delivery" && location

      typed = location[:place].to_s.squish
      extra = [ (typed unless place || typed.empty?), location[:region].presence, (location[:country] unless Country.home?(location[:country].presence || Country::HOME)) ]
      [ address.to_s.strip.presence, *extra ].compact.join(", ")
    end

    def cart_has_something
      if cart.empty?
        errors.add(:items, "Your bag is empty")
      elsif (short = cart.lines.find(&:short?))
        left = short.available
        errors.add(:items, left.zero? ? "#{short.variant.full_name} has just sold out. Take it out of your bag to carry on." :
                                        "Only #{left} left of #{short.variant.full_name}. Change the number in your bag to carry on.")
      end
    end

    def delivery_has_somewhere
      return unless delivery_method == "delivery"

      errors.add(:address, "is needed, so the rider can find you") if address.to_s.strip.empty?
      home = Country.home?(location&.dig(:country).presence || Country::HOME)
      errors.add(:region, "is needed. Which region are you in?") if home && !Region.known?(location&.dig(:region))
    end
end
