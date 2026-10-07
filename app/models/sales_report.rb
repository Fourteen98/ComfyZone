# Every figure on the Reports page, for one period.
#
#   report = SalesReport.new(ReportPeriod.preset("week"))
#   report.totals          # { orders: 12, units: 19, sales_pesewas: ..., ... }
#   report.over_time       # one row per day (or per month for long periods)
#   report.top_products    # best sellers
#
# This is a "query object": a plain Ruby class whose only job is to ask the
# database questions. The queries here span four tables and would bloat any
# one model; gathered in one place they can be read, tested and reused (the
# dashboard uses this class too).
#
# Two rules run through all of it:
#   1. A sale counts on the day the order was MADE (orders.created_at), and
#      only while the order is still a sale (not cancelled, not returned).
#   2. The database does the adding up. Every method is one or two grouped
#      queries, never a Ruby loop over orders.
class SalesReport
  attr_reader :period

  def initialize(period)
    @period = period
  end

  def totals
    @totals ||= begin
      lines = line_items.pick(Arel.sql("COALESCE(SUM(order_items.quantity), 0)"), Arel.sql("COALESCE(SUM(#{COST}), 0)"))
      sales = orders.sum(:total_pesewas)
      { orders: orders.count, units: lines[0], sales_pesewas: sales, cost_pesewas: lines[1], profit_pesewas: sales - lines[1] }
    end
  end

  # Sales through the period, with no gaps: a day with no sales is a row of
  # zeros, so a chart shows the quiet days too.
  #
  # Up to about two months this is one row per day; longer than that, one
  # per month, or the chart would be an unreadable comb.
  def over_time
    by_month = period.days > 62
    bucket = by_month ? "DATE_TRUNC('month', #{LOCAL_TIME})::date" : "DATE(#{LOCAL_TIME})"

    # .group(...).sum(...) returns a Hash: { Date => total }
    sales = orders.group(Arel.sql(bucket)).sum(:total_pesewas)
    counts = orders.group(Arel.sql(bucket)).count
    costs = line_items.group(Arel.sql(bucket)).sum(Arel.sql(COST))

    steps = by_month ? months_in_period : period.from..period.to
    steps.map do |date|
      {
        date: date.iso8601,
        label: date.strftime(by_month ? "%b %Y" : "%a %-d %b"),
        short: date.strftime(by_month ? "%b" : "%-d"),
        orders: counts.fetch(date, 0),
        sales_pesewas: sales.fetch(date, 0),
        profit_pesewas: sales.fetch(date, 0) - costs.fetch(date, 0)
      }
    end
  end

  def top_products(limit = 10)
    line_items.joins(variant: :product)
      .group("products.id", "products.name")
      .order(Arel.sql("SUM(#{REVENUE}) DESC"))
      .limit(limit)
      .pluck("products.id", "products.name", Arel.sql("SUM(order_items.quantity)"), Arel.sql("SUM(#{REVENUE})"), Arel.sql("SUM(#{COST})"))
      .map { |id, name, units, sales, cost| { id: id, name: name, units: units, sales_pesewas: sales, profit_pesewas: sales - cost } }
  end

  # LEFT JOIN, so orders with no channel are kept, as one "Not recorded" row.
  def by_channel
    orders.left_joins(:sales_channel)
      .group("sales_channels.id", "sales_channels.name")
      .order(Arel.sql("SUM(orders.total_pesewas) DESC"))
      .pluck("sales_channels.name", Arel.sql("COUNT(*)"), Arel.sql("SUM(orders.total_pesewas)"))
      .map { |name, count, sales| { name: name || "Not recorded", orders: count, sales_pesewas: sales } }
  end

  def lives(limit = 8)
    orders.joins(:live_session)
      .group("live_sessions.id", "live_sessions.title")
      .order(Arel.sql("SUM(orders.total_pesewas) DESC"))
      .limit(limit)
      .pluck("live_sessions.id", "live_sessions.title", Arel.sql("COUNT(*)"), Arel.sql("SUM(orders.total_pesewas)"))
      .map { |id, title, count, sales| { id: id, name: title, orders: count, sales_pesewas: sales } }
  end

  def top_customers(limit = 10)
    orders.joins(:customer)
      .group("customers.id")
      .order(Arel.sql("SUM(orders.total_pesewas) DESC"))
      .limit(limit)
      .pluck("customers.id", Arel.sql("COUNT(*)"), Arel.sql("SUM(orders.total_pesewas)"))
      .then { |rows|
        names = Customer.where(id: rows.map(&:first)).index_by(&:id)
        rows.map { |id, count, sales| { id: id, name: names[id].display_name, orders: count, sales_pesewas: sales } }
      }
  end

  # Money that actually arrived in the period, by how it was paid, with
  # refunds taken off. Note the different clock: this goes by the day the
  # PAYMENT was recorded, so it won't equal sales (an order claimed on
  # Friday may be paid on Monday, and delivery fees are in here too).
  def money_in
    Payment.where(created_at: period.range).group(:via).sum(:amount_pesewas)
      .map { |via, amount| { name: Payment::WAYS.fetch(via, via), amount_pesewas: amount } }
      .sort_by { |row| -row[:amount_pesewas] }
  end

  # What the business spent in the period on things that aren't stock.
  def expenses_pesewas
    Expense.during(period).sum(:amount_pesewas)
  end

  def expenses_by_category
    Expense.during(period).by_category.map { |name, amount| { name: name, amount_pesewas: amount } }
  end

  private
    # Times are stored in UTC. To ask "which DAY was this?" they must first
    # be shifted to the business's clock, or a sale at 12:30 am would land
    # on the wrong day for anyone not on UTC. (Accra happens to BE on UTC,
    # so you won't see a difference, but the code is right for anywhere.)
    LOCAL_TIME = "orders.created_at AT TIME ZONE 'UTC' AT TIME ZONE '#{Time.zone.tzinfo.name}'".freeze
    REVENUE = "order_items.quantity * order_items.unit_price_pesewas".freeze
    COST = "order_items.quantity * order_items.unit_cost_pesewas".freeze

    def orders
      Order.counted.where(created_at: period.range)
    end

    def line_items
      OrderItem.joins(:order).merge(orders)
    end

    def months_in_period
      first = period.from.beginning_of_month
      (0..).lazy.map { |n| first >> n }.take_while { |month| month <= period.to }.to_a
    end
end
