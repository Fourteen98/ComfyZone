# Adding and removing passkeys, from "My account". Same ceremony as the
# staff one (Account::PasskeysController), for ShopAccount.
#
#   POST /account/passkeys/challenge   POST /account/passkeys   DELETE /account/passkeys/:id
class Shop::PasskeysController < Shop::BaseController
  before_action :require_shop_account
  rate_limit to: 20, within: 3.minutes, only: %i[ challenge create ]

  def challenge
    account = Current.shop_account
    options = WebAuthn::Credential.options_for_create(
      user: { id: account.webauthn_id, name: account.phone_display, display_name: account.name },
      exclude: account.passkeys.pluck(:external_id), # not the same device twice
      authenticator_selection: { resident_key: "required", user_verification: "required" }
    )
    session[:shop_passkey_registration_challenge] = options.challenge
    render json: options
  end

  def create
    credential = WebAuthn::Credential.from_create(params.require(:credential).to_unsafe_h)
    credential.verify(session.delete(:shop_passkey_registration_challenge).to_s, user_verification: true)

    passkey = Current.shop_account.passkeys.new(name: params[:name].presence || "Passkey", external_id: credential.id,
                                                public_key: credential.public_key, sign_count: credential.sign_count)
    if passkey.save
      flash[:notice] = "#{passkey.name} is set up. Next time, log in with a tap."
      render json: { ok: true }, status: :created
    else
      render json: { error: passkey.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  rescue WebAuthn::Error
    render json: { error: "That didn't work. Please try again." }, status: :unprocessable_entity
  end

  def destroy
    passkey = Current.shop_account.passkeys.find(params.expect(:id)) # only their own
    passkey.destroy!
    redirect_to shop_account_path, notice: "Removed #{passkey.name}.", status: :see_other
  end
end
