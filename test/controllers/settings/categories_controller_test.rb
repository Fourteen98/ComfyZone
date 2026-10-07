require "test_helper"

class Settings::CategoriesControllerTest < ActionDispatch::IntegrationTest
  test "needs settings.manage" do
    sign_in_as(users(:two))

    get settings_categories_path
    assert_redirected_to admin_root_path

    assert_no_difference "Category.count" do
      post settings_categories_path, params: { category: { name: "Sneaky" } }
    end
  end

  test "lists categories in order with product counts" do
    sign_in_as(users(:one))

    get settings_categories_path

    assert_inertia_component "Settings/Categories/Index"
    rows = inertia.props[:categories]
    assert_equal [ "Dresses", "Bags", "Old season" ], rows.map { |c| c[:name] }
    assert_equal 1, rows.first[:products_count]
    assert_equal 1, inertia.props[:uncategorised_count]
  end

  test "creates, renames and hides" do
    sign_in_as(users(:one))

    post settings_categories_path, params: { category: { name: "Shoes" } }
    shoes = Category.find_by!(name: "Shoes")
    assert_redirected_to settings_categories_path

    patch settings_category_path(shoes), params: { category: { name: "Footwear", active: false } }
    assert_equal [ "Footwear", false, "shoes" ], shoes.reload.values_at(:name, :active, :slug)
  end

  test "errors come back to the form" do
    sign_in_as(users(:one))

    post settings_categories_path, params: { category: { name: "dresses" } }

    assert_redirected_to new_settings_category_path
    follow_redirect!
    assert inertia.props[:errors][:name].present?
  end

  test "moves a category up" do
    sign_in_as(users(:one))

    patch move_settings_category_path(categories(:bags)), params: { direction: "up" }

    assert_equal "Bags", Category.ordered.first.name
  end

  test "deleting keeps the products" do
    sign_in_as(users(:one))

    assert_difference "Category.count", -1 do
      assert_no_difference "Product.count" do
        delete settings_category_path(categories(:dresses))
      end
    end
  end
end
