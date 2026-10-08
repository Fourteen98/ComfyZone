require "test_helper"

class VariantSearchTest < ActiveSupport::TestCase
  def variant(product, *labels, sku: "CZ-1")
    Variant.new(product: Product.new(name: product), sku: sku,
      option_values: labels.map { |label| { "name" => "x", "label" => label } })
  end

  setup do
    @orange_3xl = variant("Kaftan maxi", "3XL", "Orange")
    @orange_xl = variant("Kaftan maxi", "XL", "Orange")
    @black_3xl = variant("Kaftan maxi", "3XL", "Black")
    @scarf = variant("Silk headscarf", "Orange")
    @all = [ @black_3xl, @orange_xl, @scarf, @orange_3xl ]
  end

  test "words in any order find the exact size and colour first" do
    assert_equal @orange_3xl, VariantSearch.new("orange 3xl").rank(@all).first
    assert_equal @orange_3xl, VariantSearch.new("3XL ORANGE").rank(@all).first
    assert_equal [ @orange_3xl ], VariantSearch.new("kaftan orange 3xl").rank(@all)
  end

  test "xl means XL, not 3XL; every word has to match" do
    assert_equal [ @orange_xl ], VariantSearch.new("orange xl").rank(@all)
    assert_empty VariantSearch.new("orange 4xl").rank(@all)
  end

  test "a colour alone finds it across products; a product name alone finds all its variants" do
    assert_equal 3, VariantSearch.new("orange").rank(@all).size
    assert_equal 3, VariantSearch.new("kaftan").rank(@all).size
    assert_equal [ @black_3xl, @orange_3xl ], VariantSearch.new("maxi 3").rank(@all), "prefixes work: 3 finds 3XL"
  end
end
