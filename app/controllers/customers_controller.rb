class CustomersController < InertiaController
  include SaleCapture # for location_options

  require_permission "customers.view", only: :index
  require_permission "customers.manage", except: :index
  before_action :set_customer, only: %i[ edit update merge ]

  # GET /customers?q=ama
  def index
    customers = Customer.ordered
    if params[:q].present?
      term = "%#{Customer.sanitize_sql_like(params[:q].strip.delete_prefix('@'))}%"
      # Phones are stored as +233242223333, so "024 22" is searched as "24 22".
      digits = PhoneNumber.search_digits(params[:q])
      customers = customers.where(
        "handle ILIKE :term OR name ILIKE :term OR phone LIKE :phone",
        term: term, phone: digits.length >= 3 ? "%#{digits}%" : nil
      )
    end
    customers = customers.includes(:delivery_area).limit(300).to_a

    counted = Order.counted.where(customer: customers)
    counts = counted.group(:customer_id).count
    spent = counted.group(:customer_id).sum(:total_pesewas)

    render inertia: "Customers/Index", props: {
      customers: customers.map { |customer|
        {
          id: customer.id,
          display_name: customer.display_name,
          handle: customer.handle,
          phone: customer.phone,
          # "East Legon, near the Shell station"
          location: [ customer.where_text, customer.location ].compact.join(", ").presence,
          orders_count: counts.fetch(customer.id, 0),
          spent_pesewas: spent.fetch(customer.id, 0)
        }
      },
      filters: { q: params[:q].to_s },
      total: Customer.count,
      can_manage: can?("customers.manage")
    }
  end

  def new
    render inertia: "Customers/Form", props: { customer: nil, locations: location_options }
  end

  def create
    customer = Customer.new(customer_params)
    place(customer)

    if customer.save
      redirect_to customers_path, notice: "Added #{customer.display_name}."
    else
      redirect_to new_customer_path, inertia: { errors: customer.errors }
    end
  end

  def edit
    render inertia: "Customers/Form", props: {
      customer: {
        id: @customer.id, handle: @customer.handle.to_s, name: @customer.name.to_s, phone: @customer.phone.to_s,
        location: @customer.location.to_s, note: @customer.note.to_s,
        **where_now(@customer)
      },
      locations: location_options,
      # Everyone else, for "the same person was entered twice".
      others: known_buyers.reject { |buyer| buyer[:id] == @customer.id },
      orders_count: @customer.orders.count
    }
  end

  # POST /customers/:id/merge   { other_id: 9 }
  def merge
    other = Customer.find(params.expect(:other_id))
    name = other.display_name
    @customer.absorb!(other)
    redirect_to edit_customer_path(@customer), notice: "Merged #{name} into #{@customer.display_name}."
  rescue ArgumentError, ActiveRecord::RecordInvalid => problem
    redirect_to edit_customer_path(@customer), alert: "Couldn't merge: #{problem.message}"
  end

  def update
    @customer.assign_attributes(customer_params)
    place(@customer)

    if @customer.save
      redirect_to customers_path, notice: "Saved #{@customer.display_name}."
    else
      redirect_to edit_customer_path(@customer), inertia: { errors: @customer.errors }
    end
  end

  private
    def set_customer
      @customer = Customer.find(params.expect(:id))
    end

    def customer_params
      params.expect(customer: [ :handle, :name, :phone, :location, :note ])
    end

    # An edit form: whatever it sent replaces where they were, and an
    # emptied location clears it.
    def place(customer)
      where = where_from(params.fetch(:customer, {}))
      customer.relocate(**where) if where
    end
end
