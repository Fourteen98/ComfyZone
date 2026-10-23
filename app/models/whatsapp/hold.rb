# What happens to an unpaid WhatsApp reservation as its time runs out.
module Whatsapp
  module Hold
    module_function

    # Still waiting for money, and nothing has stopped the clock.
    def waiting?(order) = ClaimHold.waiting?(order)

    def remind(order)
      chat = order.whatsapp_conversation
      return unless chat

      left = ((order.hold_until - Time.current) / 60).ceil
      Client.buttons(chat, "⏳ #{left} #{left == 1 ? 'minute' : 'minutes'} left to pay for order ##{order.id} " \
                           "(GH₵ #{Pesewas.to_input(order.due_pesewas)}). After that it's released for others.",
                     [ [ "paid", "I've paid" ], [ "cancel_order", "Cancel order" ] ])
    end

    # Cancel it (the stock goes back; ClaimHold) and tell them.
    def expire(order)
      return unless ClaimHold.expire(order)

      chat = order.whatsapp_conversation
      return unless chat

      chat.update!(state: "menu") if chat.context["order_id"] == order.id
      Client.buttons(chat, "Order ##{order.id} wasn't paid in time, so it has been released. " \
                           "If you still want it, reserve again while it's in stock.", [ [ "browse", "See what's in stock" ] ])
    end
  end
end
