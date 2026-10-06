require "test_helper"

class ProductTest < ActiveSupport::TestCase
  SIZE = { name: "Size", values: [ { label: "M" }, { label: "L" } ] }
  COLOUR = { name: "Colour", values: [ { label: "Black", swatch: "#1a1a1a" }, { label: "Red", swatch: "#c0262d" } ] }

  def new_product(**attributes)
    Product.new({ name: "Kaftan", price: "150" }.merge(attributes))
  end

  test "price is typed in cedis and stored in pesewas" do
    product = new_product(price: "120.50")

    assert_equal 12050, product.price_pesewas
    assert_equal "120.50", product.price
  end

  test "a price that isn't a number is a validation error, not a crash" do
    product = new_product(price: "cheap")

    assert_not product.valid?
    assert_includes product.errors[:price].first, "valid amount"
  end

  test "names are required and unique regardless of capitals" do
    assert_not new_product(name: "").valid?
    assert_not new_product(name: "ankara WRAP dress").valid?
  end

  test "a product with no options gets exactly one Default variant" do
    product = new_product

    assert product.save_with_options([])
    assert_equal [ "Default" ], product.variants.map(&:name)
  end

  test "options generate every combination, in option order" do
    product = new_product

    assert product.save_with_options([ SIZE, COLOUR ])
    assert_equal [ "M / Black", "M / Red", "L / Black", "L / Red" ], product.variants.reload.map(&:name)
    assert_equal product.variants.map(&:sku).uniq.size, 4
  end

  test "variants follow the product price until given their own" do
    product = new_product(price: "100")
    product.save_with_options([ SIZE ])
    large = product.variants.find_by!(name: "L")

    assert_equal 10000, large.selling_price_pesewas
    large.update!(price: "115")
    assert_equal 11500, large.selling_price_pesewas

    product.update!(price: "90")
    assert_equal 11500, large.reload.selling_price_pesewas, "an overridden price stays put"
    assert_equal 9000, product.variants.find_by!(name: "M").selling_price_pesewas
  end

  test "editing options keeps surviving variants and their prices" do
    product = new_product
    product.save_with_options([ SIZE, COLOUR ])
    kept = product.variants.find_by!(name: "L / Red")
    kept.update!(price: "175")

    # Drop M, add XL, drop Black.
    product.save_with_options([
      { name: "Size", values: [ { label: "L" }, { label: "XL" } ] },
      { name: "Colour", values: [ { label: "Red", swatch: "#c0262d" } ] }
    ])

    assert_equal [ "L / Red", "XL / Red" ], product.variants.reload.map(&:name)
    assert_equal kept.id, product.variants.first.id, "same row, not a new one"
    assert_equal 17500, product.variants.first.price_pesewas
  end

  test "a variant with history is retired, not deleted, when its choice is unticked" do
    dress = products(:dress)
    StockLedger.record!(variant: variants(:dress_m_black), quantity: 4, reason: "purchase")
    purchase_items(:m_black).destroy # leave stock history as its only tie
    no_history_id = variants(:dress_m_red).id

    # Untick M entirely.
    dress.save_with_options([ { name: "Size", values: [ { label: "L" } ] }, COLOUR ])

    assert_equal [ "L / Black", "L / Red" ], dress.variants.reload.map(&:name)
    retired = variants(:dress_m_black).reload
    assert_not retired.active?, "kept, because it has stock history"
    assert_equal 4, retired.stock_on_hand
    assert_not Variant.exists?(no_history_id), "no history, so simply removed"
  end

  test "ticking a retired choice again brings the same variant back" do
    dress = products(:dress)
    StockLedger.record!(variant: variants(:dress_m_black), quantity: 4, reason: "purchase")
    dress.save_with_options([ { name: "Size", values: [ { label: "L" } ] }, COLOUR ])

    dress.save_with_options([ SIZE, COLOUR ])

    back = dress.variants.reload.find_by!(name: "M / Black")
    assert_equal variants(:dress_m_black).id, back.id
    assert_equal 4, back.stock_on_hand
  end

  test "a failed save changes nothing" do
    product = products(:dress)

    assert_not product.save_with_options([ { name: "Size", values: [ { label: "M" }, { label: "m" } ] } ])

    assert_includes product.errors[:options].first, "Size"
    product.reload
    assert_equal [ "Size", "Colour" ], product.options.map(&:name)
    assert_equal 4, product.variants.count
  end

  test "refuses more than three options, repeated option names, or too many variants" do
    one = { name: "A", values: [ { label: "1" } ] }
    assert_not new_product.save_with_options([ one, one.merge(name: "B"), one.merge(name: "C"), one.merge(name: "D") ])
    assert_not new_product.save_with_options([ SIZE, SIZE.merge(name: "size") ])

    many = ->(name) { { name: name, values: (1..10).map { |n| { label: n.to_s } } } }
    product = new_product
    assert_not product.save_with_options([ many.("A"), many.("B"), many.("C") ])
    assert_includes product.errors[:options].first, "1000 variants"
  end

  test "search ignores capitals and treats % literally" do
    assert_equal [ products(:dress) ], Product.search("ANKARA").to_a
    assert_empty Product.search("%")
  end
end
