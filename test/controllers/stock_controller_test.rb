require "test_helper"

class StockControllerTest < ActionDispatch::IntegrationTest
  setup do
    # M / Black: 10 (fine).  L / Red: 2 (low, the dress warns at 2).  The other two: 0 (out).
    StockLedger.record!(variant: variants(:dress_m_black), quantity: 10, reason: "purchase", total_cost_pesewas: 60_000)
    StockLedger.record!(variant: variants(:dress_l_red), quantity: 2, reason: "purchase", total_cost_pesewas: 16_000)
  end

  test "needs stock.view" do
    sign_in_as(users(:two))

    get stock_index_path
    assert_redirected_to root_path

    get stock_path(variants(:dress_m_black))
    assert_redirected_to root_path
  end

  test "lists stock grouped by product, with counts and totals" do
    sign_in_as(users(:one))

    get stock_index_path

    assert_inertia_component "Stock/Index"
    group = inertia.props[:groups].first
    assert_equal "Ankara wrap dress", group[:name]
    assert_equal [ [ "M / Black", 10, "ok" ], [ "M / Red", 0, "out" ], [ "L / Black", 0, "out" ], [ "L / Red", 2, "low" ] ],
      group[:variants].map { |v| v.values_at(:name, :stock, :level).map(&:to_s).then { |n, s, l| [ n, s.to_i, l ] } }
    assert_equal({ all: 4, low: 1, out: 2 }.stringify_keys, inertia.props[:counts].to_h.stringify_keys)
    assert_equal 12, inertia.props[:totals][:units]
    assert_equal 76_000, inertia.props[:totals][:value_pesewas]
    assert_nil inertia.props[:groups].find { |g| g[:name] == "Old tote bag" }, "archived products are left out"
  end

  test "filters to low, to out, and by search" do
    sign_in_as(users(:one))

    get stock_index_path, params: { show: "low" }
    assert_equal [ "L / Red" ], inertia.props[:groups].flat_map { |g| g[:variants].map { |v| v[:name] } }

    get stock_index_path, params: { show: "out" }
    assert_equal 2, inertia.props[:groups].first[:variants].size

    get stock_index_path, params: { q: "kente" }
    assert_empty inertia.props[:groups]
  end

  test "stock value is only sent to people who may see costs" do
    roles(:assistant).update!(permissions: [ "stock.view" ])
    sign_in_as(users(:two))

    get stock_index_path

    assert_nil inertia.props[:totals][:value_pesewas]
    assert_nil inertia.props[:groups].first[:variants].first[:value_pesewas]
    assert_equal 12, inertia.props[:totals][:units]
  end

  test "shows one item's history, newest first" do
    sign_in_as(users(:one))
    variant = variants(:dress_m_black)
    StockAdjustment.new(variant: variant, user: users(:one), reason: "damaged", quantity: 1, note: "torn").save

    get stock_path(variant)

    assert_inertia_component "Stock/Show"
    assert_equal 9, inertia.props[:variant][:stock]
    assert_equal [ [ "damaged", -1, 9, "torn", "Fazy Owner" ], [ "purchase", 10, 10, nil, nil ] ],
      inertia.props[:movements].map { |m| m.values_at(:reason, :quantity, :balance_after, :note, :by) }
    assert inertia.props[:can_adjust]
  end

  test "a purchase in the history links back to the purchase" do
    sign_in_as(users(:one))
    purchases(:on_the_way).receive!(by: users(:one))

    get stock_path(variants(:dress_m_black))

    assert_equal purchase_path(purchases(:on_the_way)), inertia.props[:movements].first[:source][:href]
  end

  test "the dashboard counts what needs attention and lists the most urgent" do
    sign_in_as(users(:one))

    get root_path

    assert_equal 3, inertia.props[:stats][:low_stock]
    assert_equal [ 0, 0, 2 ], inertia.props[:low_stock].map { |v| v[:stock] }
  end

  test "the dashboard says nothing about stock to people who may not see it" do
    sign_in_as(users(:two))

    get root_path

    assert_nil inertia.props[:stats][:low_stock]
    assert_nil inertia.props[:low_stock]
  end

  test "a product's warning level decides what counts as low" do
    sign_in_as(users(:one))
    products(:dress).update!(low_stock_at: 0)

    get stock_index_path

    assert_equal 0, inertia.props[:counts][:low], "warnings switched off; out of stock is still flagged"
    assert_equal 2, inertia.props[:counts][:out]
  end
end
