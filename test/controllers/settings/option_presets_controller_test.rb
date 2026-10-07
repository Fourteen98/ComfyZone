require "test_helper"

class Settings::OptionPresetsControllerTest < ActionDispatch::IntegrationTest
  test "someone without settings.manage is turned away" do
    sign_in_as(users(:two))

    get settings_option_presets_path
    assert_redirected_to admin_root_path

    assert_no_difference "OptionPreset.count" do
      delete settings_option_preset_path(option_presets(:letters))
    end
  end

  test "lists presets in order with their values" do
    sign_in_as(users(:one))

    get settings_option_presets_path

    assert_inertia_component "Settings/OptionPresets/Index"
    presets = inertia.props[:presets]
    assert_equal [ "Letter sizes", "Colours" ], presets.map { |p| p[:name] }
    assert_equal "#1a1a1a", presets.last[:values].first[:swatch]
  end

  test "creates a preset, keeping the order of its values" do
    sign_in_as(users(:one))

    assert_difference "OptionPreset.count", 1 do
      post settings_option_presets_path, params: { option_preset: { name: "Lengths", option_name: "Length",
        values: [ { label: "Mini" }, { label: "Midi" }, { label: "Maxi" } ] } }
    end

    assert_redirected_to settings_option_presets_path
    assert_equal %w[ Mini Midi Maxi ], OptionPreset.find_by!(name: "Lengths").labels
  end

  test "reorders and edits values" do
    sign_in_as(users(:one))
    preset = option_presets(:letters)

    patch settings_option_preset_path(preset), params: { option_preset: { name: "Letter sizes", option_name: "Size",
      values: [ { label: "L" }, { label: "S" }, { label: "XL" } ] } }

    assert_equal %w[ L S XL ], preset.reload.labels
  end

  test "errors come back to the form" do
    sign_in_as(users(:one))

    post settings_option_presets_path, params: { option_preset: { name: "", option_name: "Size",
      values: [ { label: "M" }, { label: "M" } ] } }

    assert_redirected_to new_settings_option_preset_path
    follow_redirect!
    assert inertia.props[:errors][:name].present?
    assert inertia.props[:errors][:values].present?
  end

  test "deletes a preset" do
    sign_in_as(users(:one))

    assert_difference "OptionPreset.count", -1 do
      delete settings_option_preset_path(option_presets(:letters))
    end
  end

  test "settings opens on Options for people who can manage settings" do
    sign_in_as(users(:one))

    get settings_path

    assert_redirected_to settings_option_presets_path
  end
end
