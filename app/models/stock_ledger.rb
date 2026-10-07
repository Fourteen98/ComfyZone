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

  def self.record!(variant:, quantity:, reason:, source: nil, user: nil, total_cost_pesewas: nil, note: nil, guard_stock: false)
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
      warn_if_running_low(variant, before)

      StockMovement.create!(
        variant: variant,
        quantity: quantity,
        balance_after: variant.stock_on_hand,
        reason: reason,
        unit_cost_pesewas: total_cost_pesewas && (total_cost_pesewas.to_r / quantity).round,
        source: source,
        user: user,
        note: note
      )
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
  def self.needing_attention
    Variant.active.joins(:product).merge(Product.active)
      .where("variants.stock_on_hand <= products.low_stock_at")
      .order("variants.stock_on_hand ASC, lower(products.name), variants.position")
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
