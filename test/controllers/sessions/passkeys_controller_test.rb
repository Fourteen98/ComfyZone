require "test_helper"

class Sessions::PasskeysControllerTest < ActionDispatch::IntegrationTest
  # Give the helper a registered passkey, then log out, so each test starts
  # where a real person would: on the login page with a phone in hand.
  setup do
    @user = users(:two)
    sign_in_as(@user)
    register_passkey
    sign_out
  end

  test "logs in with a registered passkey, no password involved" do
    login_with_passkey

    assert_response :success
    assert_equal admin_root_url, response.parsed_body["redirect_to"]
    assert cookies[:session_id].present?

    get admin_root_path
    assert_inertia_component "Dashboard"
    assert_equal @user.name, inertia.props[:auth][:user][:name]
  end

  test "records when the passkey was last used" do
    assert_nil @user.passkeys.last.last_used_at

    login_with_passkey

    assert_not_nil @user.passkeys.last.reload.last_used_at
  end

  test "a device that was never registered is refused" do
    stranger = WebAuthn::FakeClient.new("http://localhost:3000")
    post challenge_session_passkey_path, as: :json
    stranger.create(challenge: response.parsed_body["challenge"], user_verified: true) # makes its own key
    post challenge_session_passkey_path, as: :json

    post session_passkey_path,
      params: { credential: stranger.get(challenge: response.parsed_body["challenge"], user_verified: true) }, as: :json

    assert_response :unprocessable_entity
    assert_nil cookies[:session_id].presence
  end

  test "an answer to the wrong challenge is refused" do
    post challenge_session_passkey_path, as: :json

    post session_passkey_path,
      params: { credential: fake_device.get(challenge: some_other_challenge, user_verified: true) }, as: :json

    assert_response :unprocessable_entity
    assert_nil cookies[:session_id].presence
  end

  test "a passkey from another website is refused" do
    phishing_site = WebAuthn::FakeClient.new("https://thecomfyzone.evil.example", authenticator: fake_device.send(:authenticator))
    post challenge_session_passkey_path, as: :json

    post session_passkey_path,
      params: { credential: phishing_site.get(challenge: response.parsed_body["challenge"], user_verified: true,
        rp_id: "localhost") }, as: :json

    assert_response :unprocessable_entity
  end

  test "someone whose access was switched off can't log in with their passkey" do
    @user.update!(active: false)

    login_with_passkey

    assert_response :unprocessable_entity
    assert_nil cookies[:session_id].presence
  end

  test "a removed passkey stops working" do
    @user.passkeys.destroy_all

    login_with_passkey

    assert_response :unprocessable_entity
  end
end
