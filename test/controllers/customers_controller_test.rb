require "test_helper"

class CustomersControllerTest < ActionDispatch::IntegrationTest
  test "lists customers with what they have spent" do
    sign_in_as(users(:one))
    StockLedger.record!(variant: variants(:dress_m_black), quantity: 5, reason: "purchase")
    post orders_path, params: { order: { buyer: "ama_k", items: [ { variant_id: variants(:dress_m_black).id, quantity: 1 } ] } }

    get customers_path

    assert_inertia_component "Customers/Index"
    ama = inertia.props[:customers].find { |c| c[:handle] == "ama_k" }
    assert_equal [ "Ama Koranteng", 1, 12_000 ], ama.values_at(:display_name, :orders_count, :spent_pesewas)
  end

  test "searches by TikTok name, name or phone" do
    sign_in_as(users(:one))

    { "@kofi" => [ "kofi.b" ], "koranteng" => [ "ama_k" ], "2223333" => [ "ama_k" ], "zzz" => [] }.each do |q, expected|
      get customers_path, params: { q: q }
      assert_equal expected, inertia.props[:customers].map { |c| c[:handle] }, "searching #{q.inspect}"
    end
  end

  test "adds and edits a customer" do
    sign_in_as(users(:one))

    post customers_path, params: { customer: { handle: "@Esi.M", name: "Esi Mensah", phone: "055 123 4567", location: "Tema" } }
    esi = Customer.find_by!(handle: "esi.m")

    patch customer_path(esi), params: { customer: { handle: "esi.m", name: "Esi Mensah", phone: "055 123 4567", location: "Spintex" } }
    assert_equal "Spintex", esi.reload.location
  end

  test "errors come back to the form" do
    sign_in_as(users(:one))

    assert_no_difference "Customer.count" do
      post customers_path, params: { customer: { handle: "ama_k", phone: "nope" } }
    end
    follow_redirect!
    assert inertia.props[:errors][:handle].present?
    assert inertia.props[:errors][:phone].present?
  end

  test "needs customers.view to look and customers.manage to change" do
    roles(:assistant).update!(permissions: [ "customers.view" ])
    sign_in_as(users(:two))

    get customers_path
    assert_response :success
    assert_not inertia.props[:can_manage]

    assert_no_difference "Customer.count" do
      post customers_path, params: { customer: { name: "Sneaky" } }
    end
  end
end
