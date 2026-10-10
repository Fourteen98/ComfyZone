# Correcting an order after it was recorded.
#
#   editor = OrderEditor.new(order: order, user: user,
#                            customer: customer,             # who it is really for
#                            sales_channel: channel, note: "...",
#                            lines: [{ variant_id: 12, quantity: 2, price: "110" }, ...])
#   editor.save   # true, or false with editor.errors
#
# Two kinds of change, with different rules:
#
#   Details (buyer, channel, note)   any time. They describe the order.
#   Lines (items, quantities, prices) only while it is still "To be paid".
#                                     After that, money has been taken
#                                     against these exact lines.
#
# `lines` is the WHOLE order as it should now be. The editor compares that
# with what is there and moves only the difference through the stock
# ledger: 2 becomes 3, one more leaves the shelf; a line left out goes back.
# Everything is one transaction, under a lock on the order.
class OrderEditor
  include ActiveModel::Model

  attr_accessor :order, :user, :customer, :sales_channel, :note, :lines

  def save
    saved = false
    Order.transaction do
      begin
        order.lock!
        change_details
        change_lines if lines && order.claimed?
        saved = true
      rescue StockLedger::NotEnough => problem
        errors.add(:items, problem.message)
        raise ActiveRecord::Rollback
      rescue ActiveRecord::RecordInvalid => problem
        errors.add(:base, problem.record.errors.full_messages.to_sentence)
        raise ActiveRecord::Rollback
      rescue Problem => problem
        errors.add(:items, problem.message)
        raise ActiveRecord::Rollback
      end
    end

    order.reload unless saved # forget the half-made changes on this object
    saved
  end

  private
    class Problem < StandardError; end

    def change_details
      if customer
        customer.save! if customer.new_record? || customer.changed?
        order.customer = customer
      end
      order.sales_channel = sales_channel unless order.live_session # a live's orders follow the live
      order.note = note.to_s.strip.presence
      order.save!
    end

    # { variant_id => { quantity:, price: } }, the same variant listed twice added up.
    def wanted
      Array(lines).each_with_object({}) do |line, result|
        line = line.to_h.symbolize_keys
        quantity = line[:quantity].to_i
        next unless quantity.positive?

        entry = result[line[:variant_id].to_i] ||= { quantity: 0, price: line[:price] }
        entry[:quantity] += quantity
      end
    end

    def change_lines
      target = wanted
      raise Problem, "An order needs at least one item. To drop it altogether, cancel the order" if target.empty?

      # Lines already on the order: adjust or remove.
      order.items.includes(:variant).each do |item|
        want = target.delete(item.variant_id)
        if want.nil?
          move_stock(item.variant, item.quantity, "cancellation")
          item.destroy!
        else
          difference = want[:quantity] - item.quantity
          move_stock(item.variant, -difference, difference.positive? ? "sale" : "cancellation") unless difference.zero?
          item.quantity = want[:quantity]
          set_price(item, want[:price])
          item.save!
        end
      end

      # Anything left in `target` is new to the order.
      target.each do |variant_id, want|
        variant = Variant.active.find_by(id: variant_id)
        raise StockLedger::NotEnough, "One of those items is no longer available" unless variant

        move_stock(variant, -want[:quantity], "sale")
        item = order.items.new(variant: variant, quantity: want[:quantity],
                               unit_price_pesewas: variant.selling_price_pesewas, unit_cost_pesewas: variant.average_cost_pesewas)
        set_price(item, want[:price])
        item.save!
      end

      # More (or fewer) pieces may switch the bulk price on (or off).
      BulkPricing.apply!(order)
      order.resettle!
    end

    # Negative takes from the shelf (and is refused if there isn't enough);
    # positive puts back.
    def move_stock(variant, quantity, reason)
      StockLedger.record!(variant: variant, quantity: quantity, reason: reason, source: order, user: user, guard_stock: quantity.negative?)
    end

    # The price she actually charged for this line, if she typed one: a
    # discount for a regular, a price agreed on the live. Blank keeps it.
    def set_price(item, typed)
      return if typed.to_s.strip.empty?

      pesewas = Pesewas.parse(typed)
      raise Problem, "\"#{typed}\" isn't a valid price. Use numbers like 120 or 120.50" if pesewas == Pesewas::INVALID
      raise Problem, "That price is too large" if pesewas > HasMoney::MAX_PESEWAS

      item.unit_price_pesewas = pesewas
    end
end
