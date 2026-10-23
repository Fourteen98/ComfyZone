# The bot's reply to one incoming message. In a job so the webhook answers
# Meta at once; the chat is locked so two quick messages are answered in
# order, never at the same time.
class WhatsappReplyJob < ApplicationJob
  queue_as :default

  def perform(message_id)
    message = WhatsappMessage.find_by(id: message_id)
    return unless message

    chat = message.whatsapp_conversation
    chat.with_lock { Whatsapp::Bot.new(chat).handle(message.payload) }
  end
end
