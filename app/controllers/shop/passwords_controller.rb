# "Forgot password?" without SMS: they message the shop on WhatsApp, and
# staff send a one-time link made on the customer's page in the back office
# (Customers::ShopAccountsController#reset_link). The link sets a new password.
#
#   GET /forgot-password            how to get a link
#   GET /reset-password/:token      the form    PATCH: save it
class Shop::PasswordsController < Shop::BaseController
  before_action :find_account, only: %i[ edit update ]

  def new
    render inertia: "Shop/Account/ForgotPassword", props: { whatsapp: shop_whatsapp_link }
  end

  def edit
    render inertia: "Shop/Account/ResetPassword", props: { token: params[:token], name: @account.name.split.first }
  end

  def update
    if @account.update(password: params[:password].to_s.presence || "")
      @account.sessions.delete_all # any old logins, e.g. a lost phone
      start_shop_session_for(@account)
      redirect_to shop_account_path, notice: "New password saved. You're logged in."
    else
      redirect_to shop_reset_password_path(params[:token]), inertia: { errors: { password: @account.errors[:password] } }
    end
  end

  private
    def find_account
      @account = ShopAccount.find_by_token_for(:reset_password, params[:token])
      redirect_to shop_forgot_password_path, alert: "That link has expired or was already used. Ask us for a new one." unless @account
    end

    # The shop's WhatsApp, with the message written: "I forgot my password".
    def shop_whatsapp_link
      digits = WhatsappSetting.current.business_phone.to_s.delete("+")
      return if digits.blank?

      "https://wa.me/#{digits}?text=#{ERB::Util.url_encode('Hi, I forgot my password for the website. Please send me a link to set a new one.')}"
    end
end
