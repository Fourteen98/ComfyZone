require "test_helper"

# Where a sale came from, and buyers who are not usernames.
class Orders::ChannelsTest < ActionDispatch::IntegrationTest
  setup do
    @black = variants(:dress_m_black)
    StockLedger.record!(variant: @black, quantity: 5, reason: "purchase", total_cost_pesewas: 30_000)
    sign_in_as(users(:one))
  end

  def sale(buyer:, channel: nil, live: nil)
    post orders_path, params: { order: { buyer: buyer, sales_channel_id: channel&.id, live_session_id: live&.id,
                                         items: [ { variant_id: @black.id, quantity: 1 } ] } }
    Order.newest_first.first
  end

  test "a WhatsApp sale to someone known only by name and number" do
    assert_difference "Customer.count", 1 do
      order = sale(buyer: { name: "Mrs Mensah", phone: "020 111 2222" }, channel: sales_channels(:whatsapp))

      assert_equal sales_channels(:whatsapp), order.sales_channel
      assert_equal [ nil, "Mrs Mensah", "+233201112222" ], order.customer.values_at(:handle, :name, :phone)
    end
  end

  test "a sale to a customer picked from the list makes no new customer" do
    assert_no_difference "Customer.count" do
      order = sale(buyer: { id: customers(:ama).id }, channel: sales_channels(:instagram))

      assert_equal customers(:ama), order.customer
    end
  end

  test "the same phone number is the same customer" do
    sale(buyer: { name: "Mrs Mensah", phone: "020 111 2222" })

    assert_no_difference "Customer.count" do
      sale(buyer: { name: "Mensah", phone: "0201112222" })
    end
  end

  test "a sale with nobody named is refused" do
    assert_no_difference "Order.count" do
      sale(buyer: { name: " ", phone: "", handle: "" })
    end
    follow_redirect!
    assert_includes inertia.props[:errors][:customer].first, "Say who is buying"
  end

  test "the channel can be left out, and a hidden one is ignored" do
    assert_nil sale(buyer: { name: "Walk-in lady" }).sales_channel
    assert_nil sale(buyer: { name: "Another" }, channel: sales_channels(:retired)).sales_channel
  end

  test "a claim during a live takes the live's channel, whatever was sent" do
    post live_index_path, params: { live: { title: "IG night", sales_channel_id: sales_channels(:instagram).id } }
    live = LiveSession.current
    assert_equal sales_channels(:instagram), live.sales_channel

    order = sale(buyer: "@ama_k", channel: sales_channels(:whatsapp), live: live)

    assert_equal sales_channels(:instagram), order.sales_channel
  end

  test "a live can't be started on a channel without usernames" do
    post live_index_path, params: { live: { sales_channel_id: sales_channels(:whatsapp).id } }

    assert_equal sales_channels(:tiktok), LiveSession.current.sales_channel
  end

  test "pages carry the channels they need" do
    get new_order_path
    assert_equal %w[ TikTok WhatsApp Instagram ], inertia.props[:channels].pluck(:name)

    get live_index_path
    assert_equal %w[ TikTok Instagram ], inertia.props[:channels].pluck(:name)
    assert_equal sales_channels(:tiktok).id, inertia.props[:default_channel_id]

    order = sale(buyer: { name: "Mrs Mensah" }, channel: sales_channels(:whatsapp))
    get order_path(order)
    assert_equal "WhatsApp", inertia.props[:order][:channel]
  end
end
