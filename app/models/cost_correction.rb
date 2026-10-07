# Telling the app what an item cost when it didn't come in through a purchase.
#
# Normally a variant's cost comes from purchases: receiving one blends its
# landed cost into `average_cost_pesewas` (see StockLedger). But stock can
# also arrive with NO cost attached: a stock take on the shelf she already
# had, "found" items, opening stock. Those variants sit at a cost of 0, so
# they count for nothing in "Stock value" and every sale of them looks like
# pure profit.
#
# This form object fixes that:
#
#   correction = CostCorrection.new(variant: v, cost: "60", whole_product: true)
#   correction.save   # => true, or false with errors
#
# It sets the cost and also fills it into past order lines of that variant
# that were sold "at no cost". An order line's cost is normally a snapshot
# that never changes; a 0 there was never a real cost, only "not known yet",
# which is why filling it in is a correction and not rewriting history.
# Lines that already have a cost are left exactly as they are.
class CostCorrection
  include ActiveModel::Model

  attr_accessor :variant, :cost, :whole_product

  validate :cost_is_an_amount

  # How many variants were given the cost (for the message afterwards).
  attr_reader :changed

  def save
    return false unless valid?

    Variant.transaction do
      targets.each do |target|
        target.update!(average_cost_pesewas: @pesewas)
        OrderItem.where(variant: target, unit_cost_pesewas: 0).update_all(unit_cost_pesewas: @pesewas)
      end
    end

    @changed = targets.size
    true
  end

  private
    # This variant always. With whole_product, also its sisters (the other
    # sizes and colours) that have no cost yet. Ones that already have a
    # cost from a purchase are never overwritten in bulk.
    def targets
      @targets ||= begin
        others = whole_product ? variant.product.variants.where(average_cost_pesewas: 0).where.not(id: variant.id).to_a : []
        [ variant ] + others
      end
    end

    def cost_is_an_amount
      @pesewas = Pesewas.parse(cost)

      if @pesewas.nil? || @pesewas == Pesewas::INVALID
        errors.add(:cost, "isn't a valid amount. Use numbers like 120 or 120.50")
      elsif @pesewas.zero?
        errors.add(:cost, "must be more than zero")
      elsif @pesewas > HasMoney::MAX_PESEWAS
        errors.add(:cost, "is too large")
      end
    end
end
