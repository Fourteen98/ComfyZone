require "test_helper"

class Stock::PoolsControllerTest < ActionDispatch::IntegrationTest
  setup do
    StockLedger.record!(variant: variants(:dress_m_black), quantity: 4, reason: "purchase", total_cost_pesewas: 24_000)
  end

  test "counts a product as one total, shows it once on the Stock page, and goes back" do
    sign_in_as(users(:one))
    product = products(:dress)

    patch stock_pool_path(product), params: { total: "9" }
    assert_equal "Ankara wrap dress: 9 in stock, counted as one total.", flash[:notice]

    get stock_index_path
    dress = inertia.props[:groups].find { |group| group[:id] == product.id }
    assert_equal [ true, 9 ], dress.values_at(:pooled, :total)

    # The sale screen: every size offers the shared 9.
    get new_order_path
    offered = inertia.props[:products].find { |entry| entry[:id] == product.id }
    assert offered[:pooled]
    assert_equal [ 9 ], offered[:variants].map { |variant| variant[:stock] }.uniq

    patch stock_pool_path(product), params: { total: "many" }
    assert_equal "Type how many there are in all", flash[:alert]

    delete stock_pool_path(product)
    assert_redirected_to new_stock_count_path
    assert_not product.reload.stock_pooled?
  end

  test "needs stock.adjust" do
    roles(:assistant).update!(permissions: %w[ stock.view ])
    sign_in_as(users(:two))
    patch stock_pool_path(products(:dress)), params: { total: "9" }
    assert_not products(:dress).reload.stock_pooled?
  end
end
