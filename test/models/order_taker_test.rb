require "test_helper"

class OrderTakerTest < ActiveSupport::TestCase
  setup do
    @owner = users(:one)
    @black = variants(:dress_m_black) # GH₵ 120, follows the product price
    @red = variants(:dress_l_red)     # GH₵ 140, its own price
    StockLedger.record!(variant: @black, quantity: 5, reason: "purchase", total_cost_pesewas: 30_000) # cost 60 each
    StockLedger.record!(variant: @red, quantity: 1, reason: "purchase", total_cost_pesewas: 8_000)    # cost 80
    @live = LiveSession.create!(user: @owner)
  end

  def claim(buyer, lines, live: @live)
    OrderTaker.new(customer: Customer.for_claim(buyer), user: @owner, live_session: live, lines: lines)
  end

  test "a claim makes an order, takes the stock and snapshots price and cost" do
    taker = claim("@ama_k", [ { variant_id: @black.id, quantity: 2 } ])

    assert taker.save
    order = taker.order
    assert_equal [ customers(:ama), @live, @owner, "claimed" ], [ order.customer, order.live_session, order.user, order.status ]
    assert_equal 24_000, order.total_pesewas
    assert_equal [ 2, 12_000, 6_000 ], order.items.first.values_at(:quantity, :unit_price_pesewas, :unit_cost_pesewas)
    assert_equal 12_000, order.profit_pesewas
    assert_equal 3, @black.reload.stock_on_hand

    movement = @black.stock_movements.newest_first.first
    assert_equal [ -2, "sale", order ], [ movement.quantity, movement.reason, movement.source ]
  end

  test "a new TikTok name becomes a new customer" do
    assert_difference "Customer.count", 1 do
      assert claim("@Brand_New", [ { variant_id: @black.id, quantity: 1 } ]).save
    end
    assert_equal "brand_new", Order.newest_first.first.customer.handle
  end

  test "more claims by the same person in the same live join one order" do
    first = claim("ama_k", [ { variant_id: @black.id, quantity: 1 } ]).tap(&:save).order

    assert_no_difference "Order.count" do
      claim("ama_k", [ { variant_id: @black.id, quantity: 1 }, { variant_id: @red.id, quantity: 1 } ]).save
    end

    first.reload
    assert_equal({ @black.id => 2, @red.id => 1 }, first.items.pluck(:variant_id, :quantity).to_h)
    assert_equal 12_000 * 2 + 14_000, first.total_pesewas
  end

  test "outside a live, each sale is its own order" do
    assert_difference "Order.count", 2 do
      claim("ama_k", [ { variant_id: @black.id, quantity: 1 } ], live: nil).save
      claim("ama_k", [ { variant_id: @black.id, quantity: 1 } ], live: nil).save
    end
  end

  test "the last one can't be sold twice" do
    assert claim("ama_k", [ { variant_id: @red.id, quantity: 1 } ]).save

    late = claim("kofi.b", [ { variant_id: @red.id, quantity: 1 } ])
    assert_not late.save
    assert_includes late.errors[:items].first, "has just sold out"
    assert_equal 0, @red.reload.stock_on_hand
  end

  test "a claim that can't be fully met changes nothing at all" do
    taker = claim("@nobody_yet", [ { variant_id: @black.id, quantity: 2 }, { variant_id: @red.id, quantity: 3 } ])

    assert_no_difference [ "Order.count", "OrderItem.count", "Customer.count", "StockMovement.count" ] do
      assert_not taker.save
    end
    assert_includes taker.errors[:items].first, "Only 1 left of Ankara wrap dress, L / Red"
    assert_equal 5, @black.reload.stock_on_hand, "the dress that WAS available was put back too"
  end

  test "needs a buyer and at least one item" do
    taker = claim("", [ { variant_id: @black.id, quantity: 0 } ])

    assert_not taker.save
    assert taker.errors[:customer].any?
    assert taker.errors[:items].any?
  end

  test "later price and cost changes don't touch what was sold" do
    order = claim("ama_k", [ { variant_id: @black.id, quantity: 1 } ]).tap(&:save).order

    products(:dress).update!(price: "999")
    StockLedger.record!(variant: @black, quantity: 10, reason: "purchase", total_cost_pesewas: 900_000)

    assert_equal [ 12_000, 6_000 ], order.items.reload.first.values_at(:unit_price_pesewas, :unit_cost_pesewas)
    assert_equal 12_000, order.reload.total_pesewas
  end

  test "cancelling puts everything back, once" do
    order = claim("ama_k", [ { variant_id: @black.id, quantity: 2 }, { variant_id: @red.id, quantity: 1 } ]).tap(&:save).order

    order.cancel!(by: @owner)

    assert order.reload.cancelled?
    assert_equal [ 5, 1 ], [ @black.reload.stock_on_hand, @red.reload.stock_on_hand ]
    assert_raises(Order::WrongStage) { Order.find(order.id).cancel!(by: @owner) }
    assert_equal 5, @black.reload.stock_on_hand
  end

  test "removing one line restocks it; removing the last cancels the order" do
    order = claim("ama_k", [ { variant_id: @black.id, quantity: 2 }, { variant_id: @red.id, quantity: 1 } ]).tap(&:save).order

    order.remove_item!(order.items.find_by(variant: @red), by: @owner)
    assert_equal [ "claimed", 24_000 ], [ order.reload.status, order.total_pesewas ]
    assert_equal 1, @red.reload.stock_on_hand

    order.remove_item!(order.items.first, by: @owner)
    assert order.reload.cancelled?
    assert_equal 5, @black.reload.stock_on_hand
  end

  test "stock still equals the sum of its history after all of that" do
    order = claim("ama_k", [ { variant_id: @black.id, quantity: 3 } ]).tap(&:save).order
    claim("kofi.b", [ { variant_id: @black.id, quantity: 9 } ]).save # refused
    order.cancel!(by: @owner)
    claim("kofi.b", [ { variant_id: @black.id, quantity: 4 } ]).save

    assert_equal 1, @black.reload.stock_on_hand
    assert_equal 1, @black.stock_movements.sum(:quantity)
  end

  test "a sold variant is retired, not deleted, when its size is unticked" do
    claim("ama_k", [ { variant_id: @black.id, quantity: 1 } ]).save
    purchase_items(:m_black).destroy

    products(:dress).save_with_options([ { name: "Size", values: [ { label: "L" } ] },
      { name: "Colour", values: [ { label: "Black" }, { label: "Red" } ] } ])

    assert Variant.exists?(@black.id)
    assert_not @black.reload.active?
  end
end
