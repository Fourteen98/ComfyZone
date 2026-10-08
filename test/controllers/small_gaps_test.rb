require "test_helper"

# Part-returns, stock take, merging duplicates, payment methods, menu
# badges and role dashboards.
class SmallGapsTest < ActionDispatch::IntegrationTest
  setup do
    @owner = users(:one)
    @black = variants(:dress_m_black) # GH₵ 120, cost 60
    @red = variants(:dress_l_red)     # GH₵ 140, cost 80
    StockLedger.record!(variant: @black, quantity: 5, reason: "purchase", total_cost_pesewas: 30_000)
    StockLedger.record!(variant: @red, quantity: 2, reason: "purchase", total_cost_pesewas: 16_000)
    sign_in_as(@owner)
  end

  def delivered_order
    taker = OrderTaker.new(customer: Customer.for_claim("@ama_k"), user: @owner,
                           lines: [ { variant_id: @black.id, quantity: 2 }, { variant_id: @red.id, quantity: 1 } ])
    taker.save
    order = taker.order # 240 + 140 = 380
    order.record_payment!(amount: "380", via: "momo", by: @owner)
    order.deliver!
    order
  end

  # ---- Part-returns -------------------------------------------------------

  test "returning part of an order shrinks it and leaves money to give back" do
    order = delivered_order
    black_line = order.items.find_by(variant: @black)

    post order_return_path(order), params: { restock: "true", items: { black_line.id => 1 } }

    order.reload
    assert order.delivered?, "what they kept is still a delivered sale"
    assert_equal [ 1, 1 ], [ black_line.reload.returned_quantity, black_line.kept ]
    assert_equal [ 26_000, 2, -12_000 ], [ order.total_pesewas, order.units, order.balance_pesewas ]
    assert_equal 4, @black.reload.stock_on_hand
    assert_includes Order.refund_due, order
    assert_match "money to give back", flash[:notice]
  end

  test "returning everything, in one go or in pieces, makes the order returned" do
    order = delivered_order
    lines = order.items.index_by(&:variant_id)

    post order_return_path(order), params: { restock: "false", items: { lines[@red.id].id => 1 } }
    assert order.reload.delivered?
    assert_equal 1, @red.reload.stock_on_hand, "not restocked: it wasn't fit to sell"

    post order_return_path(order), params: { restock: "true", items: { lines[@black.id].id => 2 } }
    assert order.reload.returned?
    assert_equal 5, @black.reload.stock_on_hand
  end

  test "more than was kept can't be returned, and nothing chosen is refused" do
    order = delivered_order
    line = order.items.find_by(variant: @red)

    post order_return_path(order), params: { restock: "true", items: { line.id => 5 } }
    assert_equal 1, line.reload.returned_quantity

    post order_return_path(order), params: { restock: "true", items: { line.id => 1 } }
    assert_match "Nothing was chosen", flash[:alert]
    assert_equal 2, @red.reload.stock_on_hand
  end

  test "reports count only what was kept" do
    order = delivered_order
    order.return_items!(by: @owner, restock: true, quantities: { order.items.find_by(variant: @black).id => 1 })

    totals = SalesReport.new(ReportPeriod.preset("today")).totals

    assert_equal({ orders: 1, units: 2, sales_pesewas: 26_000, cost_pesewas: 14_000, profit_pesewas: 12_000 }, totals)
  end

  test "the database refuses returning more than was sold" do
    line = delivered_order.items.first

    assert_raises(ActiveRecord::StatementInvalid) { line.update_column(:returned_quantity, 99) }
  end

  # ---- Stock take ---------------------------------------------------------

  test "the stock take page lists every active item with what the app thinks" do
    get new_stock_count_path

    assert_inertia_component "Stock/Count"
    dress = inertia.props[:products].find { |product| product[:id] == products(:dress).id }
    assert_equal 5, dress[:variants].find { |v| v[:id] == @black.id }[:stock]
  end

  test "a stock take corrects only what was counted and differs" do
    assert_difference "StockMovement.count", 2 do
      post stock_count_path, params: { counts: { @black.id => "3", @red.id => "2", variants(:dress_m_red).id => "", variants(:dress_l_black).id => "4" } }
    end

    assert_redirected_to stock_index_path
    assert_equal "Stock take saved. 2 items corrected.", flash[:notice]
    assert_equal [ 3, 2, 4 ], [ @black, @red, variants(:dress_l_black) ].map { |v| v.reload.stock_on_hand }
    assert_equal [ "recount", -2, "Stock take" ], @black.stock_movements.order(:id).last.values_at(:reason, :quantity, :note)
  end

  test "one unreadable count refuses the whole sheet" do
    assert_no_difference "StockMovement.count" do
      post stock_count_path, params: { counts: { @black.id => "3", @red.id => "two" } }
    end

    follow_redirect!
    assert_includes inertia.props[:errors][:counts].first, "isn't a whole number"
    assert_equal 5, @black.reload.stock_on_hand
  end

  test "a stock take needs stock.adjust" do
    delete session_path
    sign_in_as(users(:two))

    get new_stock_count_path
    assert_redirected_to admin_root_path
    post stock_count_path, params: { counts: { @black.id => "0" } }
    assert_equal 5, @black.reload.stock_on_hand
  end

  # ---- Merging duplicates -------------------------------------------------

  test "merging a duplicate customer moves their orders and fills in blanks" do
    keep = customers(:kofi) # only a username
    twin = Customer.create!(name: "Kofi Boateng", phone: "055 000 1111", region: "Ashanti")
    order = OrderTaker.new(customer: twin, user: @owner, lines: [ { variant_id: @black.id, quantity: 1 } ]).tap(&:save).order

    post merge_customer_path(keep), params: { other_id: twin.id }

    assert_not Customer.exists?(twin.id)
    assert_equal keep, order.reload.customer
    assert_equal [ "kofi.b", "Kofi Boateng", "+233550001111", "Ashanti" ], keep.reload.values_at(:handle, :name, :phone, :region)
  end

  test "merging never overwrites what was known, and can take over a username" do
    keep = Customer.create!(name: "Ama K", phone: "020 999 8888")

    post merge_customer_path(keep), params: { other_id: customers(:ama).id }

    assert_equal [ "ama_k", "Ama K", "+233209998888", "East Legon" ], keep.reload.values_at(:handle, :name, :phone, :location)
  end

  test "a customer can't be merged with themselves" do
    post merge_customer_path(customers(:ama)), params: { other_id: customers(:ama).id }

    assert Customer.exists?(customers(:ama).id)
    assert_match "Couldn't merge", flash[:alert]
  end

  test "merging a misspelt place moves its customers and orders" do
    twin = DeliveryArea.create!(country: "Ghana", region: "Greater Accra", name: "Ossu")
    customer = Customer.create!(name: "Efua", delivery_area: twin)

    post merge_settings_delivery_area_path(delivery_areas(:osu)), params: { other_id: twin.id }

    assert_not DeliveryArea.exists?(twin.id)
    assert_equal delivery_areas(:osu), customer.reload.delivery_area
  end

  # ---- Payment methods ----------------------------------------------------

  test "a new payment method can be added and used straight away" do
    post settings_payment_methods_path, params: { payment_method: { name: "Telecel Cash", wants_reference: true } }
    method = PaymentMethod.find_by!(name: "Telecel Cash")
    assert_equal [ "telecel-cash", true, 5 ], method.values_at(:key, :wants_reference, :position)

    order = delivered_order
    order.refund!(amount: "10", via: "telecel-cash", by: @owner)
    get order_path(order)
    assert_includes inertia.props[:ways_to_pay].pluck(:label), "Telecel Cash"
    assert_equal "Telecel Cash", inertia.props[:payment_names][:"telecel-cash"]
  end

  test "renaming a method keeps its key, so old payments still find it" do
    patch settings_payment_method_path(payment_methods(:momo)), params: { payment_method: { name: "MoMo", wants_reference: true, active: true } }

    assert_equal [ "momo", "MoMo" ], payment_methods(:momo).reload.values_at(:key, :name)
  end

  test "a used method can be hidden but not deleted; an unused one can go" do
    delivered_order # paid by momo

    delete settings_payment_method_path(payment_methods(:momo))
    assert PaymentMethod.exists?(payment_methods(:momo).id)
    assert_match "Hide it instead", flash[:alert]

    patch settings_payment_method_path(payment_methods(:momo)), params: { payment_method: { name: "Mobile money", active: false } }
    get new_expense_path
    assert_not_includes inertia.props[:ways_to_pay].pluck(:value), "momo"

    delete settings_payment_method_path(payment_methods(:bank))
    assert_not PaymentMethod.exists?(payment_methods(:bank).id)
  end

  test "an unknown way of paying is still refused" do
    order = delivered_order

    assert_raises(ActiveRecord::RecordInvalid) { order.refund!(amount: "10", via: "cheque", by: @owner) }
  end

  # ---- Badges in the menu -------------------------------------------------

  test "every page carries the counts for the menu badges" do
    delivered_order.step_back! # back to packed
    taker = OrderTaker.new(customer: Customer.for_claim("@kofi.b"), user: @owner, lines: [ { variant_id: @black.id, quantity: 1 } ])
    taker.save
    taker.order.record_payment!(amount: "120", via: "cash", by: @owner) # paid = waiting to be packed

    get products_path

    assert_equal 1, inertia.props[:alerts][:to_pack]
    assert_equal StockLedger.needing_attention.count, inertia.props[:alerts][:low_stock]
  end

  test "badges are nil for what a person may not see" do
    delete session_path
    sign_in_as(users(:two)) # no stock.view

    get products_path

    assert_nil inertia.props[:alerts][:low_stock]
    assert_equal 0, inertia.props[:alerts][:to_pack]
  end

  # ---- A standard dashboard per role --------------------------------------

  test "a role's standard dashboard is what its people start with" do
    patch dashboard_path, params: { role_id: roles(:assistant).id, dashboard: { tiles: %w[ orders_to_pack low_stock sales_today ], panels: %w[ recent_orders ] } }

    assert_redirected_to edit_dashboard_path
    # low_stock is dropped: the role can't see stock.
    assert_equal({ "tiles" => %w[ orders_to_pack sales_today ], "panels" => %w[ recent_orders ] }, roles(:assistant).reload.dashboard_layout)
    assert_nil @owner.reload.dashboard_layout, "the person setting it keeps their own"

    delete session_path
    sign_in_as(users(:two))
    get admin_root_path
    assert_equal %w[ orders_to_pack sales_today ], inertia.props[:tiles].pluck(:key)
  end

  test "a person's own choice beats their role's standard" do
    roles(:assistant).update!(dashboard_layout: { "tiles" => %w[ orders_to_pack ], "panels" => [] })
    users(:two).update!(dashboard_layout: { "tiles" => %w[ sales_today ], "panels" => [] })
    delete session_path
    sign_in_as(users(:two))

    get admin_root_path

    assert_equal %w[ sales_today ], inertia.props[:tiles].pluck(:key)
  end

  test "only someone who manages roles can set a role's dashboard" do
    delete session_path
    sign_in_as(users(:two))

    patch dashboard_path, params: { role_id: roles(:owner).id, dashboard: { tiles: %w[ sales_today ], panels: [] } }

    assert_nil roles(:owner).reload.dashboard_layout
    assert_equal %w[ sales_today ], users(:two).reload.dashboard_layout["tiles"], "it was saved as her own instead"
    get edit_dashboard_path
    assert_empty inertia.props[:roles]
  end
end
