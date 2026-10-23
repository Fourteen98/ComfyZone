# WhatsApp (Meta) calls this. Not a page anyone visits: no login, no CSRF
# token. Instead, every POST must be signed with our app secret, which
# only Meta and our server know (X-Hub-Signature-256).
#
#   GET  /webhooks/whatsapp   Meta checks the URL once, when it is set up
#   POST /webhooks/whatsapp   messages, delivery receipts, echoes
class Webhooks::WhatsappController < ActionController::Base
  skip_forgery_protection

  # Meta sends hub.mode=subscribe, hub.verify_token and hub.challenge, and
  # expects the challenge back if the token is ours.
  def verify
    token = ENV["WHATSAPP_VERIFY_TOKEN"].to_s
    if params["hub.mode"] == "subscribe" && token.present? &&
       ActiveSupport::SecurityUtils.secure_compare(params["hub.verify_token"].to_s, token)
      render plain: params["hub.challenge"]
    else
      head :forbidden
    end
  end

  def receive
    return head :unauthorized unless signed?

    Whatsapp::Inbound.receive!(JSON.parse(request.raw_post))
    head :ok # quickly: the replies are sent from a job
  rescue JSON::ParserError
    head :bad_request
  end

  private
    # HMAC-SHA256 of the exact body, with the app secret. Without a secret
    # configured, only allowed outside production (local testing).
    def signed?
      secret = ENV["WHATSAPP_APP_SECRET"].to_s
      return !Rails.env.production? if secret.empty?

      expected = "sha256=#{OpenSSL::HMAC.hexdigest('SHA256', secret, request.raw_post)}"
      ActiveSupport::SecurityUtils.secure_compare(request.headers["X-Hub-Signature-256"].to_s, expected)
    end
end
