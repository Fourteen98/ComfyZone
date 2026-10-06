require "test_helper"

class StockAdjustmentTest < ActiveSupport::TestCase
  setup do
    @variant = variants(:dress_m_black)
    StockLedger.record!(variant: @variant, quantity: 10, reason: "purchase", total_cost_pesewas: 60_000)
  end

  def adjust(**attributes)
    StockAdjustment.new({ variant: @variant, user: users(:one) }.merge(attributes))
  end

  test "damage, loss and personal use take stock away" do
    assert adjust(reason: "damaged", quantity: "2", note: "  torn   seam ").save

    movement = @variant.stock_movements.newest_first.first
    assert_equal [ -2, 8, "damaged", "torn seam" ], movement.values_at(:quantity, :balance_after, :reason, :note)
    assert_equal users(:one), movement.user
    assert_equal 8, @variant.reload.stock_on_hand
  end

  test "found adds stock without touching the average cost" do
    assert adjust(reason: "found", quantity: 3).save

    assert_equal 13, @variant.reload.stock_on_hand
    assert_equal 6000, @variant.average_cost_pesewas
  end

  test "a recount records the difference between the count and the app" do
    assert adjust(reason: "recount", quantity: 7).save
    assert_equal [ -3, 7 ], @variant.stock_movements.newest_first.first.values_at(:quantity, :balance_after)

    assert adjust(reason: "recount", quantity: 12).save
    assert_equal [ 5, 12 ], @variant.stock_movements.newest_first.first.values_at(:quantity, :balance_after)
  end

  test "a recount that matches changes nothing and says so" do
    adjustment = adjust(reason: "recount", quantity: 10)

    assert_no_difference "StockMovement.count" do
      assert_not adjustment.save
    end
    assert_includes adjustment.errors[:quantity].first, "already shows"
  end

  test "can count down to zero" do
    assert adjust(reason: "recount", quantity: 0).save
    assert_equal 0, @variant.reload.stock_on_hand
  end

  test "can't take away more than there is" do
    adjustment = adjust(reason: "lost", quantity: 11)

    assert_not adjustment.save
    assert_includes adjustment.errors[:quantity].first, "more than the 10 in stock"
    assert_equal 10, @variant.reload.stock_on_hand
  end

  test "needs a reason and a whole number" do
    adjustment = adjust(reason: "because", quantity: "2.5")

    assert_not adjustment.save
    assert adjustment.errors[:reason].any?
    assert adjustment.errors[:quantity].any?
  end

  test "taking away or adding zero is refused" do
    assert_not adjust(reason: "damaged", quantity: 0).save
  end

  test "the ledger still adds up after a run of adjustments" do
    adjust(reason: "damaged", quantity: 1).save
    adjust(reason: "found", quantity: 4).save
    adjust(reason: "recount", quantity: 6).save

    assert_equal 6, @variant.reload.stock_on_hand
    assert_equal 6, @variant.stock_movements.sum(:quantity)
  end
end
