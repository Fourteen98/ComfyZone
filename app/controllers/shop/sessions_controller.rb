# Logging in and out on the website, with phone + password.
# (Face ID / fingerprint: Shop::PasskeySessionsController.)
#
#   GET /login   POST /login   DELETE /logout
class Shop::SessionsController < Shop::BaseController
  # Guessing passwords: ten tries in three minutes from one connection.
  rate_limit to: 10, within: 3.minutes, only: :create,
    with: -> { redirect_to shop_login_path, alert: "Too many tries. Wait a few minutes, then try again." }

  def new
    return redirect_to shop_account_path if Current.shop_account

    remember_back

    render inertia: "Shop/Account/LogIn"
  end

  def create
    account = ShopAccount.authenticate_by(phone: params[:phone].to_s, password: params[:password].to_s)

    if account
      start_shop_session_for(account)
      redirect_to after_shop_login_path, notice: "Welcome back, #{account.name.split.first}."
    else
      # The same answer whether the phone is unknown or the password wrong,
      # so nobody can use this page to find out who has an account.
      redirect_to shop_login_path, inertia: { errors: { password: [ "That phone number and password don't match" ] } }
    end
  end

  def destroy
    end_shop_session
    redirect_to root_path, notice: "You're logged out."
  end
end
