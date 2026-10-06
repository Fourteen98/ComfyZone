# Logging in with a passkey instead of a password.
#
# Same two-step shape as registration:
#
#   1. challenge The server sends a random challenge.
#   2. (browser) The phone asks for Face ID / fingerprint and signs it.
#   3. create    The server finds the passkey, checks the signature against
#                the stored public key, and starts a session.
#
# No email is typed: the device tells us which passkey it used.
class Sessions::PasskeysController < ApplicationController
  allow_unauthenticated_access
  rate_limit to: 10, within: 3.minutes

  # POST /session/passkey/challenge
  def challenge
    options = WebAuthn::Credential.options_for_get(user_verification: "required")
    session[:passkey_login_challenge] = options.challenge

    render json: options
  end

  # POST /session/passkey
  def create
    credential = WebAuthn::Credential.from_get(params.require(:credential).to_unsafe_h)
    passkey = Passkey.includes(:user).find_by(external_id: credential.id)

    return refuse("This passkey isn't registered here. Log in with your password instead.") unless passkey
    return refuse("This account has been switched off.") unless passkey.user.active?

    # Raises WebAuthn::Error unless the device really holds the private key.
    credential.verify(
      session.delete(:passkey_login_challenge).to_s,
      public_key: passkey.public_key,
      sign_count: passkey.sign_count,
      user_verification: true
    )

    passkey.update!(sign_count: credential.sign_count, last_used_at: Time.current)
    start_new_session_for passkey.user

    render json: { redirect_to: after_authentication_url }
  rescue WebAuthn::Error
    refuse("That didn't work. Try again, or log in with your password.")
  end

  private
    def refuse(message)
      render json: { error: message }, status: :unprocessable_entity
    end
end
