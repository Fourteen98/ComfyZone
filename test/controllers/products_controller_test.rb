require "test_helper"

class ProductsControllerTest < ActionDispatch::IntegrationTest
  PARAMS = { product: { name: "Kaftan", description: "Loose fit", price: "150", options: [
    { name: "Size", values: [ { label: "M" }, { label: "L" } ] },
    { name: "Colour", values: [ { label: "Wine", swatch: "#5a1f2b" } ] }
  ] } }

  # --- permissions: fixture user two can view products but not manage them ---

  test "a viewer can see the list and a product" do
    sign_in_as(users(:two))

    get products_path
    assert_inertia_component "Products/Index"

    get product_path(products(:dress))
    assert_inertia_component "Products/Show"
  end

  test "a viewer can't add, edit or archive" do
    sign_in_as(users(:two))

    get new_product_path
    assert_redirected_to root_path

    assert_no_difference "Product.count" do
      post products_path, params: PARAMS
    end

    patch archive_product_path(products(:dress))
    assert products(:dress).reload.active?
  end

  test "someone with no product permissions can't even look" do
    roles(:assistant).update!(permissions: [ "orders.view" ])
    sign_in_as(users(:two))

    get products_path

    assert_redirected_to root_path
  end

  # --- listing ---

  test "lists active products with their price range" do
    sign_in_as(users(:one))

    get products_path

    products = inertia.props[:products]
    assert_equal [ "Ankara wrap dress" ], products.map { |p| p[:name] }
    assert_equal 4, products.first[:variants_count]
    assert_equal 12000, products.first[:price_from]
    assert_equal 14000, products.first[:price_to]
    assert_equal({ active: 1, archived: 1 }.stringify_keys, inertia.props[:counts].to_h.stringify_keys)
  end

  test "filters by archived and by search" do
    sign_in_as(users(:one))

    get products_path, params: { status: "archived" }
    assert_equal [ "Old tote bag" ], inertia.props[:products].map { |p| p[:name] }

    get products_path, params: { q: "kente" }
    assert_empty inertia.props[:products]
  end

  test "filters by category, and by having none" do
    sign_in_as(users(:one))
    Product.create!(name: "Plain tee", price: "40")

    get products_path, params: { category: "dresses" }
    assert_equal [ "Ankara wrap dress" ], inertia.props[:products].map { |p| p[:name] }
    assert_equal "Dresses", inertia.props[:products].first[:category]

    get products_path, params: { category: "none" }
    assert_equal [ "Plain tee" ], inertia.props[:products].map { |p| p[:name] }

    filters = inertia.props[:categories].map { |c| [ c[:name], c[:count] ] }
    assert_equal [ [ "Dresses", 1 ], [ "No category", 1 ] ], filters
  end

  test "the form offers visible categories, plus a hidden one the product already has" do
    sign_in_as(users(:one))

    get new_product_path
    assert_equal [ "Dresses", "Bags" ], inertia.props[:categories].map { |c| c[:name] }

    products(:dress).update!(category: categories(:hidden))
    get edit_product_path(products(:dress))
    assert_includes inertia.props[:categories].map { |c| c[:name] }, "Old season"
  end

  test "saves and clears a product's category" do
    sign_in_as(users(:one))
    dress = products(:dress)

    patch product_path(dress), params: { product: { name: dress.name, price: "120", category_id: categories(:bags).id } }
    assert_equal categories(:bags), dress.reload.category

    patch product_path(dress), params: { product: { name: dress.name, price: "120", category_id: "" } }
    assert_nil dress.reload.category
  end

  # --- creating and editing ---

  test "creates a product, its options and its variants together" do
    sign_in_as(users(:one))

    assert_difference({ "Product.count" => 1, "ProductOption.count" => 2, "Variant.count" => 2 }) do
      post products_path, params: PARAMS
    end

    product = Product.find_by!(name: "Kaftan")
    assert_redirected_to product_path(product)
    assert_equal 15000, product.price_pesewas
    assert_equal [ "M / Wine", "L / Wine" ], product.variants.map(&:name)
  end

  test "creates a simple product with no options" do
    sign_in_as(users(:one))

    post products_path, params: { product: { name: "Scrunchie", price: "10" } }

    assert_equal [ "Default" ], Product.find_by!(name: "Scrunchie").variants.map(&:name)
  end

  test "errors come back to the form and nothing is saved" do
    sign_in_as(users(:one))

    assert_no_difference [ "Product.count", "Variant.count" ] do
      post products_path, params: { product: { name: "", price: "lots",
        options: [ { name: "Size", values: [] } ] } }
    end

    assert_redirected_to new_product_path
    follow_redirect!
    errors = inertia.props[:errors]
    assert errors[:name].present?
    assert errors[:price].present?
    assert errors[:options].present?
  end

  test "the new form receives the option lists to pick from" do
    sign_in_as(users(:one))

    get new_product_path

    assert_inertia_component "Products/Form"
    assert_equal [ "Letter sizes", "Colours" ], inertia.props[:presets].map { |p| p[:name] }
  end

  test "updating options keeps the variants that still apply" do
    sign_in_as(users(:one))
    dress = products(:dress)

    patch product_path(dress), params: { product: { name: dress.name, price: "125", options: [
      { name: "Size", values: [ { label: "L" } ] },
      { name: "Colour", values: [ { label: "Red", swatch: "#c0262d" } ] }
    ] } }

    assert_redirected_to product_path(dress)
    assert_equal [ variants(:dress_l_red).id ], dress.variants.reload.map(&:id)
    assert_equal 14000, dress.variants.first.selling_price_pesewas
    assert_equal 12500, dress.reload.price_pesewas
  end

  test "saves the low stock warning level" do
    sign_in_as(users(:one))
    dress = products(:dress)

    patch product_path(dress), params: { product: { name: dress.name, price: "120", low_stock_at: "5" } }
    assert_equal 5, dress.reload.low_stock_at

    patch product_path(dress), params: { product: { name: dress.name, price: "120", low_stock_at: "-1" } }
    assert_equal 5, dress.reload.low_stock_at
  end

  test "extra fields in the request are ignored" do
    sign_in_as(users(:one))

    post products_path, params: { product: { name: "Sneaky", price: "1", status: "archived", price_pesewas: 5 } }

    product = Product.find_by!(name: "Sneaky")
    assert product.active?
    assert_equal 100, product.price_pesewas
  end

  # --- archiving ---

  test "archives and restores instead of deleting" do
    sign_in_as(users(:one))
    dress = products(:dress)

    assert_no_difference "Product.count" do
      patch archive_product_path(dress)
    end
    assert dress.reload.archived?

    patch restore_product_path(dress)
    assert dress.reload.active?
  end

  test "there is no delete route" do
    sign_in_as(users(:one))

    delete "/products/#{products(:dress).id}"

    assert_response :not_found
  end
end
