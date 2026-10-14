require "test_helper"

class OrderSearchTest < ActiveSupport::TestCase
  setup do
    travel_to Time.zone.local(2026, 10, 14, 15, 0)
    @owner = users(:one)
    @black = variants(:dress_m_black) # Ankara wrap dress, GH₵ 120
    StockLedger.record!(variant: @black, quantity: 80, reason: "purchase", total_cost_pesewas: 480_000)
  end

  def sell(buyer, at: Time.current, quantity: 1, channel: nil)
    travel_to(at) do
      taker = OrderTaker.new(customer: buyer.is_a?(String) ? Customer.for_claim(buyer) : buyer, user: @owner, sales_channel: channel,
                             lines: [ { variant_id: @black.id, quantity: quantity } ])
      taker.save || flunk(taker.errors.full_messages.to_sentence)
      taker.order
    end
  end

  def ids(params) = OrderSearch.new(params).orders.map(&:id)

  test "finds by name, @username, phone in any shape, order number and product" do
    ama = sell("@ama_k")
    efua = sell(Customer.create!(name: "Efua Mensah", phone: "0241234567"))

    assert_equal [ ama.id ], ids(q: "@AMA")
    assert_equal [ efua.id ], ids(q: "efua")
    assert_equal [ efua.id ], ids(q: "024 123 4567")
    assert_equal [ efua.id ], ids(q: "+233241234567")
    assert_equal [ ama.id ], ids(q: "##{ama.id}".delete_prefix("#"))
    assert_equal [ efua.id, ama.id ], ids(q: "ankara")
    assert_empty ids(q: "kaftan")
  end

  test "filters by when, payment and live, and counts tabs within the filters" do
    old = sell("@old", at: 10.days.ago)
    paid = sell("@paid")
    paid.record_payment!(amount: "120", via: "cash", by: @owner)
    part = sell("@part", quantity: 2)
    part.record_payment!(amount: "100", via: "cash", by: @owner)
    unpaid = sell("@unpaid")

    assert_equal [ unpaid.id, part.id, paid.id ], ids(when: "week")
    assert_equal [ part.id ], ids(pay: "part")
    assert_equal [ paid.id ], ids(pay: "paid")
    assert_equal [ unpaid.id, old.id ], ids(pay: "unpaid")
    assert_equal [ old.id ], ids(pay: "stale") # unpaid for 3+ days

    counts = OrderSearch.new(when: "week").counts
    assert_equal 3, counts["all"]
    assert_equal 1, counts["paid"]
    assert_equal 2, counts["claimed"]
  end

  test "25 to a page, newest first, and junk params are ignored" do
    orders = 27.times.map { |i| sell("@buyer#{i}", at: (27 - i).minutes.ago) }

    first = OrderSearch.new(page: "1")
    assert_equal [ 27, 2 ], [ first.total, first.pages ]
    assert_equal orders.last(25).reverse.map(&:id), first.orders.map(&:id)
    assert_equal orders.first(2).reverse.map(&:id), ids(page: "2")

    junk = OrderSearch.new(status: "drop table", when: "forever", pay: "x", page: "-3", channel_id: "999")
    assert_equal [ nil, nil, nil, nil, 1 ], [ junk.status, junk.when, junk.pay, junk.channel_id, junk.page ]
    assert_not junk.filtering?
  end
end
