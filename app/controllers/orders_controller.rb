class OrdersController < InertiaController
  include SaleCapture

  require_permission "orders.view", only: %i[ index show ]
  require_permission "orders.create", only: %i[ new create edit update ]
  before_action :set_order, only: %i[ show edit update cancel ]

  # Tabs that are not a single status.
  VIEWS = {
    "owing"   => -> { Order.owing.where(status: %w[ packed delivered ]) }, # gone out, not fully paid
    "refunds" => -> { Order.refund_due }
  }.freeze

  # GET /orders?status=claimed
  def index
    status = (Order.statuses.keys + VIEWS.keys).include?(params[:status]) ? params[:status] : nil
    orders =
      if VIEWS.key?(status) then VIEWS[status].call
      elsif status then Order.where(status: status)
      else Order.counted
      end

    render inertia: "Orders/Index", props: {
      orders: orders.newest_first.includes(:customer, :live_session, :sales_channel, items: { variant: :product }).limit(200)
                    .map { |order| order_summary(order).merge(live: order.live_session&.title) },
      filters: { status: status.to_s },
      counts: Order.group(:status).count.merge(VIEWS.transform_values { |view| view.call.count }),
      can_create: can?("orders.create")
    }
  end

  # GET /orders/:id
  def show
    render inertia: "Orders/Show", props: {
      order: order_summary(@order).merge(
        customer_id: @order.customer_id,
        customer_phone: @order.customer.phone,
        customer_location: @order.customer.location,
        customer_region: @order.customer.region,
        customer_place: @order.customer.delivery_area&.name,
        live: @order.live_session && { id: @order.live_session.id, title: @order.live_session.title },
        recorded_by: @order.user.name,
        note: @order.note,
        profit_pesewas: can?("costs.view") ? @order.profit_pesewas : nil,
        delivery: {
          method: @order.delivery_method,
          fee: @order.delivery_fee, # "25" or "25.50", ready for the form
          fee_pesewas: @order.delivery_fee_pesewas,
          address: @order.delivery_address,
          region: @order.delivery_area&.region,
          place: @order.delivery_area&.name
        },
        # The stages it has been through, for the small timeline.
        timeline: {
          paid: stamp(@order.paid_at), packed: stamp(@order.packed_at), delivered: stamp(@order.delivered_at),
          cancelled: stamp(@order.cancelled_at), returned: stamp(@order.returned_at)
        },
        payments: @order.payments.oldest_first.includes(:user).map { |payment|
          {
            id: payment.id,
            amount_pesewas: payment.amount_pesewas, # negative = a refund
            via: payment.via,
            reference: payment.reference,
            note: payment.note,
            by: payment.user.name,
            at: stamp(payment.created_at)
          }
        }
      ),
      locations: location_options,
      ways_to_pay: Payment::WAYS.map { |value, label| { value: value, label: label } },
      # What THIS person may do to THIS order right now. React only shows
      # buttons; each action checks again on the server.
      can: {
        change: can?("orders.create") && (@order.claimed? || @order.paid? || @order.packed?), # delivery details
        edit: can?("orders.create"),
        remove_items: can?("orders.create") && @order.claimed?,
        fulfil: can?("orders.fulfil"),
        refund: can?("orders.refund"),
        cancel: (@order.claimed? || @order.paid? || @order.packed?) && can?(permission_to_cancel)
      }
    }
  end

  # GET /orders/new   a sale made outside a live (WhatsApp, a walk-in)
  def new
    render inertia: "Orders/New", props: {
      products: sellable_products, buyers: known_buyers, channels: sales_channels, locations: location_options
    }
  end

  # POST /orders
  # The live screen and the new-order page both post here.
  def create
    # A live that has ended can still be given an order that was missed.
    live = LiveSession.find_by(id: params.dig(:order, :live_session_id))
    customer = buyer
    # Where they are, if she said: a region, and a place within it. A place
    # typed for the first time joins the list.
    where = params.dig(:order, :location)
    customer.locate(region: where[:region], place: where[:place]) if where.is_a?(ActionController::Parameters)

    taker = OrderTaker.new(
      customer: customer,
      user: Current.user,
      live_session: live,
      # Ignored during a live, where the live's own channel is used.
      sales_channel: SalesChannel.active.find_by(id: params.dig(:order, :sales_channel_id)),
      delivery: live ? nil : delivery_params(customer), # a live sorts delivery out afterwards
      lines: line_params
    )
    # Back to the live's claim screen (reopened with ?add=1 if it has ended).
    back = live ? live_path(live, add: live.running? ? nil : 1) : new_order_path

    if taker.save
      order = taker.order
      notice = "#{order.customer.display_name}: #{order.units} #{'item'.pluralize(order.units)} claimed."
      redirect_to (live ? back : order_path(order)), notice: notice
    else
      redirect_to back, inertia: { errors: taker.errors }
    end
  end

  # GET /orders/:id/edit
  def edit
    lines_open = @order.claimed?
    on_order = @order.items.to_h { |item| [ item.variant_id, item.quantity ] }

    render inertia: "Orders/Edit", props: {
      order: {
        id: @order.id,
        status: @order.status,
        customer: { id: @order.customer_id, label: @order.customer.display_name },
        sales_channel_id: @order.sales_channel_id.to_s,
        live: @order.live_session&.title, # set = the channel follows the live
        note: @order.note.to_s,
        lines_open: lines_open,
        items: @order.items.sort_by(&:id).map { |item|
          { variant_id: item.variant_id, name: item.variant.full_name, quantity: item.quantity,
            price: Pesewas.to_input(item.unit_price_pesewas), unit_price_pesewas: item.unit_price_pesewas }
        }
      },
      # What can be added. For things already on the order, "in stock"
      # counts the ones this order is holding, since they could be given back.
      products: lines_open ? sellable_products.each { |product|
        product[:variants].each { |variant| variant[:stock] += on_order.fetch(variant[:id], 0) }
      } : [],
      buyers: known_buyers,
      channels: sales_channels(SalesChannel.active.or(SalesChannel.where(id: @order.sales_channel_id)))
    }
  end

  # PATCH /orders/:id
  def update
    given = params.fetch(:order, {})
    editor = OrderEditor.new(
      order: @order,
      user: Current.user,
      # Only replace the buyer if one was sent.
      customer: given[:buyer].present? ? buyer : nil,
      # Anything not sent is left as it is.
      sales_channel: given.key?(:sales_channel_id) ? SalesChannel.find_by(id: given[:sales_channel_id]) : @order.sales_channel,
      note: given.key?(:note) ? given[:note] : @order.note,
      lines: given.key?(:items) ? given.permit(items: %i[ variant_id quantity price ]).fetch(:items, []) : nil
    )

    if editor.save
      redirect_to order_path(@order), notice: "Order updated."
    else
      redirect_to edit_order_path(@order), inertia: { errors: editor.errors }
    end
  end

  # PATCH /orders/:id/cancel
  #
  # Which permission this needs depends on the order, so it can't be a
  # one-line `require_permission` at the top. `authorize!` is the same check,
  # called by hand; `performed?` is true if it has already redirected.
  def cancel
    authorize!(permission_to_cancel)
    return if performed?

    @order.cancel!(by: Current.user)
    notice = "Order cancelled. Its items are back in stock."
    notice += " There is money to give back." if @order.paid_pesewas.positive?
    redirect_back_or_to order_path(@order), notice: notice
  rescue Order::WrongStage => problem
    redirect_back_or_to order_path(@order), alert: problem.message
  end

  private
    def set_order
      @order = Order.includes(:customer, :sales_channel, :delivery_area, items: { variant: :product }).find(params.expect(:id))
    end

    # Whoever records sales may cancel a fresh claim. Once money has been
    # taken or the parcel is packed, it needs the stronger permission.
    def permission_to_cancel
      @order.claimed? && @order.paid_pesewas.zero? ? "orders.create" : "orders.refund"
    end

    def stamp(time)
      time&.strftime("%-d %b, %-l:%M %P")
    end

    # The live screen sends one typed username:   buyer: "@ama_k"
    # The record-a-sale page sends what it knows:  buyer: { id: 4 }
    #                                         or:  buyer: { name: "Mrs Mensah", phone: "024..." }
    def buyer
      given = params.dig(:order, :buyer)
      return Customer.for_claim(given) unless given.is_a?(ActionController::Parameters)

      Customer.for_sale(**given.permit(:id, :handle, :name, :phone).to_h.symbolize_keys)
    end

    # { delivery_method: "delivery", fee: "25", address: "...", area: <DeliveryArea> }, or nil.
    # The area is wherever the buyer is (set just before, in #create).
    def delivery_params(customer)
      given = params.dig(:order, :delivery)
      return unless given.is_a?(ActionController::Parameters)

      given = given.permit(:delivery_method, :fee, :address)
      { delivery_method: given[:delivery_method], fee: given[:fee], address: given[:address], area: customer.delivery_area }
    end

    def line_params
      params.fetch(:order, {}).permit(items: %i[ variant_id quantity ]).fetch(:items, [])
    end
end
