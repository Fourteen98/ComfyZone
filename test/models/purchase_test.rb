require "test_helper"

class PurchaseTest < ActiveSupport::TestCase
  setup do
    @purchase = purchases(:on_the_way)
    @owner = users(:one)
  end

  test "totals" do
    assert_equal 15, @purchase.units
    assert_equal 100_000, @purchase.goods_total_pesewas
    assert_equal 110_000, @purchase.total_pesewas
  end

  test "transport and other fees both count as added costs" do
    assert_equal 7000, @purchase.transport_cost_pesewas
    assert_equal 3000, @purchase.extra_costs_pesewas
    assert_equal 10_000, @purchase.added_costs_pesewas
  end

  test "needs a supplier and a known way the goods arrived" do
    purchase = Purchase.new(user: @owner, purchased_on: Date.current, delivery_method: "by drone")

    assert_not purchase.valid?
    assert purchase.errors[:supplier].any?
    assert purchase.errors[:delivery_method].any?
  end

  test "an ordered purchase has not touched stock" do
    assert_equal 0, variants(:dress_m_black).stock_on_hand
    assert_equal 0, StockMovement.count
  end

  test "receiving adds the stock, with one ledger row per line pointing back at the purchase" do
    assert_difference "StockMovement.count", 2 do
      @purchase.receive!(by: @owner)
    end

    assert @purchase.reload.received?
    assert_not_nil @purchase.received_at
    assert_equal 10, variants(:dress_m_black).reload.stock_on_hand
    assert_equal 5, variants(:dress_l_red).reload.stock_on_hand
    assert_equal [ @purchase ], @purchase.stock_movements.map(&:source).uniq
    assert_equal [ @owner ], @purchase.stock_movements.map(&:user).uniq
  end

  test "extra costs are shared by value into the landed cost" do
    @purchase.receive!(by: @owner)

    # 600 of the 1,000 goods value carries 60 of the 100 extra: 660 / 10 = 66 each.
    assert_equal 66_000, purchase_items(:m_black).reload.landed_total_pesewas
    assert_equal 6600, variants(:dress_m_black).reload.average_cost_pesewas
    # 400 carries 40: 440 / 5 = 88 each.
    assert_equal 8800, variants(:dress_l_red).reload.average_cost_pesewas
  end

  test "shares always add up to the exact extra cost, to the pesewa" do
    # Three equal lines sharing GH₵ 1.00: 33.33 each would lose a pesewa.
    purchase = Purchase.new(user: @owner, supplier: suppliers(:kumasi), purchased_on: Date.current,
      delivery_method: "pickup", transport_cost: "0.60", extra_costs: "0.40")
    purchase.save_with_items([
      { variant_id: variants(:dress_m_black).id, quantity: 1, unit_cost: "10" },
      { variant_id: variants(:dress_m_red).id, quantity: 1, unit_cost: "10" },
      { variant_id: variants(:dress_l_black).id, quantity: 1, unit_cost: "10" }
    ])

    purchase.receive!(by: @owner)

    landed = purchase.items.reload.map(&:landed_total_pesewas)
    assert_equal [ 1033, 1033, 1034 ], landed.sort
    assert_equal purchase.total_pesewas, landed.sum
  end

  test "receiving twice is refused and adds nothing" do
    @purchase.receive!(by: @owner)

    assert_no_difference "StockMovement.count" do
      assert_raises(Purchase::AlreadyReceived) { Purchase.find(@purchase.id).receive!(by: @owner) }
    end
    assert_equal 10, variants(:dress_m_black).reload.stock_on_hand
  end

  test "a received purchase can't be changed behind the stock's back, or deleted" do
    @purchase.receive!(by: @owner)
    received = Purchase.find(@purchase.id)

    # A plain update would change it without correcting stock; revise! is the way.
    assert_not received.update(note: "changed my mind")
    assert_not received.destroy
    assert Purchase.exists?(received.id)
  end

  test "an ordered purchase can be edited, and rows left at zero are dropped" do
    assert @purchase.save_with_items([
      { variant_id: variants(:dress_m_black).id, quantity: 3, unit_cost: "55" },
      { variant_id: variants(:dress_m_red).id, quantity: 0, unit_cost: "55" }
    ])

    assert_equal [ [ variants(:dress_m_black).id, 3, 5500 ] ],
      @purchase.items.reload.pluck(:variant_id, :quantity, :unit_cost_pesewas)
  end

  test "needs at least one item, and a failed save changes nothing" do
    assert_not @purchase.save_with_items([])
    assert_includes @purchase.errors[:items].first, "at least one item"

    assert_not @purchase.save_with_items([ { variant_id: variants(:dress_m_black).id, quantity: 2, unit_cost: "abc" } ])
    assert_includes @purchase.errors[:items].first, "Ankara wrap dress, M / Black"

    assert_equal 2, @purchase.items.reload.count
  end

  test "an ordered purchase can be deleted, taking its lines with it" do
    assert_difference({ "Purchase.count" => -1, "PurchaseItem.count" => -2 }) do
      @purchase.destroy
    end
  end
end
