# What happens to an unpaid WhatsApp reservation as its time runs out.
module Whatsapp
  module Hold
    module_function

    # Still waiting for money, and nothing has stopped the clock.
    def waiting?(order)
      order.claimed? && order.hold_until.present? && order.paid_pesewas.zero? && order.payment_claimed_at.nil?
    end

    def remind(order)
      chat = order.whatsapp_conversation
      return unless chat

      left = ((order.hold_until - Time.current) / 60).ceil
      Client.buttons(chat, "⏳ #{left} #{left == 1 ? 'minute' : 'minutes'} left to pay for order ##{order.id} " \
                           "(GH₵ #{Pesewas.to_input(order.due_pesewas)}). After that it's released for others.",
                     [ [ "paid", "I've paid" ], [ "cancel_order", "Cancel order" ] ])
    end

    # Cancel it (the stock goes back) and tell them. Locked and re-checked,
    # so a payment recorded at the same moment wins.
    def expire(order)
      order.with_lock do
        return unless waiting?(order) && order.hold_until <= Time.current

        order.cancel!(by: nil)
        order.update_columns(note: [ order.note, "Not paid in time: released." ].compact.join(" "))
      end
      chat = order.whatsapp_conversation
      return unless chat

      chat.update!(state: "menu") if chat.context["order_id"] == order.id
      Client.buttons(chat, "Order ##{order.id} wasn't paid in time, so it has been released. " \
                           "If you still want it, reserve again while it's in stock.", [ [ "browse", "See what's in stock" ] ])
    end
  end
end
