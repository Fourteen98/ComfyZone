require "test_helper"

class Settings::RolesControllerTest < ActionDispatch::IntegrationTest
  test "someone without roles.manage is turned away" do
    sign_in_as(users(:two))

    get settings_roles_path

    assert_redirected_to root_path
  end

  test "an Owner sees every role with its head count" do
    sign_in_as(users(:one))

    get settings_roles_path

    assert_inertia_component "Settings/Roles/Index"
    owner_row = inertia.props[:roles].find { |r| r[:name] == "Owner" }
    assert_equal 1, owner_row[:users_count]
    assert_equal Permission::KEYS.size, owner_row[:permissions_count]
  end

  test "the form receives the full permission list from the code" do
    sign_in_as(users(:one))

    get new_settings_role_path

    assert_inertia_component "Settings/Roles/Form"
    keys = inertia.props[:permission_groups].flat_map { |g| g[:permissions].map { |p| p[:key] } }
    assert_equal Permission::KEYS, keys
  end

  test "an Owner creates a role" do
    sign_in_as(users(:one))

    assert_difference "Role.count", 1 do
      post settings_roles_path, params: { role: { name: "Stock keeper", description: "Counts stock",
        permissions: [ "stock.view", "stock.adjust" ] } }
    end

    assert_redirected_to settings_roles_path
    assert_equal [ "stock.view", "stock.adjust" ], Role.find_by!(name: "Stock keeper").permissions
  end

  test "an Owner changes what a role can do, and it takes effect at once" do
    sign_in_as(users(:one))
    assert_not users(:two).can?("costs.view")

    patch settings_role_path(roles(:assistant)), params: { role: { name: "Sales assistant",
      permissions: [ "orders.create", "costs.view" ] } }

    assert_redirected_to settings_roles_path
    assert users(:two).reload.can?("costs.view")
  end

  test "all permissions can be cleared" do
    sign_in_as(users(:one))

    patch settings_role_path(roles(:assistant)), params: { role: { name: "Sales assistant", permissions: [ "" ] } }

    assert_empty roles(:assistant).reload.permissions
  end

  test "the built-in Owner role can't be edited or deleted" do
    sign_in_as(users(:one))

    patch settings_role_path(roles(:owner)), params: { role: { name: "Hacked", permissions: [] } }
    assert_redirected_to settings_roles_path
    assert_equal "Owner", roles(:owner).reload.name

    assert_no_difference "Role.count" do
      delete settings_role_path(roles(:owner))
    end
  end

  test "a role in use can't be deleted, an unused one can" do
    sign_in_as(users(:one))

    assert_no_difference "Role.count" do
      delete settings_role_path(roles(:assistant))
    end
    assert_redirected_to edit_settings_role_path(roles(:assistant))

    assert_difference "Role.count", -1 do
      delete settings_role_path(roles(:unused))
    end
  end
end
