# One line of a purchase: a quantity of one variant at a unit cost.
class PurchaseItem < ApplicationRecord
  include HasMoney

  belongs_to :purchase
  belongs_to :variant

  money :unit_cost

  validates :quantity, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 100_000 }
  validates :variant_id, uniqueness: { scope: :purchase_id, message: "is on this purchase twice" }

  # What the supplier charged for this line.
  def goods_total_pesewas
    quantity.to_i * unit_cost_pesewas.to_i
  end

  # Cost of one unit including its share of extra costs, once received.
  def landed_unit_cost_pesewas
    landed_total_pesewas && (landed_total_pesewas.to_r / quantity).round
  end
end
