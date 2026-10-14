require "test_helper"

class Shop::PagesControllerTest < ActionDispatch::IntegrationTest
  test "the privacy policy is public" do
    get shop_privacy_path
    assert_response :success
    assert_inertia_component "Shop/Privacy"
    assert_equal "hello@comfyzone.shop", inertia.props[:contact_email]
  end

  test "the data deletion instructions are public" do
    get shop_data_deletion_path
    assert_response :success
    assert_inertia_component "Shop/DataDeletion"
  end
end
