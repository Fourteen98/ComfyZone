require "test_helper"

class PushTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper

  # Pretend the server has its keys for the length of a block.
  def with_keys
    was = ENV.values_at("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY")
    ENV["VAPID_PUBLIC_KEY"], ENV["VAPID_PRIVATE_KEY"] = "public", "private"
    yield
  ensure
    ENV["VAPID_PUBLIC_KEY"], ENV["VAPID_PRIVATE_KEY"] = was
  end

  def subscribe(user, topics: nil, endpoint: "https://fcm.googleapis.com/fcm/send/#{SecureRandom.hex(4)}")
    subscription = PushSubscription.register!(user: user, endpoint: endpoint, p256dh: "key", auth: "secret", device: "Test phone")
    subscription.update!(topics: topics) if topics
    subscription
  end

  # Swap WebPush.payload_send for a block, for the length of the test.
  def stub_send(replacement)
    original = WebPush.method(:payload_send)
    WebPush.define_singleton_method(:payload_send, &replacement)
    yield
  ensure
    WebPush.define_singleton_method(:payload_send, original)
  end

  test "without keys nothing is queued; with them a job is" do
    assert_no_enqueued_jobs { Push.notify("low_stock", title: "t", body: "b") }

    with_keys do
      assert_enqueued_with(job: PushJob) { Push.notify("low_stock", title: "t", body: "b") }
    end
    assert_raises(ArgumentError) { Push.notify("nonsense", title: "t", body: "b") }
  end

  test "a new device starts with every topic its owner may hear" do
    assert_equal %w[ low_stock orders ], subscribe(users(:one)).topics

    roles(:assistant).update!(permissions: [ "orders.view" ])
    assert_equal %w[ orders ], subscribe(users(:two)).topics
  end

  test "the same phone under a new login moves over instead of doubling up" do
    first = subscribe(users(:one), endpoint: "https://fcm.googleapis.com/fcm/send/phone")
    roles(:assistant).update!(permissions: [ "stock.view" ])

    assert_no_difference "PushSubscription.count" do
      subscribe(users(:two), endpoint: "https://fcm.googleapis.com/fcm/send/phone")
    end
    assert_equal [ users(:two), %w[ low_stock ] ], first.reload.then { |s| [ s.user, s.topics ] }
  end

  test "the audience is whoever wants the topic, may see it, and didn't cause it" do
    owner = subscribe(users(:one))
    muted = subscribe(users(:one), topics: [ "orders" ])
    roles(:assistant).update!(permissions: [ "stock.view" ])
    helper = subscribe(users(:two))

    assert_equal [ owner, helper ].map(&:id).sort, Push.audience("low_stock").map(&:id).sort
    assert_equal [ helper.id ], Push.audience("low_stock", except_user_id: users(:one).id).map(&:id)
    assert_not_includes Push.audience("low_stock"), muted

    # Permission taken away later: the topic is still ticked, but nothing is sent.
    roles(:assistant).update!(permissions: [])
    assert_equal [ owner.id ], Push.audience("low_stock").map(&:id)
  end

  test "the job sends to each device, and forgets one whose address has died" do
    alive, dead = subscribe(users(:one)), subscribe(users(:one))
    sent = []

    stub_send(->(**options) {
      if options[:endpoint] == dead.endpoint
        raise WebPush::ExpiredSubscription.new(Struct.new(:body, :code).new("gone", "410"), "push.example")
      end
      sent << JSON.parse(options[:message])
    }) do
      with_keys { PushJob.perform_now("low_stock", { "title" => "Running low", "body" => "2 left" }) }
    end

    assert_equal [ { "title" => "Running low", "body" => "2 left" } ], sent
    assert alive.reload.last_sent_at
    assert_not PushSubscription.exists?(dead.id)
  end

  test "a push service that is down is logged, not raised" do
    subscription = subscribe(users(:one))

    stub_send(->(**) { raise SocketError, "no network" }) do
      with_keys { assert_equal false, Push.deliver(subscription, {}) }
    end
    assert PushSubscription.exists?(subscription.id)
  end

  # --- what triggers one ---

  test "stock crossing its warning level notifies once, selling out notifies again" do
    variant = variants(:dress_m_black)
    variant.product.update!(low_stock_at: 3)
    StockLedger.record!(variant: variant, quantity: 5, reason: "recount")

    with_keys do
      assert_no_enqueued_jobs { StockLedger.record!(variant: variant, quantity: -1, reason: "recount") } # 4: fine

      assert_enqueued_with(job: PushJob, args: [ "low_stock",
        { "title" => "Running low", "body" => "Ankara wrap dress, M / Black: 3 left.", "path" => "/stock/#{variant.id}", "tag" => "low_stock" }, nil ]) do
        StockLedger.record!(variant: variant, quantity: -1, reason: "recount") # 3: crossed
      end

      assert_no_enqueued_jobs(only: PushJob) { StockLedger.record!(variant: variant, quantity: -1, reason: "recount") } # 2: already low

      assert_enqueued_jobs(1, only: PushJob) { StockLedger.record!(variant: variant, quantity: -2, reason: "recount") } # 0
      assert_equal "Sold out", enqueued_jobs.last["arguments"].second["title"]

      assert_no_enqueued_jobs(only: PushJob) { StockLedger.record!(variant: variant, quantity: 10, reason: "recount") } # going up
    end
  end

  test "a sale that is rolled back says nothing" do
    variant = variants(:dress_m_black)
    StockLedger.record!(variant: variant, quantity: 1, reason: "recount")

    with_keys do
      assert_no_enqueued_jobs(only: PushJob) do
        ActiveRecord::Base.transaction(requires_new: true) do
          StockLedger.record!(variant: variant, quantity: -1, reason: "recount")
          raise ActiveRecord::Rollback
        end
      end
    end
  end

  test "a sale recorded by hand tells the others, a live claim does not" do
    variant = variants(:dress_m_black)
    StockLedger.record!(variant: variant, quantity: 50, reason: "recount")
    customer = Customer.for_claim("ama_k")

    with_keys do
      taker = OrderTaker.new(customer: customer, user: users(:two), lines: [ { variant_id: variant.id, quantity: 1 } ])
      assert_enqueued_jobs(1, only: PushJob) { assert taker.save }
      topic, payload, except = enqueued_jobs.last["arguments"]
      assert_equal [ "orders", "New sale", "/orders/#{taker.order.id}", users(:two).id ], [ topic, payload["title"], payload["path"], except ]
      assert_match "Ama Koranteng", payload["body"]

      live = LiveSession.create!(user: users(:one), started_at: Time.current, sales_channel: sales_channels(:tiktok))
      claim = OrderTaker.new(customer: customer, user: users(:two), live_session: live, lines: [ { variant_id: variant.id, quantity: 1 } ])
      assert_no_enqueued_jobs(only: PushJob) { assert claim.save }
    end
  end
end
