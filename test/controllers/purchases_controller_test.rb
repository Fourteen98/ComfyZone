require "test_helper"

class PurchasesControllerTest < ActionDispatch::IntegrationTest
  def params(**overrides)
    { purchase: { purchased_on: "2026-10-05", supplier_id: suppliers(:kumasi).id, reference: "INV-9",
      delivery_method: "delivery", transport_cost: "40", extra_costs: "10",
      items: [
        { variant_id: variants(:dress_m_black).id, quantity: 6, unit_cost: "60" },
        { variant_id: variants(:dress_m_red).id, quantity: 0, unit_cost: "60" }
      ] }.merge(overrides) }
  end

  # --- permissions: fixture user two has neither purchases permission ---

  test "needs purchases.view to look and purchases.manage to change" do
    sign_in_as(users(:two))
    get purchases_path
    assert_redirected_to admin_root_path

    roles(:assistant).update!(permissions: [ "purchases.view" ])
    get purchases_path
    assert_inertia_component "Purchases/Index"

    assert_no_difference "Purchase.count" do
      post purchases_path, params: params
    end
    patch receive_purchase_path(purchases(:on_the_way))
    assert purchases(:on_the_way).reload.ordered?
  end

  # --- listing and showing ---

  test "lists purchases with totals, and filters to those on the way" do
    sign_in_as(users(:one))

    get purchases_path
    row = inertia.props[:purchases].first
    assert_equal [ "Kumasi Fabrics", "ordered", 15, 110_000 ], row.values_at(:supplier, :status, :units, :total_pesewas)

    purchases(:on_the_way).receive!(by: users(:one))
    get purchases_path, params: { status: "ordered" }
    assert_empty inertia.props[:purchases]
  end

  test "shows a purchase with its lines" do
    sign_in_as(users(:one))

    get purchase_path(purchases(:on_the_way))

    assert_inertia_component "Purchases/Show"
    purchase = inertia.props[:purchase]
    assert_equal 2, purchase[:items].size
    assert_equal "Ankara wrap dress", purchase[:items].first[:product]
    assert_nil purchase[:items].first[:landed_unit_cost_pesewas], "not known until received"
  end

  test "the form gets products to pick from, with the last cost paid" do
    sign_in_as(users(:one))

    get new_purchase_path

    assert_inertia_component "Purchases/Form"
    dress = inertia.props[:products].find { |p| p[:name] == "Ankara wrap dress" }
    assert_equal 4, dress[:variants].size
    assert_equal "80", dress[:last_cost]
    assert_equal [ [ "Kumasi Fabrics", "+233240000000" ] ], inertia.props[:suppliers].map { |s| s.values_at(:name, :phone) }
    assert_nil inertia.props[:products].find { |p| p[:name] == "Old tote bag" }, "archived products aren't offered"
  end

  test "the form knows what each supplier sells, and which supplier she came from" do
    sign_in_as(users(:one))

    get new_purchase_path, params: { supplier_id: suppliers(:kumasi).id }

    assert_equal [ products(:dress).id ], inertia.props[:suppliers].first[:product_ids]
    assert_equal suppliers(:kumasi).id, inertia.props[:preselected_supplier_id]
  end

  # --- creating ---

  test "saving as on the way records it without touching stock" do
    sign_in_as(users(:one))

    assert_difference "Purchase.count", 1 do
      post purchases_path, params: params
    end

    purchase = Purchase.newest_first.first
    assert_redirected_to purchase_path(purchase)
    assert purchase.ordered?
    assert_equal suppliers(:kumasi), purchase.supplier
    assert purchase.delivery_method_delivery?
    assert_equal [ 4000, 1000 ], [ purchase.transport_cost_pesewas, purchase.extra_costs_pesewas ]
    assert_equal users(:one), purchase.user
    assert_equal 1, purchase.items.count, "the row left at 0 was dropped"
    assert_equal 0, variants(:dress_m_black).reload.stock_on_hand
  end

  test "save and add to stock does both" do
    sign_in_as(users(:one))

    post purchases_path, params: params.merge(receive: true)

    assert Purchase.newest_first.first.received?
    variant = variants(:dress_m_black).reload
    assert_equal 6, variant.stock_on_hand
    assert_equal 6833, variant.average_cost_pesewas, "(6 x 60 + 40 delivery + 10 fees) / 6 = 68.33"
  end

  test "leaving the cost boxes empty means none" do
    sign_in_as(users(:one))

    post purchases_path, params: params.deep_merge(purchase: { transport_cost: "", extra_costs: "" })

    assert_equal 0, Purchase.newest_first.first.added_costs_pesewas
  end

  test "a pick-up records what the trip cost, and it goes into the item cost" do
    sign_in_as(users(:one))

    post purchases_path, params: params.deep_merge(purchase: { delivery_method: "pickup", transport_cost: "30", extra_costs: "" }).merge(receive: true)

    purchase = Purchase.newest_first.first
    assert purchase.delivery_method_pickup?
    assert_equal 6500, variants(:dress_m_black).reload.average_cost_pesewas, "(6 x 60 + 30) / 6 = 65"
  end

  test "a supplier is required" do
    sign_in_as(users(:one))

    assert_no_difference "Purchase.count" do
      post purchases_path, params: params.deep_merge(purchase: { supplier_id: "" })
    end
    follow_redirect!
    assert_includes inertia.props[:errors][:supplier].first, "Choose who you bought from"
  end

  test "how the goods arrived is required" do
    sign_in_as(users(:one))

    assert_no_difference "Purchase.count" do
      post purchases_path, params: params.deep_merge(purchase: { delivery_method: "" })
    end
    follow_redirect!
    assert inertia.props[:errors][:delivery_method].present?
  end

  test "a new supplier abroad is saved with their country and city" do
    sign_in_as(users(:one))

    post purchases_path, params: params.deep_merge(purchase: { supplier_id: "",
      new_supplier: { name: "Guangzhou Fabrics", phone: "+86 20 1234 5678", country: "China", region: "", place: "Guangzhou" } })

    supplier = Purchase.newest_first.first.supplier
    assert_equal [ "China", "Guangzhou, China", true ], [ supplier.country, supplier.where_text, supplier.abroad? ]
    get purchase_path(Purchase.newest_first.first)
    assert_equal "Guangzhou, China", inertia.props[:purchase][:supplier_where]
  end

  test "a new supplier can be added while recording the purchase" do
    sign_in_as(users(:one))

    assert_difference "Supplier.count", 1 do
      post purchases_path, params: params.deep_merge(purchase: { supplier_id: "",
        new_supplier: { name: "  Makola  Traders ", phone: "020 111 2222" } })
    end

    supplier = Purchase.newest_first.first.supplier
    assert_equal [ "Makola Traders", "+233201112222" ], [ supplier.name, supplier.phone ]
  end

  test "a new supplier needs a name and a phone number, and nothing is saved without them" do
    sign_in_as(users(:one))

    assert_no_difference [ "Supplier.count", "Purchase.count" ] do
      post purchases_path, params: params.deep_merge(purchase: { supplier_id: "",
        new_supplier: { name: "Makola Traders", phone: "" } })
    end

    follow_redirect!
    assert_includes inertia.props[:errors][:new_supplier_phone].first, "reach them"
    assert_nil inertia.props[:errors][:supplier]
  end

  test "a valid new supplier isn't left behind when the purchase itself is invalid" do
    sign_in_as(users(:one))

    assert_no_difference [ "Supplier.count", "Purchase.count" ] do
      post purchases_path, params: { purchase: { purchased_on: "2026-10-05", delivery_method: "pickup", items: [],
        new_supplier: { name: "Makola Traders", phone: "020 111 2222" } } }
    end
  end

  test "errors come back and nothing is saved" do
    sign_in_as(users(:one))

    assert_no_difference [ "Purchase.count", "Supplier.count", "StockMovement.count" ] do
      post purchases_path, params: { receive: true, purchase: { purchased_on: "", supplier_id: suppliers(:kumasi).id,
        delivery_method: "pickup", items: [] } }
    end

    assert_redirected_to new_purchase_path
    follow_redirect!
    assert inertia.props[:errors][:purchased_on].present?
    assert inertia.props[:errors][:items].present?
  end

  # --- editing, receiving, deleting ---

  test "edits an ordered purchase" do
    sign_in_as(users(:one))
    purchase = purchases(:on_the_way)

    patch purchase_path(purchase), params: params

    assert_redirected_to purchase_path(purchase)
    assert_equal [ 6 ], purchase.items.reload.pluck(:quantity)
    assert_equal 5000, purchase.reload.added_costs_pesewas
  end

  test "marks an ordered purchase as arrived" do
    sign_in_as(users(:one))

    patch receive_purchase_path(purchases(:on_the_way))

    assert purchases(:on_the_way).reload.received?
    assert_equal 10, variants(:dress_m_black).reload.stock_on_hand
  end

  test "tapping arrived twice doesn't double the stock" do
    sign_in_as(users(:one))

    patch receive_purchase_path(purchases(:on_the_way))
    patch receive_purchase_path(purchases(:on_the_way))

    assert_equal 10, variants(:dress_m_black).reload.stock_on_hand
    assert_match "already received", flash[:alert]
  end

  test "a received purchase can be corrected, and stock follows; it still can't be deleted" do
    sign_in_as(users(:one))
    purchase = purchases(:on_the_way)
    purchase.receive!(by: users(:one))

    get edit_purchase_path(purchase)
    assert_inertia_component "Purchases/Form"
    assert_equal true, inertia.props[:purchase][:received]

    patch purchase_path(purchase), params: params(reference: "INV-10") # 6 black, 0 red
    assert_redirected_to purchase_path(purchase)
    assert_equal "Saved. Stock has been corrected to match.", flash[:notice]
    assert_equal [ 6, 0 ], [ variants(:dress_m_black).reload.stock_on_hand, variants(:dress_l_red).reload.stock_on_hand ]
    assert_equal "INV-10", purchase.reload.reference

    assert_no_difference "Purchase.count" do
      delete purchase_path(purchase)
    end
  end

  test "deletes an ordered purchase" do
    sign_in_as(users(:one))

    assert_difference "Purchase.count", -1 do
      delete purchase_path(purchases(:on_the_way))
    end
    assert_redirected_to purchases_path
  end

  # --- what stock and cost people may see ---

  test "product pages show suppliers only to people who can see purchases" do
    sign_in_as(users(:one))
    get product_path(products(:dress))
    assert_equal [ "Kumasi Fabrics" ], inertia.props[:product][:suppliers].map { |s| s[:name] }

    sign_in_as(users(:two))
    get product_path(products(:dress))
    assert_nil inertia.props[:product][:suppliers]
  end

  test "product pages show stock and cost only to those allowed" do
    purchases(:on_the_way).receive!(by: users(:one))

    sign_in_as(users(:one))
    get product_path(products(:dress))
    variant = inertia.props[:product][:variants].first
    assert_equal [ 10, 6600 ], variant.values_at(:stock, :average_cost_pesewas)

    sign_in_as(users(:two)) # products.view only
    get product_path(products(:dress))
    variant = inertia.props[:product][:variants].first
    assert_nil variant[:stock]
    assert_nil variant[:average_cost_pesewas]
  end
end
