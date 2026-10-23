require "test_helper"

# Shoppers' accounts on the website: optional, separate from staff logins.
class Shop::AccountsTest < ActionDispatch::IntegrationTest
  setup do
    @dress = products(:dress)
    @black = variants(:dress_m_black)
    @dress.update!(listed: true)
    StockLedger.record!(variant: @black, quantity: 5, reason: "recount")
  end

  def sign_up(phone: "055 111 2222", password: "comfy-zone-1", **more)
    post shop_signup_path, params: { account: { name: "Esi Mensah", phone: phone, password: password, **more } }
  end

  def order_as_guest(phone: "055 111 2222")
    post items_shop_cart_path, params: { variant_id: @black.id }
    post shop_checkout_path, params: { checkout: { name: "Esi Mensah", phone: phone, delivery_method: "pickup" } }
    Order.newest_first.first
  end

  test "sign up: logged in straight away, for a year, linked to the shop's customer record" do
    sign_up
    assert_redirected_to shop_account_path
    account = ShopAccount.last
    assert_equal [ "Esi Mensah", "+233551112222" ], [ account.name, account.phone ]
    assert_equal account.customer, Customer.find_by(phone: "+233551112222")
    assert_match(/expires=/i, response.headers["Set-Cookie"].to_s[/shop_session_id[^\n]*/])

    get shop_account_path
    assert_inertia_component "Shop/Account/Show"
    assert_equal "Esi", inertia.props[:shop][:shopper]
  end

  test "bad sign-ups come back with reasons; a phone can have one account" do
    sign_up(password: "short")
    follow_redirect!
    assert_equal [ "must be at least 8 characters" ], inertia.props[:errors][:password]

    sign_up
    delete shop_logout_path
    sign_up(phone: "0551112222")
    follow_redirect!
    assert_match "already has an account", inertia.props[:errors][:phone].first
  end

  test "log in with phone and password; a wrong one gives nothing away" do
    sign_up
    delete shop_logout_path
    get shop_account_path
    assert_redirected_to shop_login_path

    post shop_login_path, params: { phone: "+233 55 111 2222", password: "wrong" }
    follow_redirect!
    assert_equal [ "That phone number and password don't match" ], inertia.props[:errors][:password]

    post shop_login_path, params: { phone: "0551112222", password: "comfy-zone-1" }
    assert_redirected_to shop_account_path # remembered: they were sent to log in from there
  end

  test "checkout: filled in from the account, the order in My orders, details kept" do
    sign_up
    get shop_checkout_path # empty bag
    post items_shop_cart_path, params: { variant_id: @black.id }
    get shop_checkout_path
    assert_equal "Esi Mensah", inertia.props[:account][:name]

    post shop_checkout_path, params: { checkout: { name: "Esi Mensah", phone: "0551112222", delivery_method: "pickup", address: "Near the mosque" } }
    order = Order.newest_first.first
    account = ShopAccount.last
    assert_equal account, order.shop_account
    assert_equal [ "pickup", "Near the mosque" ], account.reload.values_at(:delivery_method, :address)

    get shop_account_path
    assert_equal [ order.public_token ], inertia.props[:orders].map { |row| row[:token] }
  end

  test "My orders never shows someone else's orders just because the phone matches" do
    theirs = order_as_guest # placed by the real owner of this phone, as a guest
    sign_up                 # someone else signs up with that number
    get shop_account_path
    assert_empty inertia.props[:orders]
    assert_nil theirs.reload.shop_account
  end

  test "signing up from the page of a guest order brings that order in" do
    order = order_as_guest
    get shop_signup_path(order: order.public_token)
    assert_equal "Esi Mensah", inertia.props[:start][:name]

    sign_up(order: order.public_token)
    assert_equal ShopAccount.last, order.reload.shop_account
  end

  test "change password logs out other devices; delete needs the password" do
    sign_up
    ShopAccount.last.sessions.create!(last_seen_at: Time.current) # another phone
    patch shop_account_path, params: { password: { current: "nope", new: "new-password-9" } }
    follow_redirect!
    assert inertia.props[:errors][:current_password]

    patch shop_account_path, params: { password: { current: "comfy-zone-1", new: "new-password-9" } }
    assert_equal 1, ShopAccount.last.sessions.count

    delete shop_account_path, params: { password: "wrong" }
    assert ShopAccount.exists?
    delete shop_account_path, params: { password: "new-password-9" }
    assert_not ShopAccount.exists?
    assert Customer.find_by(phone: "+233551112222") # the shop keeps its customer
  end

  test "forgot password: staff make a one-time link, it sets a new password and logs in" do
    sign_up
    delete shop_logout_path
    account = ShopAccount.last

    sign_in_as(users(:one))
    post reset_link_customer_shop_account_path(account.customer)
    link = flash[:reset_link]
    get customer_path(account.customer)
    assert_equal link, inertia.props[:reset_link]
    assert_equal 0, inertia.props[:shop_account][:passkeys]

    token = link.split("/").last
    get shop_reset_password_path(token)
    assert_inertia_component "Shop/Account/ResetPassword"
    patch shop_reset_password_path(token), params: { password: "brand-new-pass" }
    assert_redirected_to shop_account_path
    assert ShopAccount.authenticate_by(phone: "0551112222", password: "brand-new-pass")

    get shop_reset_password_path(token) # used: the password changed
    assert_redirected_to shop_forgot_password_path
  end

  test "a shopper's login never opens the back office, and staff can remove an account" do
    sign_up
    get admin_root_path
    assert_redirected_to new_session_path

    sign_in_as(users(:one))
    delete customer_shop_account_path(ShopAccount.last.customer)
    assert_not ShopAccount.exists?
  end

  test "a session unused for a year has expired" do
    sign_up
    ShopSession.last.update_columns(last_seen_at: 13.months.ago)
    get shop_account_path
    assert_redirected_to shop_login_path
    assert_equal 0, ShopSession.count
  end

  test "?back= only ever goes to a page on this site" do
    get shop_login_path(back: "//evil.example")
    sign_up
    assert_redirected_to shop_account_path
  end
end
