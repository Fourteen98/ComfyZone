require "test_helper"

# The dress in four variants. Its counts by size are a mess; the TOTAL is right.
class StockPoolTest < ActiveSupport::TestCase
  setup do
    @owner = users(:one)
    @dress = products(:dress)
    @dress.update!(low_stock_at: 2)
    @black_m = variants(:dress_m_black)
    @red_m = variants(:dress_m_red)
    @black_l = variants(:dress_l_black)
    @red_l = variants(:dress_l_red)
    StockLedger.record!(variant: @black_m, quantity: 4, reason: "purchase", total_cost_pesewas: 24_000) # 4 at 60
    StockLedger.record!(variant: @red_l, quantity: 2, reason: "purchase", total_cost_pesewas: 18_000)   # 2 at 90
  end

  def sell(variant, quantity = 1)
    taker = OrderTaker.new(customer: Customer.for_claim("@ama_k"), user: @owner, lines: [ { variant_id: variant.id, quantity: quantity } ])
    taker.save || flunk(taker.errors.full_messages.to_sentence)
    taker.order
  end

  test "pooling sets the total, keeps history, and gives every size one average cost" do
    StockPool.pool!(product: @dress, total: 5, user: @owner)

    assert @dress.reload.stock_pooled?
    assert_equal 5, @dress.pooled_total
    assert_equal [ 5, 0, 0, 0 ], @dress.variants.map(&:stock_on_hand)
    assert_equal [ 7_000 ], @dress.variants.map(&:average_cost_pesewas).uniq # (4*60 + 2*90) / 6
    assert_equal "Counted as one total: 5", @red_l.stock_movements.last.note
    assert_equal 5, @red_m.reload.available # any size can be sold
  end

  test "any size sells while the total lasts, taken from sizes that hold stock" do
    StockPool.pool!(product: @dress, total: 3, user: @owner)

    order = sell(@red_m, 2) # red M shows 0 by itself
    assert_equal 1, @dress.reload.pooled_total
    assert @dress.variants.all? { |variant| variant.stock_on_hand >= 0 }
    assert_equal [ @red_m ], order.items.map(&:variant) # the sale remembers what was sold
    assert_equal 7_000, order.items.first.unit_cost_pesewas
    assert_match "Sold as M / Red", StockMovement.where(reason: "sale").last.note

    taker = OrderTaker.new(customer: Customer.for_claim("@kofi.b"), user: @owner, lines: [ { variant_id: @black_l.id, quantity: 2 } ])
    assert_not taker.save
    assert_match "Only 1 left of Ankara wrap dress", taker.errors[:items].first

    order.cancel!(by: @owner) # back on the shelf: the total is right again
    assert_equal 3, @dress.reload.pooled_total
  end

  test "low, out and the waiting list judge the total, and the product counts once" do
    StockPool.pool!(product: @dress, total: 2, user: @owner)

    attention = StockLedger.needing_attention.select { |variant| variant.product_id == @dress.id }
    assert_equal 1, attention.size
    assert_equal :low, attention.first.stock_level

    StockRequest.ask!(customer: customers(:ama), variant: @red_m, source: "sale", user: @owner)
    assert_equal 1, StockRequest.back_in_stock.count # red M shows 0, but the total is 2

    sell(@red_m, 2)
    assert_equal :out, @red_m.reload.stock_level
    assert_equal 0, StockRequest.back_in_stock.count
  end

  test "a nonsense total is refused, and unpooling leaves the counts for a stock take" do
    assert_raises(ArgumentError) { StockPool.pool!(product: @dress, total: "lots", user: @owner) }
    assert_raises(ArgumentError) { StockPool.pool!(product: @dress, total: -1, user: @owner) }
    assert_not @dress.reload.stock_pooled?

    StockPool.pool!(product: @dress, total: 4, user: @owner)
    StockPool.unpool!(product: @dress)
    assert_not @dress.reload.stock_pooled?
    assert_equal 0, @red_m.reload.available # by size again
  end
end
