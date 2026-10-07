class CustomersController < InertiaController
  require_permission "customers.view", only: :index
  require_permission "customers.manage", except: :index
  before_action :set_customer, only: %i[ edit update ]

  # GET /customers?q=ama
  def index
    customers = Customer.ordered
    if params[:q].present?
      term = "%#{Customer.sanitize_sql_like(params[:q].strip.delete_prefix('@'))}%"
      digits = params[:q].gsub(/\D/, "")
      customers = customers.where(
        "handle ILIKE :term OR name ILIKE :term OR regexp_replace(coalesce(phone, ''), '\\D', '', 'g') LIKE :phone",
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
          location: [ customer.delivery_area&.name, customer.location ].compact.join(", ").presence,
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
    render inertia: "Customers/Form", props: { customer: nil, delivery_areas: areas }
  end

  def create
    customer = Customer.new(customer_params)

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
        delivery_area_id: @customer.delivery_area_id.to_s
      },
      delivery_areas: areas
    }
  end

  def update
    if @customer.update(customer_params)
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
      params.expect(customer: [ :handle, :name, :phone, :location, :note, :delivery_area_id ])
    end

    def areas
      DeliveryArea.active.ordered.map { |area| { value: area.id.to_s, label: area.name } }
    end
end
