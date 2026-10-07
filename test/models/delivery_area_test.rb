require "test_helper"

class DeliveryAreaTest < ActiveSupport::TestCase
  test "locate finds a place however it is typed" do
    assert_no_difference "DeliveryArea.count" do
      assert_equal delivery_areas(:osu), DeliveryArea.locate(region: "Greater Accra", name: "  osu ")
    end
  end

  test "locate adds a place that isn't there yet, free until a fee is set" do
    area = nil
    assert_difference "DeliveryArea.count", 1 do
      area = DeliveryArea.locate(region: "Ashanti", name: "bantama  road")
    end

    assert_equal [ "Ashanti", "bantama road", 0, true ], area.values_at(:region, :name, :fee_pesewas, :active)
  end

  test "locate needs both parts, and a real region" do
    assert_no_difference "DeliveryArea.count" do
      assert_nil DeliveryArea.locate(region: "Ashanti", name: " ")
      assert_nil DeliveryArea.locate(region: "", name: "Adum")
      assert_nil DeliveryArea.locate(region: "Atlantis", name: "Adum")
    end
  end

  test "the same name can exist in two regions, but not twice in one" do
    assert DeliveryArea.new(region: "Volta", name: "Osu").valid?
    assert_not DeliveryArea.new(region: "Greater Accra", name: "OSU").valid?
    assert_raises(ActiveRecord::RecordNotUnique) { DeliveryArea.new(region: "Greater Accra", name: "OSU").save!(validate: false) }
  end

  test "a place needs one of Ghana's regions" do
    assert_not DeliveryArea.new(name: "Somewhere").valid?
    assert_not DeliveryArea.new(name: "Somewhere", region: "Lagos").valid?
    assert_equal 16, Region::ALL.size
  end

  test "a customer's region follows their place, and can be set alone" do
    customer = customers(:kofi)

    customer.update!(region: "Volta", delivery_area: delivery_areas(:adum))
    assert_equal "Ashanti", customer.region

    customer.update!(delivery_area: nil, region: "Volta")
    assert_equal [ "Volta", nil ], customer.values_at(:region, :delivery_area)
    assert_not customer.update(region: "Atlantis")
  end
end
