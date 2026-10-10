require "test_helper"

class SalesReportTest < ActiveSupport::TestCase
  setup do
    travel_to Time.zone.local(2026, 10, 7, 15, 0) # a Wednesday
    @owner = users(:one)
    @black = variants(:dress_m_black) # GH₵ 120, will cost 60
    @red = variants(:dress_l_red)     # GH₵ 140, will cost 80
    StockLedger.record!(variant: @black, quantity: 20, reason: "purchase", total_cost_pesewas: 120_000)
    StockLedger.record!(variant: @red, quantity: 20, reason: "purchase", total_cost_pesewas: 160_000)
  end

  # Make an order as if it were claimed at `at`.
  def sell(at:, buyer: "@ama_k", channel: nil, live: nil, lines: [ [ @black, 1 ] ])
    travel_to(at) do
      taker = OrderTaker.new(customer: Customer.for_claim(buyer), user: @owner, sales_channel: channel, live_session: live,
                             lines: lines.map { |variant, quantity| { variant_id: variant.id, quantity: quantity } })
      taker.save || flunk(taker.errors.full_messages.to_sentence)
      taker.order
    end
  end

  def week
    SalesReport.new(ReportPeriod.preset("week"))
  end

  test "totals add up sales, units, cost and profit" do
    sell(at: 1.day.ago, lines: [ [ @black, 2 ], [ @red, 1 ] ]) # 240 + 140 = 380, cost 120 + 80 = 200
    sell(at: 1.hour.ago, buyer: "@kofi.b")                    # 120, cost 60

    assert_equal({ orders: 2, units: 4, sales_pesewas: 50_000, cost_pesewas: 26_000, profit_pesewas: 24_000 }, week.totals)
  end

  test "an empty period is all zeros, not nil" do
    assert_equal({ orders: 0, units: 0, sales_pesewas: 0, cost_pesewas: 0, profit_pesewas: 0 }, week.totals)
  end

  test "cancelled and returned orders, and orders outside the period, don't count" do
    sell(at: 1.hour.ago).cancel!(by: @owner)
    returned = sell(at: 2.hours.ago, buyer: "@kofi.b")
    returned.deliver!
    returned.return!(by: @owner, restock: true)
    sell(at: 10.days.ago, buyer: "@old")
    kept = sell(at: 3.hours.ago, buyer: "@efua")

    assert_equal [ 1, kept.total_pesewas ], week.totals.values_at(:orders, :sales_pesewas)
  end

  test "delivery fees are not sales" do
    sell(at: 1.hour.ago).set_delivery!(delivery_method: "delivery", fee: "30", address: "Osu")

    assert_equal 12_000, week.totals[:sales_pesewas]
  end

  test "over time has a row for every day, quiet ones included" do
    sell(at: Time.zone.local(2026, 10, 5, 23, 30)) # Monday, late
    sell(at: Time.zone.local(2026, 10, 7, 9, 0), buyer: "@kofi.b", lines: [ [ @red, 1 ] ])

    rows = week.over_time

    assert_equal [ "Mon 5 Oct", "Tue 6 Oct", "Wed 7 Oct" ], rows.pluck(:label)
    assert_equal [ 12_000, 0, 14_000 ], rows.pluck(:sales_pesewas)
    assert_equal [ 6_000, 0, 6_000 ], rows.pluck(:profit_pesewas)
    assert_equal [ 1, 0, 1 ], rows.pluck(:orders)
  end

  test "a long period is grouped by month" do
    sell(at: Time.zone.local(2026, 7, 15, 12, 0))
    sell(at: Time.zone.local(2026, 10, 1, 12, 0), buyer: "@kofi.b")

    rows = SalesReport.new(ReportPeriod.custom("2026-07-01", "2026-10-07")).over_time

    assert_equal [ "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026" ], rows.pluck(:label)
    assert_equal [ 12_000, 0, 0, 12_000 ], rows.pluck(:sales_pesewas)
  end

  test "best sellers are ranked by sales, per product" do
    sell(at: 1.hour.ago, lines: [ [ @black, 1 ], [ @red, 2 ] ]) # both are the same product
    scarf = variants(:old_bag_default)
    StockLedger.record!(variant: scarf, quantity: 5, reason: "purchase", total_cost_pesewas: 5_000)
    sell(at: 2.hours.ago, buyer: "@kofi.b", lines: [ [ scarf, 1 ] ])

    top = week.top_products

    assert_equal [ products(:dress).name, scarf.product.name ], top.pluck(:name)
    assert_equal [ 3, 40_000, 18_000 ], top.first.values_at(:units, :sales_pesewas, :profit_pesewas)
  end

  test "sales by channel, with unrecorded ones together" do
    sell(at: 1.hour.ago, channel: sales_channels(:whatsapp))
    sell(at: 2.hours.ago, buyer: "@kofi.b", channel: sales_channels(:whatsapp))
    sell(at: 3.hours.ago, buyer: "@efua", lines: [ [ @red, 1 ] ])

    assert_equal [ { name: "WhatsApp", orders: 2, sales_pesewas: 24_000 }, { name: "Not recorded", orders: 1, sales_pesewas: 14_000 } ],
      week.by_channel
  end

  test "lives and top customers" do
    live = travel_to(1.day.ago) { LiveSession.create!(user: @owner, title: "Tuesday live", sales_channel: sales_channels(:tiktok)) }
    sell(at: 1.day.ago, live: live)
    sell(at: 1.day.ago + 60, live: live, buyer: "@kofi.b", lines: [ [ @red, 2 ] ])
    sell(at: 1.hour.ago) # ama again, outside the live

    assert_equal [ { id: live.id, name: "Tuesday live", orders: 2, sales_pesewas: 40_000, cost_pesewas: 22_000, expenses_pesewas: 0, profit_pesewas: 18_000 } ], week.lives
    assert_equal [ [ "@kofi.b", 1, 28_000 ], [ "Ama Koranteng", 2, 24_000 ] ], week.top_customers.map { |row| row.values_at(:name, :orders, :sales_pesewas) }
  end

  test "money received goes by when it was paid, less refunds" do
    old_order = sell(at: 10.days.ago)             # sold before this week...
    old_order.record_payment!(amount: "120", via: "momo", by: @owner) # ...paid in it
    order = sell(at: 1.hour.ago, buyer: "@kofi.b")
    order.record_payment!(amount: "120", via: "cash", by: @owner)
    order.refund!(amount: "20", via: "cash", by: @owner)

    assert_equal [ { name: "Mobile money", amount_pesewas: 12_000 }, { name: "Cash", amount_pesewas: 10_000 } ], week.money_in
  end

  test "when people buy: by day of the week and hour, in Ghana time" do
    sell(at: Time.zone.local(2026, 10, 6, 20, 15))                   # Tuesday, 8pm
    sell(at: Time.zone.local(2026, 10, 6, 20, 50), buyer: "@kofi.b") # Tuesday, 8pm again
    sell(at: Time.zone.local(2026, 10, 5, 9, 0), buyer: "@esi")      # Monday, 9am

    days = week.by_weekday
    assert_equal 7, days.size
    assert_equal [ "Monday", 1, 12_000 ], days[0].values_at(:label, :orders, :sales_pesewas)
    assert_equal [ "Tuesday", 2, 24_000 ], days[1].values_at(:label, :orders, :sales_pesewas)
    assert_equal 0, days[6][:orders]

    hours = week.by_hour
    assert_equal 24, hours.size
    assert_equal [ "8pm to 9pm", "8pm", 2 ], hours[20].values_at(:label, :short, :orders)
    assert_equal [ "12am to 1am", "12am" ], hours[0].values_at(:label, :short)
    assert_equal 1, hours[9][:orders]
  end
end
