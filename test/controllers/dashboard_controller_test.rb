require "test_helper"

class DashboardControllerTest < ActionDispatch::IntegrationTest
  test "sends visitors who are not logged in to the login page" do
    get admin_root_path

    assert_redirected_to new_session_path
  end

  test "renders the Dashboard React page for a logged-in user" do
    user = users(:one)
    sign_in_as(user)

    get admin_root_path

    assert_response :success
    # Which React component did the controller ask for?
    assert_inertia_component "Dashboard"
    # Shared props from InertiaController reach the page...
    assert_equal({ id: user.id, name: user.name, email_address: user.email_address, role: "Owner" }.stringify_keys,
      inertia.props[:auth][:user].to_h.stringify_keys)
    # An Owner holds every permission.
    assert_equal Permission::KEYS, inertia.props[:auth][:permissions]
    # Someone who has never customised gets the standard layout.
    assert_equal %w[ sales_today orders_to_pack low_stock money_owed ], inertia.props[:tiles].pluck(:key)
    assert_equal %w[ recent_orders low_stock ], inertia.props[:panels].pluck(:key)
    # ...and the password hash never does.
    assert_not_includes response.body, user.password_digest
  end

  test "a helper only receives the permissions their role holds" do
    sign_in_as(users(:two))

    get admin_root_path

    assert_equal roles(:assistant).permissions, inertia.props[:auth][:permissions]
  end

  # ---- Customising -------------------------------------------------------

  test "the customise page offers what this person may see, chosen ones first" do
    sign_in_as(users(:two)) # products.view, orders.view, orders.create

    get edit_dashboard_path

    assert_inertia_component "Dashboard/Edit"
    keys = inertia.props[:tiles].pluck(:key)
    assert_equal %w[ sales_today orders_to_pack money_owed ], keys.first(3)
    assert_not_includes keys, "low_stock"    # needs stock.view
    assert_not_includes keys, "profit_today" # needs costs.view
    assert_equal [ true, true, true, false ], inertia.props[:tiles].first(4).pluck(:on)
    assert_not inertia.props[:customised]
  end

  test "saves a layout, in the order chosen, and the dashboard follows it" do
    sign_in_as(users(:one))

    patch dashboard_path, params: { dashboard: { tiles: %w[ stock_value sales_week ], panels: %w[ channels week_sales ] } }
    assert_redirected_to admin_root_path

    get admin_root_path
    assert_equal %w[ stock_value sales_week ], inertia.props[:tiles].pluck(:key)
    assert_equal %w[ channels week_sales ], inertia.props[:panels].pluck(:key)
    assert_equal 7, dashboard_panel(:week_sales).size
  end

  test "keys that don't exist or aren't allowed are dropped" do
    sign_in_as(users(:two))

    patch dashboard_path, params: { dashboard: { tiles: %w[ profit_today nonsense sales_today sales_today ], panels: %w[ low_stock ] } }

    assert_equal({ "tiles" => %w[ sales_today ], "panels" => [] }, users(:two).reload.dashboard_layout)
  end

  test "a tile someone has since lost the right to see quietly disappears" do
    users(:two).update!(dashboard_layout: { "tiles" => %w[ sales_today low_stock ], "panels" => [] })
    sign_in_as(users(:two))

    get admin_root_path

    assert_equal %w[ sales_today ], inertia.props[:tiles].pluck(:key)
  end

  test "an empty dashboard is allowed, and reset brings the standard one back" do
    sign_in_as(users(:one))

    patch dashboard_path, params: { dashboard: { tiles: [], panels: [] } }
    get admin_root_path
    assert_empty inertia.props[:tiles]

    patch dashboard_path, params: { reset: true }
    assert_nil users(:one).reload.dashboard_layout
    get admin_root_path
    assert_equal 4, inertia.props[:tiles].size
  end

  test "at most eight tiles" do
    sign_in_as(users(:one))

    patch dashboard_path, params: { dashboard: { tiles: Dashboard::TILES.map(&:key), panels: [] } }

    assert_equal 8, users(:one).reload.dashboard_layout["tiles"].size
  end

  test "a reports link is left off a tile for someone who can't open reports" do
    users(:two).update!(dashboard_layout: { "tiles" => %w[ sales_week ], "panels" => [] })
    sign_in_as(users(:two))

    get admin_root_path

    assert_nil inertia.props[:tiles].first[:href]
  end
end
