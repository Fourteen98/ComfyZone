# The ONE place stock is changed.
#
#   StockLedger.record!(variant: variant, quantity: 12, reason: "purchase",
#                       source: purchase, total_cost_pesewas: 72_000, user: user)
#
# It does three things together, or none of them:
#   1. writes a row in stock_movements (the history)
#   2. updates variant.stock_on_hand (the running total)
#   3. for stock coming in with a cost, updates the variant's average cost
#
# Nothing else in the app may write to stock_on_hand. Keeping it to one
# door is what guarantees the total always equals the sum of the history.
class StockLedger
  # Raised when stock would go below zero and the caller asked us to guard it.
  class NotEnough < StandardError; end

  # quiet: true skips the "running low" / "back in stock" notifications. A
  # reset of 40 items to 0 is one deliberate act, not 40 sell-outs.
  # batch: ties movements made together, so they can be undone together (StockReset).
  def self.record!(variant:, quantity:, reason:, source: nil, user: nil, total_cost_pesewas: nil, note: nil, guard_stock: false,
                   quiet: false, batch: nil)
    raise ArgumentError, "quantity can't be zero" if quantity.zero?

    # with_lock opens a transaction and locks this variant's row
    # (SELECT ... FOR UPDATE). If two things touch the same variant at the
    # same instant, say two helpers selling the last dress, the second waits
    # for the first to finish and then sees the updated number. Without the
    # lock both would read "1 left" and both would sell it.
    variant.with_lock do
      # Checked INSIDE the lock, against the freshest number. A sale passes
      # guard_stock: true so the last item can't be sold twice.
      if guard_stock && variant.stock_on_hand + quantity < 0
        left = [ variant.stock_on_hand, 0 ].max
        raise NotEnough, left.zero? ? "#{variant.full_name} has just sold out" : "Only #{left} left of #{variant.full_name}"
      end

      if quantity.positive? && total_cost_pesewas
        variant.average_cost_pesewas = blended_cost(variant, quantity, total_cost_pesewas)
      end

      before = variant.stock_on_hand
      variant.stock_on_hand += quantity
      variant.save!
      if quiet
        # Nothing to announce (see above).
      elsif variant.product.stock_pooled?
        # Counted as one total: warn and announce for the product as a whole.
        after_total = pool_total(variant.product)
        warn_pool_low(variant.product, after_total - quantity, after_total)
        announce_pool_back(variant.product, after_total - quantity, after_total)
      else
        warn_if_running_low(variant, before)
        announce_back_in_stock(variant, before)
      end

      StockMovement.create!(
        variant: variant,
        quantity: quantity,
        balance_after: variant.stock_on_hand,
        reason: reason,
        unit_cost_pesewas: total_cost_pesewas && (total_cost_pesewas.to_r / quantity).round,
        source: source,
        user: user,
        note: note,
        batch: batch
      )
    end
  end

  # Selling `quantity` of a variant. Usually just a guarded movement out of
  # that variant. For a product counted as one total (stock_pooled), the
  # size and colour sold may show 0 while the total says there are some:
  # the pieces are then taken from the variants that do have stock, most
  # first, each movement noting what was really sold. Nothing goes below
  # zero, and the total is always right.
  #
  # Returns the average cost of what was taken (for the sale's snapshot).
  def self.sell!(variant:, quantity:, source: nil, user: nil, note: nil)
    product = variant.product
    unless product.stock_pooled?
      record!(variant: variant, quantity: -quantity, reason: "sale", source: source, user: user, note: note, guard_stock: true)
      return variant.average_cost_pesewas
    end

    # Lock the PRODUCT: two sales from one total must take turns, or both
    # could read "1 left" from different variants.
    product.with_lock do
      pool = product.variants.reload.to_a
      total = pool.sum { |each_variant| [ each_variant.stock_on_hand, 0 ].max }
      if total < quantity
        raise NotEnough, total.zero? ? "#{product.name} has just sold out" : "Only #{total} left of #{product.name}"
      end

      # The variant sold first, then the fullest ones.
      order = [ pool.find { |each_variant| each_variant.id == variant.id } || variant ] +
              pool.reject { |each_variant| each_variant.id == variant.id }.sort_by { |each_variant| -each_variant.stock_on_hand }
      remaining = quantity
      cost = 0
      order.each do |from|
        take = [ remaining, from.stock_on_hand ].min
        next unless take.positive?

        said = from.id == variant.id ? note : [ note, "Sold as #{variant.name} (stock counted as one total)" ].compact.join(". ")
        record!(variant: from, quantity: -take, reason: "sale", source: source, user: user, note: said, guard_stock: true)
        cost += take * from.average_cost_pesewas
        remaining -= take
        break if remaining.zero?
      end
      (cost.to_r / quantity).round
    end
  end

  # How many of a pooled product there are: all its sizes and colours.
  def self.pool_total(product)
    Variant.where(product_id: product.id, active: true).sum(:stock_on_hand)
  end

  def self.warn_pool_low(product, before, after)
    return unless after < before && product.active?

    sold_out = before.positive? && after <= 0
    gone_low = !sold_out && before > product.low_stock_at && after <= product.low_stock_at
    return unless sold_out || gone_low

    Push.notify("low_stock",
      title: sold_out ? "Sold out" : "Running low",
      body: sold_out ? "#{product.name} has sold out." : "#{product.name}: #{after} left.",
      path: "/admin/stock?q=#{ERB::Util.url_encode(product.name)}")
  end

  # Back from nothing: everyone waiting for ANY size of it can be told.
  def self.announce_pool_back(product, before, after)
    return unless before <= 0 && after.positive?

    waiting = StockRequest.open.joins(:variant).where(variants: { product_id: product.id }).count
    return if waiting.zero?

    Push.notify("back_in_stock",
      title: "Back in stock",
      body: "#{product.name}: #{waiting} #{waiting == 1 ? 'person' : 'people'} asked for it.",
      path: "/admin/waiting")
  end

  # Sold out, and now there is some again: if anyone was waiting for it,
  # tell her (she then tells them, from the waiting list).
  def self.announce_back_in_stock(variant, before)
    return unless before <= 0 && variant.stock_on_hand.positive?

    waiting = StockRequest.open.where(variant: variant).count
    return if waiting.zero?

    Push.notify("back_in_stock",
      title: "Back in stock",
      body: "#{variant.full_name}: #{waiting} #{waiting == 1 ? 'person' : 'people'} asked for it.",
      path: "/admin/waiting")
  end

  # Change what the units on the shelf are worth, without moving any: a
  # received purchase's price was corrected.
  #
  #   units: how many of the corrected units this applies to. Only the ones
  #   still on the shelf can be re-valued (sold ones went at the old cost),
  #   so at most stock_on_hand of them count.
  #
  #   12 on the shelf at GH₵ 50, 10 of them from a purchase now found to
  #   have cost GH₵ 3 more each:  (12 x 50 + 10 x 3) / 12 = GH₵ 52.50
  def self.revalue!(variant:, change_each_pesewas:, units:)
    variant.with_lock do
      on_hand = [ variant.stock_on_hand, 0 ].max
      return if on_hand.zero?

      affected = [ units, on_hand ].min
      value = variant.average_cost_pesewas * on_hand + change_each_pesewas * affected
      variant.update!(average_cost_pesewas: [ (value.to_r / on_hand).round, 0 ].max)
    end
  end

  # A push notification the moment stock CROSSES a line: from above the
  # product's warning level to at or below it, or from something to nothing.
  # Comparing before and after is what stops a notification on every sale
  # once it is already low. (Push.notify waits for the transaction to
  # commit, so a sale that is rolled back says nothing.)
  def self.warn_if_running_low(variant, before)
    after = variant.stock_on_hand
    return unless after < before && variant.active? && variant.product.active?

    level = variant.product.low_stock_at
    sold_out = before.positive? && after <= 0
    gone_low = before > level && after <= level
    return unless sold_out || gone_low

    Push.notify("low_stock",
      title: sold_out ? "Sold out" : "Running low",
      body: sold_out ? "#{variant.full_name} has sold out." : "#{variant.full_name}: #{after} left.",
      path: "/admin/stock/#{variant.id}")
    # No `except:` here. Unlike a sale, she wants to know stock ran out even
    # when it was her own sale that did it.
  end

  # Variants that need attention, most urgent first: out of stock, then low.
  # Only what she is selling now (active variants of active products).
  # The comparison with the product's own warning level happens in SQL, so
  # the database returns just the matching rows however many variants exist.
  #
  # A product counted as one total appears ONCE (as its first variant), and
  # only when its total is low: its sizes' own numbers mean nothing.
  POOL_SUM_SQL = "(SELECT COALESCE(SUM(v2.stock_on_hand), 0) FROM variants v2 WHERE v2.product_id = products.id AND v2.active)".freeze
  POOL_FIRST_SQL = "(SELECT v3.id FROM variants v3 WHERE v3.product_id = products.id AND v3.active ORDER BY v3.position, v3.id LIMIT 1)".freeze

  def self.needing_attention
    Variant.active.joins(:product).merge(Product.active)
      .where("(NOT products.stock_pooled AND variants.stock_on_hand <= products.low_stock_at) OR " \
             "(products.stock_pooled AND variants.id = #{POOL_FIRST_SQL} AND #{POOL_SUM_SQL} <= products.low_stock_at)")
      .order(Arel.sql("CASE WHEN products.stock_pooled THEN #{POOL_SUM_SQL} ELSE variants.stock_on_hand END ASC, lower(products.name), variants.position"))
  end

  # What everything on the shelf cost her. The same items the Stock page
  # lists (active variants of active products), so the dashboard tile and
  # the Stock page always agree. Negative counts are treated as none.
  def self.sellable
    Variant.active.joins(:product).merge(Product.active)
  end

  def self.value_pesewas
    sellable.sum("GREATEST(variants.stock_on_hand, 0) * variants.average_cost_pesewas")
  end

  # ---- What the stock should bring in --------------------------------------
  #
  # "If everything on the shelf sells": each piece at its selling price (a
  # size's own price, or the product's). Also at bulk prices, for products
  # that have one: the least it brings in if it all went to bulk buyers.
  # Estimates only: no delivery fees, discounts or hand-typed deals.
  SELLING_PRICE_SQL = "COALESCE(variants.price_pesewas, products.price_pesewas)".freeze
  BULK_PRICE_SQL = "LEAST(#{SELLING_PRICE_SQL}, COALESCE(products.bulk_price_pesewas, #{SELLING_PRICE_SQL}))".freeze

  Estimate = Data.define(:sells_for_pesewas, :bulk_sells_for_pesewas, :cost_pesewas) do
    def profit_pesewas = sells_for_pesewas - cost_pesewas
    def bulk_profit_pesewas = bulk_sells_for_pesewas - cost_pesewas
    # Only worth showing when some stock has a lower bulk price.
    def bulk_differs? = bulk_sells_for_pesewas < sells_for_pesewas
  end

  def self.sales_estimate(scope = sellable)
    sells, bulk, cost = scope.pick(
      Arel.sql("COALESCE(SUM(GREATEST(variants.stock_on_hand, 0) * #{SELLING_PRICE_SQL}), 0)"),
      Arel.sql("COALESCE(SUM(GREATEST(variants.stock_on_hand, 0) * #{BULK_PRICE_SQL}), 0)"),
      Arel.sql("COALESCE(SUM(GREATEST(variants.stock_on_hand, 0) * variants.average_cost_pesewas), 0)")
    )
    Estimate.new(sells_for_pesewas: sells.to_i, bulk_sells_for_pesewas: bulk.to_i, cost_pesewas: cost.to_i)
  end

  # In stock but with no cost recorded: these count as GH₵ 0 in the value
  # above until she says what they cost (CostCorrection).
  def self.uncosted
    sellable.where("variants.stock_on_hand > 0 AND variants.average_cost_pesewas = 0")
  end

  # Moving average: (value of what is on the shelf + value arriving) / new count.
  #
  #   10 on hand at GH₵ 50  +  10 arriving for GH₵ 700  ->  20 at GH₵ 60
  #
  # Rational arithmetic (to_r) keeps the division exact until the final round.
  def self.blended_cost(variant, quantity, total_cost_pesewas)
    on_hand = [ variant.stock_on_hand, 0 ].max # ignore negative stock
    # A cost of 0 means "never told", not "free" (stock counted in by hand
    # has no cost). Blending real money with those zeros would halve the
    # answer, so units of unknown cost are simply valued at the new price.
    return (total_cost_pesewas.to_r / quantity).round if variant.average_cost_pesewas.zero?

    value_on_hand = on_hand * variant.average_cost_pesewas

    ((value_on_hand + total_cost_pesewas).to_r / (on_hand + quantity)).round
  end
end
