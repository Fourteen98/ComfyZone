# Lives: start one, sell during it, end it, and look back at how it went.
class LiveSessionsController < InertiaController
  include SaleCapture

  require_permission "orders.view", only: %i[ index show ]
  require_permission "orders.create", only: %i[ create finish edit update destroy ]
  before_action :set_live, only: %i[ show finish edit update destroy ]

  # GET /live
  # If a live is running, go straight to it: one tap from the menu to selling.
  def index
    return redirect_to live_path(LiveSession.current) if LiveSession.current

    lives = LiveSession.newest_first.limit(30).to_a
    # Totals for all the listed lives in two grouped queries.
    counted = Order.counted.where(live_session: lives)
    totals = counted.group(:live_session_id).sum(:total_pesewas)
    counts = counted.group(:live_session_id).count

    render inertia: "Live/Index", props: {
      lives: lives.map { |live|
        {
          id: live.id,
          title: live.title,
          started: live.started_at.strftime("%-d %b %Y, %-l:%M %P"),
          minutes: ((live.ended_at - live.started_at) / 60).round,
          orders: counts.fetch(live.id, 0),
          total_pesewas: totals.fetch(live.id, 0)
        }
      },
      # A live happens on a social channel (somewhere with usernames).
      channels: sales_channels(SalesChannel.active.social),
      default_channel_id: SalesChannel.default_for_live&.id,
      can_start: can?("orders.create")
    }
  end

  # POST /live
  def create
    channel = SalesChannel.active.social.find_by(id: params.dig(:live, :sales_channel_id)) || SalesChannel.default_for_live
    live = LiveSession.new(title: params.dig(:live, :title), sales_channel: channel, user: Current.user)

    if live.save
      redirect_to live_path(live), notice: "You're live. Tap what people claim."
    else
      redirect_to live_index_path, alert: live.errors.full_messages.to_sentence
    end
  rescue ActiveRecord::RecordNotUnique
    # Two taps at the same instant: the database let only one through.
    redirect_to live_path(LiveSession.current)
  end

  # GET /live/:id
  def show
    orders = @live.orders.newest_first.includes(:customer, :sales_channel, items: { variant: :product })
    counted = orders.select(&:counts?)

    props = {
      live: {
        id: @live.id,
        title: @live.title,
        channel: @live.sales_channel&.name, # "TikTok"
        running: @live.running?,
        # ISO 8601, so the browser can show "42 min" and keep it ticking.
        started_at: @live.started_at.iso8601,
        started: @live.started_at.strftime("%-d %b %Y, %-l:%M %P"),
        ended: @live.ended_at&.strftime("%-l:%M %P"),
        minutes: @live.ended_at && ((@live.ended_at - @live.started_at) / 60).round
      },
      stats: {
        orders: counted.size,
        units: counted.sum(&:units),
        total_pesewas: counted.sum(&:total_pesewas),
        profit_pesewas: can?("costs.view") ? counted.sum(&:profit_pesewas) : nil
      },
      orders: counted.first(@live.running? ? 20 : 500).map { |order| order_summary(order) },
      can_sell: can?("orders.create")
    }

    # After a live has ended, "Add a missed order" (?add=1) brings the same
    # claim screen back for it.
    props[:adding] = !@live.running? && params[:add].present? && can?("orders.create")

    # The product and buyer lists are only needed while selling.
    if (@live.running? || props[:adding]) && can?("orders.create")
      props[:products] = sellable_products
      props[:buyers] = known_buyers
      props[:locations] = location_options # to note where a buyer is
    end

    render inertia: "Live/Show", props: props
  end

  # PATCH /live/:id/finish
  def finish
    @live.finish!
    redirect_to live_path(@live), notice: "Live ended. Here is how it went."
  end

  # GET /live/:id/edit
  def edit
    render inertia: "Live/Edit", props: {
      live: { id: @live.id, title: @live.title, sales_channel_id: @live.sales_channel_id.to_s, orders: @live.orders.count,
              running: @live.running? },
      channels: sales_channels(SalesChannel.active.social.or(SalesChannel.where(id: @live.sales_channel_id)))
    }
  end

  # PATCH /live/:id
  def update
    channel = SalesChannel.social.find_by(id: params.dig(:live, :sales_channel_id))

    saved = LiveSession.transaction do
      next false unless @live.update(title: params.dig(:live, :title), sales_channel: channel || @live.sales_channel)

      # The live's orders say where they came from too. Keep them in step.
      @live.orders.update_all(sales_channel_id: @live.sales_channel_id) if @live.saved_change_to_sales_channel_id?
      true
    end

    if saved
      redirect_to live_path(@live), notice: "Saved."
    else
      redirect_to edit_live_path(@live), inertia: { errors: @live.errors }
    end
  end

  # DELETE /live/:id
  # Only a live nothing was sold on (one started by mistake). A live with
  # orders is part of the record; rename it instead.
  def destroy
    if @live.orders.exists?
      redirect_to live_path(@live), alert: "This live has orders, so it can't be deleted. You can rename it.", status: :see_other
    else
      @live.destroy!
      redirect_to live_index_path, notice: "Deleted #{@live.title}.", status: :see_other
    end
  end

  private
    def set_live
      @live = LiveSession.find(params.expect(:id))
    end
end
