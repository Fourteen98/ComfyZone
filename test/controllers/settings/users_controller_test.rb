require "test_helper"

class Settings::UsersControllerTest < ActionDispatch::IntegrationTest
  test "someone without users.manage is turned away" do
    sign_in_as(users(:two))

    get settings_users_path

    assert_redirected_to root_path
    assert_equal "You don't have access to that. Ask an Owner if you need it.", flash[:alert]
  end

  test "they can't get round it by posting directly either" do
    sign_in_as(users(:two))

    assert_no_difference "User.count" do
      post settings_users_path, params: { user: { name: "Sneaky", email_address: "s@example.com",
        role_id: roles(:owner).id, password: "password123" } }
    end
    assert_redirected_to root_path
  end

  test "an Owner sees the team" do
    sign_in_as(users(:one))

    get settings_users_path

    assert_inertia_component "Settings/Users/Index"
    assert_equal [ "Ama Helper", "Fazy Owner" ], inertia.props[:users].map { |u| u[:name] }
  end

  test "an Owner adds a person" do
    sign_in_as(users(:one))

    assert_difference "User.count", 1 do
      post settings_users_path, params: { user: { name: "Kofi Packer", email_address: "kofi@example.com",
        role_id: roles(:assistant).id, password: "password123" } }
    end

    assert_redirected_to settings_users_path
    assert_equal roles(:assistant), User.find_by!(email_address: "kofi@example.com").role
  end

  test "validation errors come back to the form" do
    sign_in_as(users(:one))

    post settings_users_path, params: { user: { name: "", email_address: "nope", role_id: "", password: "short" } }

    assert_redirected_to new_settings_user_path
    follow_redirect!
    errors = inertia.props[:errors]
    assert errors[:name].present?
    assert errors[:email_address].present?
    assert errors[:password].present?
  end

  test "editing with an empty password keeps the old one" do
    sign_in_as(users(:one))
    helper = users(:two)

    patch settings_user_path(helper), params: { user: { name: "Ama H.", email_address: helper.email_address,
      role_id: helper.role_id, password: "", active: true } }

    assert_redirected_to settings_users_path
    assert_equal "Ama H.", helper.reload.name
    assert helper.authenticate("password")
  end

  test "switching someone off logs them out and blocks their login" do
    sign_in_as(users(:one))
    helper = users(:two)
    helper.sessions.create!

    patch settings_user_path(helper), params: { user: { name: helper.name, email_address: helper.email_address,
      role_id: helper.role_id, password: "", active: false } }

    assert_not helper.reload.active?
    assert_empty helper.sessions

    sign_out
    post session_path, params: { email_address: helper.email_address, password: "password" }
    assert_redirected_to new_session_path
    assert_nil cookies[:session_id].presence
  end

  test "the only Owner can't demote themselves" do
    sign_in_as(users(:one))
    owner = users(:one)

    patch settings_user_path(owner), params: { user: { name: owner.name, email_address: owner.email_address,
      role_id: roles(:assistant).id, password: "", active: true } }

    assert_redirected_to edit_settings_user_path(owner)
    assert owner.reload.owner?
  end
end
