# Logging in on the website with a passkey (Face ID, fingerprint, phone PIN).
# Two steps with the device in between, so JSON, like the staff version
# (Sessions::PasskeysController), but it only ever finds SHOPPERS' passkeys.
#
#   POST /login/passkey/challenge   POST /login/passkey
class Shop::PasskeySessionsController < Shop::BaseController
  rate_limit to: 10, within: 3.minutes

  def challenge
    options = WebAuthn::Credential.options_for_get(user_verification: "required")
    session[:shop_passkey_login_challenge] = options.challenge
    render json: options
  end

  def create
    credential = WebAuthn::Credential.from_get(params.require(:credential).to_unsafe_h)
    passkey = ShopPasskey.includes(:shop_account).find_by(external_id: credential.id)
    return refuse("This passkey isn't set up for a shop account. Log in with your phone and password.") unless passkey

    credential.verify(session.delete(:shop_passkey_login_challenge).to_s,
      public_key: passkey.public_key, sign_count: passkey.sign_count, user_verification: true)

    passkey.update!(sign_count: credential.sign_count, last_used_at: Time.current)
    start_shop_session_for(passkey.shop_account)
    flash[:notice] = "Welcome back, #{passkey.shop_account.name.split.first}."
    render json: { redirect_to: after_shop_login_path }
  rescue WebAuthn::Error
    refuse("That didn't work. Try again, or log in with your password.")
  end

  private
    def refuse(message)
      render json: { error: message }, status: :unprocessable_entity
    end
end
