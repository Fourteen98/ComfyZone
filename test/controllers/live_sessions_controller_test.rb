require "test_helper"

class LiveSessionsControllerTest < ActionDispatch::IntegrationTest
  setup do
    StockLedger.record!(variant: variants(:dress_m_black), quantity: 5, reason: "purchase", total_cost_pesewas: 30_000)
  end

  test "with no live running, shows the start screen and past lives" do
    sign_in_as(users(:one))
    LiveSession.create!(user: users(:one), title: "Sunday sale").finish!

    get live_index_path

    assert_inertia_component "Live/Index"
    assert_equal [ "Sunday sale" ], inertia.props[:lives].map { |l| l[:title] }
    assert inertia.props[:can_start]
  end

  test "starts a live and goes straight to selling" do
    sign_in_as(users(:one))

    assert_difference "LiveSession.count", 1 do
      post live_index_path, params: { live: { title: "Friday drop" } }
    end

    live = LiveSession.current
    assert_redirected_to live_path(live)
    assert_equal [ "Friday drop", users(:one) ], [ live.title, live.user ]
  end

  test "the menu link jumps to the running live" do
    sign_in_as(users(:one))
    live = LiveSession.create!(user: users(:one))

    get live_index_path

    assert_redirected_to live_path(live)
  end

  test "a second start doesn't make a second live" do
    sign_in_as(users(:one))
    post live_index_path

    assert_no_difference "LiveSession.count" do
      post live_index_path
    end
  end

  test "the selling screen has products with live stock and prices, and known buyers" do
    sign_in_as(users(:one))
    live = LiveSession.create!(user: users(:one))

    get live_path(live)

    assert_inertia_component "Live/Show"
    dress = inertia.props[:products].find { |p| p[:name] == "Ankara wrap dress" }
    black = dress[:variants].find { |v| v[:name] == "M / Black" }
    assert_equal [ 5, 12_000 ], black.values_at(:stock, :price_pesewas)
    assert_includes inertia.props[:buyers].map { |b| b[:handle] }, "ama_k"
    assert inertia.props[:live][:running]
  end

  test "claims show up in the live's totals, with profit only for those who may see costs" do
    sign_in_as(users(:one))
    live = LiveSession.create!(user: users(:one))
    post orders_path, params: { order: { buyer: "@ama_k", live_session_id: live.id, items: [ { variant_id: variants(:dress_m_black).id, quantity: 2 } ] } }
    assert_redirected_to live_path(live)

    get live_path(live)
    assert_equal({ orders: 1, units: 2, total_pesewas: 24_000, profit_pesewas: 12_000, expenses_pesewas: 0 }.stringify_keys, inertia.props[:stats].to_h.stringify_keys)
    assert_equal "Ama Koranteng", inertia.props[:orders].first[:customer]

    sign_in_as(users(:two)) # can see and create orders, not costs
    get live_path(live)
    assert_nil inertia.props[:stats][:profit_pesewas]
  end

  test "ending a live shows its summary and stops offering products" do
    sign_in_as(users(:one))
    live = LiveSession.create!(user: users(:one))

    patch finish_live_path(live)
    assert_redirected_to live_path(live)

    get live_path(live)
    assert_not inertia.props[:live][:running]
    assert_nil inertia.props[:products]
  end

  test "needs the right permissions" do
    roles(:assistant).update!(permissions: [ "products.view" ])
    sign_in_as(users(:two))

    get live_index_path
    assert_redirected_to admin_root_path

    roles(:assistant).update!(permissions: [ "orders.view" ])
    assert_no_difference "LiveSession.count" do
      post live_index_path
    end
  end
end
