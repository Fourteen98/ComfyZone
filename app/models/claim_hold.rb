# The clock on an unpaid claim (orders.hold_until): "pay within 24 hours, or
# it goes back on sale".
#
#   ClaimHold.start!(order)            after a claim: set the deadline (ClaimSetting)
#   ClaimHold.release!(order, by: u)   "they never paid": cancel it, stock back
#   ClaimHold.sweep!                   every minute (ClaimHoldSweepJob): warn her
#                                      about deadlines coming up, release the overdue
#
# Paying anything stops the clock (a part payment means they're serious), and
# so does a WhatsApp customer saying they paid. She can give more time or take
# the deadline off on the order's page (Orders::HoldsController).
#
# Released orders are cancelled with cancel_reason "unpaid", which is what
# the customer's reliability counts (Customer.reliability).
module ClaimHold
  REASON = "unpaid".freeze

  module_function

  def start!(order)
    return unless order.claimed? && order.paid_pesewas.zero? && order.hold_until.nil?

    hours = ClaimSetting.current.hours_for(order)
    order.update_columns(hold_until: order.created_at + hours.hours) if hours
  end

  # Still waiting for money, and nothing has stopped the clock.
  def waiting?(order)
    order.claimed? && order.hold_until.present? && order.paid_pesewas.zero? && order.payment_claimed_at.nil?
  end

  # Cancel as unpaid: the stock goes back (and anyone waiting for it is
  # told, by the ledger), and the customer's record shows it.
  def release!(order, by:, note: "Not paid: released.")
    order.with_lock do
      order.cancel!(by: by)
      order.update_columns(cancel_reason: REASON, note: [ order.note, note ].compact.join(" "))
    end
  end

  # Released by the clock, if still due. Locked and re-checked, so a payment
  # recorded at the same moment wins. True if it was released.
  def expire(order)
    order.with_lock do
      return false unless waiting?(order) && order.hold_until <= Time.current

      release!(order, by: nil, note: "Not paid in time: released.")
    end
    true
  end

  # Orders still running on the clock.
  def running
    Order.claimed.where.not(hold_until: nil).where(paid_pesewas: 0, payment_claimed_at: nil)
  end

  def sweep!
    released = running.where(hold_until: ..Time.current).includes(:customer).select do |order|
      if order.whatsapp_conversation_id
        Whatsapp::Hold.expire(order) # also tells the customer on WhatsApp
        false # her own WhatsApp inbox shows these; no push for each
      else
        expire(order)
      end
    end
    warn_released(released) if released.any?
    warn_soon
  end

  # One push for everything released in this sweep, not one per order.
  def warn_released(orders)
    who = orders.map { |order| order.customer.display_name }.uniq
    Push.notify("claims",
      title: orders.size == 1 ? "Claim released" : "#{orders.size} claims released",
      body: "Not paid in time, back on sale: #{who.first(3).to_sentence}#{who.size > 3 ? ' and others' : ''}.",
      path: "/admin/orders?status=cancelled")
  end

  # Deadlines inside the warning window, not warned about yet: one push, so
  # she can nudge them before the stock goes back.
  def warn_soon
    hours = ClaimSetting.current.remind_hours
    soon = running.where(whatsapp_conversation_id: nil, hold_reminded_at: nil)
      .where(hold_until: Time.current..hours.hours.from_now).includes(:customer).to_a
    return if soon.empty?

    Order.where(id: soon.map(&:id)).update_all(hold_reminded_at: Time.current)
    who = soon.map { |order| order.customer.display_name }.uniq
    Push.notify("claims",
      title: soon.size == 1 ? "1 claim runs out soon" : "#{soon.size} claims run out soon",
      body: "Not paid yet, released within #{hours} #{'hour'.pluralize(hours)}: #{who.first(3).to_sentence}#{who.size > 3 ? ' and others' : ''}.",
      path: "/admin/orders?pay=deadline")
  end
end
