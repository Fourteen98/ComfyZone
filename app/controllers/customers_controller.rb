class CustomersController < InertiaController
  include SaleCapture # for location_options

  require_permission "customers.view", only: %i[ index show ]
  require_permission "customers.manage", except: %i[ index show ]
  before_action :set_customer, only: %i[ show edit update merge ]

  # GET /customers?q=ama
  # GET /customers?show=quiet   good customers who haven't bought in 30 days
  def index
    quiet = params[:show] == "quiet"
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
    if quiet
      # Best spenders first, in the order the query ranked them.
      ranked = CustomerInsights.gone_quiet.map(&:first)
      customers = customers.where(id: ranked).includes(:delivery_area).to_a.sort_by { |customer| ranked.index(customer.id) }
    else
      customers = customers.includes(:delivery_area).limit(300).to_a
    end

    counted = Order.counted.where(customer: customers)
    counts = counted.group(:customer_id).count
    spent = counted.group(:customer_id).sum(:total_pesewas)
    last = counted.group(:customer_id).maximum(:created_at)

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
          spent_pesewas: spent.fetch(customer.id, 0),
          last_order: last[customer.id] && last_order_words(last[customer.id])
        }
      },
      filters: { q: params[:q].to_s, show: quiet ? "quiet" : "all" },
      quiet_count: CustomerInsights.gone_quiet.size,
      total: Customer.count,
      can_manage: can?("customers.manage")
    }
  end

  # GET /customers/:id   everything the shop knows about them
  def show
    insights = CustomerInsights.new(@customer)
    orders = @customer.orders.includes(:sales_channel, items: { variant: :product }).order(created_at: :desc).limit(50)

    render inertia: "Customers/Show", props: {
      customer: {
        id: @customer.id,
        display_name: @customer.display_name,
        name: @customer.name,
        handle: @customer.handle,
        phone: @customer.phone,
        where: [ @customer.where_text, @customer.location ].compact.join(", ").presence,
        note: @customer.note,
        since: @customer.created_at.strftime("%-d %b %Y")
      },
      summary: insights.summary.merge(
        first_at: insights.summary[:first_at]&.strftime("%-d %b %Y"),
        last_at: insights.summary[:last_at]&.strftime("%-d %b %Y")
      ),
      favourites: insights.favourites.map { |option, labels| { option: option, labels: labels.map { |label, units| { label: label, units: units } } } },
      top_products: insights.top_products,
      pays: insights.pays,
      orders: orders.map { |order|
        { id: order.id, at: order.created_at.strftime("%-d %b %Y"), status: order.status, channel: order.sales_channel&.name,
          total_pesewas: order.due_pesewas, balance_pesewas: order.balance_pesewas,
          items: order.items.map { |item| "#{item.kept} × #{item.variant.full_name}" }.join(", ") }
      },
      waiting: @customer.stock_requests.open.includes(variant: :product).map { |request| waiting_props(request) },
      # For "asked for something you don't have?": the catalogue, to find the size.
      products: can?("customers.manage") ? findable_products : nil,
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
    # "3 days ago", "2 months ago": for the list, where a date makes her count.
    def last_order_words(time)
      days = (Date.current - time.to_date).to_i
      return "today" if days.zero?
      return "yesterday" if days == 1

      "#{helpers.time_ago_in_words(time)} ago"
    end

    # Every product and its sizes, small enough to search in the browser.
    def findable_products
      Product.active.ordered.includes(:variants).map { |product|
        { id: product.id, name: product.name,
          variants: product.variants.map { |variant| { id: variant.id, name: variant.name, option_values: variant.option_values, stock: variant.stock_on_hand } } }
      }
    end

    def waiting_props(request)
      { id: request.id, product: request.variant.product.name, variant: request.variant.name, quantity: request.quantity,
        since: request.created_at.strftime("%-d %b"), in_stock: request.variant.stock_on_hand.positive?, told: request.told_at.present? }
    end

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
