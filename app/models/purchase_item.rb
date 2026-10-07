# One line of a purchase: a quantity of one variant at a unit cost.
class PurchaseItem < ApplicationRecord
  include HasMoney

  belongs_to :purchase
  belongs_to :variant

  money :unit_cost

  validates :quantity, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 100_000 }
  validates :variant_id, uniqueness: { scope: :purchase_id, message: "is on this purchase twice" }

  # "12.50" dollars at 15.5 cedis each: keeps the 1250 cents, and sets the
  # cedi cost the rest of the app runs on (19375 pesewas).
  #
  # The rate is a BigDecimal, the cents an Integer, so the multiplication is
  # exact; only the final step rounds, to the nearest pesewa.
  def price_in_foreign(input, rate:)
    minor = Pesewas.parse(input)

    if minor == Pesewas::INVALID
      @bad_foreign_cost = true
    elsif minor && rate.to_d.positive?
      self.foreign_unit_cost_minor = minor
      self.unit_cost_pesewas = (minor * rate.to_d).round
    else
      # No cost typed, or no rate yet: keep what we can, and let the
      # validations (here and on the purchase) say what is missing.
      self.foreign_unit_cost_minor = minor
      self.unit_cost_pesewas = minor && 0
    end
  end

  def foreign_unit_cost
    Pesewas.to_input(foreign_unit_cost_minor)
  end

  validate do
    errors.add(:foreign_unit_cost, "isn't a valid amount. Use numbers like 120 or 120.50") if @bad_foreign_cost
  end

  # What the supplier charged for this line.
  def goods_total_pesewas
    quantity.to_i * unit_cost_pesewas.to_i
  end

  # Cost of one unit including its share of extra costs, once received.
  def landed_unit_cost_pesewas
    landed_total_pesewas && (landed_total_pesewas.to_r / quantity).round
  end
end
