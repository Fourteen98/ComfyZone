require "test_helper"

class Account::PushSubscriptionsControllerTest < ActionDispatch::IntegrationTest
  setup do
    sign_in_as(users(:one))
    @keys = ENV.values_at("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY")
    ENV["VAPID_PUBLIC_KEY"], ENV["VAPID_PRIVATE_KEY"] = "public", "private"
  end

  teardown { ENV["VAPID_PUBLIC_KEY"], ENV["VAPID_PRIVATE_KEY"] = @keys }

  def subscribe(endpoint = "https://fcm.googleapis.com/fcm/send/abc")
    post account_push_subscriptions_path, as: :json,
      params: { endpoint: endpoint, keys: { p256dh: "key", auth: "secret" }, device: "Android phone" }
  end

  test "the account page leaves notifications out until the server has keys" do
    ENV["VAPID_PUBLIC_KEY"] = nil
    get account_path
    assert_nil inertia.props[:push]
  end

  test "turning on saves the device, and the account page lists it" do
    assert_difference "PushSubscription.count", 1 do
      subscribe
    end
    assert_response :success

    get account_path
    push = inertia.props[:push]
    assert_equal "public", push[:public_key]
    assert_equal %w[ low_stock orders back_in_stock ], push[:topics].pluck("key")
    assert_equal [ "Android phone", %w[ low_stock orders back_in_stock ] ], push[:devices].first.values_at("device", "topics")

    assert_no_difference("PushSubscription.count") { subscribe } # the same phone again
  end

  test "only a real push service over https is accepted" do
    [ "http://fcm.googleapis.com/x", "https://evil.example/x", "https://127.0.0.1/admin", "https://notgoogleapis.com/x" ].each do |address|
      assert_no_difference("PushSubscription.count") { subscribe(address) }
      assert_response :unprocessable_entity
    end

    assert_difference("PushSubscription.count", 1) { subscribe("https://web.push.apple.com/abc") }
  end

  test "choosing topics keeps only real ones she may hear" do
    subscribe
    subscription = PushSubscription.last

    patch account_push_subscription_path(subscription), params: { topics: [ "orders", "made_up" ] }
    assert_equal %w[ orders ], subscription.reload.topics

    patch account_push_subscription_path(subscription), params: { topics: [] }
    assert_equal [], subscription.reload.topics
  end

  test "only her own devices can be changed, tested or removed" do
    theirs = PushSubscription.register!(user: users(:two), endpoint: "https://fcm.googleapis.com/fcm/send/theirs", p256dh: "k", auth: "a")

    patch account_push_subscription_path(theirs), params: { topics: [] }
    assert_response :not_found
    delete account_push_subscription_path(theirs)
    assert_response :not_found
    assert PushSubscription.exists?(theirs.id)
  end

  test "turning off removes the device" do
    subscribe
    assert_difference("PushSubscription.count", -1) { delete account_push_subscription_path(PushSubscription.last) }
    assert_redirected_to account_path
  end

  test "a test notification reports whether it went" do
    subscribe
    original = WebPush.method(:payload_send)

    WebPush.define_singleton_method(:payload_send) { |**| true }
    post test_account_push_subscription_path(PushSubscription.last)
    assert_equal "Sent. It should appear in a moment.", flash[:notice]

    WebPush.define_singleton_method(:payload_send) { |**| raise SocketError }
    post test_account_push_subscription_path(PushSubscription.last)
    assert_match "didn't go through", flash[:alert]
  ensure
    WebPush.define_singleton_method(:payload_send, original)
  end
end
