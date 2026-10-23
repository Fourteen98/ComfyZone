require "test_helper"

# Shoppers' passkeys: added in My account, then log in with a tap. They are
# a shopper's only: never the back office.
class Shop::PasskeysTest < ActionDispatch::IntegrationTest
  def sign_up
    post shop_signup_path, params: { account: { name: "Esi Mensah", phone: "055 111 2222", password: "comfy-zone-1" } }
  end

  def add_passkey(name: "Esi's phone")
    post shop_passkey_challenge_path, as: :json
    credential = fake_device.create(challenge: response.parsed_body["challenge"], user_verified: true)
    post shop_passkeys_path, params: { credential: credential, name: name }, as: :json
  end

  def passkey_login(device: fake_device)
    post shop_passkey_login_challenge_path, as: :json
    assertion = device.get(challenge: response.parsed_body["challenge"], user_verified: true)
    post shop_passkey_login_path, params: { credential: assertion }, as: :json
  end

  test "add one in My account, log out, log back in with a tap" do
    sign_up
    add_passkey
    assert_response :created
    assert_equal [ "Esi's phone" ], ShopAccount.last.passkeys.pluck(:name)

    delete shop_logout_path
    passkey_login
    assert_equal "/account", response.parsed_body["redirect_to"]
    get shop_account_path
    assert_inertia_component "Shop/Account/Show"
    assert_equal 1, inertia.props[:passkeys].size
  end

  test "adding one needs a shop login" do
    post shop_passkey_challenge_path, as: :json
    assert_redirected_to shop_login_path
  end

  test "a staff passkey can't log into a shop account" do
    sign_in_as(users(:two))
    register_passkey(name: "Staff phone")
    delete session_path

    passkey_login
    assert_response :unprocessable_entity
    assert_match "isn't set up for a shop account", response.parsed_body["error"]
  end

  test "a shop passkey can't open the back office" do
    sign_up
    add_passkey
    delete shop_logout_path

    login_with_passkey # the staff login, with the shopper's phone
    assert_response :unprocessable_entity
    get admin_root_path
    assert_redirected_to new_session_path
  end

  test "remove one" do
    sign_up
    add_passkey
    delete shop_passkey_path(ShopPasskey.last)
    assert_equal 0, ShopPasskey.count
  end
end
