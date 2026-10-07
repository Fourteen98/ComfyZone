require "test_helper"

# Pick-up or delivery chosen while recording a sale, and delivery areas.
class Orders::DeliveryAtSaleTest < ActionDispatch::IntegrationTest
  setup do
    @black = variants(:dress_m_black) # GH₵ 120
    StockLedger.record!(variant: @black, quantity: 5, reason: "purchase", total_cost_pesewas: 30_000)
    sign_in_as(users(:one))
  end

  def sale(buyer: { name: "Mrs Mensah", phone: "020 111 2222" }, delivery: nil, live: nil)
    post orders_path, params: { order: { buyer: buyer, delivery: delivery, live_session_id: live&.id,
                                         items: [ { variant_id: @black.id, quantity: 1 } ] } }
    Order.newest_first.first
  end

  test "a sale sent to an area takes the area's usual fee" do
    order = sale(delivery: { delivery_method: "delivery", area_id: delivery_areas(:osu).id, fee: "", address: "Behind the mall" })

    assert_equal [ "delivery", delivery_areas(:osu), 2_000, "Behind the mall" ],
      order.values_at(:delivery_method, :delivery_area, :delivery_fee_pesewas, :delivery_address)
    assert_equal 14_000, order.due_pesewas
  end

  test "a fee typed for this order beats the area's usual fee" do
    order = sale(delivery: { delivery_method: "delivery", area_id: delivery_areas(:osu).id, fee: "35", address: "" })

    assert_equal 3_500, order.delivery_fee_pesewas
  end

  test "a pick-up has no fee and no area, whatever else was sent" do
    order = sale(delivery: { delivery_method: "pickup", area_id: delivery_areas(:osu).id, fee: "35", address: "x" })

    assert_equal [ "pickup", nil, 0, nil ], order.values_at(:delivery_method, :delivery_area, :delivery_fee_pesewas, :delivery_address)
  end

  test "delivery can be left undecided" do
    assert_nil sale.delivery_method
    assert_nil sale(buyer: { name: "Another" }, delivery: { delivery_method: "", area_id: "", fee: "", address: "" }).delivery_method
  end

  test "the first delivery teaches us where the customer is, and never overwrites" do
    order = sale(delivery: { delivery_method: "delivery", area_id: delivery_areas(:osu).id, fee: "", address: "Behind the mall" })
    customer = order.customer
    assert_equal [ delivery_areas(:osu), "Behind the mall" ], customer.reload.values_at(:delivery_area, :location)

    sale(buyer: { id: customer.id }, delivery: { delivery_method: "delivery", area_id: delivery_areas(:tema).id, fee: "", address: "Her sister's" })
    assert_equal [ delivery_areas(:osu), "Behind the mall" ], customer.reload.values_at(:delivery_area, :location)
  end

  test "a bad fee refuses the whole sale: no order, no stock taken" do
    assert_no_difference [ "Order.count", "StockMovement.count", "Customer.count" ] do
      sale(delivery: { delivery_method: "delivery", area_id: "", fee: "plenty", address: "" })
    end
    assert_equal 5, @black.reload.stock_on_hand
  end

  test "a hidden area is ignored" do
    order = sale(delivery: { delivery_method: "delivery", area_id: delivery_areas(:closed).id, fee: "", address: "" })

    assert_equal [ nil, 0 ], order.values_at(:delivery_area, :delivery_fee_pesewas)
  end

  test "a claim during a live ignores delivery: that is sorted out afterwards" do
    live = LiveSession.create!(user: users(:one))

    order = sale(buyer: "@ama_k", live: live, delivery: { delivery_method: "delivery", area_id: delivery_areas(:osu).id, fee: "", address: "" })

    assert_nil order.delivery_method
  end

  test "the order page can set the area later" do
    order = sale

    patch order_delivery_path(order), params: { delivery: { delivery_method: "delivery", area_id: delivery_areas(:tema).id, fee: "", address: "C5" } }
    get order_path(order)

    assert_equal [ delivery_areas(:tema).id, "Tema", 4_500 ], inertia.props[:order][:delivery].values_at(:area_id, :area, :fee_pesewas)
    assert_equal %w[ Osu Tema ], inertia.props[:delivery_areas].pluck(:name)
  end

  test "the sale screen gets the areas, and buyers with where they are" do
    customers(:ama).update!(delivery_area: delivery_areas(:osu))

    get new_order_path

    assert_equal [ [ "Osu", "20", 2_000 ], [ "Tema", "45", 4_500 ] ], inertia.props[:delivery_areas].map { |a| a.values_at(:name, :fee, :fee_pesewas) }
    ama = inertia.props[:buyers].find { |buyer| buyer[:id] == customers(:ama).id }
    assert_equal [ "East Legon", delivery_areas(:osu).id ], ama.values_at(:location, :delivery_area_id)
  end

  # ---- Settings > Delivery areas ----------------------------------------

  test "adds, edits, reorders and deletes an area" do
    post settings_delivery_areas_path, params: { delivery_area: { name: "Madina", fee: "30" } }
    area = DeliveryArea.find_by!(name: "Madina")
    assert_equal 3_000, area.fee_pesewas

    patch settings_delivery_area_path(area), params: { delivery_area: { name: "Madina", fee: "", active: false } }
    assert_equal [ 0, false ], area.reload.values_at(:fee_pesewas, :active)

    patch move_settings_delivery_area_path(area), params: { direction: "up" }
    assert_equal "Kumasi", DeliveryArea.ordered.last.name

    order = sale(delivery: { delivery_method: "delivery", area_id: delivery_areas(:osu).id, fee: "", address: "" })
    delete settings_delivery_area_path(delivery_areas(:osu))
    assert_equal [ nil, 2_000 ], order.reload.values_at(:delivery_area_id, :delivery_fee_pesewas), "the order keeps the fee it was charged"
  end

  test "an area needs a unique name and a readable fee; settings need permission" do
    post settings_delivery_areas_path, params: { delivery_area: { name: "osu", fee: "abc" } }
    follow_redirect!
    assert_equal %w[ fee name ], inertia.props[:errors].keys.map(&:to_s).sort

    delete session_path
    sign_in_as(users(:two))
    get settings_delivery_areas_path
    assert_redirected_to root_path
  end

  test "a customer can be given an area by hand" do
    patch customer_path(customers(:kofi)), params: { customer: { handle: "kofi.b", name: "", phone: "", location: "Community 5", note: "", delivery_area_id: delivery_areas(:tema).id } }

    assert_equal delivery_areas(:tema), customers(:kofi).reload.delivery_area
    get customers_path
    assert_equal "Tema, Community 5", inertia.props[:customers].find { |c| c[:id] == customers(:kofi).id }[:location]
  end
end
