require "test_helper"

class SuppliersControllerTest < ActionDispatch::IntegrationTest
  test "lists suppliers with what has been spent with each" do
    sign_in_as(users(:one))

    get suppliers_path

    assert_inertia_component "Suppliers/Index"
    row = inertia.props[:suppliers].first
    assert_equal [ "Kumasi Fabrics", 1, 110_000 ], row.values_at(:name, :purchases_count, :spent_pesewas)
    assert_equal [ "Ankara wrap dress" ], row[:products]
  end

  test "finds suppliers by name, phone, or something they sell" do
    sign_in_as(users(:one))
    Supplier.create!(name: "Makola Traders", phone: "020 111 2222")

    { "kumasi" => [ "Kumasi Fabrics" ], "0111" => [ "Makola Traders" ], "ankara" => [ "Kumasi Fabrics" ], "zzz" => [] }.each do |q, expected|
      get suppliers_path, params: { q: q }
      assert_equal expected, inertia.props[:suppliers].map { |s| s[:name] }, "searching #{q.inspect}"
    end
  end

  test "a supplier's page shows what they sell, the last price paid, and their purchases" do
    sign_in_as(users(:one))
    suppliers(:kumasi).sells!([ products(:old_bag).id ]) # listed, never bought

    get supplier_path(suppliers(:kumasi))

    assert_inertia_component "Suppliers/Show"
    supplier = inertia.props[:supplier]
    assert_equal 110_000, supplier[:spent_pesewas]
    assert_equal 1, supplier[:purchases].size
    dress, bag = supplier[:products].sort_by { |p| p[:name] }
    assert_equal [ "Ankara wrap dress", 8000 ], dress.values_at(:name, :last_cost_pesewas)
    assert_equal [ "Old tote bag", nil, true ], bag.values_at(:name, :last_cost_pesewas, :archived)
  end

  test "adds a supplier with the products they sell" do
    sign_in_as(users(:one))

    post suppliers_path, params: { supplier: { name: "Makola Traders", phone: "020 111 2222",
      product_ids: [ products(:dress).id, "", 999_999 ] } }

    supplier = Supplier.find_by!(name: "Makola Traders")
    assert_redirected_to supplier_path(supplier)
    assert_equal [ products(:dress) ], supplier.products.to_a, "blank and unknown ids are ignored"
  end

  test "editing replaces what they sell" do
    sign_in_as(users(:one))
    supplier = suppliers(:kumasi)

    patch supplier_path(supplier), params: { supplier: { name: supplier.name, phone: supplier.phone,
      product_ids: [ products(:old_bag).id ] } }

    assert_equal [ products(:old_bag) ], supplier.products.reload.to_a
  end

  test "adds and edits a supplier" do
    sign_in_as(users(:one))

    post suppliers_path, params: { supplier: { name: "Makola Traders", phone: "020 111 2222" } }
    supplier = Supplier.find_by!(name: "Makola Traders")
    supplier.sells!([ products(:dress).id ])

    patch supplier_path(supplier), params: { supplier: { name: "Makola Traders Ltd", phone: "+233 20 111 2222", note: "Cash only" } }
    assert_equal [ "Makola Traders Ltd", "+233 20 111 2222", "Cash only" ], supplier.reload.values_at(:name, :phone, :note)
    assert_equal 1, supplier.products.count, "no product list sent, so it was left alone"
  end

  test "a phone number is required and must look like one" do
    sign_in_as(users(:one))

    [ "", "call me", "12345" ].each do |phone|
      assert_no_difference "Supplier.count" do
        post suppliers_path, params: { supplier: { name: "Makola Traders", phone: phone } }
      end
      follow_redirect!
      assert inertia.props[:errors][:phone].present?, "#{phone.inspect} should be refused"
    end

    assert_difference "Supplier.count", 1 do
      post suppliers_path, params: { supplier: { name: "Makola Traders", phone: "(020) 111-2222" } }
    end
  end

  test "names are unique regardless of capitals" do
    sign_in_as(users(:one))

    assert_no_difference "Supplier.count" do
      post suppliers_path, params: { supplier: { name: "kumasi fabrics", phone: "024 000 0000" } }
    end
    follow_redirect!
    assert inertia.props[:errors][:name].present?
  end

  test "needs purchases.manage to change" do
    sign_in_as(users(:two))

    assert_no_difference "Supplier.count" do
      post suppliers_path, params: { supplier: { name: "Sneaky", phone: "020 111 2222" } }
    end
    assert_redirected_to admin_root_path
  end
end
