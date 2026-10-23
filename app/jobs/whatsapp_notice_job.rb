# A short message to a WhatsApp customer about their order, when something
# happens on it in the back office.
#
#   "paid"  a payment was recorded: thank them, and say what is left if any
#
# Only while WhatsApp lets us write freely (within 24 hours of their last
# message). Later than that needs an approved template: part 2.
class WhatsappNoticeJob < ApplicationJob
  queue_as :default

  def perform(order_id, kind)
    order = Order.find_by(id: order_id)
    chat = order&.whatsapp_conversation
    return unless chat&.window_open?

    case kind
    when "paid"
      left = order.balance_pesewas
      Whatsapp::Client.text(chat, left.positive? ?
        "🙏 We received GH₵ #{Pesewas.to_input(order.paid_pesewas)} for order ##{order.id}. GH₵ #{Pesewas.to_input(left)} still to pay." :
        "🎉 Payment received for order ##{order.id}. Thank you! We'll let you know when it's on its way.")
    end
  end
end
