class DashboardController < InertiaController
  include SaleCapture # for order_summary

  # GET /
  #
  # `render inertia:` is the one new idea compared to classic Rails.
  # Instead of rendering app/views/dashboard/show.html.erb, it tells the
  # browser: "show the React component at app/frontend/pages/Dashboard.tsx
  # and hand it these props".
  def show
    dashboard = Dashboard.new(Current.user)

    render inertia: "Dashboard", props: {
      today: Date.current.strftime("%A, %-d %B %Y"),
      # Only what this person chose, and only what they may see. React draws
      # whatever arrives, in the order it arrives.
      tiles: dashboard.tiles,
      # `send` calls a method by name: "low_stock" -> low_stock_panel.
      # Safe here because the names come from Dashboard::PANELS, never from
      # the request.
      panels: dashboard.panels.map { |panel|
        { key: panel.key, title: panel.label, wide: panel.wide, data: send("#{panel.key}_panel") }
      },
      # Shown as a banner so anyone opening the app mid-live can jump in.
      live_now: LiveSession.current && can?("orders.view") ? { id: LiveSession.current.id, title: LiveSession.current.title } : nil
    }
  end

  # GET /dashboard/edit   the Customise page
  def edit
    render inertia: "Dashboard/Edit", props: Dashboard.new(Current.user).choices.merge(
      # For people who manage roles: set what a whole role starts with.
      roles: can?("roles.manage") ? Role.ordered.map { |role| { value: role.id, label: role.name } } : []
    )
  end

  # PATCH /dashboard
  def update
    dashboard = Dashboard.new(Current.user)

    if params[:reset].present?
      dashboard.reset
      redirect_to root_path, notice: "Your dashboard is back to the standard layout."
    else
      chosen = params.fetch(:dashboard, {}).permit(tiles: [], panels: [])
      role = can?("roles.manage") ? Role.find_by(id: params[:role_id]) : nil

      if role
        # Saved on the role, not on this person. It is filtered by what the
        # ROLE may see, so a tile its people can't have is simply dropped.
        Dashboard.new(role).save(tiles: chosen[:tiles], panels: chosen[:panels])
        redirect_to edit_dashboard_path, notice: "Saved as the standard dashboard for #{role.name}. People who have customised their own keep theirs."
      else
        dashboard.save(tiles: chosen[:tiles], panels: chosen[:panels])
        redirect_to root_path, notice: "Dashboard saved."
      end
    end
  end

  private
    # ---- One method per panel, named "<key>_panel" -----------------------

    def recent_orders_panel
      Order.counted.newest_first.includes(:customer, :sales_channel, items: { variant: :product }).limit(6).map { |order| order_summary(order) }
    end

    # The most urgent few.
    def low_stock_panel
      StockLedger.needing_attention.includes(:product).limit(6).map { |variant|
        {
          id: variant.id,
          product: variant.product.name,
          variant: variant.name,
          option_values: variant.option_values,
          stock: variant.stock_on_hand,
          level: variant.stock_level
        }
      }
    end

    def week_sales_panel
      days = SalesReport.new(ReportPeriod.custom((Date.current - 6).iso8601, Date.current.iso8601)).over_time
      days.map { |day| day.slice(:label, :short, :orders, :sales_pesewas) } # no profit: not everyone may see it
    end

    def top_products_panel
      last_30_days.top_products(5).map { |row| row.slice(:id, :name, :units, :sales_pesewas) }
    end

    def channels_panel
      last_30_days.by_channel
    end

    def last_30_days
      @last_30_days ||= SalesReport.new(ReportPeriod.preset("30days"))
    end
end
