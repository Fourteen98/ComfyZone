# One line of an order. Price and cost are snapshots: see the migration.
class OrderItem < ApplicationRecord
  belongs_to :order
  belongs_to :variant

  validates :quantity, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 10_000 }

  def total_pesewas
    quantity * unit_price_pesewas
  end

  def cost_pesewas
    quantity * unit_cost_pesewas
  end
end
