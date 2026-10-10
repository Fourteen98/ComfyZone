require "test_helper"

# Supplies bought item by item: the expense adds itself up.
class ExpenseItemTest < ActiveSupport::TestCase
  def supplies(lines:, delivery_fee: "", **attributes)
    Expense.new({ user: users(:one), spent_on: Date.current, category: "Packaging", delivery_fee: delivery_fee }.merge(attributes)).tap { |expense|
      expense.lines = lines
    }
  end

  test "the amount is the lines plus delivery, and blank rows are skipped" do
    expense = supplies(delivery_fee: "15", supplier: suppliers(:kumasi), lines: [
      { name: " Polymer   bags ", quantity: "500", unit_cost: "0.20" },
      { name: "Delivery stickers", quantity: "1000", unit_cost: "0.05" },
      { name: "", quantity: "", unit_cost: "" }
    ])

    assert expense.save, expense.errors.full_messages.to_sentence
    assert_equal 16_500, expense.reload.amount_pesewas
    assert_equal [ [ "Polymer bags", 500, 20 ], [ "Delivery stickers", 1000, 5 ] ], expense.items.map { |item| [ item.name, item.quantity, item.unit_cost_pesewas ] }
    assert_equal suppliers(:kumasi), expense.supplier
  end

  test "a typed amount is ignored once there are lines" do
    expense = supplies(amount: "999", lines: [ { name: "Tape", quantity: "4", unit_cost: "12" } ])
    assert expense.save
    assert_equal 4_800, expense.amount_pesewas
  end

  test "replacing the lines removes the old ones when saved" do
    expense = supplies(lines: [ { name: "Tape", quantity: "4", unit_cost: "12" } ])
    expense.save!

    expense.update!(lines: [ { name: "Polymer bags", quantity: "100", unit_cost: "0.25" } ])
    assert_equal [ "Polymer bags" ], expense.reload.items.map(&:name)
    assert_equal 2_500, expense.amount_pesewas
    assert_equal 1, ExpenseItem.count
  end

  test "a bad line says which line and which box" do
    expense = supplies(lines: [ { name: "Tape", quantity: "4", unit_cost: "12" }, { name: "Bags", quantity: "0", unit_cost: "" } ])

    assert_not expense.valid?
    assert_includes expense.errors[:"lines.1.quantity"], "must be greater than 0"
    assert_includes expense.errors[:"lines.1.unit_cost"], "can't be blank"
    assert_empty expense.errors[:"lines.0.quantity"]
  end

  test "delivery is only for an expense with items" do
    expense = Expense.new(user: users(:one), spent_on: Date.current, category: "Data", amount: "50", delivery_fee: "10")
    assert_not expense.valid?
    assert expense.errors[:delivery_fee].any?
  end

  test "last prices: one row per item name, the newest, with who sold it" do
    supplies(spent_on: Date.current - 10, lines: [ { name: "Polymer bags", quantity: "100", unit_cost: "0.30" } ]).save!
    supplies(spent_on: Date.current - 1, supplier: suppliers(:kumasi), lines: [ { name: "polymer BAGS", quantity: "500", unit_cost: "0.20" } ]).save!

    prices = ExpenseItem.last_prices
    assert_equal 1, prices.size
    assert_equal [ 20, suppliers(:kumasi).name ], prices.first.values_at(:unit_cost_pesewas, :supplier)
  end
end
