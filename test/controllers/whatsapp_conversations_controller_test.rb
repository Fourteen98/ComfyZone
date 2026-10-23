require "test_helper"

class WhatsappConversationsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @chat = WhatsappConversation.for("+233241112233", name: "Esi")
    @chat.messages.create!(direction: "in", kind: "text", body: "Is the dress available?", payload: { "text" => "x" }, status: "received")
    @chat.update!(last_inbound_at: 1.hour.ago, last_message_at: 1.hour.ago, unread: 1)
  end

  test "the inbox lists chats; opening one marks it read; replying takes it over" do
    sign_in_as(users(:one))
    get whatsapp_conversations_path
    assert_equal [ [ "Esi", 1, "Is the dress available?" ] ], inertia.props[:chats].map { |chat| chat.values_at(:name, :unread, :preview) }

    get whatsapp_conversation_path(@chat)
    assert_equal 0, @chat.reload.unread
    assert inertia.props[:chat][:window_open]

    post reply_whatsapp_conversation_path(@chat), params: { body: "Yes! Which size?" }
    assert_equal [ "Yes! Which size?", users(:one) ], @chat.messages.outbound.last.slice(:body, :user).values
    assert @chat.reload.handed_off?

    patch hand_back_whatsapp_conversation_path(@chat)
    assert_not @chat.reload.handed_off?
  end

  test "after 24 hours a free reply is refused, as WhatsApp would" do
    @chat.update!(last_inbound_at: 25.hours.ago)
    sign_in_as(users(:one))
    post reply_whatsapp_conversation_path(@chat), params: { body: "Hello?" }
    assert_match "more than 24 hours", flash[:alert]
    assert_equal 0, @chat.messages.outbound.count
  end

  test "settings: save the MoMo details, and try the bot without touching orders" do
    sign_in_as(users(:one))
    patch settings_whatsapp_path, params: { whatsapp: { enabled: "1", hold_minutes: "10", momo_number: "", momo_name: "" } }
    follow_redirect!
    assert inertia.props[:errors].key?(:momo_number)

    patch settings_whatsapp_path, params: { whatsapp: { enabled: "1", hold_minutes: "15", momo_number: "0241112222", momo_name: "Fazila" } }
    assert_equal [ true, 15 ], WhatsappSetting.current.reload.slice(:enabled, :hold_minutes).values

    assert_no_difference -> { Order.count } do
      post try_settings_whatsapp_path, params: { text: "hi" }
    end
    get settings_whatsapp_path
    assert_match "Welcome to The Comfy Zone", inertia.props[:trial].last[:text]
    assert_equal false, inertia.props[:connection][:connected]

    delete try_settings_whatsapp_path
    assert_not WhatsappConversation.exists?(phone: Settings::WhatsappController::TRY_PHONE)
  end

  test "the inbox needs orders.view; settings need settings.manage" do
    roles(:assistant).update!(permissions: %w[ products.view ])
    sign_in_as(users(:two))
    get whatsapp_conversations_path
    assert_response :redirect
    post try_settings_whatsapp_path, params: { text: "hi" }
    assert_not WhatsappConversation.exists?(phone: Settings::WhatsappController::TRY_PHONE)
  end
end
