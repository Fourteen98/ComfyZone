require "test_helper"

class SalesChannelTest < ActiveSupport::TestCase
  test "needs a name that isn't already used, whatever the capitals" do
    assert_not SalesChannel.new(name: "", kind: "social").valid?
    assert_not SalesChannel.new(name: "tiktok", kind: "social").valid?
    assert SalesChannel.new(name: "Jumia", kind: "direct").valid?
  end

  test "needs to know how buyers are identified" do
    channel = SalesChannel.new(name: "Jumia", kind: "carrier pigeon")

    assert_not channel.valid?
    assert channel.errors[:kind].any?
  end

  test "the database also refuses a duplicate name and an unknown kind" do
    assert_raises(ActiveRecord::RecordNotUnique) { SalesChannel.new(name: "TIKTOK", kind: "social").save!(validate: false) }
    assert_raises(ActiveRecord::StatementInvalid) { sales_channels(:tiktok).update_column(:kind, "other") }
  end

  test "a new channel goes last, and can be moved" do
    channel = SalesChannel.create!(name: "Jumia", kind: "direct")
    assert_equal "Jumia", SalesChannel.ordered.last.name

    channel.move(:up)
    assert_equal [ "Jumia", "Market stall" ], SalesChannel.ordered.last(2).map(&:name)
  end

  test "deleting a channel keeps its orders and lives" do
    owner = users(:one)
    variant = variants(:dress_m_black)
    StockLedger.record!(variant: variant, quantity: 2, reason: "purchase", total_cost_pesewas: 10_000)
    live = LiveSession.create!(user: owner, sales_channel: sales_channels(:tiktok))
    taker = OrderTaker.new(customer: Customer.for_claim("@ama_k"), user: owner, live_session: live, lines: [ { variant_id: variant.id, quantity: 1 } ])
    taker.save

    # delete_all skips Rails, so this proves the database rule by itself.
    SalesChannel.where(id: sales_channels(:tiktok).id).delete_all

    assert_nil taker.order.reload.sales_channel_id
    assert_nil live.reload.sales_channel_id
  end

  test "a live starts on the channel the last live used, else the first social one" do
    assert_equal sales_channels(:tiktok), SalesChannel.default_for_live

    LiveSession.create!(user: users(:one), sales_channel: sales_channels(:instagram)).finish!
    assert_equal sales_channels(:instagram), SalesChannel.default_for_live
  end
end
