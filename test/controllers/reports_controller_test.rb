require "test_helper"
require "csv"

class ReportsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @owner = users(:one)
    @black = variants(:dress_m_black)
    StockLedger.record!(variant: @black, quantity: 5, reason: "purchase", total_cost_pesewas: 30_000)
    taker = OrderTaker.new(customer: Customer.for_claim("@ama_k"), user: @owner, sales_channel: sales_channels(:whatsapp),
                           lines: [ { variant_id: @black.id, quantity: 2 } ])
    taker.save
    @order = taker.order
    @order.record_payment!(amount: "100", via: "momo", by: @owner, reference: "TX9")
  end

  # The helper can't see reports or costs. Give her more.
  def helper_may(*keys)
    roles(:assistant).update!(permissions: roles(:assistant).permissions + keys)
    sign_in_as(users(:two))
  end

  test "shows this week by default, with everything on it" do
    sign_in_as(@owner)

    get reports_path

    assert_inertia_component "Reports/Show"
    assert_equal "week", inertia.props[:period][:key]
    assert_equal [ 1, 2, 24_000, 12_000 ], inertia.props[:totals].values_at(:orders, :units, :sales_pesewas, :profit_pesewas)
    assert_equal [ "WhatsApp" ], inertia.props[:channels].pluck(:name)
    assert_equal [ "Ama Koranteng" ], inertia.props[:customers].pluck(:name)
    assert_equal [ { name: "Mobile money", amount_pesewas: 10_000 } ], inertia.props[:money_in].map { |row| row.to_h.symbolize_keys }
    assert_equal ReportPeriod::PRESETS.keys, inertia.props[:presets].pluck(:key)
  end

  test "a chosen range is used" do
    sign_in_as(@owner)

    get reports_path, params: { range: "custom", from: "2020-01-01", to: "2020-01-31" }

    assert_equal [ "custom", 31 ], inertia.props[:period].values_at(:key, :days)
    assert_equal 0, inertia.props[:totals][:orders]
  end

  test "profit never reaches someone who may not see costs" do
    helper_may "reports.view"

    get reports_path

    assert_not inertia.props[:sees_costs]
    assert_not_includes response.body, "profit_pesewas"
    assert_not_includes response.body, "cost_pesewas"
    assert_nil inertia.props[:customers], "and no customers without customers.view"
  end

  test "needs reports.view" do
    sign_in_as(users(:two))

    get reports_path
    assert_redirected_to root_path
    get export_reports_path(kind: "orders", format: :csv)
    assert_redirected_to root_path
  end

  test "downloads orders as a CSV file" do
    sign_in_as(@owner)

    get export_reports_path(kind: "orders", format: :csv), params: { range: "today" }

    assert_equal "text/csv; charset=utf-8", response.headers["Content-Type"]
    assert_match(/attachment; filename="comfyzone-orders-.*\.csv"/, response.headers["Content-Disposition"])
    rows = CSV.parse(response.body, headers: true)
    assert_equal 1, rows.size
    row = rows.first
    assert_equal [ "Ama Koranteng", "WhatsApp", "claimed", "2", "240.00", "100.00", "140.00", "120.00" ],
      row.values_at("Customer", "Came from", "Status", "Units", "Goods", "Paid", "Balance", "Profit")
    assert_includes row["Items"], "2 x "
  end

  test "the orders file has no cost or profit columns without costs.view" do
    helper_may "reports.view"

    get export_reports_path(kind: "orders", format: :csv)

    assert_not_includes CSV.parse(response.body).first, "Profit"
  end

  test "downloads payments as a CSV file" do
    sign_in_as(@owner)

    get export_reports_path(kind: "payments", format: :csv)

    row = CSV.parse(response.body, headers: true).first
    assert_equal [ @order.id.to_s, "100.00", "Mobile money", "TX9", @owner.name ], row.values_at("Order", "Amount", "How", "Transaction ID", "Recorded by")
  end

  test "text that a spreadsheet would run as a formula is defused" do
    sign_in_as(@owner)
    @order.customer.update!(name: "=HYPERLINK(\"http://evil.example\")")

    get export_reports_path(kind: "orders", format: :csv)

    assert CSV.parse(response.body, headers: true).first["Customer"].start_with?("'=")
  end

  test "only orders and payments can be exported" do
    sign_in_as(@owner)

    get "/reports/export/users.csv"

    assert_response :not_found
  end
end
