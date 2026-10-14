require "net/http"

# Sends messages through WhatsApp's Cloud API, and logs every one.
#
#   Whatsapp::Client.text(chat, "Hello")
#   Whatsapp::Client.buttons(chat, "Pick one", [ [ "browse", "See what's in" ], ... ])
#   Whatsapp::Client.list(chat, "Here's what's in", "Choose", [ { id:, title:, description: } ])
#   Whatsapp::Client.image(chat, url, caption)
#
# Keys come from the server's environment (docs/whatsapp-setup.md):
#   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID   to send
#   WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN        to receive (webhook)
#
# Until they are set, and always for a "Try it" (sandbox) chat, nothing
# leaves the server: the message is logged as "simulated", so the whole bot
# can be tried in the back office first.
module Whatsapp
  class Client
    API = "https://graph.facebook.com".freeze

    # WhatsApp's own limits; longer text is cut, not refused.
    BUTTON_TITLE = 20
    ROW_TITLE = 24
    ROW_DESCRIPTION = 72
    MAX_ROWS = 10

    class << self
      # Swappable in tests: ->(uri, json) { [status, body] }
      attr_writer :transport

      def configured?
        ENV["WHATSAPP_ACCESS_TOKEN"].present? && ENV["WHATSAPP_PHONE_NUMBER_ID"].present?
      end

      def text(chat, body, user: nil)
        send!(chat, "text", body, { type: "text", text: { body: body, preview_url: false } }, user: user)
      end

      # buttons: [[id, title], ...] at most 3
      def buttons(chat, body, buttons)
        replies = buttons.first(3).map { |id, title| { type: "reply", reply: { id: id, title: title.to_s.truncate(BUTTON_TITLE) } } }
        send!(chat, "buttons", "#{body}\n[#{buttons.map(&:last).join(' | ')}]",
          { type: "interactive", interactive: { type: "button", body: { text: body }, action: { buttons: replies } } })
      end

      # rows: [{ id:, title:, description: }], at most 10
      def list(chat, body, button, rows)
        shown = rows.first(MAX_ROWS).map { |row|
          { id: row[:id], title: row[:title].to_s.truncate(ROW_TITLE), description: row[:description].to_s.truncate(ROW_DESCRIPTION).presence }.compact
        }
        send!(chat, "list", "#{body}\n#{shown.map { |row| "- #{row[:title]}" }.join("\n")}",
          { type: "interactive", interactive: { type: "list", body: { text: body },
            action: { button: button.truncate(BUTTON_TITLE), sections: [ { title: "Choose", rows: shown } ] } } })
      end

      def image(chat, url, caption)
        send!(chat, "image", caption, { type: "image", image: { link: url, caption: caption } })
      end

      private
        def send!(chat, kind, body, message, user: nil)
          record = chat.messages.create!(direction: "out", kind: kind, body: body, payload: message, user: user, status: "simulated")
          chat.update_columns(last_message_at: Time.current)
          return record if chat.sandbox? || !configured?

          status, response = transport.call(endpoint, { messaging_product: "whatsapp", recipient_type: "individual",
                                                       to: chat.phone.delete("+") }.merge(message))
          if status.between?(200, 299)
            record.update!(status: "sent", wa_id: response.dig("messages", 0, "id"))
          else
            record.update!(status: "failed", error: response.dig("error", "message") || "HTTP #{status}")
          end
          record
        rescue StandardError => error
          record&.update!(status: "failed", error: error.message.truncate(250))
          record
        end

        def endpoint
          URI("#{API}/#{ENV.fetch('WHATSAPP_API_VERSION', 'v23.0')}/#{ENV['WHATSAPP_PHONE_NUMBER_ID']}/messages")
        end

        def transport
          @transport ||= lambda { |uri, json|
            request = Net::HTTP::Post.new(uri)
            request["Authorization"] = "Bearer #{ENV['WHATSAPP_ACCESS_TOKEN']}"
            request["Content-Type"] = "application/json"
            request.body = json.to_json
            http = Net::HTTP.new(uri.host, uri.port)
            http.use_ssl = true
            http.open_timeout = 5
            http.read_timeout = 10
            response = http.request(request)
            [ response.code.to_i, (JSON.parse(response.body.to_s) rescue {}) ]
          }
        end
    end
  end
end
