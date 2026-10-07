require "test_helper"

class OrderEditorTest < ActiveSupport::TestCase
  setup do
    @owner = users(:one)
    @black = variants(:dress_m_black) # GH₵ 120, cost 60
    @red = variants(:dress_l_red)     # GH₵ 140, cost 80
    StockLedger.record!(variant: @black, quantity: 5, reason: "purchase", total_cost_pesewas: 30_000)
    StockLedger.record!(variant: @red, quantity: 2, reason: "purchase", total_cost_pesewas: 16_000)
    taker = OrderTaker.new(customer: Customer.for_claim("@ama_k"), user: @owner, sales_channel: sales_channels(:whatsapp),
                           lines: [ { variant_id: @black.id, quantity: 2 } ])
    taker.save
    @order = taker.order # 2 black = GH₵ 240; black stock now 3
  end

  def edit(**changes)
    OrderEditor.new(order: @order, user: @owner, sales_channel: @order.sales_channel, note: @order.note, **changes)
  end

  def line(variant, quantity, price = "")
    { variant_id: variant.id, quantity: quantity, price: price }
  end

  test "raising a quantity takes the extra from stock" do
    assert edit(lines: [ line(@black, 3) ]).save

    assert_equal [ 3, 36_000 ], [ @order.items.first.quantity, @order.total_pesewas ]
    assert_equal 2, @black.reload.stock_on_hand
    assert_equal [ "sale", -1 ], @order.stock_movements.order(:id).last.values_at(:reason, :quantity)
  end

  test "lowering a quantity puts the difference back" do
    assert edit(lines: [ line(@black, 1) ]).save

    assert_equal 12_000, @order.total_pesewas
    assert_equal 4, @black.reload.stock_on_hand
  end

  test "an unchanged order moves no stock" do
    assert_no_difference "StockMovement.count" do
      assert edit(lines: [ line(@black, 2) ]).save
    end
  end

  test "adds a new item with its price and cost snapshots, and drops one left out" do
    assert edit(lines: [ line(@red, 1) ]).save

    assert_equal [ [ @red.id, 1, 14_000, 8_000 ] ], @order.items.reload.map { |i| i.values_at(:variant_id, :quantity, :unit_price_pesewas, :unit_cost_pesewas) }
    assert_equal [ 5, 1 ], [ @black.reload.stock_on_hand, @red.reload.stock_on_hand ]
    assert_equal 14_000, @order.total_pesewas
  end

  test "a typed price is what she charged; cost and profit follow" do
    assert edit(lines: [ line(@black, 2, "100") ]).save

    assert_equal [ 10_000, 20_000, 8_000 ], [ @order.items.first.unit_price_pesewas, @order.total_pesewas, @order.profit_pesewas ]
    assert_equal 12_000, @black.reload.selling_price_pesewas, "the product's own price is untouched"
  end

  test "more than there is refuses the whole edit" do
    assert_no_difference "StockMovement.count" do
      editor = edit(lines: [ line(@black, 1), line(@red, 3) ])

      assert_not editor.save
      assert_includes editor.errors[:items].first, "Only 2 left"
    end
    assert_equal [ 2, 24_000 ], [ @order.items.first.quantity, @order.reload.total_pesewas ]
    assert_equal 3, @black.reload.stock_on_hand
  end

  test "a bad price, or no items at all, is refused" do
    assert_not edit(lines: [ line(@black, 2, "cheap") ]).save
    editor = edit(lines: [ line(@black, 0) ])
    assert_not editor.save
    assert_includes editor.errors[:items].first, "cancel the order"
    assert_equal 24_000, @order.reload.total_pesewas
  end

  test "a part-paid order becomes paid when the lines shrink to what was paid" do
    @order.record_payment!(amount: "120", via: "cash", by: @owner)

    assert edit(lines: [ line(@black, 1) ]).save

    assert @order.paid?
  end

  test "once paid, lines are left alone but details can still change" do
    @order.record_payment!(amount: "240", via: "cash", by: @owner)

    assert edit(lines: [ line(@black, 1) ], note: "Gift wrap", sales_channel: sales_channels(:instagram)).save

    assert_equal [ 2, "Gift wrap", sales_channels(:instagram) ], [ @order.items.first.quantity, @order.note, @order.sales_channel ]
    assert_equal 3, @black.reload.stock_on_hand
  end

  test "the buyer can be corrected, to a known customer or a new one" do
    assert edit(customer: customers(:kofi)).save
    assert_equal customers(:kofi), @order.reload.customer

    assert_difference "Customer.count", 1 do
      assert edit(customer: Customer.for_sale(name: "Mrs Mensah")).save
    end
    assert_equal "Mrs Mensah", @order.reload.customer.name
  end

  test "an order from a live keeps the live's channel" do
    live = LiveSession.create!(user: @owner, sales_channel: sales_channels(:tiktok))
    taker = OrderTaker.new(customer: Customer.for_claim("@kofi.b"), user: @owner, live_session: live, lines: [ { variant_id: @black.id, quantity: 1 } ])
    taker.save

    assert OrderEditor.new(order: taker.order, user: @owner, sales_channel: sales_channels(:whatsapp), note: "").save

    assert_equal sales_channels(:tiktok), taker.order.reload.sales_channel
  end

  test "stock on hand still equals the ledger after a run of edits" do
    edit(lines: [ line(@black, 4), line(@red, 2) ]).save
    edit(lines: [ line(@red, 1) ]).save
    edit(lines: [ line(@black, 1, "99.50"), line(@red, 1) ]).save

    [ @black, @red ].each { |v| assert_equal v.stock_movements.sum(:quantity), v.reload.stock_on_hand }
    assert_equal 9_950 + 14_000, @order.reload.total_pesewas
  end
end
