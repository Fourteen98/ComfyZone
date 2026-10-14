# The Orders page's search, filters and pages, in one place.
#
#   search = OrderSearch.new(q: "ama", when: "week", pay: "owing", page: 2)
#   search.orders     # this page's orders (25 at most), newest first
#   search.total      # how many match, across all pages
#   search.counts     # how many in each tab, WITHIN the other filters
#
# Every filter narrows the same base list, so the tab counts always agree
# with what she sees. Nothing here is loaded until it is asked for.
class OrderSearch
  PER_PAGE = 25

  # Tabs that are not a single status.
  VIEWS = {
    "owing"   => ->(scope) { scope.owing.where(status: %w[ packed delivered ]) }, # gone out, not fully paid
    "refunds" => ->(scope) { scope.refund_due }
  }.freeze

  WHEN = {
    "today" => "Today",
    "week"  => "This week",
    "month" => "This month",
    "30days" => "Last 30 days"
  }.freeze

  PAY = {
    "unpaid" => "Nothing paid",
    "part"   => "Part paid",
    "paid"   => "Paid in full",
    "stale"  => "Unpaid 3+ days"
  }.freeze

  FROM = { "live" => "From a live", "direct" => "Not from a live" }.freeze
  DELIVERY = { "pickup" => "They collect", "delivery" => "Sent to them", "unset" => "Not decided" }.freeze

  attr_reader :status, :q, :when, :pay, :from, :delivery, :channel_id, :page

  def initialize(params = {})
    params = params.to_h.symbolize_keys
    @status = (Order.statuses.keys + VIEWS.keys).include?(params[:status]) ? params[:status] : nil
    @q = params[:q].to_s.squish.first(60)
    @when = WHEN.key?(params[:when]) ? params[:when] : nil
    @pay = PAY.key?(params[:pay]) ? params[:pay] : nil
    @from = FROM.key?(params[:from]) ? params[:from] : nil
    @delivery = DELIVERY.key?(params[:delivery]) ? params[:delivery] : nil
    @channel_id = SalesChannel.find_by(id: params[:channel_id])&.id
    @page = [ params[:page].to_i, 1 ].max
  end

  # This page of the chosen tab.
  def orders
    @orders ||= in_tab.newest_first.offset((page - 1) * PER_PAGE).limit(PER_PAGE)
                      .includes(:customer, :live_session, :sales_channel, items: { variant: :product })
  end

  def total = @total ||= in_tab.count
  def pages = [ (total.to_f / PER_PAGE).ceil, 1 ].max

  # { "claimed" => 4, ..., "owing" => 2, "refunds" => 0, "all" => 17 }
  def counts
    @counts ||= filtered.group(:status).count
      .merge(VIEWS.transform_values { |view| view.call(filtered).count })
      .merge("all" => filtered.counted.count)
  end

  # Any filter besides the tab? (The page shows "Clear filters" if so.)
  def filtering?
    [ q.presence, self.when, pay, from, delivery, channel_id ].any?
  end

  def to_props
    { status: status.to_s, q: q, when: self.when.to_s, pay: pay.to_s, from: from.to_s, delivery: delivery.to_s,
      channel_id: channel_id.to_s, page: page }
  end

  private
    # The filters, without the tab.
    def filtered
      @filtered ||= begin
        scope = Order.all
        scope = search(scope) if q.present?
        scope = scope.where(created_at: period.range) if self.when
        scope = by_payment(scope) if pay
        scope = from == "live" ? scope.where.not(live_session_id: nil) : scope.where(live_session_id: nil) if from
        scope = delivery == "unset" ? scope.where(delivery_method: nil) : scope.where(delivery_method: delivery) if delivery
        scope = scope.where(sales_channel_id: channel_id) if channel_id
        scope
      end
    end

    # ...and the tab on top. "All" leaves out cancelled and returned orders.
    def in_tab
      if VIEWS.key?(status) then VIEWS[status].call(filtered)
      elsif status then filtered.where(status: status)
      else filtered.counted
      end
    end

    def period
      ReportPeriod.preset(self.when)
    end

    # One box finds an order by its number (#123), the buyer's name,
    # username or phone, or a product on it. ILIKE ignores case;
    # sanitize_sql_like stops a typed % or _ acting as a wildcard.
    def search(scope)
      return scope.where(id: q.delete("#").to_i) if q.match?(/\A#?\d{1,7}\z/) && !q.start_with?("0")

      like = "%#{Order.sanitize_sql_like(q.delete_prefix('@'))}%"
      digits = q.gsub(/\D/, "")
      buyers = Customer.where("name ILIKE :like OR handle ILIKE :like", like: like)
      # Phones are stored as +233241234567: match the last digits, so
      # "0241234567", "24 123 4567" and "+233 24..." all find her.
      buyers = buyers.or(Customer.where("phone LIKE ?", "%#{digits.sub(/\A0/, '')}%")) if digits.length >= 6
      products = OrderItem.joins(variant: :product).where("products.name ILIKE ?", like).select(:order_id)

      scope.where(customer_id: buyers.select(:id)).or(scope.where(id: products))
    end

    def by_payment(scope)
      case pay
      when "unpaid" then scope.counted.where(paid_pesewas: 0)
      when "part"   then scope.counted.where("paid_pesewas > 0").where("#{Order::BALANCE_SQL} > 0")
      when "paid"   then scope.counted.where("paid_pesewas > 0").where("#{Order::BALANCE_SQL} <= 0")
      when "stale"  then scope.claimed.where(paid_pesewas: 0).where(created_at: ...3.days.ago)
      end
    end
end
