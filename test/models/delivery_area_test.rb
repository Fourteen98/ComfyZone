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
    assert DeliveryArea.new(country: "Ghana", region: "Volta", name: "Osu").valid?
    assert_not DeliveryArea.new(country: "Ghana", region: "Greater Accra", name: "OSU").valid?
    assert_raises(ActiveRecord::RecordNotUnique) { DeliveryArea.new(country: "Ghana", region: "Greater Accra", name: "OSU").save!(validate: false) }
  end

  test "a place needs one of Ghana's regions" do
    assert_not DeliveryArea.new(name: "Somewhere").valid?
    assert_not DeliveryArea.new(country: "Ghana", name: "Somewhere").valid?
    assert_not DeliveryArea.new(country: "Ghana", name: "Somewhere", region: "Lagos").valid?
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

  # ---- Countries ----------------------------------------------------------

  test "a place abroad has a country and no region" do
    assert DeliveryArea.new(country: "China", name: "Yiwu").valid?
    assert_not DeliveryArea.new(country: "China", region: "Ashanti", name: "Yiwu").valid?
    assert_not DeliveryArea.new(country: "Narnia", name: "Yiwu").valid?
  end

  test "locate finds and adds places abroad, and ignores a region given for them" do
    assert_equal delivery_areas(:guangzhou), DeliveryArea.locate(country: "China", name: "guangzhou")
    assert_difference "DeliveryArea.count", 1 do
      assert_equal [ "Türkiye", nil ], DeliveryArea.locate(country: "Türkiye", name: "Istanbul").values_at(:country, :region)
    end
    assert_nil DeliveryArea.locate(country: "China", region: "Ashanti", name: "Yiwu")
  end

  test "the database won't hold the same place abroad twice, even with no region" do
    assert_raises(ActiveRecord::RecordNotUnique) { DeliveryArea.new(country: "China", name: "GUANGZHOU").save!(validate: false) }
  end

  test "someone can be located at home, abroad, or not at all" do
    supplier = suppliers(:kumasi)

    supplier.locate(country: "China", region: "Ashanti", place: "Guangzhou")
    assert_equal [ "China", nil, delivery_areas(:guangzhou), "Guangzhou, China", true ],
      [ supplier.country, supplier.region, supplier.delivery_area, supplier.where_text, supplier.abroad? ]

    supplier.relocate(country: "Ghana", region: "Ashanti", place: "")
    assert_equal [ "Ghana", "Ashanti", nil, "Ashanti", false ], [ supplier.country, supplier.region, supplier.delivery_area, supplier.where_text, supplier.abroad? ]

    # Ghana with no region says nothing: an edit form sending that clears it.
    supplier.relocate(country: "Ghana", region: "", place: "")
    assert_equal [ nil, nil, nil ], [ supplier.country, supplier.region, supplier.where_text ]
    assert supplier.valid?
  end

  test "a region can't be kept on someone abroad" do
    customer = customers(:kofi)
    customer.assign_attributes(country: "China", region: "Ashanti")

    assert_not customer.valid?
  end
end
