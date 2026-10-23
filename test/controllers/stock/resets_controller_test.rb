require "test_helper"

class Stock::ResetsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @black = variants(:dress_m_black)
    StockLedger.record!(variant: @black, quantity: 4, reason: "purchase", total_cost_pesewas: 24_000)
  end

  test "reset chosen items, see it on the Stock page, and undo it" do
    sign_in_as(users(:one))

    post stock_reset_path, params: { variant_ids: [ @black.id ], to: "0" }
    assert_redirected_to stock_index_path
    assert_equal "1 item set to 0.", flash[:notice]
    assert_equal 0, @black.reload.stock_on_hand

    get stock_index_path
    last = inertia.props[:last_reset]
    assert_equal [ 1, "Reset to 0" ], last.values_at(:items, :note)
    assert_equal "RESET", inertia.props[:confirm_word]

    delete stock_reset_undo_path(last[:batch])
    assert_match "Undone. 1 item is back", flash[:notice]
    assert_equal 4, @black.reload.stock_on_hand

    delete stock_reset_undo_path(last[:batch])
    assert_equal "That reset has already been undone", flash[:alert]
  end

  test "nothing to change, and a full reset without the word" do
    sign_in_as(users(:one))
    post stock_reset_path, params: { variant_ids: [ variants(:dress_l_red).id ] }
    assert_equal "Nothing changed: those counts were already 0.", flash[:notice]

    post stock_reset_path, params: { everything: true, confirm: "" }
    assert_equal "Type RESET to reset everything", flash[:alert]
    assert_equal 4, @black.reload.stock_on_hand

    post stock_reset_path, params: { everything: true, confirm: "RESET" }
    assert_equal "Full reset: 1 item set to 0.", flash[:notice]
  end

  test "needs stock.adjust" do
    roles(:assistant).update!(permissions: %w[ stock.view ])
    sign_in_as(users(:two))
    post stock_reset_path, params: { everything: true, confirm: "RESET" }
    assert_equal 4, @black.reload.stock_on_hand

    get stock_index_path
    assert_nil inertia.props[:last_reset]
  end
end
