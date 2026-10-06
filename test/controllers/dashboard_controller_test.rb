require "test_helper"

class DashboardControllerTest < ActionDispatch::IntegrationTest
  test "sends visitors who are not logged in to the login page" do
    get root_path

    assert_redirected_to new_session_path
  end

  test "renders the Dashboard React page for a logged-in user" do
    user = users(:one)
    sign_in_as(user)

    get root_path

    assert_response :success
    # Which React component did the controller ask for?
    assert_inertia_component "Dashboard"
    # Shared props from InertiaController reach the page...
    assert_equal({ id: user.id, name: user.name, email_address: user.email_address, role: "Owner" }.stringify_keys,
      inertia.props[:auth][:user].to_h.stringify_keys)
    # An Owner holds every permission.
    assert_equal Permission::KEYS, inertia.props[:auth][:permissions]
    # The stats contract React relies on: all four keys are always present.
    assert_equal %w[ sales_today orders_to_pack low_stock money_owed ], inertia.props[:stats].keys.map(&:to_s)
    # ...and the password hash never does.
    assert_not_includes response.body, user.password_digest
  end

  test "a helper only receives the permissions their role holds" do
    sign_in_as(users(:two))

    get root_path

    assert_equal roles(:assistant).permissions, inertia.props[:auth][:permissions]
  end
end
