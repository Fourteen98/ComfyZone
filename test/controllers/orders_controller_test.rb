require "test_helper"

class OrdersControllerTest < ActionDispatch::IntegrationTest
  setup do
    @black = variants(:dress_m_black)
    StockLedger.record!(variant: @black, quantity: 5, reason: "purchase", total_cost_pesewas: 30_000)
  end

  def claim_params(buyer: "@ama_k", quantity: 1, live: nil)
    { order: { buyer: buyer, live_session_id: live&.id, items: [ { variant_id: @black.id, quantity: quantity } ] } }
  end

  test "a sale outside a live makes an order and opens it" do
    sign_in_as(users(:one))

    assert_difference "Order.count", 1 do
      post orders_path, params: claim_params(quantity: 2)
    end

    order = Order.newest_first.first
    assert_redirected_to order_path(order)
    assert_nil order.live_session
    assert_equal 3, @black.reload.stock_on_hand
  end

  test "a refused claim comes back with the reason and changes nothing" do
    sign_in_as(users(:one))

    assert_no_difference [ "Order.count", "StockMovement.count" ] do
      post orders_path, params: claim_params(quantity: 6)
    end

    assert_redirected_to new_order_path
    follow_redirect!
    assert_includes inertia.props[:errors][:items].first, "Only 5 left"
  end

  test "a claim can't be attached to a live that has ended" do
    sign_in_as(users(:one))
    live = LiveSession.create!(user: users(:one))
    live.finish!

    post orders_path, params: claim_params(live: live)

    assert_nil Order.newest_first.first.live_session
  end

  test "lists orders, leaving cancelled ones out unless asked" do
    sign_in_as(users(:one))
    post orders_path, params: claim_params
    post orders_path, params: claim_params(buyer: "kofi.b")
    Order.newest_first.first.cancel!(by: users(:one))

    get orders_path
    assert_inertia_component "Orders/Index"
    assert_equal [ "Ama Koranteng" ], inertia.props[:orders].map { |o| o[:customer] }

    get orders_path, params: { status: "cancelled" }
    assert_equal [ "@kofi.b" ], inertia.props[:orders].map { |o| o[:customer] }
  end

  test "shows an order, with profit only for those who may see costs" do
    sign_in_as(users(:one))
    post orders_path, params: claim_params(quantity: 2)
    order = Order.newest_first.first

    get order_path(order)
    assert_inertia_component "Orders/Show"
    assert_equal [ 24_000, 12_000 ], inertia.props[:order].values_at(:total_pesewas, :profit_pesewas)
    assert_equal "Ankara wrap dress, M / Black", inertia.props[:order][:items].first[:name]

    sign_in_as(users(:two))
    get order_path(order)
    assert_nil inertia.props[:order][:profit_pesewas]
  end

  test "cancels an order and restocks it" do
    sign_in_as(users(:one))
    post orders_path, params: claim_params(quantity: 2)
    order = Order.newest_first.first

    patch cancel_order_path(order)

    assert order.reload.cancelled?
    assert_equal 5, @black.reload.stock_on_hand

    patch cancel_order_path(order) # a second tap
    assert_equal 5, @black.reload.stock_on_hand
    assert_match "already cancelled", flash[:alert]
  end

  test "removes one line from an order" do
    sign_in_as(users(:one))
    post orders_path, params: claim_params(quantity: 2)
    order = Order.newest_first.first

    delete order_item_path(order, order.items.first)

    assert order.reload.cancelled?, "it was the only line"
    assert_equal 5, @black.reload.stock_on_hand
  end

  test "a line can't be removed through the wrong order" do
    sign_in_as(users(:one))
    post orders_path, params: claim_params
    post orders_path, params: claim_params(buyer: "kofi.b")
    first, second = Order.order(:id).last(2)

    delete order_item_path(first, second.items.first)

    assert_response :not_found
    assert_equal 1, second.items.count
  end

  test "recording and cancelling need orders.create; looking needs orders.view" do
    roles(:assistant).update!(permissions: [ "orders.view" ])
    sign_in_as(users(:two))

    get orders_path
    assert_response :success

    assert_no_difference "Order.count" do
      post orders_path, params: claim_params
    end
    assert_redirected_to root_path
  end

  test "the dashboard shows today's sales, money owed and recent orders" do
    sign_in_as(users(:one))
    post orders_path, params: claim_params(quantity: 2)

    get root_path

    assert_equal [ 24_000, 0, 24_000 ], [ dashboard_tile(:sales_today), dashboard_tile(:orders_to_pack), dashboard_tile(:money_owed) ]
    assert_equal [ "Ama Koranteng" ], dashboard_panel(:recent_orders).map { |o| o[:customer] }
    assert_nil inertia.props[:live_now]
  end

  test "the dashboard says nothing about sales to people who may not see orders" do
    roles(:assistant).update!(permissions: [ "products.view" ])
    sign_in_as(users(:two))

    get root_path

    assert_nil dashboard_tile(:sales_today)
    assert_nil dashboard_panel(:recent_orders)
  end
end
