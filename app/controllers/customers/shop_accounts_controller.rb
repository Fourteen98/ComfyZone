# A customer's website account, from the back office.
#
#   POST   /customers/:customer_id/shop_account/reset_link   a one-time link to set a new password
#   DELETE /customers/:customer_id/shop_account              remove the login (their orders stay)
#
# "Forgot password?" on the website sends the shopper to WhatsApp; she makes
# the link here and sends it to them. Check it's really them first: the
# message should come from the account's phone number.
class Customers::ShopAccountsController < InertiaController
  require_permission "customers.manage"
  before_action :set_account

  def reset_link
    url = shop_reset_password_url(@account.generate_token_for(:reset_password))
    # Shown once on the customer's page, with Copy and Send on WhatsApp.
    flash[:reset_link] = url
    redirect_to customer_path(@account.customer), notice: "Link made. It works once, for one day."
  end

  def destroy
    @account.destroy!
    redirect_to customer_path(params.expect(:customer_id)), notice: "Website account removed. Their orders stay.", status: :see_other
  end

  private
    def set_account
      @account = ShopAccount.find_by!(customer_id: params.expect(:customer_id))
    end
end
