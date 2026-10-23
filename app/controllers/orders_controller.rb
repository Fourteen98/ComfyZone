class OrdersController < InertiaController
  include SaleCapture

  require_permission "orders.view", only: %i[ index show ]
  require_permission "orders.create", only: %i[ new create edit update ]
  before_action :set_order, only: %i[ show edit update cancel ]

  # GET /orders?status=claimed&q=ama&when=week&pay=owing&page=2
  # Search, filters and pages: see OrderSearch.
  def index
    search = OrderSearch.new(params.permit(:status, :q, :when, :pay, :from, :delivery, :channel_id, :page))

    render inertia: "Orders/Index", props: {
      orders: search.orders.map { |order| order_summary(order).merge(live: order.live_session&.title) },
      filters: search.to_props,
      filtering: search.filtering?,
      counts: search.counts,
      page: { number: search.page, pages: search.pages, total: search.total, per: OrderSearch::PER_PAGE },
      # The choices for the filter row.
      options: {
        when: OrderSearch::WHEN.map { |key, label| { value: key, label: label } },
        pay: OrderSearch::PAY.map { |key, label| { value: key, label: label } },
        from: OrderSearch::FROM.map { |key, label| { value: key, label: label } },
        delivery: OrderSearch::DELIVERY.map { |key, label| { value: key, label: label } },
        channels: SalesChannel.order(:name).map { |channel| { value: channel.id.to_s, label: channel.name } }
      },
      any_orders: Order.exists?,
      drafts: can?("orders.create") ? OrderDraft.count : 0,
      can_create: can?("orders.create"),
      # What "Record a sale" needs, for the drawer on this page. Optional:
      # only sent when the drawer asks for it (a partial reload with
      # only: ["sale"]), so the list itself stays quick to load.
      sale: InertiaRails.optional { can?("orders.create") ? sale_props : nil }
    }
  end

  # GET /orders/:id
  def show
    render inertia: "Orders/Show", props: {
      order: order_summary(@order).merge(
        customer_id: @order.customer_id,
        customer_phone: @order.customer.phone,
        customer_location: @order.customer.location,
        customer_country: @order.customer.country,
        customer_region: @order.customer.region,
        customer_place: @order.customer.delivery_area&.name,
        live: @order.live_session && { id: @order.live_session.id, title: @order.live_session.title },
        recorded_by: @order.user&.name || (@order.whatsapp_conversation_id ? "The customer, on WhatsApp" : "The shopper, on the website"),
        # The pay-by deadline (ClaimHold), while it is running.
        hold: ClaimHold.waiting?(@order) ? {
          until: hold_words(@order.hold_until),
          overdue: @order.hold_until <= Time.current,
          whatsapp: @order.whatsapp_conversation_id.present?
        } : nil,
        # Unpaid with no deadline: she can start one.
        can_hold: @order.claimed? && @order.paid_pesewas.zero? && @order.hold_until.nil? && @order.payment_claimed_at.nil?,
        cancel_reason: @order.cancel_reason,
        # A WhatsApp message she can send from her own phone: "please pay by...".
        remind_url: ClaimHold.waiting?(@order) && !@order.whatsapp_conversation_id ? remind_url(@order) : nil,
        reliability: @order.customer.reliability.to_props,
        # Reserved on WhatsApp: the hold, and whether they say they paid.
        whatsapp: @order.whatsapp_conversation_id && {
          chat_id: @order.whatsapp_conversation_id,
          hold_until: @order.claimed? && @order.paid_pesewas.zero? ? @order.hold_until&.strftime("%-l:%M %P") : nil,
          payment_claimed: @order.payment_claimed_at && @order.claimed? ? (@order.payment_claim.presence || "no transaction ID given") : nil
        },
        note: @order.note,
        profit_pesewas: can?("costs.view") ? @order.profit_pesewas : nil,
        delivery: {
          method: @order.delivery_method,
          fee: @order.delivery_fee, # "25" or "25.50", ready for the form
          fee_pesewas: @order.delivery_fee_pesewas,
          address: @order.delivery_address,
          country: @order.delivery_area&.country,
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
      ways_to_pay: PaymentMethod.options,
      # Names for every method, hidden ones too, to label old payments.
      payment_names: PaymentMethod.names,
      # For "swap a size": each line still on the order, and what it could
      # become (every product, with live stock). Only when a swap is possible.
      swap: can?("orders.refund") && (@order.paid? || @order.packed? || @order.delivered?) ? {
        lines: @order.items.includes(variant: :product).select { |item| item.kept.positive? }.map { |item|
          { id: item.id, variant_id: item.variant_id, product_id: item.variant.product_id, name: item.variant.full_name,
            kept: item.kept, unit_price_pesewas: item.unit_price_pesewas }
        },
        products: sellable_products
      } : nil,
      # What THIS person may do to THIS order right now. React only shows
      # buttons; each action checks again on the server.
      can: {
        change: can?("orders.create") && (@order.claimed? || @order.paid? || @order.packed?), # delivery details
        edit: can?("orders.create"),
        remove_items: can?("orders.create") && @order.claimed?,
        fulfil: can?("orders.fulfil"),
        refund: can?("orders.refund"),
        swap: can?("orders.refund") && (@order.paid? || @order.packed? || @order.delivered?),
        cancel: (@order.claimed? || @order.paid? || @order.packed?) && can?(permission_to_cancel)
      }
    }
  end

  # GET /orders/new   a sale made outside a live (WhatsApp, a walk-in)
  def new
    render inertia: "Orders/New", props: sale_props.merge(
      # Sales saved halfway, newest first, and the one being resumed (?draft=5).
      drafts: OrderDraft.newest_first.includes(:user).limit(20).map { |draft|
        { id: draft.id, label: draft.label, by: draft.user.name, at: draft.updated_at.strftime("%-d %b, %-l:%M %P") }
      },
      draft: (found = OrderDraft.find_by(id: params[:draft])) && { id: found.id, label: found.label, payload: found.payload }
    )
  end

  # POST /orders
  # The live screen and the new-order page both post here.
  def create
    # A live that has ended can still be given an order that was missed.
    live = LiveSession.find_by(id: params.dig(:order, :live_session_id))
    customer = buyer
    # Where they are, if she said: a region, and a place within it. A place
    # typed for the first time joins the list.
    where = where_from(params.dig(:order, :location))
    customer.locate(**where) if where

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
    # Recorded from the drawer on the orders list: back to that list.
    from_list = params.dig(:order, :return_to) == "list"
    back = live ? live_path(live, add: live.running? ? nil : 1) : from_list ? orders_list_url : new_order_path

    if taker.save
      order = taker.order
      notice = "#{order.customer.display_name}: #{order.units} #{'item'.pluralize(order.units)} claimed."
      problem = take_payment_now(order) unless live
      # Not paid: the clock starts ("pay within 24 hours"). See ClaimHold.
      ClaimHold.start!(order.reload)
      # Recorded from a draft: the draft has done its job.
      OrderDraft.where(id: params.dig(:order, :draft_id)).destroy_all if params.dig(:order, :draft_id).present?
      if problem
        redirect_to order_path(order), alert: "The sale is recorded, but not the payment: #{problem} Record it below."
      else
        notice += " #{money_words(order)}" if order.paid_pesewas.positive?
        redirect_to (live || from_list ? back : order_path(order)), notice: notice
      end
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

    # "They never paid": counted against the customer (see ClaimHold).
    if params[:reason] == ClaimHold::REASON && @order.claimed? && @order.paid_pesewas.zero?
      ClaimHold.release!(@order, by: Current.user, note: "Not paid: released by #{Current.user.name}.")
      return redirect_back_or_to order_path(@order), notice: "Released. Its items are back on sale, and #{@order.customer.display_name}'s record shows it wasn't paid."
    end

    @order.cancel!(by: Current.user)
    notice = "Order cancelled. Its items are back in stock."
    notice += " There is money to give back." if @order.paid_pesewas.positive?
    redirect_back_or_to order_path(@order), notice: notice
  rescue Order::WrongStage => problem
    redirect_back_or_to order_path(@order), alert: problem.message
  end

  private
    # The orders list she came from, with its search and filters, or the plain list.
    def orders_list_url
      came_from = URI.parse(request.referer.to_s) rescue nil
      came_from.is_a?(URI::HTTP) && came_from.path == orders_path ? came_from.request_uri : orders_path # path and query only: never another site
    end

    # Everything the Record a sale screen needs (the page, and the drawer on the list).
    def sale_props
      {
        products: sellable_products, buyers: known_buyers, channels: sales_channels, locations: location_options,
        # "Did they pay?" on the form: only for people who may take payments.
        ways_to_pay: can?("orders.fulfil") ? PaymentMethod.options : nil
      }
    end

    def set_order
      @order = Order.includes(:customer, :sales_channel, :delivery_area, items: { variant: :product }).find(params.expect(:id))
    end

    # Whoever records sales may cancel a fresh claim. Once money has been
    # taken or the parcel is packed, it needs the stronger permission.
    def permission_to_cancel
      @order.claimed? && @order.paid_pesewas.zero? ? "orders.create" : "orders.refund"
    end

    # wa.me opens WhatsApp on her phone with the message typed in, ready to
    # send from her own number (no WhatsApp API needed). nil without a phone.
    def remind_url(order)
      phone = order.customer.phone or return
      momo = WhatsappSetting.current
      text = "Hi #{order.customer.name.presence || 'there'}, your order ##{order.id} from The Comfy Zone " \
             "(GH₵ #{Pesewas.to_input(order.due_pesewas)}) is waiting for payment. " \
             "Please pay by #{hold_words(order.hold_until)}, or it will be released for others." +
             (momo.momo_number ? " #{momo.momo_line}, reference #{order.id}." : "")
      "https://wa.me/#{phone.delete('+')}?text=#{ERB::Util.url_encode(text)}"
    end

    # "4:30 pm today", "Sat 24 Oct, 4:30 pm"
    def hold_words(time)
      time.to_date == Date.current ? time.strftime("%-l:%M %P today") : time.strftime("%a %-d %b, %-l:%M %P")
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

    # Money taken with the sale (a deposit, or everything), if she said.
    #   payment: { amount: "all" | "200", via: "momo", reference: "..." }
    # "all" means whatever the order came to once saved: bulk prices and
    # the delivery fee are only certain then. Returns a problem, or nil.
    def take_payment_now(order)
      given = params.dig(:order, :payment)
      return unless given.is_a?(ActionController::Parameters) && can?("orders.fulfil")

      given = given.permit(:amount, :via, :reference)
      return if given[:amount].blank?

      amount = given[:amount] == "all" ? Pesewas.to_input(order.balance_pesewas) : given[:amount]
      order.record_payment!(amount: amount, via: given[:via], reference: given[:reference].presence, by: Current.user)
      nil
    rescue ActiveRecord::RecordInvalid => error
      error.record.errors.full_messages.to_sentence + "."
    end

    def money_words(order)
      left = order.reload.balance_pesewas
      "GH₵ #{Pesewas.to_input(order.paid_pesewas)} paid" + (left.positive? ? ", GH₵ #{Pesewas.to_input(left)} still to pay." : ", paid in full.")
    end

    def line_params
      # price: optional, a price agreed with the buyer for that line.
      params.fetch(:order, {}).permit(items: %i[ variant_id quantity price ]).fetch(:items, [])
    end
end
