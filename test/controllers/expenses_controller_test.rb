require "test_helper"

class ExpensesControllerTest < ActionDispatch::IntegrationTest
  def helper_may(*keys)
    roles(:assistant).update!(permissions: roles(:assistant).permissions + keys)
    sign_in_as(users(:two))
  end

  test "records an expense and lists it under this month" do
    sign_in_as(users(:one))

    post expenses_path, params: { expense: { spent_on: Date.current.iso8601, category: "Packaging", amount: "45.50", note: "Mailer bags", paid_via: "momo" } }
    assert_redirected_to expenses_path
    assert_equal "Recorded GH₵ 45.50 for Packaging.", flash[:notice]

    get expenses_path
    assert_inertia_component "Expenses/Index"
    assert_equal "month", inertia.props[:period][:key]
    assert_equal 4_550, inertia.props[:total_pesewas]
    assert_equal [ "Packaging", 4_550, "Mailer bags", "Mobile money" ], inertia.props[:expenses].first.values_at(:category, :amount_pesewas, :note, :paid_via)
  end

  test "a bad expense comes back with the reasons" do
    sign_in_as(users(:one))

    post expenses_path, params: { expense: { spent_on: "", category: "", amount: "x", note: "", paid_via: "" } }

    follow_redirect!
    assert_equal %w[ amount category spent_on ], inertia.props[:errors].keys.map(&:to_s).sort
  end

  test "edits and deletes" do
    sign_in_as(users(:one))
    expense = Expense.create!(user: users(:one), spent_on: Date.current, category: "Rent", amount: "400")

    patch expense_path(expense), params: { expense: { spent_on: Date.current.iso8601, category: "Rent", amount: "450", note: "", paid_via: "" } }
    assert_equal 45_000, expense.reload.amount_pesewas

    delete expense_path(expense)
    assert_not Expense.exists?(expense.id)
  end

  test "the form offers categories and ways to pay" do
    sign_in_as(users(:one))

    get new_expense_path

    assert_equal Expense::SUGGESTED, inertia.props[:categories]
    assert_equal Date.current.iso8601, inertia.props[:today]
  end

  test "looking needs expenses.view; changing needs expenses.manage" do
    sign_in_as(users(:two))
    get expenses_path
    assert_redirected_to admin_root_path

    helper_may "expenses.view"
    get expenses_path
    assert_response :success
    assert_not inertia.props[:can_manage]
    post expenses_path, params: { expense: { spent_on: Date.current.iso8601, category: "Rent", amount: "1" } }
    assert_equal 0, Expense.count
  end

  test "reports show expenses and net profit only to those allowed" do
    Expense.create!(user: users(:one), spent_on: Date.current, category: "Rent", amount: "50")

    sign_in_as(users(:one))
    get reports_path, params: { range: "today" }
    assert_equal 5_000, inertia.props[:expenses][:total_pesewas]
    assert_equal [ "Rent" ], inertia.props[:expenses][:by_category].pluck(:name)
    delete session_path

    helper_may "reports.view"
    get reports_path, params: { range: "today" }
    assert_nil inertia.props[:expenses]
  end

  test "dashboard tiles for expenses and net profit" do
    Expense.create!(user: users(:one), spent_on: Date.current, category: "Rent", amount: "50")
    users(:one).update!(dashboard_layout: { "tiles" => %w[ expenses_month net_profit_month ], "panels" => [] })
    sign_in_as(users(:one))

    get admin_root_path

    assert_equal [ 5_000, -5_000 ], [ dashboard_tile(:expenses_month), dashboard_tile(:net_profit_month) ]
  end

  test "records supplies item by item from a new supplier, saved with their phone" do
    sign_in_as(users(:one))

    assert_difference -> { Supplier.count } => 1, -> { ExpenseItem.count } => 2 do
      post expenses_path, params: { expense: {
        spent_on: Date.current.iso8601, category: "Packaging", amount: "", delivery_fee: "15",
        lines: [ { name: "Polymer bags", quantity: "500", unit_cost: "0.20" }, { name: "Delivery stickers", quantity: "1000", unit_cost: "0.05" } ],
        new_supplier: { name: "Auntie Ama Packaging", phone: "024 123 4567" }
      } }
    end
    assert_equal "Recorded GH₵ 165 for Packaging.", flash[:notice]
    assert_equal "+233241234567", Supplier.find_by!(name: "Auntie Ama Packaging").phone

    get expenses_path
    row = inertia.props[:expenses].first
    assert_equal [ "500 × Polymer bags", "1000 × Delivery stickers" ], row[:items]
    assert_equal [ "Auntie Ama Packaging", 1_500 ], [ row[:supplier][:name], row[:delivery_fee_pesewas] ]

    get new_expense_path
    assert_equal [ "Delivery stickers", "Polymer bags" ], inertia.props[:past_items].map { |item| item[:name] }.sort
  end

  test "a new supplier with a bad phone stops the whole expense" do
    sign_in_as(users(:one))

    assert_no_difference -> { Expense.count } do
      post expenses_path, params: { expense: {
        spent_on: Date.current.iso8601, category: "Packaging",
        lines: [ { name: "Tape", quantity: "2", unit_cost: "10" } ],
        new_supplier: { name: "Somebody", phone: "12" }
      } }
    end
    follow_redirect!
    assert inertia.props[:errors].key?(:new_supplier_phone)
    assert_not inertia.props[:errors].key?(:supplier)
  end

  test "lists only one supplier's expenses, over the last two years" do
    sign_in_as(users(:one))
    supplier = suppliers(:kumasi)
    Expense.create!(user: users(:one), spent_on: Date.current - 100, category: "Packaging", supplier: supplier, lines: [ { name: "Tape", quantity: "2", unit_cost: "10" } ])
    Expense.create!(user: users(:one), spent_on: Date.current, category: "Data", amount: "50")

    get expenses_path(supplier_id: supplier.id)
    assert_equal [ 2_000 ], inertia.props[:expenses].map { |row| row[:amount_pesewas] }
    assert_equal supplier.name, inertia.props[:supplier][:name]
  end
end
