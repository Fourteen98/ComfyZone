require "test_helper"

class SupplierTest < ActiveSupport::TestCase
  test "knows what it sells, and products know who sells them" do
    assert_equal [ products(:dress) ], suppliers(:kumasi).products.to_a
    assert_equal [ suppliers(:kumasi) ], products(:dress).suppliers.to_a
  end

  test "sells! adds pairings and can be repeated without duplicates" do
    supplier = suppliers(:kumasi)

    supplier.sells!([ products(:old_bag).id, products(:dress).id, products(:old_bag).id ])
    supplier.sells!([ products(:old_bag).id ])

    assert_equal 2, supplier.products.count
  end

  test "the database refuses the same pairing twice" do
    assert_raises(ActiveRecord::RecordNotUnique) do
      ProductSupplier.new(supplier: suppliers(:kumasi), product: products(:dress)).save!(validate: false)
    end
  end

  test "save_with_products replaces the set" do
    supplier = suppliers(:kumasi)

    assert supplier.save_with_products([ products(:old_bag).id ])
    assert_equal [ products(:old_bag) ], supplier.products.reload.to_a

    assert supplier.save_with_products([])
    assert_empty supplier.products.reload
  end

  test "save_with_products leaves the set alone when given nil, or when the supplier is invalid" do
    supplier = suppliers(:kumasi)

    assert supplier.save_with_products(nil)
    assert_equal 1, supplier.products.count

    supplier.phone = ""
    assert_not supplier.save_with_products([])
    assert_equal 1, supplier.products.reload.count
  end

  test "recording a purchase links the supplier to what was bought" do
    supplier = Supplier.create!(name: "Makola Traders", phone: "020 111 2222")
    purchase = Purchase.new(user: users(:one), supplier: supplier, purchased_on: Date.current, delivery_method: "pickup")

    purchase.save_with_items([ { variant_id: variants(:dress_m_black).id, quantity: 2, unit_cost: "50" } ])

    assert_equal [ products(:dress) ], supplier.products.to_a
  end

  test "deleting a product removes its pairings but not the supplier" do
    product = Product.create!(name: "Temporary", price: "1")
    suppliers(:kumasi).sells!([ product.id ])

    assert_difference "ProductSupplier.count", -1 do
      assert_no_difference "Supplier.count" do
        product.destroy
      end
    end
  end
end
