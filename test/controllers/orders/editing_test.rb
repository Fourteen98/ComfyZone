require "test_helper"

# Editing orders and lives after the fact.
class Orders::EditingTest < ActionDispatch::IntegrationTest
  setup do
    @owner = users(:one)
    @black = variants(:dress_m_black)
    StockLedger.record!(variant: @black, quantity: 5, reason: "purchase", total_cost_pesewas: 30_000)
    taker = OrderTaker.new(customer: Customer.for_claim("@ama_k"), user: @owner, lines: [ { variant_id: @black.id, quantity: 2 } ])
    taker.save
    @order = taker.order
    sign_in_as(@owner)
  end

  test "the edit page carries the order, and counts its own items as available" do
    get edit_order_path(@order)

    assert_inertia_component "Orders/Edit"
    assert_equal [ [ @black.id, 2, "120" ] ], inertia.props[:order][:items].map { |i| i.values_at(:variant_id, :quantity, :price) }
    variant = inertia.props[:products].flat_map { |p| p[:variants] }.find { |v| v[:id] == @black.id }
    assert_equal 5, variant[:stock], "3 on the shelf + the 2 this order holds"
    assert inertia.props[:order][:lines_open]
  end

  test "updates lines, buyer, channel and note in one go" do
    patch order_path(@order), params: { order: {
      buyer: { name: "Mrs Mensah", phone: "020 111 2222" }, sales_channel_id: sales_channels(:whatsapp).id, note: "Call first",
      items: [ { variant_id: @black.id, quantity: 3, price: "110" } ]
    } }

    assert_redirected_to order_path(@order)
    @order.reload
    assert_equal [ "Mrs Mensah", sales_channels(:whatsapp), "Call first", 33_000 ],
      [ @order.customer.name, @order.sales_channel, @order.note, @order.total_pesewas ]
    assert_equal 2, @black.reload.stock_on_hand
  end

  test "a refused edit comes back with the reason" do
    patch order_path(@order), params: { order: { items: [ { variant_id: @black.id, quantity: 9, price: "" } ] } }

    assert_redirected_to edit_order_path(@order)
    follow_redirect!
    assert_includes inertia.props[:errors][:items].first, "Only"
  end

  test "sending only some fields leaves the rest alone" do
    @order.update!(sales_channel: sales_channels(:whatsapp), note: "Keep me")

    patch order_path(@order), params: { order: { note: "Changed" } }

    assert_equal [ sales_channels(:whatsapp), "Changed", 2, customers(:ama) ],
      [ @order.reload.sales_channel, @order.note, @order.items.first.quantity, @order.customer ]
  end

  test "a paid order's edit page offers no line editing" do
    @order.record_payment!(amount: "240", via: "cash", by: @owner)

    get edit_order_path(@order)

    assert_not inertia.props[:order][:lines_open]
    assert_empty inertia.props[:products]
  end

  test "editing needs orders.create" do
    delete session_path
    roles(:assistant).update!(permissions: [ "orders.view" ])
    sign_in_as(users(:two))

    get edit_order_path(@order)
    assert_redirected_to root_path
    patch order_path(@order), params: { order: { note: "x" } }
    assert_nil @order.reload.note
  end

  # ---- Lives --------------------------------------------------------------

  test "a live can be renamed and moved to another platform, and its orders follow" do
    live = LiveSession.create!(user: @owner, title: "Typo nite", sales_channel: sales_channels(:tiktok))
    taker = OrderTaker.new(customer: Customer.for_claim("@kofi.b"), user: @owner, live_session: live, lines: [ { variant_id: @black.id, quantity: 1 } ])
    taker.save

    get edit_live_path(live)
    assert_equal [ "Typo nite", 1 ], inertia.props[:live].values_at(:title, :orders)

    patch live_path(live), params: { live: { title: "Friday night", sales_channel_id: sales_channels(:instagram).id } }

    assert_equal [ "Friday night", sales_channels(:instagram) ], live.reload.values_at(:title, :sales_channel)
    assert_equal sales_channels(:instagram), taker.order.reload.sales_channel
  end

  test "a live can't be given a blank name or a channel without usernames" do
    live = LiveSession.create!(user: @owner, sales_channel: sales_channels(:tiktok))

    patch live_path(live), params: { live: { title: " ", sales_channel_id: sales_channels(:whatsapp).id } }

    follow_redirect!
    assert inertia.props[:errors][:title].any?
    assert_equal sales_channels(:tiktok), live.reload.sales_channel
  end

  test "an empty live can be deleted; one with orders can't" do
    empty = LiveSession.create!(user: @owner)
    empty.finish!
    delete live_path(empty)
    assert_not LiveSession.exists?(empty.id)

    live = LiveSession.create!(user: @owner)
    OrderTaker.new(customer: Customer.for_claim("@kofi.b"), user: @owner, live_session: live, lines: [ { variant_id: @black.id, quantity: 1 } ]).save
    delete live_path(live)
    assert LiveSession.exists?(live.id)
    assert_match "can't be deleted", flash[:alert]
  end
end
