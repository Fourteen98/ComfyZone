# What the shop knows about one customer, worked out from their orders.
#
#   insights = CustomerInsights.new(customer)
#   insights.summary     # spent, how many orders, how often, last time...
#   insights.favourites  # { "Size" => [["XL", 5], ["L", 2]], "Colour" => [...] }
#   insights.pays        # how quickly they pay, in words
#
# A query object, like SalesReport: it only reads. Everything counts only
# orders that are still sales (not cancelled, not returned), and only what
# they kept (a part-return doesn't count as bought).
class CustomerInsights
  QUIET_AFTER = 30.days # "gone quiet": a good customer who hasn't bought in this long

  attr_reader :customer

  def initialize(customer)
    @customer = customer
  end

  def summary
    @summary ||= begin
      first, last = counted.minimum(:created_at), counted.maximum(:created_at)
      count = counted.count
      spent = counted.sum(:total_pesewas)

      {
        orders: count,
        spent_pesewas: spent,
        average_pesewas: count.zero? ? 0 : (spent.to_r / count).round,
        units: kept_lines.sum { |item| item.kept },
        first_at: first,
        last_at: last,
        days_since_last: last && (Date.current - last.to_date).to_i,
        # On average, how many days between orders. Needs two orders to say.
        every_days: count > 1 ? ((last - first) / 1.day / (count - 1)).round : nil,
        owing_pesewas: customer.orders.owing.sum(Arel.sql(Order::BALANCE_SQL)),
        cancelled: customer.orders.where(status: "cancelled").count,
        returned: customer.orders.where(status: "returned").count + kept_lines.count { |item| item.returned_quantity.positive? },
        quiet: last.present? && last < QUIET_AFTER.ago
      }
    end
  end

  # Their usual choices, per option ("Size", "Colour"), most bought first.
  # Counted in units, so three of one dress in L counts as three.
  def favourites(limit = 3)
    tally = Hash.new { |hash, key| hash[key] = Hash.new(0) }
    kept_lines.each do |item|
      item.variant.option_values.each { |value| tally[value["name"]][value["label"]] += item.kept }
    end
    tally.transform_values { |labels| labels.sort_by { |label, units| [ -units, label ] }.first(limit) }
  end

  # The products they come back for.
  def top_products(limit = 5)
    kept_lines.group_by { |item| item.variant.product }
      .map { |product, items| { id: product.id, name: product.name, units: items.sum(&:kept), spent_pesewas: items.sum { |i| i.kept * i.unit_price_pesewas } } }
      .sort_by { |row| -row[:units] }.first(limit)
  end

  # How quickly they pay after claiming, from orders that have been paid.
  # The median, not the average: one order paid a month late shouldn't
  # make a reliable customer look slow.
  def pays
    waits = counted.where.not(paid_at: nil).pluck(:created_at, :paid_at).map { |claimed, paid| (paid - claimed) / 1.hour }.sort
    return nil if waits.empty?

    hours = waits[waits.size / 2]
    words = if hours < 3 then "Pays straight away"
    elsif hours < 24 then "Pays the same day"
    elsif hours < 72 then "Pays within 3 days"
    else "Slow to pay (usually #{(hours / 24).round} days)"
    end
    { label: words, hours: hours.round(1), orders: waits.size, slow: hours >= 72 }
  end

  # "Top buyers who haven't bought in a while": customers whose last order is
  # older than QUIET_AFTER, best spenders first. One grouped query.
  #   [[customer_id, spent_pesewas, orders, last_order_at], ...]
  def self.gone_quiet(limit = 100)
    Order.counted.group(:customer_id)
      .having("MAX(orders.created_at) < ?", QUIET_AFTER.ago)
      .order(Arel.sql("SUM(orders.total_pesewas) DESC"))
      .limit(limit)
      .pluck(:customer_id, Arel.sql("SUM(orders.total_pesewas)"), Arel.sql("COUNT(*)"), Arel.sql("MAX(orders.created_at)"))
  end

  private
    def counted
      customer.orders.counted
    end

    def kept_lines
      @kept_lines ||= OrderItem.joins(:order).merge(counted).includes(variant: :product).select { |item| item.kept.positive? }
    end
end
