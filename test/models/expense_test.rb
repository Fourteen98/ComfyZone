require "test_helper"

class ExpenseTest < ActiveSupport::TestCase
  setup { travel_to Time.zone.local(2026, 10, 7, 15, 0) }

  def expense(**attributes)
    Expense.new({ user: users(:one), spent_on: Date.current, category: "Packaging", amount: "45.50" }.merge(attributes))
  end

  test "saves with a date, a category and an amount" do
    record = expense(category: "  Data   and airtime ", note: " MTN bundle ")

    assert record.save
    assert_equal [ 4_550, "Data and airtime", "MTN bundle", nil ], record.values_at(:amount_pesewas, :category, :note, :paid_via)
  end

  test "needs each of them, and a real amount" do
    assert_not expense(category: " ").valid?
    assert_not expense(spent_on: nil).valid?
    assert_includes expense(amount: "").tap(&:valid?).errors[:amount], "can't be blank"
    assert_includes expense(amount: "0").tap(&:valid?).errors[:amount], "must be more than zero"
    assert expense(amount: "lots").tap(&:valid?).errors[:amount].any?
  end

  test "can't be dated in the future, or paid in an unknown way" do
    assert_not expense(spent_on: Date.current + 1).valid?
    assert_not expense(paid_via: "cheque").valid?
    assert expense(paid_via: "momo").valid?
  end

  test "the database refuses a zero amount" do
    record = expense
    record.save!

    assert_raises(ActiveRecord::StatementInvalid) { record.update_column(:amount_pesewas, 0) }
  end

  test "during a period, by category, biggest first" do
    expense(amount: "20").save!
    expense(amount: "30", spent_on: Date.current - 1).save!
    expense(category: "Rent", amount: "400").save!
    expense(category: "Rent", amount: "400", spent_on: Date.current - 40).save! # outside

    month = ReportPeriod.preset("month")

    assert_equal 45_000, Expense.during(month).sum(:amount_pesewas)
    assert_equal [ [ "Rent", 40_000 ], [ "Packaging", 5_000 ] ], Expense.during(month).by_category
  end

  test "categories offered: hers first, most used first, then the suggestions" do
    2.times { expense(category: "Tailor").save! }
    expense(category: "Rent").save!

    assert_equal [ "Tailor", "Rent", "Packaging" ], Expense.categories.first(3)
    assert_equal 1, Expense.categories.count("Rent")
  end
end
