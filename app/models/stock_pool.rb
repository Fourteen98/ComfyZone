# Counting a product as one total, or going back to counting it by size.
#
#   StockPool.pool!(product:, total: 23, user:)   # "we have 23, sizes unknown"
#   StockPool.unpool!(product:)                   # back to counts by size
#
# Pooling writes ordinary "recount" movements, so the history explains every
# change: the first size gets the whole total and the rest go to 0. Which
# size holds the number doesn't matter while pooled: the Stock page, the sale
# screen and the shop all read the TOTAL (Variant#available), and a sale of
# any size is taken from whichever sizes hold stock (StockLedger.sell!).
#
# Sizes may have cost different amounts; once their counts are mixed, one
# average cost for the product is the honest figure, so every size gets it.
class StockPool
  def self.pool!(product:, total:, user:)
    total = Integer(total, exception: false)
    raise ArgumentError, "Type how many there are in all" if total.nil? || total.negative? || total > 100_000

    Product.transaction do
      product.lock!
      sizes = product.variants.to_a
      raise ArgumentError, "This product has no sizes or colours to pool" if sizes.empty?

      units = sizes.sum { |size| [ size.stock_on_hand, 0 ].max }
      value = sizes.sum(&:stock_value_pesewas)
      average = units.positive? ? (value.to_r / units).round : sizes.map(&:average_cost_pesewas).max.to_i
      note = "Counted as one total: #{total}"

      sizes.each_with_index do |size, index|
        target = index.zero? ? total : 0
        difference = target - size.stock_on_hand
        StockLedger.record!(variant: size, quantity: difference, reason: "recount", user: user, note: note) unless difference.zero?
        size.update!(average_cost_pesewas: average) unless size.average_cost_pesewas == average
      end
      product.update!(stock_pooled: true)
    end
  end

  # Back to counting by size. The counts are whatever the pool left (the
  # total, mostly on one size), so a stock take by size should follow.
  def self.unpool!(product:)
    product.update!(stock_pooled: false)
  end
end
