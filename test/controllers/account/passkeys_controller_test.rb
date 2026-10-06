require "test_helper"

class Account::PasskeysControllerTest < ActionDispatch::IntegrationTest
  test "you must be logged in to register a passkey" do
    post challenge_account_passkeys_path, as: :json

    assert_redirected_to new_session_path
  end

  test "the challenge asks the device to verify the person and remember them" do
    sign_in_as(users(:two))

    post challenge_account_passkeys_path, as: :json

    options = response.parsed_body
    assert options["challenge"].present?
    assert_equal users(:two).webauthn_id, options["user"]["id"]
    assert_equal "required", options["authenticatorSelection"]["userVerification"]
    assert_equal "required", options["authenticatorSelection"]["residentKey"]
  end

  test "registers a passkey for the signed-in person" do
    sign_in_as(users(:two))

    assert_difference -> { users(:two).passkeys.count }, 1 do
      register_passkey(name: "Ama's iPhone")
    end

    assert_response :created
    passkey = users(:two).passkeys.last
    assert_equal "Ama's iPhone", passkey.name
    assert passkey.public_key.present?
  end

  test "an answer to the wrong challenge is refused" do
    sign_in_as(users(:two))
    post challenge_account_passkeys_path, as: :json
    credential = fake_device.create(challenge: some_other_challenge, user_verified: true)

    assert_no_difference "Passkey.count" do
      post account_passkeys_path, params: { credential: credential, name: "Sneaky" }, as: :json
    end
    assert_response :unprocessable_entity
  end

  test "a challenge can only be used once" do
    sign_in_as(users(:two))
    post challenge_account_passkeys_path, as: :json
    challenge = response.parsed_body["challenge"]
    post account_passkeys_path,
      params: { credential: fake_device.create(challenge: challenge, user_verified: true), name: "First" }, as: :json
    assert_response :created

    other_device = WebAuthn::FakeClient.new("http://localhost:3000")
    post account_passkeys_path,
      params: { credential: other_device.create(challenge: challenge, user_verified: true), name: "Replay" }, as: :json

    assert_response :unprocessable_entity
  end

  test "the account page lists your passkeys and nobody else's" do
    sign_in_as(users(:two))
    register_passkey(name: "Ama's iPhone")
    users(:one).passkeys.create!(name: "Owner's Mac", external_id: "other", public_key: "key")

    get account_path

    assert_inertia_component "Account/Show"
    assert_equal [ "Ama's iPhone" ], inertia.props[:passkeys].map { |p| p[:name] }
  end

  test "you can remove your own passkey but not someone else's" do
    sign_in_as(users(:two))
    register_passkey
    theirs = users(:one).passkeys.create!(name: "Owner's Mac", external_id: "other", public_key: "key")

    assert_difference "Passkey.count", -1 do
      delete account_passkey_path(users(:two).passkeys.last)
    end
    assert_redirected_to account_path

    assert_no_difference "Passkey.count" do
      delete account_passkey_path(theirs)
    end
    assert_response :not_found
  end
end
