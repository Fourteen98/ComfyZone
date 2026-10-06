require "test_helper"

class OptionPresetTest < ActiveSupport::TestCase
  test "keeps values in the order given, not alphabetical" do
    preset = OptionPreset.create!(name: "Tops", option_name: "Size",
      values: [ { label: "S" }, { label: "M" }, { label: "L" }, { label: "2XL" } ])

    assert_equal %w[ S M L 2XL ], preset.reload.labels
  end

  test "cleans up what it is given" do
    preset = OptionPreset.create!(name: "  Shades ", option_name: "Colour",
      values: [ { label: "  Deep   red ", swatch: "#C0262D" }, { label: "" }, { "label" => "Plain", "swatch" => "" } ])

    assert_equal "Shades", preset.name
    assert_equal [ { "label" => "Deep red", "swatch" => "#c0262d" }, { "label" => "Plain" } ], preset.values
    assert preset.swatches?
  end

  test "needs at least one choice" do
    preset = OptionPreset.new(name: "Empty", option_name: "Size", values: [ { label: " " } ])

    assert_not preset.valid?
    assert_includes preset.errors[:values].first, "at least one"
  end

  test "rejects the same choice twice, ignoring capitals" do
    preset = OptionPreset.new(name: "Dupes", option_name: "Size", values: [ { label: "M" }, { label: "m" } ])

    assert_not preset.valid?
  end

  test "rejects a colour that isn't a hex code" do
    preset = OptionPreset.new(name: "Bad", option_name: "Colour", values: [ { label: "Red", swatch: "red" } ])

    assert_not preset.valid?
    assert_includes preset.errors[:values].first, "Red"
  end

  test "names are unique regardless of capitals" do
    assert_not OptionPreset.new(name: "letter SIZES", option_name: "Size", values: [ { label: "S" } ]).valid?
  end

  test "a new preset goes to the end of the list" do
    preset = OptionPreset.create!(name: "Newest", option_name: "Size", values: [ { label: "S" } ])

    assert_equal "Newest", OptionPreset.ordered.last.name
    assert_operator preset.position, :>, option_presets(:colours).position
  end
end
