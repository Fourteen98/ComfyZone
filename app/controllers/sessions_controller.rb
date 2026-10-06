class SessionsController < InertiaController
  # Everything requires login by default (see the Authentication concern).
  # The login page itself obviously can't.
  allow_unauthenticated_access only: %i[ new create ]

  # Slow down password guessing: max 10 attempts per 3 minutes per IP.
  rate_limit to: 10, within: 3.minutes, only: :create,
    with: -> { redirect_to new_session_path, alert: "Too many attempts. Try again in a few minutes." }

  # GET /session/new -> the login form (app/frontend/pages/Sessions/New.tsx)
  def new
    render inertia: "Sessions/New"
  end

  # POST /session -> check the credentials
  def create
    # `User.active` first: someone whose access was switched off in
    # Settings can't log in, even with the right password.
    if user = User.active.authenticate_by(params.permit(:email_address, :password))
      start_new_session_for user
      redirect_to after_authentication_url
    else
      # Redirect back to the form and attach an error to a field.
      # Inertia carries it across the redirect; React reads it as
      # `form.errors.email_address`.
      redirect_to new_session_path,
        inertia: { errors: { email_address: [ "That email and password don't match." ] } }
    end
  end

  # DELETE /session -> log out
  def destroy
    terminate_session
    redirect_to new_session_path, status: :see_other
  end
end
