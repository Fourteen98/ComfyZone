require "test_helper"

# Where the buyer is (region + place), and pick-up or delivery, chosen
# while recording a sale.
class Orders::DeliveryAtSaleTest < ActionDispatch::IntegrationTest
  setup do
    @black = variants(:dress_m_black) # GH₵ 120
    StockLedger.record!(variant: @black, quantity: 5, reason: "purchase", total_cost_pesewas: 30_000)
    sign_in_as(users(:one))
  end

  OSU = { region: "Greater Accra", place: "Osu" }.freeze

  def sale(buyer: { name: "Mrs Mensah", phone: "020 111 2222" }, location: nil, delivery: nil, live: nil)
    post orders_path, params: { order: { buyer: buyer, location: location, delivery: delivery, live_session_id: live&.id,
                                         items: [ { variant_id: @black.id, quantity: 1 } ] } }
    Order.newest_first.first
  end

  test "the buyer's region and place are saved, whether or not it is delivered" do
    order = sale(location: OSU)

    assert_equal [ "Greater Accra", delivery_areas(:osu) ], order.customer.values_at(:region, :delivery_area)
    assert_nil order.delivery_method
  end

  test "a place typed for the first time joins the list" do
    assert_difference "DeliveryArea.count", 1 do
      order = sale(location: { region: "Ashanti", place: "Bantama" })

      assert_equal [ "Ashanti", "Bantama" ], [ order.customer.region, order.customer.delivery_area.name ]
    end
    assert_no_difference "DeliveryArea.count" do
      sale(buyer: { name: "Someone else" }, location: { region: "Ashanti", place: "bantama" })
    end
  end

  test "a region can be known without the exact place" do
    order = sale(location: { region: "Volta", place: "" })

    assert_equal [ "Volta", nil ], order.customer.values_at(:region, :delivery_area)
  end

  test "a made-up region is ignored" do
    assert_nil sale(location: { region: "Atlantis", place: "Deep End" }).customer.region
  end

  test "a sale sent to a place takes the place's usual fee" do
    order = sale(location: OSU, delivery: { delivery_method: "delivery", fee: "", address: "Behind the mall" })

    assert_equal [ "delivery", delivery_areas(:osu), 2_000, "Behind the mall" ],
      order.values_at(:delivery_method, :delivery_area, :delivery_fee_pesewas, :delivery_address)
    assert_equal 14_000, order.due_pesewas
  end

  test "a fee typed for this order beats the place's usual fee" do
    assert_equal 3_500, sale(location: OSU, delivery: { delivery_method: "delivery", fee: "35", address: "" }).delivery_fee_pesewas
  end

  test "a pick-up has no fee, but we still learn where the buyer is" do
    order = sale(location: OSU, delivery: { delivery_method: "pickup", fee: "35", address: "x" })

    assert_equal [ "pickup", nil, 0, nil ], order.values_at(:delivery_method, :delivery_area, :delivery_fee_pesewas, :delivery_address)
    assert_equal delivery_areas(:osu), order.customer.delivery_area
  end

  test "choosing a new place for a known customer moves them" do
    customer = sale(location: OSU).customer

    sale(buyer: { id: customer.id }, location: { region: "Ashanti", place: "Adum" })

    assert_equal delivery_areas(:adum), customer.reload.delivery_area
  end

  test "a bad fee refuses the whole sale: no order, no stock taken" do
    assert_no_difference [ "Order.count", "StockMovement.count", "Customer.count" ] do
      sale(delivery: { delivery_method: "delivery", fee: "plenty", address: "" })
    end
    assert_equal 5, @black.reload.stock_on_hand
  end

  test "a claim during a live ignores delivery: that is sorted out afterwards" do
    live = LiveSession.create!(user: users(:one))

    assert_nil sale(buyer: "@ama_k", live: live, delivery: { delivery_method: "delivery", fee: "", address: "" }).delivery_method
  end

  test "the order page can set where it is going later" do
    order = sale

    patch order_delivery_path(order), params: { delivery: { delivery_method: "delivery", region: "Greater Accra", place: "Tema", fee: "", address: "C5" } }
    get order_path(order)

    assert_equal [ "Greater Accra", "Tema", 4_500 ], inertia.props[:order][:delivery].values_at(:region, :place, :fee_pesewas)
    assert_equal delivery_areas(:tema), order.customer.reload.delivery_area, "and the customer learns it too"
  end

  test "pages carry the regions, the known places, and where buyers are" do
    customers(:ama).update!(delivery_area: delivery_areas(:osu))

    get new_order_path

    assert_equal Region::ALL, inertia.props[:locations][:regions]
    assert_equal [ [ "Ghana", "Ashanti", "Adum", 7_000 ], [ "Ghana", "Greater Accra", "Osu", 2_000 ], [ "Ghana", "Greater Accra", "Tema", 4_500 ],
                   [ "China", nil, "Guangzhou", 0 ] ],
      inertia.props[:locations][:places].map { |place| place.values_at(:country, :region, :name, :fee_pesewas) }
    assert_equal [ "Ghana", "Ghana" ], [ inertia.props[:locations][:home], inertia.props[:locations][:countries].first ]
    ama = inertia.props[:buyers].find { |buyer| buyer[:id] == customers(:ama).id }
    assert_equal [ "Greater Accra", "Osu", "East Legon" ], ama.values_at(:region, :place, :location)
  end

  test "reports count sales by region and by place" do
    sale(location: OSU)
    sale(buyer: { name: "Kumasi buyer" }, location: { region: "Ashanti", place: "" })
    sale(buyer: { name: "Unknown" })

    get reports_path, params: { range: "today" }

    assert_equal [ "Ashanti", "Greater Accra", "Not recorded" ], inertia.props[:regions].pluck(:name).sort
    assert_equal [ [ "Osu", "Greater Accra", 1, 12_000 ] ], inertia.props[:places].map { |p| p.values_at(:name, :region, :orders, :sales_pesewas) }
  end

  # ---- Settings > Locations ---------------------------------------------

  test "adds, edits and deletes a place" do
    post settings_delivery_areas_path, params: { delivery_area: { name: "Madina", country: "Ghana", region: "Greater Accra", fee: "30" } }
    area = DeliveryArea.find_by!(name: "Madina")
    assert_equal 3_000, area.fee_pesewas

    patch settings_delivery_area_path(area), params: { delivery_area: { name: "Madina", country: "Ghana", region: "Greater Accra", fee: "", active: false } }
    assert_equal [ 0, false ], area.reload.values_at(:fee_pesewas, :active)

    order = sale(location: OSU, delivery: { delivery_method: "delivery", fee: "", address: "" })
    delete settings_delivery_area_path(delivery_areas(:osu))
    assert_equal [ nil, 2_000 ], order.reload.values_at(:delivery_area_id, :delivery_fee_pesewas), "the order keeps the fee it was charged"
    assert_equal "Greater Accra", order.customer.reload.region, "and the customer keeps the region"
  end

  test "a place needs a region, a name not already in it, and a readable fee" do
    post settings_delivery_areas_path, params: { delivery_area: { name: "osu", country: "Ghana", region: "Greater Accra", fee: "abc" } }
    follow_redirect!
    assert_equal %w[ fee name ], inertia.props[:errors].keys.map(&:to_s).sort

    post settings_delivery_areas_path, params: { delivery_area: { name: "Nowhere", country: "Ghana", region: "", fee: "" } }
    follow_redirect!
    assert inertia.props[:errors][:region].any?

    delete session_path
    sign_in_as(users(:two))
    get settings_delivery_areas_path
    assert_redirected_to admin_root_path
  end

  test "a customer's region and place can be set, changed and cleared by hand" do
    kofi = customers(:kofi)
    params = { handle: "kofi.b", name: "", phone: "", location: "Community 5", note: "" }

    patch customer_path(kofi), params: { customer: params.merge(region: "Greater Accra", place: "Tema") }
    assert_equal delivery_areas(:tema), kofi.reload.delivery_area
    get customers_path
    assert_equal "Tema, Greater Accra, Community 5", inertia.props[:customers].find { |c| c[:id] == kofi.id }[:location]

    patch customer_path(kofi), params: { customer: params.merge(region: "Ashanti", place: "") }
    assert_equal [ "Ashanti", nil ], kofi.reload.values_at(:region, :delivery_area)

    patch customer_path(kofi), params: { customer: params.merge(region: "", place: "") }
    assert_equal [ nil, nil ], kofi.reload.values_at(:region, :delivery_area)
  end

  # ---- Countries ----------------------------------------------------------

  test "a buyer abroad is saved with their country and city, and no region" do
    order = sale(location: { country: "United Kingdom", region: "", place: "London" })

    assert_equal [ "United Kingdom", nil, "London", "London, United Kingdom" ],
      [ order.customer.country, order.customer.region, order.customer.delivery_area.name, order.customer.where_text ]
  end

  test "Ghana with no region says nothing, so nothing is recorded" do
    assert_nil sale(location: { country: "Ghana", region: "", place: "" }).customer.country
  end

  test "an order can be sent abroad, with the fee typed" do
    order = sale

    patch order_delivery_path(order), params: { delivery: { delivery_method: "delivery", country: "United States", region: "", place: "Houston", fee: "450", address: "" } }
    get order_path(order)

    assert_equal [ "United States", nil, "Houston", 45_000 ], inertia.props[:order][:delivery].values_at(:country, :region, :place, :fee_pesewas)
  end

  test "reports list regions at home and countries abroad side by side" do
    sale(location: OSU)
    sale(buyer: { name: "London buyer" }, location: { country: "United Kingdom", region: "", place: "London" })

    get reports_path, params: { range: "today" }

    assert_equal [ "Greater Accra", "United Kingdom" ], inertia.props[:regions].pluck(:name).sort
    assert_equal [ [ "London", "United Kingdom" ], [ "Osu", "Greater Accra" ] ], inertia.props[:places].map { |p| p.values_at(:name, :region) }.sort
  end

  test "a customer's country can be set by hand, and Ghana alone clears it" do
    kofi = customers(:kofi)
    params = { handle: "kofi.b", name: "", phone: "", location: "", note: "" }

    patch customer_path(kofi), params: { customer: params.merge(country: "Nigeria", region: "", place: "Lagos") }
    assert_equal [ "Nigeria", "Lagos" ], [ kofi.reload.country, kofi.delivery_area.name ]
    get edit_customer_path(kofi)
    assert_equal [ "Nigeria", "", "Lagos" ], inertia.props[:customer].values_at(:country, :region, :place)

    patch customer_path(kofi), params: { customer: params.merge(country: "Ghana", region: "", place: "") }
    assert_equal [ nil, nil ], kofi.reload.values_at(:country, :delivery_area)
  end

  # ---- Suppliers ----------------------------------------------------------

  test "a supplier abroad: country, city and address" do
    post suppliers_path, params: { supplier: { name: "Guangzhou Fabrics", phone: "+86 20 1234 5678", note: "", location: "Zhongda market, stall 14",
                                               country: "China", region: "", place: "Guangzhou" } }

    supplier = Supplier.find_by!(name: "Guangzhou Fabrics")
    assert_equal [ "China", delivery_areas(:guangzhou), "Zhongda market, stall 14" ], supplier.values_at(:country, :delivery_area, :location)

    get supplier_path(supplier)
    assert_equal [ "Guangzhou, China, Zhongda market, stall 14", true ], inertia.props[:supplier].values_at(:where, :abroad)
    get suppliers_path
    assert_equal "Guangzhou, China", inertia.props[:suppliers].find { |s| s[:id] == supplier.id }[:where]
  end

  test "a supplier at home has a region and place, editable and clearable" do
    supplier = suppliers(:kumasi)
    base = { name: supplier.name, phone: "024 111 2222", note: "", location: "" }

    patch supplier_path(supplier), params: { supplier: base.merge(country: "Ghana", region: "Ashanti", place: "Kejetia") }
    assert_equal [ "Ghana", "Ashanti", "Kejetia" ], [ supplier.reload.country, supplier.region, supplier.delivery_area.name ]
    get edit_supplier_path(supplier)
    assert_equal [ "Ghana", "Ashanti", "Kejetia" ], inertia.props[:supplier].values_at(:country, :region, :place)
    assert inertia.props[:locations][:countries].include?("China")

    patch supplier_path(supplier), params: { supplier: base.merge(country: "Ghana", region: "", place: "") }
    assert_nil supplier.reload.country
  end

  test "sending no location at all leaves a supplier where they were" do
    supplier = suppliers(:kumasi)
    supplier.update!(country: "China")

    patch supplier_path(supplier), params: { supplier: { name: supplier.name, phone: "024 111 2222", note: "x" } }

    assert_equal "China", supplier.reload.country
  end

  # ---- During a live ------------------------------------------------------

  test "a claim during a live can note where the buyer is; delivery is chosen later" do
    live = LiveSession.create!(user: users(:one))

    order = sale(buyer: "@newbuyer", live: live, location: { country: "Ghana", region: "Ashanti", place: "Adum" },
                 delivery: { delivery_method: "delivery", fee: "", address: "" })

    assert_equal [ "Ghana", "Ashanti", delivery_areas(:adum) ], order.customer.values_at(:country, :region, :delivery_area)
    assert_nil order.delivery_method, "pick-up or delivery is still decided afterwards"

    get live_path(live)
    assert_equal Region::ALL, inertia.props[:locations][:regions]
    buyer = inertia.props[:buyers].find { |b| b[:handle] == "newbuyer" }
    assert_equal [ "Ashanti", "Adum" ], buyer.values_at(:region, :place)
  end

  test "a claim that says nothing about location leaves a known buyer where they were" do
    customers(:ama).update!(delivery_area: delivery_areas(:osu))
    live = LiveSession.create!(user: users(:one))

    sale(buyer: "@ama_k", live: live)
    sale(buyer: "@ama_k", live: live, location: { country: "Ghana", region: "", place: "" })

    assert_equal delivery_areas(:osu), customers(:ama).reload.delivery_area
  end
end
