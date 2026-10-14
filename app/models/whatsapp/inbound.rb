# Reads what WhatsApp posts to our webhook and files it.
#
#   messages  a customer wrote: logged, and the bot is asked to reply (a job)
#   statuses  delivered / read / failed for something we sent
#   message_echoes  (her own number used from the WhatsApp Business app, the
#             "coexistence" setup): she replied from her phone, so the bot
#             steps back from that chat
#
# WhatsApp may post the same message twice; wa_id is unique, so the second
# copy is ignored and the customer never gets two replies.
module Whatsapp
  class Inbound
    def self.receive!(payload)
      Array(payload["entry"]).each do |entry|
        Array(entry["changes"]).each { |change| new(change["value"] || {}).file! }
      end
    end

    def initialize(value)
      @value = value
    end

    def file!
      names = Array(@value["contacts"]).to_h { |contact| [ contact["wa_id"], contact.dig("profile", "name") ] }
      Array(@value["messages"]).each { |message| take(message, names[message["from"]]) }
      Array(@value["statuses"]).each { |status| track(status) }
      Array(@value["message_echoes"]).each { |echo| echo!(echo) }
    end

    # What the customer said, as the bot reads it:
    #   { "text" => "orange 3xl" }   typed
    #   { "id" => "product:12", "text" => "Palazzo" }   a button or list choice
    def self.read(message)
      case message["type"]
      when "text" then { "text" => message.dig("text", "body").to_s }
      when "interactive"
        reply = message.dig("interactive", "button_reply") || message.dig("interactive", "list_reply") || {}
        { "id" => reply["id"], "text" => reply["title"] }
      when "button" then { "id" => message.dig("button", "payload"), "text" => message.dig("button", "text") }
      else { "text" => "", "unsupported" => message["type"] } # a photo, voice note, sticker...
      end
    end

    private
      def take(message, name)
        chat = WhatsappConversation.for(message["from"], name: name)
        said = self.class.read(message)
        record = chat.messages.create!(direction: "in", wa_id: message["id"], kind: said["id"] ? "choice" : (said["unsupported"] || "text"),
                                       body: said["text"].presence || "(#{said['unsupported']})", payload: said, status: "received")
        chat.update!(last_inbound_at: Time.current, last_message_at: Time.current, unread: chat.unread + 1)
        WhatsappReplyJob.perform_later(record.id)
      rescue ActiveRecord::RecordNotUnique
        nil # the same message, delivered again
      end

      def track(status)
        message = WhatsappMessage.find_by(wa_id: status["id"])
        return unless message

        error = Array(status["errors"]).first
        message.update!(status: status["status"], error: error && [ error["title"], error["message"] ].compact.join(": ").truncate(250))
      end

      def echo!(echo)
        chat = WhatsappConversation.for(echo["to"])
        chat.messages.create!(direction: "out", wa_id: echo["id"], kind: "text", body: echo.dig("text", "body").to_s.presence || "(sent from the app)",
                              payload: echo, status: "sent")
        chat.update!(handed_off_at: chat.handed_off_at || Time.current, last_message_at: Time.current)
      rescue ActiveRecord::RecordNotUnique
        nil
      end
  end
end
