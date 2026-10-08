require "test_helper"

class PhoneNumberTest < ActiveSupport::TestCase
  test "every way of typing a Ghanaian number ends up the same" do
    [ "024 222 3333", "0242223333", "024-222-3333", "+233 24 222 3333", "233242223333", "00233242223333", "24 222 3333", " (024) 222 3333 " ].each do |typed|
      assert_equal "+233242223333", PhoneNumber.normalize(typed), typed
    end
  end

  test "numbers from abroad keep their own country code" do
    assert_equal "+447700900123", PhoneNumber.normalize("+44 7700 900123")
    assert_equal "+8613800138000", PhoneNumber.normalize("0086 138 0013 8000")
    assert PhoneNumber.valid?("+447700900123")
  end

  test "blank is nothing, and nonsense is kept as typed so it can be pointed at" do
    assert_nil PhoneNumber.normalize("  ")
    assert_equal "hello there", PhoneNumber.normalize(" hello   there ")
    assert_not PhoneNumber.valid?("hello there")
    assert_not PhoneNumber.valid?("+23324222333"), "a Ghanaian number needs 9 digits after +233"
    assert_not PhoneNumber.valid?("+0123456789")
  end

  test "it reads well, and searches drop the leading 0" do
    assert_equal "+233 24 222 3333", PhoneNumber.format("+233242223333")
    assert_equal "+447700 900 123", PhoneNumber.format("+447700900123")
    assert_equal "2422", PhoneNumber.search_digits("024 22")
  end
end

class CustomerPhoneTest < ActiveSupport::TestCase
  test "the phone number is one customer, however it is typed" do
    ama = customers(:ama)

    twin = Customer.new(name: "Someone", phone: "0242223333")
    assert_not twin.valid?
    assert_equal [ "already belongs to Ama Koranteng" ], twin.errors[:phone]

    assert_raises(ActiveRecord::RecordNotUnique) do
      Customer.insert_all!([ { name: "Sneaky", phone: ama.phone, created_at: Time.current, updated_at: Time.current } ])
    end
  end

  test "a sale finds the customer by number first, even if the username points elsewhere" do
    found = Customer.for_sale(handle: "kofi.b", phone: "+233 24 222 3333")
    assert_equal customers(:ama), found
  end

  test "many customers can have no number" do
    assert Customer.create!(handle: "no_phone_one")
    assert Customer.create!(handle: "no_phone_two")
  end

  test "a number that isn't one is refused with an example" do
    customer = Customer.new(name: "X", phone: "12345")
    assert_not customer.valid?
    assert_match "024 123 4567", customer.errors[:phone].first
  end

  test "search finds a number typed the local way" do
    assert_includes Customer.phone_like("024 222"), customers(:ama)
  end
end
