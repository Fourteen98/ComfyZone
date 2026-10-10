require "test_helper"

# The Ankara dress: normally GH₵ 120 (the L / Red is GH₵ 140), bulk GH₵ 100
# from 3 pieces of any size or colour.
class BulkPricingTest < ActiveSupport::TestCase
  setup do
    @owner = users(:one)
    @dress = products(:dress)
    @dress.update!(bulk_price: "100", bulk_min_quantity: 3)
    @black = variants(:dress_m_black)
    @red = variants(:dress_l_red)
    StockLedger.record!(variant: @black, quantity: 10, reason: "purchase", total_cost_pesewas: 60_000)
    StockLedger.record!(variant: @red, quantity: 10, reason: "purchase", total_cost_pesewas: 80_000)
    @live = LiveSession.create!(user: @owner)
  end

  def claim(lines, buyer: "@ama_k", **options)
    taker = OrderTaker.new(customer: Customer.for_claim(buyer), user: @owner, live_session: @live, lines: lines, **options)
    assert taker.save, taker.errors.full_messages.to_sentence
    taker.order
  end

  def prices(order)
    order.items.reload.sort_by(&:id).map { |item| [ item.unit_price_pesewas, item.bulk ] }
  end

  test "below the count, normal prices" do
    order = claim([ { variant_id: @black.id, quantity: 2 } ])
    assert_equal [ [ 12_000, false ] ], prices(order)
  end

  test "reaching the count across sizes and colours, later in the live, drops every line" do
    claim([ { variant_id: @black.id, quantity: 2 } ])
    order = claim([ { variant_id: @red.id, quantity: 1 } ])

    assert_equal [ [ 10_000, true ], [ 10_000, true ] ], prices(order)
    assert_equal 30_000, order.reload.total_pesewas
  end

  test "a bulk buyer gets it from one piece" do
    customers(:ama).update!(bulk_buyer: true)
    order = claim([ { variant_id: @black.id, quantity: 1 } ])
    assert_equal [ [ 10_000, true ] ], prices(order)
  end

  test "a price typed by hand is left alone; taking pieces off raises the rest back" do
    order = claim([ { variant_id: @black.id, quantity: 2 }, { variant_id: @red.id, quantity: 1 } ])
    assert_equal 30_000, order.total_pesewas

    # A special deal on the red one, and one black dropped: below the count again.
    editor = OrderEditor.new(order: order, user: @owner, sales_channel: order.sales_channel, note: "",
                             lines: [ { variant_id: @black.id, quantity: 1, price: "100" }, { variant_id: @red.id, quantity: 1, price: "90" } ])
    assert editor.save, editor.errors.full_messages.to_sentence

    assert_equal [ [ 12_000, false ], [ 9_000, false ] ], prices(order)
    assert_equal 21_000, order.reload.total_pesewas
  end

  test "the website gives it by count only when she offers it there" do
    shopper = Customer.new(name: "Efua", phone: "0201112222")
    taker = OrderTaker.new(customer: shopper, lines: [ { variant_id: @black.id, quantity: 3 } ], shop: true)
    products(:dress).update!(listed: true)
    assert taker.save, taker.errors.full_messages.to_sentence
    assert_equal [ [ 12_000, false ] ], prices(taker.order)

    @dress.update!(bulk_on_shop: true)
    taker = OrderTaker.new(customer: Customer.new(name: "Esi", phone: "0203334444"), lines: [ { variant_id: @black.id, quantity: 3 } ], shop: true)
    assert taker.save
    assert_equal [ [ 10_000, true ] ], prices(taker.order)
  end

  test "the cart shows the bulk price once the bag has enough, when offered online" do
    @dress.update!(listed: true, bulk_on_shop: true)
    session = {}
    cart = Cart.new(session)
    cart.add(@black.id, 2)
    assert_equal [ 12_000 ], cart.lines.map(&:unit_price_pesewas)

    cart = Cart.new(session)
    cart.add(@red.id, 1)
    assert_equal [ 10_000, 10_000 ], cart.lines.map(&:unit_price_pesewas)
    assert_equal 30_000, cart.total_pesewas
  end

  test "a product's bulk price needs both boxes, and must be below the normal price" do
    product = products(:dress)
    product.assign_attributes(bulk_price: "100", bulk_min_quantity: nil)
    assert product.errors.empty? && !product.valid?
    assert product.errors[:bulk_min_quantity].any?

    product.assign_attributes(bulk_price: "130", bulk_min_quantity: 3)
    assert_not product.valid?
    assert product.errors[:bulk_price].any?

    product.assign_attributes(bulk_price: nil, bulk_min_quantity: nil)
    assert product.valid?
    assert_not product.bulk?
  end
end
