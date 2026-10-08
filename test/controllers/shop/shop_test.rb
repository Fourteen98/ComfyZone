require "test_helper"

# The public shop, end to end: nobody is logged in for any of this.
class ShopTest < ActionDispatch::IntegrationTest
  setup do
    @dress = products(:dress)
    @black = variants(:dress_m_black)
    @red = variants(:dress_m_red)
    @dress.update!(listed: true)
    StockLedger.record!(variant: @black, quantity: 3, reason: "recount")
  end

  def checkout(**overrides)
    post shop_checkout_path, params: { checkout: { name: "Esi Mensah", phone: "055 111 2222", delivery_method: "pickup" }.merge(overrides) }
  end

  # ---------- browsing ----------

  test "the shop is open to everyone and shows only listed, active products" do
    products(:old_bag).update!(listed: true) # archived: listed doesn't matter
    get root_path
    assert_inertia_component "Shop/Home"
    assert_equal [ "Ankara wrap dress" ], inertia.props[:products].pluck("name")

    @dress.update!(listed: false)
    get root_path
    assert_empty inertia.props[:products]
  end

  test "a card and a product page never carry costs or exact stock" do
    @black.update!(average_cost_pesewas: 5000)
    StockLedger.record!(variant: @red, quantity: 50, reason: "recount")

    get root_path
    card = inertia.props[:products].first
    assert_equal [ 12_000, false ], card.values_at("price_from_pesewas", "sold_out")

    get shop_product_path(@dress.shop_param)
    assert_inertia_component "Shop/Product"
    json = inertia.props[:product].to_json
    assert_no_match(/cost|stock_on_hand|sku/, json)

    black = inertia.props[:product][:variants].find { |v| v["id"] == @black.id }
    red = inertia.props[:product][:variants].find { |v| v["id"] == @red.id }
    assert_equal [ "in_stock", 3, 3 ], black.values_at("availability", "max", "few_left")
    assert_equal [ Cart::MAX_EACH, nil ], red.values_at("max", "few_left"), "50 in stock shows as 'plenty', not as 50"
  end

  test "an unlisted product's page is a 404, like one that doesn't exist" do
    @dress.update!(listed: false)
    get shop_product_path(@dress.shop_param)
    assert_response :not_found
  end

  test "the back office still needs a login" do
    get products_path
    assert_redirected_to new_session_path
  end

  # ---------- the bag ----------

  test "adding, changing and removing lines" do
    post items_shop_cart_path, params: { variant_id: @black.id, quantity: 2 }
    get shop_cart_path
    assert_equal [ [ @black.id, 2, 24_000 ] ], inertia.props[:cart][:lines].map { |l| l.values_at("variant_id", "quantity", "total_pesewas") }
    assert_equal 2, inertia.props[:shop][:cart_count]

    patch item_shop_cart_path(@black.id), params: { quantity: 1 }
    get shop_cart_path
    assert_equal 12_000, inertia.props[:cart][:total_pesewas]

    delete item_shop_cart_path(@black.id)
    get shop_cart_path
    assert_empty inertia.props[:cart][:lines]
  end

  test "something sold out, or not on the shop, can't be added" do
    post items_shop_cart_path, params: { variant_id: @red.id } # 0 in stock
    post items_shop_cart_path, params: { variant_id: variants(:dress_l_red).id, quantity: 1 }
    get shop_cart_path
    assert_empty inertia.props[:cart][:lines]
  end

  test "a product taken off the shop drops out of bags it was in" do
    post items_shop_cart_path, params: { variant_id: @black.id }
    @dress.update!(listed: false)

    get shop_cart_path
    assert_empty inertia.props[:cart][:lines]
    get shop_checkout_path
    assert_redirected_to shop_cart_path
  end

  # ---------- checkout ----------

  test "placing an order takes the stock and lands in the back office as a web order" do
    post items_shop_cart_path, params: { variant_id: @black.id, quantity: 2 }

    assert_difference({ "Order.count" => 1, "Customer.count" => 1 }) { checkout }

    order = Order.last
    assert_redirected_to shop_order_path(order.public_token)
    assert_equal [ "claimed", nil, 24_000, "pickup" ], [ order.status, order.user, order.total_pesewas, order.delivery_method ]
    assert_equal "web", order.sales_channel.system_key
    assert_equal [ "Esi Mensah", "+233551112222" ], order.customer.then { |c| [ c.name, c.phone ] }
    assert_equal 1, @black.reload.stock_on_hand

    get shop_cart_path
    assert_empty inertia.props[:cart][:lines], "the bag is emptied"

    # Staff see it like any other order.
    sign_in_as(users(:one))
    get order_path(order)
    assert_equal "The shopper, on the website", inertia.props[:order][:recorded_by]
  end

  test "the order page is found by its token, never by its number" do
    post items_shop_cart_path, params: { variant_id: @black.id }
    checkout
    order = Order.last

    get shop_order_path(order.public_token)
    assert_inertia_component "Shop/Order"
    assert_equal [ order.id, "claimed", 12_000 ], inertia.props[:order].values_at("number", "status", "due_pesewas")

    get shop_order_path(order.id)
    assert_response :not_found
  end

  test "delivery to a place she has a fee for adds the fee; an unknown town is kept in the address, not added to her list" do
    post items_shop_cart_path, params: { variant_id: @black.id }
    checkout(delivery_method: "delivery", address: "House 4", where: { country: "Ghana", region: "Greater Accra", place: "osu" })
    order = Order.last
    assert_equal [ delivery_areas(:osu), 2000, 14_000 ], [ order.delivery_area, order.delivery_fee_pesewas, order.due_pesewas ]

    post items_shop_cart_path, params: { variant_id: @black.id }
    assert_no_difference "DeliveryArea.count" do
      checkout(phone: "055 999 0000", delivery_method: "delivery", address: "Near the market", where: { country: "Ghana", region: "Ashanti", place: "Somewhere New" })
    end
    order = Order.last
    assert_equal [ nil, 0, "Near the market, Somewhere New, Ashanti" ], [ order.delivery_area, order.delivery_fee_pesewas, order.delivery_address ]
    assert_equal "Ashanti", order.customer.region
  end

  test "a returning customer is matched by phone, and what she already has for them is not overwritten" do
    ama = customers(:ama)
    post items_shop_cart_path, params: { variant_id: @black.id }

    assert_no_difference "Customer.count" do
      checkout(name: "Someone Else", phone: "0242223333", delivery_method: "delivery", address: "x",
        where: { country: "Ghana", region: "Ashanti", place: "" })
    end

    assert_equal ama, Order.last.customer
    assert_equal [ "Ama Koranteng", nil ], ama.reload.then { |c| [ c.name, c.region ] }
  end

  test "name, phone and how they want it are required; delivery needs a region and an address" do
    post items_shop_cart_path, params: { variant_id: @black.id }

    assert_no_difference "Order.count" do
      checkout(name: "", phone: "", delivery_method: "")
      checkout(delivery_method: "delivery", address: "", where: { country: "Ghana", region: "", place: "" })
      checkout(phone: "not a number")
    end
    assert_equal 3, @black.reload.stock_on_hand
  end

  test "if it sells out while in the bag, the order is refused whole and nothing is taken" do
    post items_shop_cart_path, params: { variant_id: @black.id, quantity: 3 }
    StockLedger.record!(variant: @black, quantity: -2, reason: "damaged") # two went on a live meanwhile

    assert_no_difference "Order.count" do
      checkout
    end
    assert_redirected_to shop_cart_path
    assert_equal 1, @black.reload.stock_on_hand

    get shop_cart_path
    assert_equal [ true, 1 ], inertia.props[:cart][:lines].first.values_at("short", "available")
  end

  test "taking it off the shop between bag and checkout stops the sale" do
    post items_shop_cart_path, params: { variant_id: @black.id }
    taker = OrderTaker.new(customer: Customer.new(name: "X", phone: "0551112222"), shop: true, lines: [ { variant_id: @black.id, quantity: 1 } ])
    @dress.update!(listed: false)

    assert_not taker.save
    assert_equal 3, @black.reload.stock_on_hand
  end

  # ---------- the back office's switch ----------

  test "staff put a product on the shop and take it off" do
    @dress.update!(listed: false)
    sign_in_as(users(:one))

    patch listing_product_path(@dress), params: { listed: true }
    assert @dress.reload.listed?
    patch listing_product_path(@dress), params: { listed: false }
    assert_not @dress.reload.listed?

    sign_in_as(users(:two)) # no products.manage
    patch listing_product_path(@dress), params: { listed: true }
    assert_not @dress.reload.listed?
  end
end

# The back office moved from / to /admin. Old links must still land.
class OldAddressesTest < ActionDispatch::IntegrationTest
  test "old back-office addresses are sent on to /admin" do
    get "/orders/12"
    assert_redirected_to "/admin/orders/12"
    get "/stock?show=low"
    assert_redirected_to "/admin/stock?show=low"
    get "/session/new"
    assert_redirected_to "/admin/session/new"
  end

  test "shop addresses are not caught by that" do
    get "/order/nope"
    assert_response :not_found
    get "/cart"
    assert_response :success
  end
end
