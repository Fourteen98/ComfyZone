require "test_helper"

class RoleTest < ActiveSupport::TestCase
  test "can? is true only for permissions the role holds" do
    role = roles(:assistant)

    assert role.can?("orders.create")
    assert_not role.can?("costs.view")
  end

  test "the system role can do everything, including permissions added later" do
    assert roles(:owner).can?("costs.view")
    assert_equal Permission::KEYS, roles(:owner).effective_permissions
  end

  test "rejects permission keys that don't exist in the code" do
    role = Role.new(name: "Typo", permissions: [ "products.veiw" ])

    assert_not role.valid?
    assert_includes role.errors[:permissions].first, "products.veiw"
  end

  test "stores permissions without blanks or duplicates, in the standard order" do
    role = Role.create!(name: "Tidy", permissions: [ "orders.view", "", "products.view", "orders.view" ])

    assert_equal [ "products.view", "orders.view" ], role.permissions
  end

  test "names are unique regardless of capitals" do
    assert_not Role.new(name: "sales ASSISTANT").valid?
  end

  test "a role with people in it can't be deleted" do
    assert_no_difference "Role.count" do
      assert_not roles(:assistant).destroy
    end
  end

  test "the system role can't be deleted" do
    User.where(role: roles(:owner)).update_all(role_id: roles(:unused).id)

    assert_not roles(:owner).destroy
  end

  test "an unused role can be deleted" do
    assert_difference "Role.count", -1 do
      roles(:unused).destroy
    end
  end
end
