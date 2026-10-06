require "test_helper"

class UserTest < ActiveSupport::TestCase
  test "downcases and strips email_address" do
    user = User.new(email_address: " DOWNCASED@EXAMPLE.COM ")
    assert_equal("downcased@example.com", user.email_address)
  end

  test "needs a name, a role, a valid unique email and a password of 8+ characters" do
    user = User.new(name: " ", email_address: "ONE@example.com", password: "short")

    assert_not user.valid?
    assert user.errors[:name].any?
    assert user.errors[:role].any?
    assert user.errors[:email_address].any?, "email is already taken by fixture one"
    assert user.errors[:password].any?
  end

  test "asks its role what it can do" do
    assert users(:one).can?("roles.manage")
    assert users(:two).can?("orders.create")
    assert_not users(:two).can?("roles.manage")
  end

  test "the only Owner can't be given another role" do
    owner = users(:one)

    assert_not owner.update(role: roles(:assistant))
    assert owner.errors[:role_id].any?
  end

  test "the only Owner can't be switched off" do
    owner = users(:one)

    assert_not owner.update(active: false)
    assert owner.errors[:active].any?
  end

  test "an Owner can step down once there is another Owner" do
    users(:two).update!(role: roles(:owner))

    assert users(:one).update(role: roles(:assistant))
  end
end
