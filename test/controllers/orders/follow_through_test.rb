require "test_helper"

# Payments, stages, delivery, returns: the requests behind the order page.
class Orders::FollowThroughTest < ActionDispatch::IntegrationTest
  setup do
    @owner = users(:one)
    @black = variants(:dress_m_black) # GH₵ 120
    StockLedger.record!(variant: @black, quantity: 5, reason: "purchase", total_cost_pesewas: 30_000)
    taker = OrderTaker.new(customer: Customer.for_claim("@ama_k"), user: @owner, lines: [ { variant_id: @black.id, quantity: 1 } ])
    taker.save
    @order = taker.order
  end

  # The helper (users(:two)) can see and record orders. Give her more.
  def helper_may(*keys)
    roles(:assistant).update!(permissions: roles(:assistant).permissions + keys)
    sign_in_as(users(:two))
  end

  test "records a payment and reports what is left" do
    sign_in_as(@owner)

    post order_payments_path(@order), params: { payment: { amount: "50", via: "momo", reference: "TX1" } }
    assert_redirected_to order_path(@order)
    assert_equal "GH₵ 50 received. GH₵ 70 still to pay.", flash[:notice]

    post order_payments_path(@order), params: { payment: { amount: "70", via: "cash" } }
    assert_equal "GH₵ 70 received. Paid in full.", flash[:notice]
    assert @order.reload.paid?
  end

  test "a refused payment comes back with the reason under the amount" do
    sign_in_as(@owner)

    post order_payments_path(@order), params: { payment: { amount: "500", via: "momo" } }

    follow_redirect!
    assert_includes inertia.props[:errors][:amount].first, "still owed"
    assert_equal 0, Payment.count
  end

  test "the order page carries the money, the payments and what this person may do" do
    sign_in_as(@owner)
    @order.set_delivery!(delivery_method: "delivery", fee: "20", address: "Osu")
    @order.record_payment!(amount: "100", via: "momo", by: @owner)

    get order_path(@order)

    order = inertia.props[:order]
    assert_equal [ 12_000, 14_000, 10_000, 4_000 ], order.values_at(:total_pesewas, :due_pesewas, :paid_pesewas, :balance_pesewas)
    assert_equal [ "delivery", "20", "Osu" ], order[:delivery].values_at(:method, :fee, :address)
    assert_equal [ [ 10_000, "momo" ] ], order[:payments].map { |payment| payment.values_at(:amount_pesewas, :via) }
    assert_equal({ change: true, edit: true, remove_items: true, fulfil: true, refund: true, cancel: true }, inertia.props[:can].to_h.symbolize_keys)
    assert_equal %w[ momo cash bank other ], inertia.props[:ways_to_pay].pluck(:value)
  end

  test "moves an order to packed, delivered and back" do
    sign_in_as(@owner)

    patch order_stage_path(@order), params: { to: "packed" }
    assert @order.reload.packed?
    patch order_stage_path(@order), params: { to: "delivered" }
    assert @order.reload.delivered?
    patch order_stage_path(@order), params: { to: "back" }
    assert @order.reload.packed?
  end

  test "a move the stage doesn't allow is refused with the reason" do
    sign_in_as(@owner)
    @order.deliver!

    patch order_stage_path(@order), params: { to: "packed" }
    assert_match "delivered", flash[:alert]

    patch order_stage_path(@order), params: { to: "the moon" }
    assert_match "isn't a stage", flash[:alert]
    assert @order.reload.delivered?
  end

  test "saves delivery details, and reports a bad fee" do
    sign_in_as(@owner)

    patch order_delivery_path(@order), params: { delivery: { delivery_method: "delivery", fee: "15.50", address: "Tema C5" } }
    assert_equal [ "delivery", 1_550, "Tema C5" ], @order.reload.values_at(:delivery_method, :delivery_fee_pesewas, :delivery_address)

    patch order_delivery_path(@order), params: { delivery: { delivery_method: "delivery", fee: "x", address: "" } }
    follow_redirect!
    assert inertia.props[:errors][:delivery_fee].any?
    assert_equal 1_550, @order.reload.delivery_fee_pesewas
  end

  test "records a return, restocking only when asked" do
    sign_in_as(@owner)
    @order.deliver!

    post order_return_path(@order), params: { restock: "false" }

    assert @order.reload.returned?
    assert_equal 4, @black.reload.stock_on_hand
    assert_match "left as it is", flash[:notice]
  end

  test "records a refund" do
    sign_in_as(@owner)
    @order.record_payment!(amount: "120", via: "momo", by: @owner)
    @order.cancel!(by: @owner)

    post order_refunds_path(@order), params: { refund: { amount: "120", via: "momo", note: "Changed her mind" } }

    assert_equal 0, @order.reload.paid_pesewas
    assert_equal "Changed her mind", @order.payments.last.note
  end

  test "the orders page can show who still owes and who is owed a refund" do
    sign_in_as(@owner)
    @order.deliver! # delivered, nothing paid

    get orders_path, params: { status: "owing" }
    assert_equal [ @order.id ], inertia.props[:orders].pluck(:id)
    assert_equal [ 1, 0 ], inertia.props[:counts].values_at(:owing, :refunds)

    @order.record_payment!(amount: "120", via: "cash", by: @owner)
    @order.return!(by: @owner, restock: true)

    get orders_path, params: { status: "refunds" }
    assert_equal [ @order.id ], inertia.props[:orders].pluck(:id)
    get orders_path
    assert_empty inertia.props[:orders], "a returned order is no longer a sale"
  end

  test "the dashboard counts what is owed and what is waiting to be packed" do
    sign_in_as(@owner)
    @order.set_delivery!(delivery_method: "delivery", fee: "20", address: "Osu")
    @order.record_payment!(amount: "100", via: "momo", by: @owner)

    get admin_root_path
    assert_equal [ 0, 4_000 ], [ dashboard_tile(:orders_to_pack), dashboard_tile(:money_owed) ]

    @order.record_payment!(amount: "40", via: "momo", by: @owner)
    get admin_root_path
    assert_equal [ 1, 0 ], [ dashboard_tile(:orders_to_pack), dashboard_tile(:money_owed) ]
    assert_equal 12_000, dashboard_tile(:sales_today), "delivery fees are not sales"
  end

  # ---- Who may do what ---------------------------------------------------

  test "taking payments and moving stages need orders.fulfil" do
    sign_in_as(users(:two))

    post order_payments_path(@order), params: { payment: { amount: "120", via: "cash" } }
    assert_redirected_to admin_root_path
    patch order_stage_path(@order), params: { to: "packed" }
    assert_redirected_to admin_root_path
    assert_equal [ "claimed", 0 ], @order.reload.values_at(:status, :paid_pesewas)

    helper_may "orders.fulfil"
    post order_payments_path(@order), params: { payment: { amount: "120", via: "cash" } }
    assert @order.reload.paid?
  end

  test "refunds and returns need orders.refund" do
    helper_may "orders.fulfil"
    @order.record_payment!(amount: "120", via: "cash", by: @owner)
    @order.deliver!

    post order_refunds_path(@order), params: { refund: { amount: "120", via: "cash" } }
    assert_redirected_to admin_root_path
    post order_return_path(@order), params: { restock: "true" }
    assert_redirected_to admin_root_path
    assert_equal [ "delivered", 12_000 ], @order.reload.values_at(:status, :paid_pesewas)
  end

  test "a helper can cancel a fresh claim but not one that has been paid for" do
    sign_in_as(users(:two))
    @order.record_payment!(amount: "50", via: "cash", by: @owner)

    get order_path(@order)
    assert_not inertia.props[:can][:cancel]
    patch cancel_order_path(@order)
    assert_redirected_to admin_root_path
    assert @order.reload.claimed?

    @order.refund!(amount: "50", via: "cash", by: @owner)
    patch cancel_order_path(@order)
    assert @order.reload.cancelled?
  end
end
