# Money spent on running the business (not on stock).
class ExpensesController < InertiaController
  require_permission "expenses.view", only: :index
  require_permission "expenses.manage", except: :index
  before_action :set_expense, only: %i[ edit update destroy ]

  # GET /expenses?range=month
  def index
    # The same period picker as Reports, starting on this month.
    period = ReportPeriod.from_params(params[:range].present? ? params : { range: "month" })
    expenses = Expense.during(period)
    names = PaymentMethod.names

    render inertia: "Expenses/Index", props: {
      period: { key: period.key, label: period.label, from: period.from.iso8601, to: period.to.iso8601, today: Date.current.iso8601 },
      presets: ReportPeriod::PRESETS.map { |key, label| { key: key, label: label } },
      total_pesewas: expenses.sum(:amount_pesewas),
      by_category: expenses.by_category.map { |name, amount| { name: name, amount_pesewas: amount } },
      expenses: expenses.newest_first.includes(:user).limit(500).map { |expense|
        {
          id: expense.id,
          spent_on: expense.spent_on.strftime("%-d %b %Y"),
          category: expense.category,
          amount_pesewas: expense.amount_pesewas,
          note: expense.note,
          paid_via: expense.paid_via && names[expense.paid_via],
          by: expense.user.name
        }
      },
      can_manage: can?("expenses.manage")
    }
  end

  # GET /expenses/new
  def new
    render inertia: "Expenses/Form", props: form_props(nil)
  end

  # POST /expenses
  def create
    expense = Expense.new(expense_params.merge(user: Current.user))

    if expense.save
      redirect_to expenses_path, notice: "Recorded GH₵ #{expense.amount} for #{expense.category}."
    else
      redirect_to new_expense_path, inertia: { errors: expense.errors }
    end
  end

  # GET /expenses/:id/edit
  def edit
    render inertia: "Expenses/Form", props: form_props(@expense)
  end

  # PATCH /expenses/:id
  def update
    if @expense.update(expense_params)
      redirect_to expenses_path, notice: "Saved."
    else
      redirect_to edit_expense_path(@expense), inertia: { errors: @expense.errors }
    end
  end

  # DELETE /expenses/:id
  def destroy
    @expense.destroy!
    redirect_to expenses_path, notice: "Expense deleted.", status: :see_other
  end

  private
    def set_expense
      @expense = Expense.find(params.expect(:id))
    end

    def expense_params
      # .presence turns "" (nothing chosen) into nil for the optional field.
      permitted = params.expect(expense: [ :spent_on, :category, :amount, :note, :paid_via ])
      permitted.merge(paid_via: permitted[:paid_via].presence)
    end

    def form_props(expense)
      {
        expense: expense && {
          id: expense.id, spent_on: expense.spent_on.iso8601, category: expense.category, amount: expense.amount,
          note: expense.note.to_s, paid_via: expense.paid_via.to_s
        },
        today: Date.current.iso8601,
        categories: Expense.categories,
        ways_to_pay: PaymentMethod.options
      }
    end
end
