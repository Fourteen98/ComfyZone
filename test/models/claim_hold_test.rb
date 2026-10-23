require "test_helper"

# Unpaid claims with a time to pay, and who actually pays.
class ClaimHoldTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  setup do
    @black = variants(:dress_m_black)
    StockLedger.record!(variant: @black, quantity: 5, reason: "purchase", total_cost_pesewas: 30_000)
    @live = LiveSession.create!(user: users(:one))
    sign_in_as(users(:one))
  end

  def claim(buyer: "@ama_k", live: @live, quantity: 1)
    post orders_path, params: { order: { buyer: buyer, live_session_id: live&.id, items: [ { variant_id: @black.id, quantity: quantity } ] } }
    Order.newest_first.first
  end

  def with_push
    ENV["VAPID_PUBLIC_KEY"], ENV["VAPID_PRIVATE_KEY"] = "public", "private"
    yield
  ensure
    ENV.delete("VAPID_PUBLIC_KEY")
    ENV.delete("VAPID_PRIVATE_KEY")
  end

  test "a live claim gets a day to pay; a hand-recorded sale gets none until she turns it on" do
    travel_to Time.zone.local(2026, 10, 23, 20, 0) do
      assert_equal Time.zone.local(2026, 10, 24, 20, 0), claim.hold_until
      assert_nil claim(buyer: "@kofi_b", live: nil).hold_until

      ClaimSetting.current.update!(sale_pay_hours: 6)
      assert_equal Time.zone.local(2026, 10, 24, 2, 0), claim(buyer: "@esi", live: nil).hold_until
    end
  end

  test "a sale paid when recorded has no deadline" do
    ClaimSetting.current.update!(sale_pay_hours: 6)
    post orders_path, params: { order: { buyer: { name: "Abena", phone: "0241112222" }, items: [ { variant_id: @black.id, quantity: 1 } ],
                                         payment: { amount: "all", via: "momo" } } }
    assert_nil Order.newest_first.first.hold_until
  end

  test "she is warned once before the deadline, then it is released: stock back, record shows it" do
    order = claim(quantity: 2)
    assert_equal 3, @black.reload.stock_on_hand

    with_push do
      travel 20.hours do
        assert_no_enqueued_jobs(only: PushJob) { ClaimHoldSweepJob.perform_now } # 4 hours left: not yet
      end
      travel 22.hours do
        assert_enqueued_with(job: PushJob, args: [ "claims", { "title" => "1 claim runs out soon",
          "body" => "Not paid yet, released within 3 hours: Ama Koranteng.", "path" => "/admin/orders?pay=deadline", "tag" => "claims" }, nil ]) do
          ClaimHoldSweepJob.perform_now
        end
        assert_no_enqueued_jobs(only: PushJob) { ClaimHoldSweepJob.perform_now } # once only
      end
      travel 25.hours do
        assert_enqueued_jobs(1, only: PushJob) { ClaimHoldSweepJob.perform_now }
      end
    end

    order.reload
    assert order.cancelled?
    assert_equal "unpaid", order.cancel_reason
    assert_match "Not paid in time", order.note
    assert_equal 5, @black.reload.stock_on_hand
  end

  test "any payment stops the clock" do
    order = claim
    order.record_payment!(amount: "20", via: "momo", by: users(:one))
    travel 2.days do
      ClaimHoldSweepJob.perform_now
    end
    assert order.reload.claimed?
  end

  test "more time, no deadline, or release by hand" do
    order = claim
    travel_to order.hold_until - 1.hour do
      patch order_hold_path(order), params: { hours: 24 }
      assert_in_delta order.hold_until + 24.hours, order.reload.hold_until, 1
      assert_match "has until", flash[:notice]
    end

    delete order_hold_path(order)
    assert_nil order.reload.hold_until
    travel 30.days do
      ClaimHoldSweepJob.perform_now
    end
    assert order.reload.claimed?

    patch order_hold_path(order), params: { hours: 999 }
    assert_equal "Give between 1 hour and 30 days.", flash[:alert]

    patch cancel_order_path(order), params: { reason: "unpaid" }
    assert_match "Released.", flash[:notice]
    assert_equal [ "cancelled", "unpaid" ], order.reload.values_at(:status, :cancel_reason)
  end

  test "the order page offers a WhatsApp reminder for a buyer with a phone" do
    ClaimSetting.current.update!(sale_pay_hours: 24)
    post orders_path, params: { order: { buyer: { name: "Abena", phone: "0241112222" }, items: [ { variant_id: @black.id, quantity: 1 } ] } }
    get order_path(Order.newest_first.first)

    order = inertia.props[:order]
    assert order[:hold][:until].present?
    assert_match %r{\Ahttps://wa\.me/233241112222\?text=Hi%20Abena}, order[:remind_url]
  end

  test "reliability: paid orders against orders released unpaid" do
    customer = customers(:ama)
    good = Customer.reliability([ customer.id ])[customer.id]
    assert_nil good.tone

    3.times { |n| claim(buyer: "@ama_k#{n}") } # other buyers
    first = claim
    first.record_payment!(amount: "120", via: "momo", by: users(:one))
    2.times do
      order = claim
      ClaimHold.release!(order, by: users(:one))
    end

    who = first.customer.reliability
    assert_equal [ 1, 2, "risky", "Didn't pay 2 of 3 orders" ], [ who.paid, who.unpaid, who.tone, who.label ]

    get new_order_path
    listed = inertia.props[:buyers].find { |buyer| buyer[:id] == first.customer_id }
    assert_equal "risky", listed[:reliability][:tone]
  end

  test "the deadline filter lists the soonest first" do
    later = claim(buyer: "@later")
    sooner = claim(buyer: "@sooner")
    sooner.update!(hold_until: 1.hour.from_now)
    get orders_path(pay: "deadline")
    assert_equal [ sooner.id, later.id ], inertia.props[:orders].map { |order| order[:id] }
    assert_equal true, inertia.props[:orders].all? { |order| order[:pay_by].present? }
  end
end
