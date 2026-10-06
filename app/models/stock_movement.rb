# One row of the stock ledger. Created only through StockLedger, and never
# changed afterwards.
class StockMovement < ApplicationRecord
  # Why stock changed. The first three come from the normal flow of goods;
  # the rest are corrections made by hand (see StockAdjustment).
  FLOW = %w[ purchase sale cancellation return ].freeze
  ADJUSTMENTS = %w[ recount damaged lost personal found ].freeze
  REASONS = (FLOW + ADJUSTMENTS).freeze

  belongs_to :variant
  belongs_to :user, optional: true
  # Whatever caused the movement: a Purchase today, an Order later.
  belongs_to :source, polymorphic: true, optional: true

  validates :quantity, numericality: { only_integer: true, other_than: 0 }
  validates :reason, inclusion: { in: REASONS }

  scope :newest_first, -> { order(created_at: :desc, id: :desc) }

  # Rails asks this before every update or delete. Answering "yes" once the
  # row is saved makes the ledger append-only: `update` and `destroy` raise
  # ActiveRecord::ReadOnlyRecord.
  def readonly?
    persisted?
  end
end
