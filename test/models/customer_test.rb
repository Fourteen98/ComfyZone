require "test_helper"

class CustomerTest < ActiveSupport::TestCase
  test "tidies a TikTok name however it is typed" do
    assert_equal "new_buyer", Customer.new(handle: " @New_Buyer ").handle
    assert_nil Customer.new(handle: " @ ").handle
  end

  test "for_claim finds the same person whatever the capitals or @" do
    assert_equal customers(:ama), Customer.for_claim("@AMA_K")
    assert_equal customers(:ama), Customer.for_claim(" ama_k ")
  end

  test "for_claim prepares a new customer for an unknown name" do
    customer = Customer.for_claim("@first.timer")

    assert customer.new_record?
    assert_equal "first.timer", customer.handle
    assert customer.valid?
  end

  test "is shown by name, else @handle, else phone" do
    assert_equal "Ama Koranteng", customers(:ama).display_name
    assert_equal "@kofi.b", customers(:kofi).display_name
    assert_equal "+233 20 000 1111", Customer.new(phone: "020 000 1111").display_name
  end

  test "needs something to identify them, a unique handle and a sensible phone" do
    assert_not Customer.new.valid?
    assert_not Customer.new(handle: "AMA_K").valid?
    assert_not Customer.new(handle: "has spaces!").valid?
    assert_not Customer.new(name: "Esi", phone: "call me").valid?
    assert Customer.new(name: "Esi").valid?
  end

  test "several customers may have no handle" do
    Customer.create!(name: "Walk-in one")

    assert Customer.new(name: "Walk-in two").save
  end
end

# Finding or making the buyer for a sale recorded by hand.
class CustomerForSaleTest < ActiveSupport::TestCase
  test "an id picks that customer" do
    assert_equal customers(:ama), Customer.for_sale(id: customers(:ama).id)
  end

  test "a username finds the same person, however it is typed" do
    assert_equal customers(:ama), Customer.for_sale(handle: " @Ama_K ")
  end

  test "a phone number finds the same person, however it is spaced" do
    assert_equal customers(:ama), Customer.for_sale(name: "Ama", phone: "0242223333")
  end

  test "a name alone is always a new customer" do
    customer = Customer.for_sale(name: "Ama Koranteng")

    assert customer.new_record?
    assert customer.valid?
    assert_equal "Ama Koranteng", customer.display_name
  end

  test "a new buyer keeps everything that was typed" do
    customer = Customer.for_sale(name: "Mrs Mensah", phone: "020 111 2222", handle: "")

    assert_equal [ nil, "Mrs Mensah", "+233201112222" ], customer.values_at(:handle, :name, :phone)
  end

  test "new details fill blanks on a known customer but never overwrite" do
    kofi = Customer.for_sale(handle: "kofi.b", name: "Kofi Boateng", phone: "055 000 1111")
    assert_equal [ customers(:kofi).id, "Kofi Boateng", "+233550001111" ], kofi.values_at(:id, :name, :phone)

    ama = Customer.for_sale(handle: "ama_k", name: "Someone else")
    assert_equal "Ama Koranteng", ama.name
  end

  test "nothing typed gives a customer that can't be saved" do
    assert_not Customer.for_sale.valid?
    assert_not Customer.for_sale(id: 0).valid?
  end
end
