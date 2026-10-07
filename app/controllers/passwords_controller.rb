# "Forgot your password": ask for a link by email, then choose a new one.
#
#   GET  /passwords/new          the "what's your email" form
#   POST /passwords              emails a link (if that email is a user)
#   GET  /passwords/:token/edit  the link in the email lands here
#   PUT  /passwords/:token       saves the new password
#
# The token in the link is not stored anywhere. Rails signs it from the
# user's id and their current password hash (has_secure_password gives us
# `password_reset_token`), so it stops working after 15 minutes AND the
# moment the password changes: a link can only ever be used once.
class PasswordsController < InertiaController
  allow_unauthenticated_access
  before_action :set_user_by_token, only: %i[ edit update ]
  rate_limit to: 10, within: 3.minutes, only: :create, with: -> { redirect_to new_password_path, alert: "Try again later." }

  def new
    render inertia: "Passwords/New", props: { sending: ApplicationMailer.sending? }
  end

  def create
    # `active`: someone whose access was switched off can't reset their way back in.
    if user = User.active.find_by(email_address: params[:email_address])
      # deliver_later hands the sending to a background job (Solid Queue), so
      # this page answers at once even if the mail server is slow.
      PasswordsMailer.reset(user).deliver_later
    end

    # The same message whether or not the email matched anyone. Otherwise
    # this page would tell a stranger which emails have accounts here.
    redirect_to new_session_path, notice: "If that email has an account, a reset link is on its way. It works for 15 minutes."
  end

  def edit
    render inertia: "Passwords/Edit", props: { token: params[:token] }
  end

  def update
    if @user.update(params.permit(:password, :password_confirmation))
      # Log every device out: if someone else had got in, they are out now.
      @user.sessions.destroy_all
      redirect_to new_session_path, notice: "Password changed. Log in with the new one."
    else
      redirect_to edit_password_path(params[:token]), inertia: { errors: @user.errors.to_hash }
    end
  end

  private
    def set_user_by_token
      @user = User.find_by_password_reset_token!(params[:token])
    rescue ActiveSupport::MessageVerifier::InvalidSignature
      redirect_to new_password_path, alert: "That reset link has expired or was already used. Ask for a new one."
    end
end
