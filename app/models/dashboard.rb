# One person's dashboard: what COULD be on it, and what they chose.
#
#   dashboard = Dashboard.new(user)
#   dashboard.tiles     # the headline numbers they picked, with values
#   dashboard.panels    # the keys of the panels they picked, in order
#   dashboard.choices   # everything they may pick from, for the Customise page
#
# The list of widgets is code (each one needs a query written for it). Which
# ones a person shows, and in what order, is data: users.dashboard_layout.
# Same split as permissions and roles.
class Dashboard
  # Data.define makes a small read-only value object (Ruby 3.2+).
  #   needs:  permissions the person must ALL hold to see it
  #   format: how React should print the number
  #   value:  a lambda that works the number out. It only runs for tiles
  #           that are actually shown, so an unused tile costs nothing.
  Tile = Data.define(:key, :label, :needs, :format, :href, :value)
  Panel = Data.define(:key, :label, :needs, :wide)

  today = -> { ReportPeriod.preset("today") }
  week  = -> { ReportPeriod.preset("week") }
  month = -> { ReportPeriod.preset("month") }
  sales = ->(period) { SalesReport.new(period).totals }

  TILES = [
    Tile.new("sales_today", "Sales today", %w[ orders.view ], :money, "/admin/orders", -> { sales.(today.())[:sales_pesewas] }),
    Tile.new("sales_week", "Sales this week", %w[ orders.view ], :money, "/admin/reports?range=week", -> { sales.(week.())[:sales_pesewas] }),
    Tile.new("sales_month", "Sales this month", %w[ orders.view ], :money, "/admin/reports?range=month", -> { sales.(month.())[:sales_pesewas] }),
    Tile.new("profit_today", "Profit today", %w[ orders.view costs.view ], :money, "/admin/reports?range=today", -> { sales.(today.())[:profit_pesewas] }),
    Tile.new("profit_month", "Profit this month", %w[ orders.view costs.view ], :money, "/admin/reports?range=month", -> { sales.(month.())[:profit_pesewas] }),
    Tile.new("expenses_month", "Expenses this month", %w[ expenses.view ], :money, "/admin/expenses", -> { Expense.during(month.()).sum(:amount_pesewas) }),
    Tile.new("net_profit_month", "Net profit this month", %w[ orders.view costs.view expenses.view ], :money, "/admin/reports?range=month",
             -> { sales.(month.())[:profit_pesewas] - Expense.during(month.()).sum(:amount_pesewas) }),
    Tile.new("orders_to_pay", "Orders to be paid", %w[ orders.view ], :count, "/admin/orders?status=claimed", -> { Order.claimed.count }),
    Tile.new("orders_to_pack", "Orders to pack", %w[ orders.view ], :count, "/admin/orders?status=paid", -> { Order.paid.count }),
    Tile.new("orders_to_deliver", "Orders to deliver", %w[ orders.view ], :count, "/admin/orders?status=packed", -> { Order.packed.count }),
    Tile.new("money_owed", "Money owed to you", %w[ orders.view ], :money, "/admin/orders?status=claimed", -> { Order.owing.sum(Arel.sql(Order::BALANCE_SQL)) }),
    Tile.new("refunds_due", "Refunds to give", %w[ orders.view ], :count, "/admin/orders?status=refunds", -> { Order.refund_due.count }),
    Tile.new("low_stock", "Low on stock", %w[ stock.view ], :count, "/admin/stock?show=low", -> { StockLedger.needing_attention.count }),
    Tile.new("stock_value", "Stock value", %w[ stock.view costs.view ], :money, "/admin/stock", -> { StockLedger.value_pesewas }),
    # What the shelf should bring in if it all sells, and the profit in it.
    Tile.new("stock_sells_for", "Stock will sell for", %w[ stock.view ], :money, "/admin/stock", -> { StockLedger.sales_estimate.sells_for_pesewas }),
    Tile.new("stock_profit", "Profit in your stock", %w[ stock.view costs.view ], :money, "/admin/stock", -> { StockLedger.sales_estimate.profit_pesewas })
  ].freeze

  PANELS = [
    Panel.new("recent_orders", "Recent orders", %w[ orders.view ], true),
    Panel.new("low_stock", "Low on stock", %w[ stock.view ], false),
    Panel.new("week_sales", "Sales, last 7 days", %w[ orders.view ], true),
    Panel.new("top_products", "Best sellers, last 30 days", %w[ orders.view ], false),
    Panel.new("channels", "Where sales came from, last 30 days", %w[ orders.view ], false)
  ].freeze

  # What someone sees until they choose for themselves.
  DEFAULT = { "tiles" => %w[ sales_today orders_to_pack low_stock money_owed ], "panels" => %w[ recent_orders low_stock ] }.freeze
  MAX_TILES = 8

  # `user` is usually a User. It can also be a Role, to set the dashboard
  # everyone in that role starts with: a Role answers the same three
  # questions this class asks (can?, dashboard_layout, update), so no other
  # code changes. That is "duck typing".
  def initialize(user)
    @user = user
  end

  def customised?
    @user.dashboard_layout.present?
  end

  # The chosen tiles, each with its number worked out.
  def tiles
    chosen(TILES, "tiles").map do |tile|
      # A reports link is no use to someone who can't open reports.
      href = tile.href.start_with?("/admin/reports") && !@user.can?("reports.view") ? nil : tile.href
      { key: tile.key, label: tile.label, format: tile.format, href: href, value: tile.value.call }
    end
  end

  # The chosen panels. The controller fills in each one's contents.
  def panels
    chosen(PANELS, "panels")
  end

  # Everything this person is allowed to put on their dashboard, with what
  # is switched on now, in their order (chosen first, then the rest).
  def choices
    { tiles: choices_from(TILES, "tiles"), panels: choices_from(PANELS, "panels"), max_tiles: MAX_TILES, customised: customised? }
  end

  # Save a new layout. Only keys that exist AND that this person may see are
  # kept, so nothing can be added by editing the request.
  def save(tiles:, panels:)
    @user.update(dashboard_layout: {
      "tiles" => clean(tiles, TILES).first(MAX_TILES),
      "panels" => clean(panels, PANELS)
    })
  end

  def reset
    @user.update(dashboard_layout: nil)
  end

  private
    def allowed(widgets)
      widgets.select { |widget| widget.needs.all? { |key| @user.can?(key) } }
    end

    # Their own choice; failing that, their role's standard; failing that,
    # the app's. (A Role is asked the same question when its standard is
    # being set, and has no `role` of its own to fall back on.)
    def layout
      @user.dashboard_layout.presence || (@user.respond_to?(:role) && @user.role.dashboard_layout.presence) || DEFAULT
    end

    # The person's keys, in their order, minus anything that no longer
    # exists or that they have since lost the permission for.
    def chosen(widgets, slot)
      by_key = allowed(widgets).index_by(&:key)
      Array(layout[slot]).filter_map { |key| by_key[key] }
    end

    def choices_from(widgets, slot)
      on = chosen(widgets, slot)
      (on + (allowed(widgets) - on)).map { |widget| { key: widget.key, label: widget.label, on: on.include?(widget) } }
    end

    def clean(keys, widgets)
      permitted = allowed(widgets).map(&:key)
      Array(keys).map(&:to_s).uniq.select { |key| permitted.include?(key) }
    end
end
