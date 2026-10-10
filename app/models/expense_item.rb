# One line of a supplies expense: "500 polymer bags at GH₵ 0.20 each".
class ExpenseItem < ApplicationRecord
  include HasMoney

  belongs_to :expense, inverse_of: :items

  money :unit_cost

  normalizes :name, with: ->(text) { text.to_s.squish }

  validates :name, presence: true, length: { maximum: 60 }
  validates :quantity, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 1_000_000 }
  # (An empty or unreadable price box is already caught by `money` above.)
  validates :unit_cost_pesewas, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  def total_pesewas
    quantity.to_i * unit_cost_pesewas.to_i
  end

  # Every item name she has bought before, with what she paid the LAST time
  # and from whom. It feeds the suggestions in the form, so buying polymer
  # bags again shows "last time GH₵ 0.20 each, from Auntie Ama".
  #
  # DISTINCT ON (lower(name)) is Postgres for "one row per name": with the
  # ORDER BY, the row kept for each name is the newest one.
  def self.last_prices(limit: 200)
    joins(:expense)
      .left_joins(expense: :supplier)
      .select("DISTINCT ON (lower(expense_items.name)) expense_items.name, expense_items.unit_cost_pesewas, " \
              "expenses.spent_on, expenses.category, suppliers.id AS supplier_id, suppliers.name AS supplier_name")
      .order(Arel.sql("lower(expense_items.name), expenses.spent_on DESC, expense_items.id DESC"))
      .limit(limit)
      .map { |row|
        { name: row.name, unit_cost_pesewas: row.unit_cost_pesewas, on: row.spent_on.strftime("%-d %b %Y"),
          category: row.category, supplier_id: row.supplier_id, supplier: row.supplier_name }
      }
  end
end
