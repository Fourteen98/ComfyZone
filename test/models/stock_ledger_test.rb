require "test_helper"

class StockLedgerTest < ActiveSupport::TestCase
  setup { @variant = variants(:dress_m_black) }

  test "writes a movement and updates the running total together" do
    assert_difference "StockMovement.count", 1 do
      StockLedger.record!(variant: @variant, quantity: 12, reason: "purchase", total_cost_pesewas: 72_000)
    end

    movement = @variant.stock_movements.last
    assert_equal [ 12, 12, 6000 ], [ movement.quantity, movement.balance_after, movement.unit_cost_pesewas ]
    assert_equal 12, @variant.reload.stock_on_hand
  end

  test "stock on hand always equals the sum of the movements" do
    StockLedger.record!(variant: @variant, quantity: 12, reason: "purchase", total_cost_pesewas: 72_000)
    StockLedger.record!(variant: @variant, quantity: -3, reason: "sale")
    StockLedger.record!(variant: @variant, quantity: -1, reason: "damaged", note: "wet in storage")

    assert_equal 8, @variant.reload.stock_on_hand
    assert_equal @variant.stock_on_hand, @variant.stock_movements.sum(:quantity)
    assert_equal [ 12, 9, 8 ], @variant.stock_movements.order(:id).pluck(:balance_after)
  end

  test "incoming stock blends into a moving average cost" do
    StockLedger.record!(variant: @variant, quantity: 10, reason: "purchase", total_cost_pesewas: 50_000) # GH₵ 50 each
    assert_equal 5000, @variant.reload.average_cost_pesewas

    StockLedger.record!(variant: @variant, quantity: 10, reason: "purchase", total_cost_pesewas: 70_000) # GH₵ 70 each
    assert_equal 6000, @variant.reload.average_cost_pesewas, "20 on hand worth 1,200 -> 60 each"
  end

  test "stock going out doesn't change the average cost" do
    StockLedger.record!(variant: @variant, quantity: 10, reason: "purchase", total_cost_pesewas: 50_000)
    StockLedger.record!(variant: @variant, quantity: -4, reason: "sale")

    assert_equal 5000, @variant.reload.average_cost_pesewas
  end

  test "a failed movement leaves stock untouched" do
    assert_raises(ActiveRecord::RecordInvalid) do
      StockLedger.record!(variant: @variant, quantity: 5, reason: "made-up reason")
    end

    assert_equal 0, @variant.reload.stock_on_hand
    assert_equal 0, @variant.stock_movements.count
  end

  test "zero is not a movement" do
    assert_raises(ArgumentError) { StockLedger.record!(variant: @variant, quantity: 0, reason: "recount") }
  end

  test "the ledger is append-only" do
    movement = StockLedger.record!(variant: @variant, quantity: 5, reason: "purchase")

    assert_raises(ActiveRecord::ReadOnlyRecord) { movement.update!(quantity: 500) }
    assert_raises(ActiveRecord::ReadOnlyRecord) { movement.destroy }
  end
end
