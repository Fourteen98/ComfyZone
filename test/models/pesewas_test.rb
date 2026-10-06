require "test_helper"

class PesewasTest < ActiveSupport::TestCase
  test "parses what people type into whole pesewas" do
    assert_equal 12050, Pesewas.parse("120.50")
    assert_equal 12000, Pesewas.parse("120")
    assert_equal 12050, Pesewas.parse("120.5")
    assert_equal 120000, Pesewas.parse(" 1,200 ")
    assert_equal 9900, Pesewas.parse("GH₵ 99")
    assert_equal 5, Pesewas.parse("0.05")
  end

  test "never loses a pesewa to rounding" do
    # The classic float trap: 0.1 + 0.2 is 0.30000000000000004 in floats.
    assert_equal 30, Pesewas.parse("0.10") + Pesewas.parse("0.20")
    assert_equal 1999, Pesewas.parse("19.99")
  end

  test "blank is nil and nonsense is flagged" do
    assert_nil Pesewas.parse("")
    assert_nil Pesewas.parse(nil)
    assert_equal Pesewas::INVALID, Pesewas.parse("abc")
    assert_equal Pesewas::INVALID, Pesewas.parse("12.345")
    assert_equal Pesewas::INVALID, Pesewas.parse("-5")
  end

  test "formats back for a form field" do
    assert_equal "120.50", Pesewas.to_input(12050)
    assert_equal "120", Pesewas.to_input(12000)
    assert_equal "0.05", Pesewas.to_input(5)
    assert_equal "", Pesewas.to_input(nil)
  end
end
