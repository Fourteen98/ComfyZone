require "test_helper"

class CustomerKnowledgeControllerTest < ActionDispatch::IntegrationTest
  setup do
    sign_in_as(users(:one))
    @ama = customers(:ama)
    @red = variants(:dress_m_red)
  end

  test "a customer's page, and the gone-quiet tab" do
    get customer_path(@ama)
    assert_inertia_component "Customers/Show"
    assert_equal "Ama Koranteng", inertia.props[:customer][:display_name]
    assert inertia.props[:products].present?, "for adding to the waiting list"

    get customers_path(show: "quiet")
    assert_equal "quiet", inertia.props[:filters][:show]
  end

  test "the waiting list: add by customer or by details, mark told, take off" do
    post waiting_list_index_path, params: { variant_id: @red.id, customer_id: @ama.id }
    post waiting_list_index_path, params: { variant_id: @red.id, buyer: { handle: "new_fan", name: "", phone: "" }, source: "live" }
    assert_equal 2, StockRequest.open.count
    assert Customer.exists?(handle: "new_fan")

    StockLedger.record!(variant: @red, quantity: 2, reason: "found")
    get waiting_list_index_path
    assert_inertia_component "Waiting/Index"
    assert_equal 2, inertia.props[:back].size
    assert_equal 2, inertia.props[:alerts][:to_tell]

    request = StockRequest.open.first
    patch told_waiting_list_path(request)
    assert request.reload.told_at
    delete waiting_list_path(request)
    assert request.reload.closed_at
  end

  test "someone who records sales can add to the list without managing customers" do
    roles(:assistant).update!(permissions: %w[ orders.view orders.create ])
    sign_in_as(users(:two))

    post waiting_list_index_path, params: { variant_id: @red.id, buyer: { handle: "live_fan" } }
    assert_equal 1, StockRequest.open.count

    patch told_waiting_list_path(StockRequest.open.first)
    assert_nil StockRequest.open.first.told_at, "telling and removing need customers.manage"
  end

  test "the shop's 'tell me when it's back' joins the same list" do
    products(:dress).update!(listed: true)
    delete session_path # log out: the shop is public

    post shop_notify_path, params: { variant_id: @red.id, name: "Esi", phone: "055 111 2222" }
    request = StockRequest.open.sole
    assert_equal [ "shop", "+233551112222" ], [ request.source, request.customer.phone ]

    post shop_notify_path, params: { variant_id: @red.id, name: "X", phone: "123" }
    assert_equal 1, StockRequest.count
  end

  test "the restock advice page" do
    get stock_advice_path(days: 30, cover: 8)
    assert_inertia_component "Stock/Advice"
    assert_equal [ 30, 8 ], inertia.props.values_at(:days, :cover)
  end

  test "an expense can be pinned to a live" do
    live = LiveSession.create!(user: users(:one), started_at: 1.hour.ago, sales_channel: sales_channels(:tiktok))
    post expenses_path, params: { expense: { spent_on: Date.current.iso8601, category: "Data", amount: "15", live_session_id: live.id } }
    assert_equal live, Expense.last.live_session

    get live_path(live)
    assert_equal 1500, inertia.props[:stats][:expenses_pesewas]
  end
end
