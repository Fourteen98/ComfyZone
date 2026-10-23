require "test_helper"

class Settings::ClaimsControllerTest < ActionDispatch::IntegrationTest
  test "shows and saves the times; empty means no deadline" do
    sign_in_as(users(:one))
    get settings_claims_path
    assert_equal({ "live_pay_hours" => "24", "sale_pay_hours" => "", "remind_hours" => "3" }, inertia.props[:setting].stringify_keys)

    patch settings_claims_path, params: { claims: { live_pay_hours: "", sale_pay_hours: "48", remind_hours: "6" } }
    assert_match "Saved.", flash[:notice]
    assert_equal [ nil, 48, 6 ], ClaimSetting.current.values_at(:live_pay_hours, :sale_pay_hours, :remind_hours)

    patch settings_claims_path, params: { claims: { live_pay_hours: "9999", sale_pay_hours: "", remind_hours: "3" } }
    follow_redirect!
    assert_match "between 1 hour and 30 days", inertia.props[:errors][:live_pay_hours].first
  end

  test "needs settings.manage" do
    sign_in_as(users(:two))
    patch settings_claims_path, params: { claims: { live_pay_hours: "1" } }
    assert_equal 24, ClaimSetting.current.live_pay_hours
  end
end
