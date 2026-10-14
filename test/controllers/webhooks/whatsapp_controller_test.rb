require "test_helper"

# What Meta sends, as Meta sends it.
class Webhooks::WhatsappControllerTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  def with_env(values)
    old = values.keys.to_h { |key| [ key, ENV[key] ] }
    values.each { |key, value| ENV[key] = value }
    yield
  ensure
    old.each { |key, value| ENV[key] = value }
  end

  def text_message(id: "wamid.1", body: "hi", from: "233241112233")
    { object: "whatsapp_business_account", entry: [ { changes: [ { field: "messages", value: {
      messaging_product: "whatsapp", contacts: [ { wa_id: from, profile: { name: "Esi" } } ],
      messages: [ { from: from, id: id, timestamp: Time.current.to_i.to_s, type: "text", text: { body: body } } ] } } ] } ] }
  end

  def post_signed(payload, secret: "s3cret")
    json = payload.to_json
    signature = "sha256=#{OpenSSL::HMAC.hexdigest('SHA256', secret, json)}"
    post "/webhooks/whatsapp", params: json, headers: { "Content-Type" => "application/json", "X-Hub-Signature-256" => signature }
  end

  test "Meta's setup check: the challenge back only with our token" do
    with_env("WHATSAPP_VERIFY_TOKEN" => "tok") do
      get "/webhooks/whatsapp", params: { "hub.mode" => "subscribe", "hub.verify_token" => "tok", "hub.challenge" => "12345" }
      assert_equal "12345", response.body
      get "/webhooks/whatsapp", params: { "hub.mode" => "subscribe", "hub.verify_token" => "nope", "hub.challenge" => "12345" }
      assert_response :forbidden
    end
  end

  test "a signed message is filed once and answered; a bad signature is refused" do
    WhatsappSetting.current.update!(enabled: true, momo_number: "0241112222", momo_name: "Fazila")
    with_env("WHATSAPP_APP_SECRET" => "s3cret") do
      perform_enqueued_jobs do
        post_signed(text_message)
        assert_response :ok
        post_signed(text_message) # Meta delivering the same message again
      end
      chat = WhatsappConversation.find_by!(phone: "+233241112233")
      assert_equal [ 1, 1 ], [ chat.messages.inbound.count, chat.messages.outbound.count ]
      assert_equal "Esi", chat.profile_name
      assert chat.window_open?

      post_signed(text_message(id: "wamid.2"), secret: "wrong")
      assert_response :unauthorized
      assert_equal 1, chat.messages.inbound.count
    end
  end

  test "taps, delivery receipts, and her own replies from the phone app" do
    with_env("WHATSAPP_APP_SECRET" => "s3cret") do
      chat = WhatsappConversation.for("+233241112233")
      sent = chat.messages.create!(direction: "out", kind: "text", body: "hi", wa_id: "wamid.out", status: "sent")
      tap = { from: "233241112233", id: "wamid.3", type: "interactive",
              interactive: { type: "button_reply", button_reply: { id: "browse", title: "See what's in stock" } } }
      payload = { entry: [ { changes: [ { value: {
        messages: [ tap ], statuses: [ { id: "wamid.out", status: "read" } ],
        message_echoes: [ { from: "233200000000", to: "233241112233", id: "wamid.echo", type: "text", text: { body: "I'll check" } } ] } } ] } ] }
      post_signed(payload)

      assert_equal({ "id" => "browse", "text" => "See what's in stock" }, chat.messages.inbound.last.payload)
      assert_equal "read", sent.reload.status
      assert chat.reload.handed_off? # she answered from the app: the bot steps back
      assert_equal "I'll check", chat.messages.find_by(wa_id: "wamid.echo").body
    end
  end
end
