# One movement of money for an order: a payment in, or a refund out.
#
# Payments are not created with Payment.create. They come from
# Order#record_payment! and Order#refund!, which also keep the order's
# running total (paid_pesewas) and its stage in step.
class Payment < ApplicationRecord
  include HasMoney

  belongs_to :order
  belongs_to :user

  money :amount

  normalizes :reference, :note, with: ->(text) { text.to_s.squish.presence }

  # One of the methods in Settings > Payment methods (hidden ones included,
  # so old payments stay valid).
  validates :via, inclusion: { in: ->(_) { PaymentMethod.keys }, message: "is needed. How did the money move?" }
  # On :amount (what the form field is called), not :amount_pesewas, so the
  # message lands under the right box.
  validate { errors.add(:amount, "must be more than zero") if amount_pesewas == 0 }
  validates :reference, :note, length: { maximum: 120 }

  scope :oldest_first, -> { order(:created_at, :id) }

  def refund?
    amount_pesewas.negative?
  end

  # A ledger row is a fact. To correct a mistake, record the opposite.
  def readonly?
    persisted?
  end
end
