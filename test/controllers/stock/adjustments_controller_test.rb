require "test_helper"

class Stock::AdjustmentsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @variant = variants(:dress_m_black)
    StockLedger.record!(variant: @variant, quantity: 10, reason: "purchase", total_cost_pesewas: 60_000)
  end

  test "records an adjustment" do
    sign_in_as(users(:one))

    post stock_adjustments_path(@variant), params: { adjustment: { reason: "recount", quantity: "7", note: "Monday count" } }

    assert_redirected_to stock_path(@variant)
    assert_equal 7, @variant.reload.stock_on_hand
    assert_match "now shows 7", flash[:notice]
  end

  test "errors come back and stock is untouched" do
    sign_in_as(users(:one))

    post stock_adjustments_path(@variant), params: { adjustment: { reason: "lost", quantity: "50" } }

    assert_equal 10, @variant.reload.stock_on_hand
    follow_redirect!
    assert_includes inertia.props[:errors][:quantity].first, "more than the 10"
  end

  test "seeing stock is not enough to change it" do
    roles(:assistant).update!(permissions: [ "stock.view" ])
    sign_in_as(users(:two))

    post stock_adjustments_path(@variant), params: { adjustment: { reason: "lost", quantity: "5" } }

    assert_redirected_to admin_root_path
    assert_equal 10, @variant.reload.stock_on_hand

    get stock_path(@variant)
    assert_not inertia.props[:can_adjust]
  end

  test "only the listed fields are accepted" do
    sign_in_as(users(:one))

    post stock_adjustments_path(@variant), params: { adjustment: { reason: "found", quantity: "1", user: users(:two).id, variant: 999 } }

    assert_equal users(:one), @variant.stock_movements.newest_first.first.user
  end
end
