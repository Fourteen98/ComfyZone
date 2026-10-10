require "test_helper"

# A size didn't fit: swap it (Order#swap!, lesson 30).
class Orders::SwapsTest < ActionDispatch::IntegrationTest
  setup do
    sign_in_as(users(:one))
    @m = variants(:dress_m_black)
    @l = variants(:dress_l_black)
    StockLedger.record!(variant: @m, quantity: 5, reason: "recount")
    StockLedger.record!(variant: @l, quantity: 5, reason: "recount")

    taker = OrderTaker.new(customer: customers(:ama), user: users(:one), lines: [ { variant_id: @m.id, quantity: 2 } ])
    assert taker.save
    @order = taker.order
    @order.record_payment!(amount: "240", via: "momo", by: users(:one))
    @order.pack!
    @order.deliver!
    @line = @order.items.first
  end

  def swap(**params)
    post order_swap_path(@order), params: { item_id: @line.id, variant_id: @l.id, quantity: 1 }.merge(params)
  end

  test "one M back, one L out: stock both ways, same price, back to 'to deliver'" do
    swap
    @order.reload

    assert_equal [ 4, 4 ], [ @m.reload.stock_on_hand, @l.reload.stock_on_hand ], "M: 3 + 1 back; L: 5 - 1"
    assert_equal [ [ @m.id, 2, 1 ], [ @l.id, 1, 0 ] ], @order.items.order(:id).pluck(:variant_id, :quantity, :returned_quantity)
    assert_equal [ "packed", 24_000, 0 ], [ @order.status, @order.total_pesewas, @order.balance_pesewas ]
    assert_match "swapped 1 × M / Black for L / Black", @order.note
    assert_equal "Swapped for Ankara wrap dress, L / Black.", flash[:notice]
  end

  test "a different price can be charged; the difference is owed" do
    @l.update!(price: "150")
    swap(same_price: false, send_again: false)
    @order.reload

    assert_equal [ "delivered", 27_000, 3000 ], [ @order.status, @order.total_pesewas, @order.balance_pesewas ]
    assert_match "They owe", flash[:notice]
  end

  test "a damaged one isn't restocked; a sold-out size is refused; unpaid orders are edited instead" do
    swap(restock: false)
    assert_equal 3, @m.reload.stock_on_hand

    @l.update_columns(stock_on_hand: 0)
    swap
    assert_match "sold out", flash[:alert]

    other = OrderTaker.new(customer: customers(:ama), user: users(:one), lines: [ { variant_id: @m.id, quantity: 1 } ]).tap(&:save).order
    post order_swap_path(other), params: { item_id: other.items.first.id, variant_id: @l.id, quantity: 1 }
    assert_match "edit it", flash[:alert]
  end

  test "can't swap more than they still have, or for the same thing; needs orders.refund" do
    swap(quantity: 3)
    assert_match "Only 2", flash[:alert]
    post order_swap_path(@order), params: { item_id: @line.id, variant_id: @m.id, quantity: 1 }
    assert_match "same item", flash[:alert]

    roles(:assistant).update!(permissions: %w[ orders.view orders.fulfil ])
    sign_in_as(users(:two))
    swap
    assert_equal 2, @line.reload.kept
  end

  test "the order page offers it" do
    get order_path(@order)
    assert inertia.props[:can][:swap]
    assert_equal [ @line.id ], inertia.props[:swap][:lines].pluck("id")
  end

  # ---------- money back instead (Order#take_back!) ----------

  def take_back(**params)
    post order_take_back_path(@order), params: { item_id: @line.id, quantity: 1 }.merge(params)
  end

  test "the colour they want is sold out: take one back and refund it" do
    take_back(refund: true, amount: "120", via: "momo", reference: "TX123")
    @order.reload

    assert_equal [ "delivered", 12_000, 12_000, 0 ], [ @order.status, @order.total_pesewas, @order.paid_pesewas, @order.balance_pesewas ]
    assert_equal 4, @m.reload.stock_on_hand, "back in stock"
    refund = @order.payments.order(:id).last
    assert_equal [ -12_000, "momo" ], [ refund.amount_pesewas, refund.via ]
    assert_match "TX123", refund.note
    assert_match "took back 1 × Ankara wrap dress, M / Black, money refunded", @order.note
  end

  test "taking everything back makes it a return, and the refund can include delivery" do
    take_back(quantity: 2, refund: true, amount: "240", via: "cash")
    assert @order.reload.returned?
    assert_equal 0, @order.paid_pesewas
  end

  test "no refund now leaves it as a refund due; a refund over what they paid saves nothing" do
    take_back(refund: false)
    assert_equal(-12_000, @order.reload.balance_pesewas)
    assert_includes Order.refund_due, @order

    take_back(refund: true, amount: "500", via: "momo")
    assert_match "Nothing was saved", flash[:alert]
    assert_equal 1, @line.reload.returned_quantity, "the second take-back was rolled back whole"
  end

  test "someone who wanted a sold-out colour goes on its waiting list" do
    @l.update_columns(stock_on_hand: 0)
    post waiting_list_index_path, params: { variant_id: @l.id, customer_id: customers(:ama).id, source: "sale" }
    assert_equal [ customers(:ama), @l ], StockRequest.open.sole.then { |r| [ r.customer, r.variant ] }
  end
end
