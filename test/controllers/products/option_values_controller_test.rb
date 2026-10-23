require "test_helper"

# Adding a colour the product didn't have, from the purchase form.
class Products::OptionValuesControllerTest < ActionDispatch::IntegrationTest
  setup { @dress = products(:dress) }

  test "adds the colour and makes it in every size; the purchase form lists them" do
    sign_in_as(users(:one))

    assert_difference -> { @dress.variants.count } => 2 do
      post product_option_values_path(@dress), params: { option: "colour", label: " Green ", swatch: "#2E7D32" },
        headers: { "HTTP_REFERER" => new_purchase_url }
    end
    assert_redirected_to new_purchase_url
    assert_equal "Ankara wrap dress now comes in Green (2 new items).", flash[:notice]
    assert_equal %w[ Black Red Green ], @dress.options.find_by(name: "Colour").labels
    assert_equal "#2e7d32", @dress.options.find_by(name: "Colour").values.last["swatch"]

    get new_purchase_path
    picked = inertia.props[:products].find { |product| product[:id] == @dress.id }
    assert_includes picked[:variants].map { |variant| variant[:name] }, "L / Green"
    assert_equal [ [ "Size", false, %w[ M L ] ], [ "Colour", true, %w[ Black Red Green ] ] ],
      picked[:options].map { |option| option.values_at("name", "colours", "labels") }
    assert_includes inertia.props[:option_suggestions]["colour"].map { |value| value["label"] }, "Green"
  end

  test "a colour it already has, or an option it doesn't have, is refused" do
    sign_in_as(users(:one))
    assert_no_difference -> { Variant.count } do
      post product_option_values_path(@dress), params: { option: "Colour", label: "red" }, headers: { "HTTP_REFERER" => new_purchase_url }
      post product_option_values_path(@dress), params: { option: "Length", label: "Maxi" }, headers: { "HTTP_REFERER" => new_purchase_url }
    end
    follow_redirect!
    assert_equal [ "Ankara wrap dress has no \"Length\" to add to" ], inertia.props[:errors][:option_value]
  end

  test "stock already on a size is kept" do
    StockLedger.record!(variant: variants(:dress_m_black), quantity: 3, reason: "found")
    sign_in_as(users(:one))
    post product_option_values_path(@dress), params: { option: "Size", label: "XL" }
    assert_equal 3, variants(:dress_m_black).reload.stock_on_hand
    assert_equal %w[ M/Black M/Red L/Black L/Red XL/Black XL/Red ], @dress.variants.reload.map { |variant| variant.name.delete(" ") }
  end

  test "needs products.manage" do
    roles(:assistant).update!(permissions: %w[ purchases.manage products.view ])
    sign_in_as(users(:two))
    assert_no_difference -> { Variant.count } do
      post product_option_values_path(@dress), params: { option: "Colour", label: "Green" }
    end
  end
end
