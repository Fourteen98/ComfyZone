require "test_helper"

# A customer buying on WhatsApp, message by message.
# The Ankara dress: M/Black 3, L/Red 1 (GH₵ 140); other sizes none.
class Whatsapp::BotTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper

  setup do
    @setting = WhatsappSetting.current
    @setting.update!(enabled: true, hold_minutes: 10, momo_number: "024 111 2222", momo_name: "Fazila", momo_network: "MTN")
    @black = variants(:dress_m_black)
    @red = variants(:dress_l_red)
    StockLedger.record!(variant: @black, quantity: 3, reason: "purchase", total_cost_pesewas: 18_000)
    StockLedger.record!(variant: @red, quantity: 1, reason: "purchase", total_cost_pesewas: 8_000)
    @chat = WhatsappConversation.for("+233241112233", name: "Esi Owusu")
  end

  def say(input)
    input = { "text" => input } if input.is_a?(String)
    Whatsapp::Bot.new(@chat.reload).handle(input)
    @chat.reload
  end

  def last = @chat.messages.outbound.last

  # The ids of the buttons or rows the bot offered last.
  def offered
    interactive = last.payload["interactive"] || {}
    (interactive.dig("action", "buttons") || []).map { |button| button.dig("reply", "id") } +
      (interactive.dig("action", "sections", 0, "rows") || []).map { |row| row["id"] }
  end

  def reserve_one(variant_pick: :first)
    say("id" => "product:#{@black.product_id}")
    say("id" => offered.public_send(variant_pick))
    say("id" => "qty:1")
    say("id" => "reserve")
    Order.last
  end

  test "hello: a menu with three choices" do
    say("Good morning")
    assert_match "Hi Esi!", last.body
    assert_equal %w[ browse my_order human ], offered
    assert_equal "simulated", last.status # not connected in tests: nothing leaves the server
  end

  test "browse, choose colour and size from what's in stock, reserve, pay" do
    say("hi")
    say("id" => "browse")
    assert_includes offered, "product:#{@black.product_id}"

    say("id" => "product:#{@black.product_id}")
    assert_match "Which colour?", last.body
    assert_equal 2, offered.size # Black and Red: only colours with stock

    say("id" => offered.first) # Black: only M has stock, so size is chosen for them
    assert_match "M / Black", last.body
    assert_equal %w[ qty:1 qty:2 qty:3 ], offered

    say("id" => "qty:2")
    assert_match "2 × Ankara wrap dress, M / Black = GH₵ 240", last.body

    travel_to Time.zone.local(2026, 10, 14, 12, 0) do
      assert_difference -> { Order.count } => 1 do
        say("id" => "reserve")
      end
      order = Order.last
      assert_equal [ "claimed", "WhatsApp", 24_000, @chat ], [ order.status, order.sales_channel.name, order.total_pesewas, order.whatsapp_conversation ]
      assert_equal Time.zone.local(2026, 10, 14, 12, 10), order.hold_until
      assert_equal [ "+233241112233", "Esi Owusu" ], [ order.customer.phone, order.customer.name ]
      assert_equal 1, @black.reload.stock_on_hand # the stock is taken
      assert_match "MoMo 024 111 2222 (MTN), name: Fazila", last.body
      assert_match "Reference: *#{order.id}*", last.body
      assert_equal 2, enqueued_jobs.count { |job| job["job_class"] == "WhatsappHoldJob" } # reminder + expiry

      say("Sent it. ID 5412398765")
      assert_equal "5412398765", order.reload.payment_claim
      assert order.payment_claimed_at
      assert_match "Fazy will check", last.body
    end
  end

  test "typing what you want: the search fills in what was said" do
    say("do you have the red dress?")
    assert_match "L / Red", last.body # only one red in stock: straight to how many
    assert_equal %w[ qty:1 ], offered

    say("5") # more than there is
    assert_match "Only 1 more", @chat.messages.outbound.second_to_last.body

    say("kaftan purple")
    assert_match "couldn't find", last.body
  end

  test "an unpaid reservation is reminded, then released" do
    order = reserve_one

    travel 8.minutes do
      WhatsappHoldJob.perform_now(order.id, "remind")
      assert_match "minutes left to pay for order ##{order.id}", last.body
    end
    travel 11.minutes do
      WhatsappHoldSweepJob.perform_now
      assert order.reload.cancelled?
      assert_equal 3, @black.reload.stock_on_hand # back on sale
      assert_match "wasn't paid in time", last.body
    end
  end

  test "saying you paid stops the clock; a payment recorded later thanks them" do
    order = reserve_one
    say("id" => "paid")

    travel 30.minutes do
      WhatsappHoldSweepJob.perform_now
      assert order.reload.claimed? # not released: she checks the payment
    end

    @chat.update!(last_inbound_at: Time.current) # they wrote recently, so we may reply freely
    perform_enqueued_jobs(only: WhatsappNoticeJob) do
      order.record_payment!(amount: "120", via: "momo", by: users(:one))
    end
    assert_match "Payment received for order ##{order.id}", last.body
  end

  test "cancel, and talking to Fazy quiets the bot" do
    order = reserve_one(variant_pick: :last)
    assert_equal 0, @red.reload.stock_on_hand
    say("id" => "cancel_order")
    assert order.reload.cancelled?
    assert_equal 1, @red.reload.stock_on_hand

    say("i want to talk to someone")
    assert @chat.handed_off?
    assert_match "Fazy will reply", last.body
    assert_no_difference -> { @chat.messages.outbound.count } do
      say("hello?") # she is replying now; the bot says nothing
    end
  end

  test "switched off, or a sandbox chat: nothing real happens" do
    @setting.update!(enabled: false)
    say("hi")
    assert_match "isn't open right now", last.body

    @setting.update!(enabled: true)
    @chat = WhatsappConversation.for("+233000000000", sandbox: true)
    assert_no_difference -> { Order.count } do
      reserve_one
    end
    assert_match "This is a test", last.body
    assert_equal 3, @black.reload.stock_on_hand
  end

  test "'delete my data' goes to a person, as the privacy policy promises" do
    say("Please delete my data")
    assert @chat.handed_off?
    assert_match "request to delete your data", last.body
  end
end
