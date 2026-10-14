require "test_helper"

class Whatsapp::ClientTest < ActiveSupport::TestCase
  teardown do
    Whatsapp::Client.transport = nil
    %w[ WHATSAPP_ACCESS_TOKEN WHATSAPP_PHONE_NUMBER_ID ].each { |key| ENV.delete(key) }
  end

  test "with keys, sends WhatsApp's JSON and keeps the message id; long titles are cut" do
    ENV["WHATSAPP_ACCESS_TOKEN"] = "token"
    ENV["WHATSAPP_PHONE_NUMBER_ID"] = "123"
    sent = []
    Whatsapp::Client.transport = ->(uri, json) { sent << [ uri.to_s, json ]; [ 200, { "messages" => [ { "id" => "wamid.X" } ] } ] }
    chat = WhatsappConversation.for("+233241112233")

    message = Whatsapp::Client.buttons(chat, "Pick", [ [ "a", "A title much longer than twenty" ], [ "b", "B" ] ])
    uri, json = sent.first
    assert_match %r{graph.facebook.com/v\d+\.\d+/123/messages}, uri
    assert_equal "233241112233", json[:to]
    assert_equal 20, json.dig(:interactive, :action, :buttons, 0, :reply, :title).length
    assert_equal [ "sent", "wamid.X" ], [ message.status, message.wa_id ]

    Whatsapp::Client.transport = ->(*) { [ 400, { "error" => { "message" => "Bad number" } } ] }
    failed = Whatsapp::Client.text(chat, "hi")
    assert_equal [ "failed", "Bad number" ], [ failed.status, failed.error ]
  end
end
