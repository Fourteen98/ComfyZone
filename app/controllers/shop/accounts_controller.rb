# A shopper's own account: signing up, "My account", changing details or
# password, and deleting the account.
#
#   GET    /signup    POST /signup
#   GET    /account   PATCH /account   DELETE /account
class Shop::AccountsController < Shop::BaseController
  include LocationPicker

  before_action :require_shop_account, only: %i[ show update destroy ]
  # Stops a script making thousands of accounts. Ten tries an hour from one
  # connection is plenty for a person who mistypes.
  rate_limit to: 10, within: 1.hour, only: :create,
    with: -> { redirect_to shop_signup_path, alert: "Too many sign-ups from this connection. Please try again later." }

  # GET /signup   (?order=<token>: just ordered as a guest; that order joins the new account)
  def new
    return redirect_to shop_account_path if Current.shop_account

    remember_back

    from = params[:order].presence && Order.find_by(public_token: params[:order])
    render inertia: "Shop/Account/SignUp", props: {
      # Coming from their order's page: start from the name and phone they gave.
      start: from ? { name: from.customer.name.to_s, phone: PhoneNumber.format(from.customer.phone).to_s, order: params[:order] } : nil
    }
  end

  # POST /signup
  def create
    fields = params.expect(account: %i[ name phone email password ])
    account = ShopAccount.new(fields)

    if account.save
      claim_guest_order(account, params.dig(:account, :order))
      start_shop_session_for(account)
      redirect_to after_shop_login_path, notice: "Welcome, #{account.name.split.first}! You're signed up, and you'll stay logged in on this device."
    else
      redirect_to shop_signup_path(order: params.dig(:account, :order).presence), inertia: { errors: account.errors.to_hash }
    end
  end

  # GET /account
  def show
    account = Current.shop_account
    render inertia: "Shop/Account/Show", props: {
      account: { name: account.name, phone: account.phone_display, email: account.email.to_s, since: account.created_at.strftime("%B %Y") },
      orders: account.orders.where.not(public_token: nil).newest_first.limit(50).includes(items: { variant: :product }).map { |order|
        { token: order.public_token, number: order.id, at: order.created_at.strftime("%-d %b %Y"), status: order.status,
          total_pesewas: order.due_pesewas.positive? ? order.due_pesewas : order.total_pesewas, balance_pesewas: order.balance_pesewas,
          items: order.items.sum(&:kept), summary: order.items.first(2).map { |item| item.variant.product.name }.join(", ") }
      },
      passkeys: account.passkeys.ordered.map { |key|
        { id: key.id, name: key.name, added: key.created_at.strftime("%-d %b %Y"), used: key.last_used_at&.strftime("%-d %b %Y") }
      },
      devices: account.sessions.count
    }
  end

  # PATCH /account   { account: { name, phone, email } }  or  { password: { current, new } }
  def update
    account = Current.shop_account

    if params[:password]
      change_password(account)
    elsif account.update(params.expect(account: %i[ name phone email ]))
      redirect_to shop_account_path, notice: "Saved."
    else
      redirect_to shop_account_path, inertia: { errors: account.errors.to_hash }
    end
  end

  # DELETE /account   { password }
  # Their orders stay (the shop needs its sales records), no longer linked to a login.
  def destroy
    account = Current.shop_account
    unless account.authenticate(params[:password].to_s)
      return redirect_to shop_account_path, inertia: { errors: { delete_password: [ "That isn't your password" ] } }
    end

    end_shop_session
    account.destroy!
    redirect_to root_path, notice: "Your account is deleted. Your past orders stay with the shop, as our privacy policy explains."
  end

  private
    def change_password(account)
      typed = params.expect(password: %i[ current new ])
      if !account.authenticate(typed[:current].to_s)
        redirect_to shop_account_path, inertia: { errors: { current_password: [ "That isn't your current password" ] } }
      elsif account.update(password: typed[:new].to_s)
        # Logged out everywhere else: a changed password should lock out a lost phone.
        account.sessions.where.not(id: Current.shop_session.id).delete_all
        redirect_to shop_account_path, notice: "Password changed. Any other devices were logged out."
      else
        redirect_to shop_account_path, inertia: { errors: { new_password: account.errors[:password] } }
      end
    end

    # Signed up from the page of an order they had just placed as a guest:
    # the secret link proves the order is theirs, so it joins the account
    # (only if it was placed with the same phone, and isn't anyone else's).
    def claim_guest_order(account, token)
      return if token.blank?

      order = Order.find_by(public_token: token, shop_account_id: nil)
      order.update!(shop_account: account) if order && order.customer.phone == account.phone
    end
end
