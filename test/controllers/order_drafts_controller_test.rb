require "test_helper"

class OrderDraftsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @black = variants(:dress_m_black)
    StockLedger.record!(variant: @black, quantity: 5, reason: "purchase", total_cost_pesewas: 30_000)
  end

  def payload(quantity: 2)
    { channelId: "", choice: { buyer: { name: "Abena", phone: "0244556677", handle: "" }, label: "Abena" },
      basket: { @black.id.to_s => quantity }, agreed: {}, pay: { when: "", amount: "", via: "", reference: "" } }
  end

  test "saves a draft without touching stock, then shows it on Record a sale" do
    sign_in_as(users(:one))

    assert_difference -> { OrderDraft.count } => 1, -> { StockMovement.count } => 0 do
      post order_drafts_path, params: { draft: { label: "Abena: 2 items, GH₵ 240", payload: payload } }
    end
    assert_redirected_to orders_path
    assert_equal 5, @black.reload.stock_on_hand

    draft = OrderDraft.last
    get new_order_path
    assert_equal [ "Abena: 2 items, GH₵ 240" ], inertia.props[:drafts].map { |entry| entry[:label] }
    assert_nil inertia.props[:draft]

    get new_order_path(draft: draft.id)
    assert_equal({ @black.id.to_s => "2" }, inertia.props[:draft][:payload]["basket"])

    get orders_path
    assert_equal 1, inertia.props[:drafts]
  end

  test "recording the sale from a draft deletes the draft" do
    sign_in_as(users(:one))
    draft = OrderDraft.create!(user: users(:one), label: "Abena", payload: payload)

    post orders_path, params: { order: { buyer: { name: "Abena", phone: "0244556677" }, draft_id: draft.id,
                                         items: [ { variant_id: @black.id, quantity: 2 } ] } }
    assert_not OrderDraft.exists?(draft.id)
    assert_equal 3, @black.reload.stock_on_hand
  end

  test "updates and deletes; needs orders.create; refuses junk" do
    draft = OrderDraft.create!(user: users(:one), label: "Abena", payload: payload)
    sign_in_as(users(:one))

    patch order_draft_path(draft), params: { draft: { label: "Abena: 4 items", payload: payload(quantity: 4) } }
    assert_equal [ "Abena: 4 items", "4" ], [ draft.reload.label, draft.payload["basket"][@black.id.to_s] ]

    # Keys a sale screen never sends are dropped...
    post order_drafts_path, params: { draft: { label: "odd", payload: payload.merge(admin: true) } }
    assert_not OrderDraft.last.payload.key?("admin")
    # ...and an allowed key stuffed with junk is refused.
    post order_drafts_path, params: { draft: { label: "big", payload: payload.merge(channelId: "x" * 25_000) } }
    assert_match "too big", flash[:alert]

    delete order_draft_path(draft)
    assert_not OrderDraft.exists?(draft.id)
    OrderDraft.delete_all

    roles(:assistant).update!(permissions: %w[ orders.view ])
    sign_in_as(users(:two))
    post order_drafts_path, params: { draft: { label: "x", payload: payload } }
    assert_equal 0, OrderDraft.count
  end
end
