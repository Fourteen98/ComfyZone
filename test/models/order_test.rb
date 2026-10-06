require "test_helper"

# What happens to an order after the claim: money, delivery, stages, and
# undoing the sale. (Making the order is tested in order_taker_test.rb.)
class OrderTest < ActiveSupport::TestCase
  setup do
    @owner = users(:one)
    @black = variants(:dress_m_black) # GH₵ 120
    StockLedger.record!(variant: @black, quantity: 5, reason: "purchase", total_cost_pesewas: 30_000) # cost 60 each
    taker = OrderTaker.new(customer: Customer.for_claim("@ama_k"), user: @owner, lines: [ { variant_id: @black.id, quantity: 2 } ])
    taker.save
    @order = taker.order # GH₵ 240, stock now 3
  end

  def pay(amount, via: "momo", **more)
    @order.record_payment!(amount: amount, via: via, by: @owner, **more)
  end

  # ---- Money -------------------------------------------------------------

  test "a full payment makes the order paid" do
    payment = pay("240", reference: " TX 123 ")

    assert_equal [ 24_000, "momo", "TX 123", @owner ], [ payment.amount_pesewas, payment.via, payment.reference, payment.user ]
    assert @order.paid?
    assert_not_nil @order.paid_at
    assert_equal [ 24_000, 0 ], [ @order.paid_pesewas, @order.balance_pesewas ]
  end

  test "part payments add up, and the order is paid when they cover it" do
    pay("100")
    assert @order.claimed?
    assert_equal 14_000, @order.balance_pesewas

    pay("140", via: "cash")
    assert @order.paid?
    assert_equal 2, @order.payments.count
  end

  test "the running total always equals the sum of the payments" do
    pay("100")
    pay("140")
    @order.refund!(amount: "40", via: "cash", by: @owner)

    assert_equal @order.payments.sum(:amount_pesewas), @order.reload.paid_pesewas
  end

  test "paying more than is owed is refused" do
    error = assert_raises(ActiveRecord::RecordInvalid) { pay("2400") }

    assert_includes error.record.errors[:amount].first, "more than the GH₵ 240 still owed"
    assert_equal [ 0, 0 ], [ @order.reload.paid_pesewas, Payment.count ]
  end

  test "a payment needs a real amount and a known way" do
    assert_includes assert_raises(ActiveRecord::RecordInvalid) { pay("") }.record.errors[:amount], "can't be blank"
    assert_includes assert_raises(ActiveRecord::RecordInvalid) { pay("0") }.record.errors[:amount], "must be more than zero"
    assert assert_raises(ActiveRecord::RecordInvalid) { pay("abc") }.record.errors[:amount].any?
    assert assert_raises(ActiveRecord::RecordInvalid) { pay("10", via: "cheque") }.record.errors[:via].any?
    assert_equal 0, Payment.count
  end

  test "a cancelled order can't be paid" do
    @order.cancel!(by: @owner)

    assert_raises(Order::WrongStage) { pay("240") }
  end

  test "payments can't be edited or deleted" do
    payment = pay("100")

    assert_raises(ActiveRecord::ReadOnlyRecord) { payment.update!(amount_pesewas: 1) }
    assert_raises(ActiveRecord::ReadOnlyRecord) { payment.destroy }
  end

  test "a refund is a negative payment and can turn paid back into to-be-paid" do
    pay("240")
    refund = @order.refund!(amount: "40", via: "cash", by: @owner, note: "Overcharged")

    assert_equal [ -4_000, true, "Overcharged" ], [ refund.amount_pesewas, refund.refund?, refund.note ]
    assert @order.claimed?
    assert_nil @order.paid_at
    assert_equal 4_000, @order.balance_pesewas
  end

  test "a refund can't be more than was paid" do
    pay("100")
    error = assert_raises(ActiveRecord::RecordInvalid) { @order.refund!(amount: "150", via: "cash", by: @owner) }

    assert_includes error.record.errors[:amount].first, "more than the GH₵ 100 they have paid"
    assert_equal 10_000, @order.reload.paid_pesewas
  end

  # ---- Delivery ----------------------------------------------------------

  test "a delivery fee is added to what is owed but not to sales or profit" do
    @order.set_delivery!(delivery_method: "delivery", fee: "25", address: " Osu, near the mall ")

    assert_equal [ "delivery", 2_500, "Osu, near the mall" ], @order.values_at(:delivery_method, :delivery_fee_pesewas, :delivery_address)
    assert_equal 24_000, @order.total_pesewas
    assert_equal 26_500, @order.due_pesewas
    assert_equal 12_000, @order.profit_pesewas
  end

  test "a pick-up never carries a delivery fee" do
    @order.set_delivery!(delivery_method: "pickup", fee: "25", address: "")

    assert_equal [ "pickup", 0, nil ], @order.values_at(:delivery_method, :delivery_fee_pesewas, :delivery_address)
  end

  test "adding a delivery fee to a paid order makes it to-be-paid again" do
    pay("240")
    @order.set_delivery!(delivery_method: "delivery", fee: "25", address: "Osu")

    assert @order.claimed?
    assert_equal 2_500, @order.balance_pesewas

    pay("25")
    assert @order.paid?
  end

  test "a bad delivery fee or method is refused and nothing changes" do
    assert_raises(ActiveRecord::RecordInvalid) { @order.set_delivery!(delivery_method: "delivery", fee: "lots", address: "") }
    assert_raises(ActiveRecord::RecordInvalid) { @order.set_delivery!(delivery_method: "drone", fee: "", address: "") }
    assert_equal [ nil, 0 ], @order.reload.values_at(:delivery_method, :delivery_fee_pesewas)
  end

  test "delivery can't be changed once delivered" do
    @order.deliver!

    assert_raises(Order::WrongStage) { @order.set_delivery!(delivery_method: "pickup", fee: "", address: "") }
  end

  # ---- Stages ------------------------------------------------------------

  test "paid, packed, delivered, each with its time" do
    pay("240")
    @order.pack!
    assert @order.packed?
    @order.deliver!

    assert @order.delivered?
    assert @order.values_at(:paid_at, :packed_at, :delivered_at).all?
  end

  test "an unpaid order can be packed and delivered: pay on delivery" do
    @order.pack!
    @order.deliver!
    assert_equal [ "delivered", 24_000 ], [ @order.status, @order.balance_pesewas ]
    assert_includes Order.owing, @order

    pay("240", via: "cash")
    assert @order.delivered?, "paying must not move a delivered order backwards"
    assert_not_includes Order.owing, @order
  end

  test "a paid order can be handed over without the packed step" do
    pay("240")
    @order.deliver!

    assert @order.delivered?
    assert_not_nil @order.packed_at
  end

  test "stepping back undoes one stage at a time" do
    pay("240")
    @order.pack!
    @order.deliver!

    @order.step_back!
    assert_equal [ "packed", nil ], [ @order.status, @order.delivered_at ]
    @order.step_back!
    assert_equal [ "paid", nil ], [ @order.status, @order.packed_at ]
    assert_raises(Order::WrongStage) { @order.step_back! }
  end

  test "stepping back an unpaid packed order lands on to-be-paid" do
    @order.pack!
    @order.step_back!

    assert @order.claimed?
  end

  test "stages can't be skipped backwards or repeated" do
    @order.pack!
    assert_raises(Order::WrongStage) { @order.pack! }
    @order.deliver!
    assert_raises(Order::WrongStage) { @order.deliver! }
    assert_raises(Order::WrongStage) { @order.pack! }
  end

  # ---- Undoing a sale ----------------------------------------------------

  test "a paid, packed order can be cancelled: stock returns and a refund is due" do
    pay("240")
    @order.pack!
    @order.cancel!(by: @owner)

    assert @order.cancelled?
    assert_equal 5, @black.reload.stock_on_hand
    assert_equal [ 0, -24_000 ], [ @order.due_pesewas, @order.balance_pesewas ]
    assert_includes Order.refund_due, @order

    @order.refund!(amount: "240", via: "momo", by: @owner)
    assert_not_includes Order.refund_due, @order
    assert @order.reload.cancelled?, "a refund must not bring a cancelled order back"
  end

  test "a delivered order can't be cancelled, only returned" do
    @order.deliver!

    assert_raises(Order::WrongStage) { @order.cancel!(by: @owner) }
    assert_equal 3, @black.reload.stock_on_hand
  end

  test "a return puts the goods back when they are fit to sell" do
    @order.deliver!
    @order.return!(by: @owner, restock: true)

    assert @order.returned?
    assert_not_nil @order.returned_at
    assert_equal 5, @black.reload.stock_on_hand
    assert_equal [ "return", 2 ], @order.stock_movements.order(:id).last.values_at(:reason, :quantity)
  end

  test "a return of spoiled goods leaves stock alone" do
    @order.deliver!

    assert_no_difference "StockMovement.count" do
      @order.return!(by: @owner, restock: false)
    end
    assert_equal 3, @black.reload.stock_on_hand
  end

  test "only a delivered order can be returned, and only once" do
    assert_raises(Order::WrongStage) { @order.return!(by: @owner, restock: true) }
    @order.deliver!
    @order.return!(by: @owner, restock: true)
    assert_raises(Order::WrongStage) { Order.find(@order.id).return!(by: @owner, restock: true) }
    assert_equal 5, @black.reload.stock_on_hand
  end

  test "returned orders stop counting as sales" do
    @order.deliver!
    @order.return!(by: @owner, restock: true)

    assert_not_includes Order.counted, @order
    assert_not @order.counts?
  end

  test "removing a line from a part-paid order can leave it paid" do
    red = variants(:dress_l_red) # GH₵ 140
    StockLedger.record!(variant: red, quantity: 1, reason: "purchase", total_cost_pesewas: 8_000)
    taker = OrderTaker.new(customer: Customer.for_claim("@efua"), user: @owner,
                           lines: [ { variant_id: @black.id, quantity: 1 }, { variant_id: red.id, quantity: 1 } ])
    taker.save
    order = taker.order # 120 + 140
    order.record_payment!(amount: "120", via: "cash", by: @owner)

    order.remove_item!(order.items.find_by(variant: red), by: @owner)

    assert order.paid?
    assert_equal 12_000, order.total_pesewas
  end

  test "items can't be removed once the order is paid" do
    pay("240")

    assert_raises(Order::WrongStage) { @order.remove_item!(@order.items.first, by: @owner) }
  end

  test "the database refuses an unknown status or a negative paid total" do
    assert_raises(ActiveRecord::StatementInvalid) { @order.update_column(:status, "lost") }
    assert_raises(ActiveRecord::StatementInvalid) { @order.update_column(:paid_pesewas, -1) }
  end
end
