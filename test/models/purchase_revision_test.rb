require "test_helper"

# Correcting a purchase whose goods are already in stock (lesson 27).
class PurchaseRevisionTest < ActiveSupport::TestCase
  setup do
    @owner = users(:one)
    @black = variants(:dress_m_black)
    @red = variants(:dress_l_red)
    @purchase = purchases(:on_the_way) # 10 black at 60, 5 red at 80; transport 70 + fees 30
    @purchase.receive!(by: @owner)
    @purchase.reload
  end

  def lines(black: 10, red: 5, black_cost: "60", red_cost: "80", extra: [])
    [ { variant_id: @black.id, quantity: black, unit_cost: black_cost },
      { variant_id: @red.id, quantity: red, unit_cost: red_cost } ] + extra
  end

  test "an item left off goes into stock at its landed cost" do
    forgotten = variants(:dress_m_red)
    assert @purchase.revise!(lines(extra: [ { variant_id: forgotten.id, quantity: 4, unit_cost: "50" } ]), by: @owner)

    assert_equal 4, forgotten.reload.stock_on_hand
    assert forgotten.average_cost_pesewas > 5000, "carries a share of the transport and fees"
    movement = forgotten.stock_movements.last
    assert_equal [ "purchase", @purchase, "Purchase corrected" ], [ movement.reason, movement.source, movement.note ]
    assert_equal 3, @purchase.items.count
  end

  test "more of an item, and fewer of another" do
    assert @purchase.revise!(lines(black: 12, red: 3), by: @owner)

    assert_equal [ 12, 3 ], [ @black.reload.stock_on_hand, @red.reload.stock_on_hand ]
    assert_equal 1, @black.stock_movements.where(note: "Purchase corrected").count
  end

  test "units that have been sold can't be taken back off the purchase" do
    StockLedger.record!(variant: @red, quantity: -4, reason: "sale") # 1 left

    assert_not @purchase.revise!(lines(red: 2), by: @owner)
    assert_match "can't be lowered", @purchase.errors[:items].first
    assert_equal 1, @red.reload.stock_on_hand
    assert_equal 5, @purchase.items.reload.find_by(variant: @red).quantity, "nothing changed"
  end

  test "a corrected price re-values what is still on the shelf" do
    before = @black.reload.average_cost_pesewas # 60 + its share of 100 extra costs = 66.67
    assert @purchase.revise!(lines(black_cost: "63"), by: @owner)

    assert_equal 10, @black.reload.stock_on_hand, "no units moved"
    assert_in_delta before + 300, @black.average_cost_pesewas, 30, "about GH₵ 3 more each, plus a slightly larger share of the fees"
  end

  test "details can be corrected too, and an invalid change saves nothing" do
    @purchase.assign_attributes(note: "Forgot the scarves", reference: "INV-77")
    assert @purchase.revise!(lines, by: @owner)
    assert_equal [ "Forgot the scarves", "INV-77" ], @purchase.reload.values_at(:note, :reference)

    assert_not @purchase.revise!([], by: @owner)
    assert_equal 2, @purchase.items.reload.count
    assert_equal 10, @black.reload.stock_on_hand
  end

  test "a received purchase still can't be deleted" do
    assert_not @purchase.destroy
  end
end

class PurchaseRemovalTest < ActionDispatch::IntegrationTest
  setup do
    @purchase = purchases(:on_the_way) # 10 black, 5 red
    @purchase.receive!(by: users(:one))
    @black = variants(:dress_m_black)
  end

  test "an Owner deletes a received purchase and its stock comes back out" do
    sign_in_as(users(:one))

    assert_difference "Purchase.count", -1 do
      delete purchase_path(@purchase)
    end
    assert_redirected_to purchases_path
    assert_equal "Purchase deleted, and its items taken back out of stock.", flash[:notice]
    assert_equal [ 0, 0 ], [ @black.reload.stock_on_hand, variants(:dress_l_red).reload.stock_on_hand ]
    assert_match "Purchase deleted", @black.stock_movements.order(:id).last.note

    # The item's history still opens, with the old arrival in it.
    get stock_path(@black)
    assert_response :success
  end

  test "it needs the Delete purchases permission, not just manage" do
    roles(:assistant).update!(permissions: %w[ purchases.view purchases.manage ])
    sign_in_as(users(:two))

    assert_no_difference("Purchase.count") { delete purchase_path(@purchase) }
    assert_match "Delete purchases", flash[:alert]

    roles(:assistant).update!(permissions: %w[ purchases.view purchases.manage purchases.delete ])
    assert_difference("Purchase.count", -1) { delete purchase_path(@purchase) }
  end

  test "if some of it has been sold, it can't be deleted and nothing changes" do
    StockLedger.record!(variant: @black, quantity: -3, reason: "sale")
    sign_in_as(users(:one))

    assert_no_difference("Purchase.count") { delete purchase_path(@purchase) }
    assert_match "already gone out", flash[:alert]
    assert_equal 7, @black.reload.stock_on_hand
    assert_equal 5, variants(:dress_l_red).reload.stock_on_hand
  end

  test "a purchase still on the way only needs manage" do
    on_the_way = Purchase.new(purchased_on: Date.current, supplier: suppliers(:kumasi), user: users(:one), delivery_method: "pickup")
    assert on_the_way.save_with_items([ { variant_id: @black.id, quantity: 1, unit_cost: "5" } ])
    roles(:assistant).update!(permissions: %w[ purchases.view purchases.manage ])
    sign_in_as(users(:two))

    assert_difference("Purchase.count", -1) { delete purchase_path(on_the_way) }
  end
end
