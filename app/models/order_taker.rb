# Records a claim: who wants what. Takes the stock at the same moment.
#
#   taker = OrderTaker.new(customer: customer, user: user, live_session: live,
#                          lines: [{ variant_id: 12, quantity: 1 }])
#   if taker.save
#     taker.order      # the order it went onto
#   else
#     taker.errors     # e.g. "Only 1 left of Ankara wrap dress, M / Black"
#   end
#
# Everything happens in one transaction: either the customer, the order, its
# lines and the stock movements are all saved, or none of them are. A claim
# that can't be fully met (one item just sold out) is refused whole, so she
# can tell the buyer straight away.
#
# During a live the same person often claims several things, minutes apart.
# Those go onto ONE order per customer per live, so there is one thing to
# pay for and one parcel to pack.
class OrderTaker
  include ActiveModel::Model

  attr_accessor :customer, :user, :live_session, :sales_channel, :lines
  attr_reader :order

  validate :has_a_customer
  validate :has_lines

  def save
    return false unless valid?

    saved = false
    Order.transaction do
      begin
        customer.save! if customer.new_record? || customer.changed?
        @order = open_order
        wanted.each { |variant_id, quantity| add(variant_id, quantity) }
        @order.recalculate!
        saved = true
      rescue StockLedger::NotEnough => problem
        errors.add(:items, problem.message)
        raise ActiveRecord::Rollback
      rescue ActiveRecord::RecordInvalid => problem
        errors.add(:base, problem.record.errors.full_messages.to_sentence)
        raise ActiveRecord::Rollback
      end
    end

    @order = nil unless saved
    saved
  end

  private
    # [{variant_id: 3, quantity: 1}, {variant_id: 3, quantity: 2}] -> { 3 => 3 }
    def wanted
      Array(lines).each_with_object(Hash.new(0)) do |line, totals|
        line = line.to_h.symbolize_keys
        quantity = line[:quantity].to_i
        totals[line[:variant_id].to_i] += quantity if quantity.positive?
      end
    end

    # The order this claim joins: the customer's still-open order in this
    # live if there is one, otherwise a new one.
    def open_order
      existing = live_session && Order.claimed.where(customer: customer, live_session: live_session).lock.first
      # A claim during a live came from wherever the live is.
      channel = live_session ? live_session.sales_channel : sales_channel
      existing || Order.create!(customer: customer, live_session: live_session, sales_channel: channel, user: user)
    end

    def add(variant_id, quantity)
      variant = Variant.active.find_by(id: variant_id)
      raise StockLedger::NotEnough, "One of those items is no longer available" unless variant

      # Take the stock FIRST. This locks the variant and refuses if there
      # isn't enough, which is what stops two people selling the last one.
      StockLedger.record!(variant: variant, quantity: -quantity, reason: "sale", source: @order, user: user, guard_stock: true)

      item = @order.items.find_or_initialize_by(variant: variant)
      item.quantity = item.quantity.to_i + quantity
      if item.new_record?
        # Snapshots, taken now and never changed (see the order_items migration).
        item.unit_price_pesewas = variant.selling_price_pesewas
        item.unit_cost_pesewas = variant.average_cost_pesewas
      end
      item.save!
    end

    def has_a_customer
      if customer.nil? || (customer.handle.blank? && customer.name.blank? && customer.phone.blank?)
        errors.add(:customer, "is needed. Say who is buying")
      elsif customer.invalid?
        errors.add(:customer, customer.errors.full_messages.to_sentence)
      end
    end

    def has_lines
      errors.add(:items, "Pick at least one item") if wanted.empty?
    end
end
