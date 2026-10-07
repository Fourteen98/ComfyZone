# Settings > Payment methods: the ways money moves.
class Settings::PaymentMethodsController < InertiaController
  require_permission "settings.manage"
  before_action :set_method, only: %i[ edit update destroy move ]

  # GET /settings/payments
  def index
    # How many payments and expenses used each method, in two queries.
    used = Payment.group(:via).count.merge(Expense.where.not(paid_via: nil).group(:paid_via).count) { |_, a, b| a + b }

    render inertia: "Settings/PaymentMethods/Index", props: {
      methods: PaymentMethod.ordered.map { |method|
        { id: method.id, name: method.name, wants_reference: method.wants_reference, active: method.active,
          used_count: used.fetch(method.key, 0) }
      }
    }
  end

  # GET /settings/payments/new
  def new
    render inertia: "Settings/PaymentMethods/Form", props: { method: nil }
  end

  # POST /settings/payments
  def create
    method = PaymentMethod.new(method_params)

    if method.save
      redirect_to settings_payment_methods_path, notice: "Added #{method.name}."
    else
      redirect_to new_settings_payment_method_path, inertia: { errors: method.errors }
    end
  end

  # GET /settings/payments/:id/edit
  def edit
    render inertia: "Settings/PaymentMethods/Form", props: {
      method: { id: @method.id, name: @method.name, wants_reference: @method.wants_reference, active: @method.active,
                used: @method.used? }
    }
  end

  # PATCH /settings/payments/:id
  def update
    if @method.update(method_params)
      redirect_to settings_payment_methods_path, notice: "Saved #{@method.name}."
    else
      redirect_to edit_settings_payment_method_path(@method), inertia: { errors: @method.errors }
    end
  end

  # DELETE /settings/payments/:id
  def destroy
    # destroy (no !) returns false when the model refuses: a method that
    # has been used can only be hidden.
    if @method.destroy
      redirect_to settings_payment_methods_path, notice: "Deleted #{@method.name}.", status: :see_other
    else
      redirect_to edit_settings_payment_method_path(@method), alert: @method.errors.full_messages.to_sentence, status: :see_other
    end
  end

  # PATCH /settings/payments/:id/move?direction=up
  def move
    @method.move(params[:direction] == "up" ? :up : :down)
    redirect_to settings_payment_methods_path
  end

  private
    def set_method
      @method = PaymentMethod.find(params.expect(:id))
    end

    def method_params
      params.expect(payment_method: [ :name, :wants_reference, :active ])
    end
end
