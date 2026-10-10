require "test_helper"

# Lesson 29: knowing her customers. Insights, the waiting list, the restock
# advisor and profit per product and live.
class CustomerKnowledgeTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper

  setup do
    @ama = customers(:ama)
    @black = variants(:dress_m_black) # M / Black
    @red = variants(:dress_m_red)     # M / Red
    StockLedger.record!(variant: @black, quantity: 20, reason: "recount")
    @black.update!(average_cost_pesewas: 5000)
  end

  def sell(customer, variant, quantity = 1, at: Time.current, paid_after: nil)
    taker = OrderTaker.new(customer: customer, user: users(:one), lines: [ { variant_id: variant.id, quantity: quantity } ])
    assert taker.save, taker.errors.full_messages.to_sentence
    order = taker.order
    order.update_columns(created_at: at)
    if paid_after
      order.record_payment!(amount: Pesewas.to_input(order.due_pesewas), via: "momo", by: users(:one))
      order.update_columns(paid_at: at + paid_after)
    end
    order
  end

  # ---------- insights ----------

  test "spend, how often, usual size and colour, and how fast they pay" do
    sell(@ama, @black, 2, at: 20.days.ago, paid_after: 1.hour)
    sell(@ama, @black, 1, at: 10.days.ago, paid_after: 5.hours)
    sell(@ama, @black, 1, at: 2.days.ago, paid_after: 4.days)

    insights = CustomerInsights.new(@ama)
    summary = insights.summary
    assert_equal [ 3, 48_000, 16_000, 4 ], summary.values_at(:orders, :spent_pesewas, :average_pesewas, :units)
    assert_equal 9, summary[:every_days]
    assert_equal 2, summary[:days_since_last]
    assert_not summary[:quiet]

    assert_equal [ [ "M", 4 ] ], insights.favourites["Size"]
    assert_equal [ [ "Black", 4 ] ], insights.favourites["Colour"]
    assert_equal "Pays the same day", insights.pays[:label], "the median, not dragged by one slow payment"
  end

  test "gone quiet: good customers who stopped buying, biggest spenders first" do
    sell(@ama, @black, 3, at: 45.days.ago)
    sell(customers(:kofi), @black, 1, at: 40.days.ago)
    sell(customers(:kofi), @black, 1, at: 3.days.ago) # Kofi came back

    assert_equal [ @ama.id ], CustomerInsights.gone_quiet.map(&:first)
    assert CustomerInsights.new(@ama).summary[:quiet]
  end

  # ---------- waiting list ----------

  test "asking twice is one entry; buying it takes them off" do
    StockRequest.ask!(customer: @ama, variant: @red, source: "live")
    assert_no_difference "StockRequest.count" do
      StockRequest.ask!(customer: @ama, variant: @red, source: "manual", quantity: 2)
    end
    request = StockRequest.open.sole
    assert_equal [ "live", 2 ], [ request.source, request.quantity ]

    StockLedger.record!(variant: @red, quantity: 5, reason: "found")
    sell(@ama, @red)
    assert request.reload.closed_at, "fulfilled by the sale"
  end

  test "stock coming back lights up the list, the badge and a notification" do
    StockRequest.ask!(customer: @ama, variant: @red, source: "shop")
    assert_equal 0, StockRequest.to_tell.count

    with_push_keys do
      assert_enqueued_jobs(1, only: PushJob) { StockLedger.record!(variant: @red, quantity: 3, reason: "found") }
    end
    assert_equal "back_in_stock", enqueued_jobs.last["arguments"].first
    assert_equal 1, StockRequest.to_tell.count

    StockRequest.open.sole.told!
    assert_equal 0, StockRequest.to_tell.count
    assert_equal 1, StockRequest.back_in_stock.count
  end

  test "the message names them and the item" do
    request = StockRequest.ask!(customer: @ama, variant: @red, source: "live")
    assert_match "Hi Ama, good news from The Comfy Zone: the Ankara wrap dress in M / Red", request.message
  end

  # ---------- restock advisor ----------

  test "suggests enough for the cover period plus the people waiting" do
    sell(@ama, @black, 8, at: 10.days.ago) # 8 in 60 days ≈ 0.93 a week
    StockRequest.ask!(customer: customers(:kofi), variant: @red, source: "live", quantity: 2)

    advisor = RestockAdvisor.new(days: 60, cover_weeks: 4)
    black = advisor.rows.find { |row| row.variant == @black }
    red = advisor.rows.find { |row| row.variant == @red }

    assert_equal [ 8, 12, 0 ], [ black.sold, black.on_hand, black.suggest ], "12 left covers 4 weeks"
    assert_equal [ 2, 2 ], [ red.waiting, red.suggest ]
    assert_equal @red, advisor.buy.first.variant, "people waiting come first"

    tight = RestockAdvisor.new(days: 30, cover_weeks: 8).rows.find { |row| row.variant == @black }
    assert tight.suggest.positive?, "a shorter window shows a faster pace"
  end

  test "slow movers are on the shelf with no sales; best options count sold units" do
    @black.update_columns(created_at: 100.days.ago)
    advisor = RestockAdvisor.new(days: 60)
    assert_equal [ @black ], advisor.slow.map(&:variant)
    assert_equal 20 * 5000, advisor.slow.first.tied_pesewas

    sell(@ama, @black, 3)
    assert_empty RestockAdvisor.new(days: 60).slow.map(&:variant) & [ @black ]
    assert_equal [ [ "M", 3 ] ], RestockAdvisor.new(days: 60).best_options["Size"]
  end

  # ---------- profit ----------

  test "profit and margin per product, and per live after its own costs" do
    live = LiveSession.create!(user: users(:one), started_at: 1.hour.ago, sales_channel: sales_channels(:tiktok))
    taker = OrderTaker.new(customer: @ama, user: users(:one), live_session: live, lines: [ { variant_id: @black.id, quantity: 2 } ])
    assert taker.save
    Expense.create!(spent_on: Date.current, category: "Data and airtime", amount: "20", user: users(:one), live_session: live)

    report = SalesReport.new(ReportPeriod.preset("today"))
    product = report.product_profit.find { |row| row[:id] == @black.product_id }
    assert_equal [ 24_000, 10_000, 14_000, 58 ], product.values_at(:sales_pesewas, :cost_pesewas, :profit_pesewas, :margin)

    row = report.lives.find { |entry| entry[:id] == live.id }
    assert_equal [ 24_000, 10_000, 2000, 12_000 ], row.values_at(:sales_pesewas, :cost_pesewas, :expenses_pesewas, :profit_pesewas)
  end

  private
    def with_push_keys
      was = ENV.values_at("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY")
      ENV["VAPID_PUBLIC_KEY"], ENV["VAPID_PRIVATE_KEY"] = "public", "private"
      yield
    ensure
      ENV["VAPID_PUBLIC_KEY"], ENV["VAPID_PRIVATE_KEY"] = was
    end
end
