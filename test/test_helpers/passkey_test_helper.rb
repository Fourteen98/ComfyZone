require "webauthn/fake_client"

# Stands in for a phone in tests. The webauthn gem ships a FakeClient that
# creates real key pairs and real signatures, so the server-side checks run
# exactly as they would with Face ID. Only the human is faked.
module PasskeyTestHelper
  def fake_device
    @fake_device ||= WebAuthn::FakeClient.new("http://localhost:3000")
  end

  # A well-formed challenge that the server never issued.
  def some_other_challenge
    Base64.urlsafe_encode64(SecureRandom.random_bytes(32), padding: false)
  end

  # Runs the whole registration ceremony for whoever is signed in.
  def register_passkey(name: "Test phone", device: fake_device)
    post challenge_account_passkeys_path, as: :json
    credential = device.create(challenge: response.parsed_body["challenge"], user_verified: true)
    post account_passkeys_path, params: { credential: credential, name: name }, as: :json
  end

  # Runs the whole login ceremony.
  def login_with_passkey(device: fake_device)
    post challenge_session_passkey_path, as: :json
    assertion = device.get(challenge: response.parsed_body["challenge"], user_verified: true)
    post session_passkey_path, params: { credential: assertion }, as: :json
  end
end

ActiveSupport.on_load(:action_dispatch_integration_test) do
  include PasskeyTestHelper
end
