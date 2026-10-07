require "test_helper"

class Settings::SalesChannelsControllerTest < ActionDispatch::IntegrationTest
  test "lists channels in order with how many orders each has" do
    sign_in_as(users(:one))

    get settings_sales_channels_path

    assert_inertia_component "Settings/SalesChannels/Index"
    assert_equal [ "TikTok", "WhatsApp", "Instagram", "Market stall" ], inertia.props[:channels].pluck(:name)
    assert_equal [ "social", 0 ], inertia.props[:channels].first.values_at(:kind, :orders_count)
  end

  test "adds, edits, moves and deletes a channel" do
    sign_in_as(users(:one))

    post settings_sales_channels_path, params: { sales_channel: { name: "Jumia", kind: "direct" } }
    channel = SalesChannel.find_by!(name: "Jumia")
    assert_redirected_to settings_sales_channels_path

    patch settings_sales_channel_path(channel), params: { sales_channel: { name: "Jumia store", active: false } }
    assert_equal [ "Jumia store", false ], channel.reload.values_at(:name, :active)

    patch move_settings_sales_channel_path(channel), params: { direction: "up" }
    assert_equal "Market stall", SalesChannel.ordered.last.name

    delete settings_sales_channel_path(channel)
    assert_not SalesChannel.exists?(channel.id)
  end

  test "a channel with no name or kind comes back with errors" do
    sign_in_as(users(:one))

    post settings_sales_channels_path, params: { sales_channel: { name: "", kind: "" } }

    follow_redirect!
    assert inertia.props[:errors][:name].any?
    assert inertia.props[:errors][:kind].any?
  end

  test "needs settings.manage" do
    sign_in_as(users(:two))

    get settings_sales_channels_path
    assert_redirected_to admin_root_path
    post settings_sales_channels_path, params: { sales_channel: { name: "Jumia", kind: "direct" } }
    assert_not SalesChannel.exists?(name: "Jumia")
  end
end
