# Registering and removing your own passkeys.
#
# Registration is a two-step "ceremony":
#
#   1. challenge The server invents a random challenge and remembers it.
#   2. (browser) The phone asks for Face ID / fingerprint, creates a key
#                pair, and signs the challenge with it.
#   3. create    The server checks the signature and stores the public key.
#
# Steps 1 and 3 answer with JSON instead of rendering an Inertia page,
# because the browser has work to do in between. These are the only
# JSON endpoints in the app.
class Account::PasskeysController < ApplicationController
  rate_limit to: 20, within: 3.minutes, only: %i[ challenge create ]

  # POST /account/passkeys/challenge
  def challenge
    user = Current.user

    options = WebAuthn::Credential.options_for_create(
      user: { id: user.webauthn_id, name: user.email_address, display_name: user.name },
      # Don't register the same device twice.
      exclude: user.passkeys.pluck(:external_id),
      authenticator_selection: {
        resident_key: "required",     # the device remembers who she is, so login needs no email
        user_verification: "required" # always ask for face, fingerprint or PIN
      }
    )

    # Remember the challenge so `create` can check the device signed THIS one.
    session[:passkey_registration_challenge] = options.challenge

    render json: options
  end

  # POST /account/passkeys
  def create
    credential = WebAuthn::Credential.from_create(params.require(:credential).to_unsafe_h)

    # Raises WebAuthn::Error unless the signature, challenge and site all match.
    credential.verify(session.delete(:passkey_registration_challenge).to_s, user_verification: true)

    passkey = Current.user.passkeys.new(
      name: params[:name].presence || "Passkey",
      external_id: credential.id,
      public_key: credential.public_key,
      sign_count: credential.sign_count
    )

    if passkey.save
      flash[:notice] = "#{passkey.name} is set up. Next time, log in with a tap."
      render json: { ok: true }, status: :created
    else
      render json: { error: passkey.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  rescue WebAuthn::Error
    render json: { error: "That didn't work. Please try again." }, status: :unprocessable_entity
  end

  # DELETE /account/passkeys/:id
  def destroy
    # Looked up through Current.user, so nobody can remove someone else's.
    passkey = Current.user.passkeys.find(params.expect(:id))
    passkey.destroy!

    redirect_to account_path, notice: "Removed #{passkey.name}.", status: :see_other
  end
end
