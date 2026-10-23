# One WhatsApp message as the chat screens show it. The buttons and list
# rows the bot offered are passed along, so a "Try it" chat can tap them.
module WhatsappMessageProps
  extend ActiveSupport::Concern

  private
    def message_props(message)
      interactive = message.payload["interactive"] || {}
      choices = (interactive.dig("action", "buttons") || []).map { |button| button["reply"] } +
                (interactive.dig("action", "sections") || []).flat_map { |section| section["rows"] }
      {
        id: message.id,
        direction: message.direction,
        kind: message.kind,
        text: interactive.dig("body", "text") || message.payload.dig("image", "caption") || message.body,
        image: message.payload.dig("image", "link"),
        choices: choices.compact.map { |choice| { id: choice["id"], title: choice["title"], description: choice["description"] } },
        status: message.status,
        error: message.error,
        by: message.user&.name,
        at: message.created_at.strftime("%-l:%M %P")
      }
    end
end
