require "test_helper"

class Products::VariantPricesControllerTest < ActionDispatch::IntegrationTest
  test "sets, changes and clears variant prices in one go" do
    sign_in_as(users(:one))
    dress = products(:dress)

    patch product_variant_prices_path(dress), params: { variants: [
      { id: variants(:dress_m_black).id, price: "130.50" },
      { id: variants(:dress_l_red).id, price: "" }
    ] }

    assert_redirected_to product_path(dress)
    assert_equal 13050, variants(:dress_m_black).reload.price_pesewas
    assert_nil variants(:dress_l_red).reload.price_pesewas, "blank goes back to following the product price"
  end

  test "one bad price saves none of them" do
    sign_in_as(users(:one))
    dress = products(:dress)

    patch product_variant_prices_path(dress), params: { variants: [
      { id: variants(:dress_m_black).id, price: "130" },
      { id: variants(:dress_m_red).id, price: "free" }
    ] }

    assert_nil variants(:dress_m_black).reload.price_pesewas
    follow_redirect!
    assert inertia.props[:errors][:"price_#{variants(:dress_m_red).id}"].present?
  end

  test "can't touch a variant of another product" do
    sign_in_as(users(:one))

    patch product_variant_prices_path(products(:dress)), params: { variants: [
      { id: variants(:old_bag_default).id, price: "1" }
    ] }

    assert_response :not_found
    assert_nil variants(:old_bag_default).reload.price_pesewas
  end

  test "needs products.manage" do
    sign_in_as(users(:two))

    patch product_variant_prices_path(products(:dress)), params: { variants: [
      { id: variants(:dress_m_black).id, price: "1" }
    ] }

    assert_redirected_to root_path
    assert_nil variants(:dress_m_black).reload.price_pesewas
  end
end
