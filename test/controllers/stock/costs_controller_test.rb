require "test_helper"

# Stock that never came through a purchase has no cost. See CostCorrection.
class Stock::CostsControllerTest < ActionDispatch::IntegrationTest
  setup do
    sign_in_as(users(:one))
    @variant = variants(:dress_m_black)
    StockLedger.record!(variant: @variant, quantity: 4, reason: "recount") # counted in, no cost
  end

  test "stock counted in by hand is worth nothing until it is given a cost" do
    assert_equal 0, StockLedger.value_pesewas
    assert_equal [ @variant ], StockLedger.uncosted.to_a

    get stock_index_path
    assert_equal [ 1, 0 ], [ inertia.props[:counts][:uncosted], inertia.props[:totals][:value_pesewas] ]

    patch stock_cost_path(@variant), params: { cost: "60" }
    assert_redirected_to stock_path(@variant)

    assert_equal 6000, @variant.reload.average_cost_pesewas
    assert_equal 24_000, StockLedger.value_pesewas, "4 x GH₵ 60"
    assert_equal 24_000, dashboard_tile_value
    assert_empty StockLedger.uncosted

    get stock_index_path
    assert_equal [ 0, 24_000 ], [ inertia.props[:counts][:uncosted], inertia.props[:totals][:value_pesewas] ]
  end

  test "it can cover the product's other options, but never one that already has a cost" do
    costed = variants(:dress_l_red)
    costed.update!(average_cost_pesewas: 8000)

    patch stock_cost_path(@variant), params: { cost: "60", whole_product: true }

    product = @variant.product
    assert_equal 8000, costed.reload.average_cost_pesewas
    assert_equal [ 6000 ], product.variants.where.not(id: costed.id).pluck(:average_cost_pesewas).uniq
    assert_match "Also set for", flash[:notice]
  end

  test "sales already made at no cost get the cost too; ones with a cost keep theirs" do
    taker = OrderTaker.new(customer: Customer.for_claim("ama_k"), user: users(:one), lines: [ { variant_id: @variant.id, quantity: 1 } ])
    assert taker.save
    assert_equal 0, taker.order.cost_pesewas

    other = variants(:dress_l_red)
    other.update!(average_cost_pesewas: 5000)
    StockLedger.record!(variant: other, quantity: 2, reason: "recount")
    second = OrderTaker.new(customer: Customer.for_claim("efua"), user: users(:one), lines: [ { variant_id: other.id, quantity: 1 } ])
    assert second.save

    patch stock_cost_path(@variant), params: { cost: "60", whole_product: true }

    assert_equal 6000, taker.order.reload.cost_pesewas
    assert_equal 5000, second.order.reload.cost_pesewas
  end

  test "a purchase arriving on top of uncosted stock sets the cost, it doesn't average with zero" do
    purchase = Purchase.new(purchased_on: Date.current, supplier: suppliers(:kumasi), user: users(:one), delivery_method: "pickup")
    assert purchase.save_with_items([ { variant_id: @variant.id, quantity: 4, unit_cost: "60" } ])
    purchase.receive!(by: users(:one))

    assert_equal 6000, @variant.reload.average_cost_pesewas, "not 3000"
    assert_equal 48_000, StockLedger.value_pesewas
  end

  test "a bad amount is refused, and so is anyone who may not see costs" do
    patch stock_cost_path(@variant), params: { cost: "abc" }
    patch stock_cost_path(@variant), params: { cost: "0" }
    assert_equal 0, @variant.reload.average_cost_pesewas

    sign_in_as(users(:two))
    roles(:assistant).update!(permissions: %w[ stock.view stock.adjust ])
    patch stock_cost_path(@variant), params: { cost: "60" }
    assert_equal 0, @variant.reload.average_cost_pesewas

    get stock_index_path
    assert_nil inertia.props[:counts][:uncosted]
  end

  private
    def dashboard_tile_value
      Dashboard::TILES.find { |tile| tile.key == "stock_value" }.then { |tile| tile.to_h.values.grep(Proc).first.call }
    end
end
