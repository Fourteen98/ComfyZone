# "What should I buy next?", worked out from what actually sells.
#
#   advisor = RestockAdvisor.new(days: 60, cover_weeks: 4)
#   advisor.buy          # sizes/colours to buy, how many, and why
#   advisor.slow         # what isn't moving, and the money sitting in it
#   advisor.best_options # which sizes and colours sell, across all products
#
# The idea, in her words: look at how fast each size and colour has been
# selling, keep enough on the shelf to last `cover_weeks`, and add anyone on
# the waiting list. Buy the difference. Anything that hasn't sold at all in
# the window is money sitting on a shelf.
#
# A query object: two grouped queries (units sold, people waiting) plus the
# active catalogue, all worked out in Ruby. The catalogue is hundreds of
# variants, not millions.
class RestockAdvisor
  WINDOWS = [ 30, 60, 90 ].freeze
  COVERS = [ 2, 4, 8 ].freeze

  Row = Data.define(:variant, :sold, :waiting, :on_hand, :per_week, :weeks_left, :suggest) do
    def tied_pesewas = on_hand * variant.average_cost_pesewas
    def estimate_pesewas = suggest * variant.average_cost_pesewas
  end

  attr_reader :days, :cover_weeks

  def initialize(days: 60, cover_weeks: 4)
    @days = WINDOWS.include?(days.to_i) ? days.to_i : 60
    @cover_weeks = COVERS.include?(cover_weeks.to_i) ? cover_weeks.to_i : 4
  end

  def since = days.days.ago

  def rows
    @rows ||= begin
      sold = sold_by_variant
      waiting = StockRequest.open.group(:variant_id).sum(:quantity)
      weeks = days / 7.0

      StockLedger.sellable.includes(:product).map do |variant|
        units = sold.fetch(variant.id, 0)
        wanted = waiting.fetch(variant.id, 0)
        on_hand = [ variant.stock_on_hand, 0 ].max
        per_week = units / weeks
        # Enough to last cover_weeks at the current pace, plus everyone waiting.
        target = (per_week * cover_weeks).ceil + wanted
        Row.new(variant: variant, sold: units, waiting: wanted, on_hand: on_hand, per_week: per_week.round(1),
          weeks_left: per_week.positive? ? (on_hand / per_week).round(1) : nil, suggest: [ target - on_hand, 0 ].max)
      end
    end
  end

  # Worth buying: people are waiting, or it will run out within the cover.
  # Most urgent first: people waiting, then fastest sellers.
  def buy
    rows.select { |row| row.suggest.positive? }.sort_by { |row| [ -row.waiting, -row.per_week, row.variant.product.name ] }
  end

  # On the shelf, but not one sold in the whole window. Things added to the
  # catalogue during the window are left out: they haven't had a fair chance.
  # Biggest money first.
  def slow
    rows.select { |row| row.on_hand.positive? && row.sold.zero? && row.variant.created_at < since }
      .sort_by { |row| [ -row.tied_pesewas, -row.on_hand ] }
  end

  # Units sold per option value, across every product: { "Size" => [["XL", 40], ...] }.
  # Answers "which sizes does my audience wear?" before buying a new style.
  def best_options
    tally = Hash.new { |hash, key| hash[key] = Hash.new(0) }
    rows.each do |row|
      next if row.sold.zero?

      row.variant.option_values.each { |value| tally[value["name"]][value["label"]] += row.sold }
    end
    tally.transform_values { |labels| labels.sort_by { |label, units| [ -units, label ] } }
  end

  private
    # Units kept (sold less returned) per variant, in orders that are still
    # sales, made within the window.
    def sold_by_variant
      OrderItem.joins(:order).merge(Order.counted.where(created_at: since..))
        .group(:variant_id).sum(Arel.sql("order_items.quantity - order_items.returned_quantity"))
    end
end
