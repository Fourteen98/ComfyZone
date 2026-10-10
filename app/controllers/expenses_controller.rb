# Money spent on running the business (not on stock).
class ExpensesController < InertiaController
  require_permission "expenses.view", only: :index
  require_permission "expenses.manage", except: :index
  before_action :set_expense, only: %i[ edit update destroy ]

  # GET /expenses?range=month
  def index
    supplier = Supplier.find_by(id: params[:supplier_id])
    # The same period picker as Reports, starting on this month. Looking at
    # one supplier, start on the last two years: "everything from them".
    period = ReportPeriod.from_params(
      if params[:range].present? then params
      elsif supplier then { range: "custom", from: (Date.current - 730).iso8601, to: Date.current.iso8601 }
      else { range: "month" }
      end
    )
    expenses = Expense.during(period)
    expenses = expenses.where(supplier: supplier) if supplier
    names = PaymentMethod.names

    render inertia: "Expenses/Index", props: {
      period: { key: period.key, label: period.label, from: period.from.iso8601, to: period.to.iso8601, today: Date.current.iso8601 },
      presets: ReportPeriod::PRESETS.map { |key, label| { key: key, label: label } },
      total_pesewas: expenses.sum(:amount_pesewas),
      by_category: expenses.by_category.map { |name, amount| { name: name, amount_pesewas: amount } },
      expenses: expenses.newest_first.includes(:user, :supplier, :items).limit(500).map { |expense|
        {
          id: expense.id,
          spent_on: expense.spent_on.strftime("%-d %b %Y"),
          category: expense.category,
          amount_pesewas: expense.amount_pesewas,
          note: expense.note,
          paid_via: expense.paid_via && names[expense.paid_via],
          by: expense.user.name,
          supplier: expense.supplier && { id: expense.supplier.id, name: expense.supplier.name, phone: expense.supplier.phone },
          # "500 × Polymer bags, 1000 × Delivery stickers"
          items: expense.items.map { |item| "#{item.quantity} × #{item.name}" },
          delivery_fee_pesewas: expense.delivery_fee_pesewas
        }
      },
      supplier: supplier && { id: supplier.id, name: supplier.name },
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
    expense.supplier = chosen_supplier

    if expense.save
      redirect_to expenses_path, notice: "Recorded GH₵ #{expense.amount} for #{expense.category}."
    else
      redirect_to new_expense_path, inertia: { errors: errors_for(expense) }
    end
  end

  # GET /expenses/:id/edit
  def edit
    render inertia: "Expenses/Form", props: form_props(@expense)
  end

  # PATCH /expenses/:id
  def update
    @expense.assign_attributes(expense_params)
    @expense.supplier = chosen_supplier

    if @expense.save
      redirect_to expenses_path, notice: "Saved."
    else
      redirect_to edit_expense_path(@expense), inertia: { errors: errors_for(@expense) }
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
      permitted = params.expect(expense: [ :spent_on, :category, :amount, :delivery_fee, :note, :paid_via, :live_session_id,
                                           lines: [ [ :name, :quantity, :unit_cost ] ] ])
      lines = permitted.delete(:lines) || []
      permitted.merge(
        paid_via: permitted[:paid_via].presence,
        live_session_id: LiveSession.find_by(id: permitted[:live_session_id])&.id,
        # Only an expense with items has a delivery fee.
        delivery_fee: lines.any? { |line| line[:name].present? } ? permitted[:delivery_fee] : "0",
        lines: lines.map(&:to_h)
      )
    end

    # An existing supplier (supplier_id), a new one typed in the form
    # (new_supplier: { name, phone }), or nobody. A new one is only built
    # here; saving the expense saves it too, or neither is saved.
    def chosen_supplier
      fields = params.fetch(:expense, {}).permit(:supplier_id, new_supplier: %i[ name phone ])
      return Supplier.new(fields[:new_supplier].to_h) if fields[:new_supplier].present?

      Supplier.find_by(id: fields[:supplier_id])
    end

    # A new supplier's problems go next to its own boxes.
    def errors_for(expense)
      errors = expense.errors.to_hash
      supplier = expense.supplier
      if supplier&.new_record? && supplier.errors.any?
        errors.delete(:supplier)
        errors[:new_supplier_name] = supplier.errors[:name] if supplier.errors[:name].any?
        errors[:new_supplier_phone] = supplier.errors[:phone] if supplier.errors[:phone].any?
      end
      errors
    end

    def form_props(expense)
      {
        expense: expense && {
          id: expense.id, spent_on: expense.spent_on.iso8601, category: expense.category, amount: expense.amount,
          note: expense.note.to_s, paid_via: expense.paid_via.to_s, live_session_id: expense.live_session_id.to_s,
          supplier_id: expense.supplier_id.to_s, delivery_fee: expense.delivery_fee,
          lines: expense.items.map { |item| { name: item.name, quantity: item.quantity.to_s, unit_cost: item.unit_cost } }
        },
        suppliers: Supplier.ordered.map { |supplier| { id: supplier.id, name: supplier.name, phone: supplier.phone } },
        # Set when she came from a supplier's page ("Record supplies from them").
        preselected_supplier_id: Supplier.find_by(id: params[:supplier_id])&.id,
        # Items bought before, with the last price paid: suggestions in the form.
        past_items: ExpenseItem.last_prices,
        today: Date.current.iso8601,
        categories: Expense.categories,
        ways_to_pay: PaymentMethod.options,
        # Recent lives, to pin a cost to one (and the one already chosen, however old).
        lives: (LiveSession.newest_first.limit(30).to_a | [ expense&.live_session ].compact).map { |live|
          { id: live.id, label: "#{live.title} (#{live.started_at.strftime('%-d %b')})" }
        }
      }
    end
end
