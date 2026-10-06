class DashboardController < InertiaController
  include SaleCapture # for order_summary

  # GET /
  #
  # `render inertia:` is the one new idea compared to classic Rails.
  # Instead of rendering app/views/dashboard/show.html.erb, it tells the
  # browser: "show the React component at app/frontend/pages/Dashboard.tsx
  # and hand it these props".
  def show
    render inertia: "Dashboard", props: {
      today: Date.current.strftime("%A, %-d %B %Y"),
      stats: stats,
      # nil (not an empty list) when this person may not see stock, so React
      # can tell "nothing is low" apart from "not allowed to know".
      low_stock: can?("stock.view") ? low_stock_items : nil,
      recent_orders: can?("orders.view") ? recent_orders : nil,
      # Shown as a banner so anyone opening the app mid-live can jump in.
      live_now: LiveSession.current && can?("orders.view") ? { id: LiveSession.current.id, title: LiveSession.current.title } : nil
    }
  end

  private
    # The headline numbers. A nil means the feature that produces it does not
    # exist yet (or this person may not see it), and React shows a dash.
    # As features land, each nil becomes a real query.
    def stats
      sees_orders = can?("orders.view")

      {
        # Everything claimed today that hasn't been cancelled.
        sales_today: sees_orders ? Order.counted.where(created_at: Time.current.all_day).sum(:total_pesewas) : nil,
        # Paid for and waiting to be packed.
        orders_to_pack: sees_orders ? Order.paid.count : nil,
        low_stock: can?("stock.view") ? StockLedger.needing_attention.count : nil,
        # Everything buyers still owe, across every order that is still a
        # sale: unpaid claims, part-payments and pay-on-delivery parcels.
        money_owed: sees_orders ? Order.owing.sum(Arel.sql(Order::BALANCE_SQL)) : nil
      }
    end

    def recent_orders
      Order.counted.newest_first.includes(:customer, :sales_channel, items: { variant: :product }).limit(6).map { |order| order_summary(order) }
    end

    # The most urgent few, for the dashboard panel.
    def low_stock_items
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
end
