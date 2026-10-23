# The clock on an unpaid WhatsApp reservation (orders.hold_until).
#
#   "remind"  3 minutes before: "3 minutes left to pay for #77"
#   "expire"  at the time: cancel it, so the stock goes back on sale
#
# Nothing happens if things moved on: paid, the customer said they paid
# (payment_claimed_at: she confirms by hand), cancelled, or the hold was
# cleared by staff. Scheduled when the order is reserved; ClaimHoldSweepJob
# catches any whose job was lost (a restart at the wrong moment).
class WhatsappHoldJob < ApplicationJob
  queue_as :default

  def perform(order_id, step)
    order = Order.find_by(id: order_id)
    return unless order && Whatsapp::Hold.waiting?(order)

    step == "remind" ? Whatsapp::Hold.remind(order) : Whatsapp::Hold.expire(order)
  end
end
