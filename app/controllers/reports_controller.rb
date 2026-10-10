require "csv"

# The Reports page, and its CSV downloads.
class ReportsController < InertiaController
  require_permission "reports.view"

  # GET /reports?range=week
  # GET /reports?range=custom&from=2026-09-01&to=2026-09-30
  def show
    period = ReportPeriod.from_params(params)
    report = SalesReport.new(period)
    before = SalesReport.new(period.previous).totals
    sees_costs = can?("costs.view")

    # Profit and cost only leave the server for people allowed to see them.
    hide_costs = ->(row) { sees_costs ? row : row.except(:profit_pesewas, :cost_pesewas) }

    render inertia: "Reports/Show", props: {
      period: {
        key: period.key, label: period.label, days: period.days,
        from: period.from.iso8601, to: period.to.iso8601, today: Date.current.iso8601
      },
      presets: ReportPeriod::PRESETS.map { |key, label| { key: key, label: label } },
      totals: hide_costs.(report.totals),
      # For "up 12% on the 7 days before".
      previous: { sales_pesewas: before[:sales_pesewas], orders: before[:orders] },
      over_time: report.over_time.map(&hide_costs),
      top_products: report.top_products.map(&hide_costs),
      channels: report.by_channel,
      regions: report.by_region,
      places: report.by_place,
      # Profit numbers only for people who may see costs.
      lives: report.lives.map { |row| sees_costs ? row : row.except(:cost_pesewas, :expenses_pesewas, :profit_pesewas) },
      product_profit: sees_costs ? report.product_profit(30) : nil,
      customers: can?("customers.view") ? report.top_customers : nil,
      money_in: report.money_in,
      # nil = this person may not see expenses.
      expenses: can?("expenses.view") ? { total_pesewas: report.expenses_pesewas, by_category: report.expenses_by_category } : nil,
      sees_costs: sees_costs
    }
  end

  # GET /reports/export/orders.csv?range=month
  # GET /reports/export/payments.csv?range=month
  #
  # `send_data` answers with a file to download instead of a page. Nothing
  # is written to disk: the CSV is built in memory and sent.
  def export
    period = ReportPeriod.from_params(params)
    csv = params[:kind] == "payments" ? payments_csv(period) : orders_csv(period)

    send_data csv, type: "text/csv; charset=utf-8",
      filename: "comfyzone-#{params[:kind]}-#{period.from.iso8601}-to-#{period.to.iso8601}.csv"
  end

  private
    def orders_csv(period)
      sees_costs = can?("costs.view")
      headings = [ "Order", "Date", "Customer", "Phone", "Came from", "Country", "Region", "Place", "Live", "Status", "Items", "Units",
                   "Goods", "Delivery", "Paid", "Balance" ]
      headings += %w[ Cost Profit ] if sees_costs

      orders = Order.where(created_at: period.range).order(:created_at)
                    .includes(:sales_channel, :live_session, customer: :delivery_area, items: { variant: :product })

      CSV.generate do |csv|
        csv << headings
        orders.each do |order|
          row = [
            order.id, order.created_at.strftime("%Y-%m-%d %H:%M"), safe(order.customer.display_name), safe(order.customer.phone),
            order.sales_channel&.name, order.customer.country, order.customer.region, safe(order.customer.delivery_area&.name), safe(order.live_session&.title), order.status,
            safe(order.items.map { |item| "#{item.quantity} x #{item.variant.full_name}" }.join("; ")), order.units,
            cedis(order.total_pesewas), cedis(order.delivery_fee_pesewas), cedis(order.paid_pesewas), cedis(order.balance_pesewas)
          ]
          row += [ cedis(order.cost_pesewas), cedis(order.profit_pesewas) ] if sees_costs
          csv << row
        end
      end
    end

    def payments_csv(period)
      payments = Payment.where(created_at: period.range).order(:created_at).includes(:user, order: :customer)
      names = PaymentMethod.names

      CSV.generate do |csv|
        csv << [ "Date", "Order", "Customer", "Amount", "How", "Transaction ID", "Note", "Recorded by" ]
        payments.each do |payment|
          csv << [
            payment.created_at.strftime("%Y-%m-%d %H:%M"), payment.order_id, safe(payment.order.customer.display_name),
            cedis(payment.amount_pesewas), names.fetch(payment.via, payment.via),
            safe(payment.reference), safe(payment.note), payment.user.name
          ]
        end
      end
    end

    # 12050 -> "120.50". Plain numbers, so a spreadsheet can add them up.
    def cedis(pesewas)
      format("%.2f", pesewas / 100.0)
    end

    # A spreadsheet treats a cell starting with = + - or @ as a formula. Text
    # typed by people (a customer called "=HYPERLINK(...)", a username with
    # an @) must not be run as one when the file is opened, so such cells
    # get a leading apostrophe, which spreadsheets read as "this is text".
    def safe(text)
      text.to_s.match?(/\A[=+\-@\t\r]/) ? "'#{text}" : text
    end
end
