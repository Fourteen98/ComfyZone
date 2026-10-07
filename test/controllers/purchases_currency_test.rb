require "test_helper"

# Purchases paid in another currency (lesson 23).
class PurchasesCurrencyTest < ActionDispatch::IntegrationTest
  setup { sign_in_as(users(:one)) }

  def params(**overrides)
    { purchase: { purchased_on: "2026-10-05", supplier_id: suppliers(:kumasi).id, delivery_method: "delivery",
      transport_cost: "100", currency: "USD", exchange_rate: "15.5",
      items: [ { variant_id: variants(:dress_m_black).id, quantity: 10, unit_cost: "12.50" } ] }.merge(overrides) }
  end

  test "a dollar purchase keeps the dollars and works out the cedis" do
    post purchases_path, params: params

    purchase = Purchase.newest_first.first
    item = purchase.items.first
    assert_equal [ "USD", BigDecimal("15.5") ], [ purchase.currency, purchase.exchange_rate ]
    assert_equal 1250, item.foreign_unit_cost_minor, "$12.50, kept as cents"
    assert_equal 19_375, item.unit_cost_pesewas, "12.50 x 15.5 = GH₵ 193.75"
    assert_equal 12_500, purchase.foreign_goods_total_minor
    assert_equal 193_750 + 10_000, purchase.total_pesewas, "transport is in cedis, on top"

    get purchase_path(purchase)
    assert_equal({ code: "USD", symbol: "$", rate: "15.5", goods_total_minor: 12_500 }.stringify_keys, inertia.props[:purchase][:foreign])

    # The edit form gets back what she typed: dollars, not cedis.
    get edit_purchase_path(purchase)
    form = inertia.props[:purchase]
    assert_equal [ "USD", "15.5", "12.50" ], [ form[:currency], form[:exchange_rate], form[:items].first[:unit_cost] ]
  end

  test "stock is valued in cedis when a foreign purchase arrives" do
    post purchases_path, params: params.merge(receive: true)

    variant = variants(:dress_m_black).reload
    assert_equal 10, variant.stock_on_hand
    assert_equal 20_375, variant.average_cost_pesewas, "(1,937.50 + 100 transport) / 10"
  end

  test "a foreign purchase needs a rate" do
    assert_no_difference "Purchase.count" do
      post purchases_path, params: params(exchange_rate: "")
    end

    purchase = Purchase.new(purchased_on: Date.current, supplier: suppliers(:kumasi), user: users(:one),
      delivery_method: "pickup", currency: "USD", exchange_rate: "0")
    assert_not purchase.save_with_items([ { variant_id: variants(:dress_m_black).id, quantity: 1, unit_cost: "5" } ])
    assert_includes purchase.errors[:exchange_rate].first, "How many cedis"
  end

  test "a cedi purchase ignores a stray rate, and an unknown currency is refused" do
    post purchases_path, params: params(currency: "GHS", exchange_rate: "15.5")
    purchase = Purchase.newest_first.first
    assert_nil purchase.exchange_rate
    assert_equal [ 1250, nil ], purchase.items.pluck(:unit_cost_pesewas, :foreign_unit_cost_minor).first
    assert_nil purchase.foreign_goods_total_minor

    assert_no_difference "Purchase.count" do
      post purchases_path, params: params(currency: "XXX")
    end
  end

  test "switching a purchase back to cedis drops the foreign figures" do
    post purchases_path, params: params
    purchase = Purchase.newest_first.first

    patch purchase_path(purchase), params: params(currency: "GHS", exchange_rate: "",
      items: [ { variant_id: variants(:dress_m_black).id, quantity: 10, unit_cost: "190" } ])

    assert_equal [ "GHS", nil ], [ purchase.reload.currency, purchase.exchange_rate ]
    assert_equal [ [ 19_000, nil ] ], purchase.items.pluck(:unit_cost_pesewas, :foreign_unit_cost_minor)
  end

  test "the form offers the currencies, cedis first" do
    get new_purchase_path
    assert_equal({ code: "GHS", name: "Ghana cedi", symbol: "GH₵" }.stringify_keys, inertia.props[:currencies].first)
  end
end
