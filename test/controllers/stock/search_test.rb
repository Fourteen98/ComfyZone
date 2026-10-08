require "test_helper"

# "orange 3xl" on the stock page: find it, update it, stay on the list.
class Stock::SearchTest < ActionDispatch::IntegrationTest
  setup { sign_in_as(users(:one)) }

  test "a size and a colour, in any order, bring that item first and open it" do
    get stock_index_path(q: "black m")
    variants = inertia.props[:groups].flat_map { |group| group[:variants] }
    assert_equal variants(:dress_m_black).id, variants.first["id"]
    assert_equal variants(:dress_m_black).id, inertia.props[:focus_id]
    assert variants.none? { |v| v["name"].include?("Red") }, "every word must match"

    get stock_index_path(q: "wrap")
    assert_equal products(:dress).variants.count, inertia.props[:groups].first[:variants].size, "a product name shows all of it"
    get stock_index_path
    assert_nil inertia.props[:focus_id]
  end

  test "updating from the list goes back to the same search" do
    variant = variants(:dress_m_black)

    post stock_adjustments_path(variant), params: { adjustment: { reason: "found", quantity: "3" }, back: "list", q: "black m", show: "all" }
    assert_redirected_to stock_index_path(q: "black m", show: "all")
    assert_equal 3, variant.reload.stock_on_hand

    post stock_adjustments_path(variant), params: { adjustment: { reason: "damaged", quantity: "9" }, back: "list", q: "black m" }
    assert_redirected_to stock_index_path(q: "black m")
    assert_equal 3, variant.reload.stock_on_hand
  end
end
