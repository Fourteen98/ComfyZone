# One line of an order. Price and cost are snapshots: see the migration.
class OrderItem < ApplicationRecord
  belongs_to :order
  belongs_to :variant

  validates :quantity, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 10_000 }
  validates :returned_quantity, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate { errors.add(:returned_quantity, "can't be more than was sold") if returned_quantity.to_i > quantity.to_i }

  # How many of these still count as sold: what was sold, less what came back.
  def kept
    quantity - returned_quantity
  end

  def total_pesewas
    kept * unit_price_pesewas
  end

  def cost_pesewas
    kept * unit_cost_pesewas
  end
end
