# A correction to stock made by hand: a recount, damage, loss, and so on.
#
# This is a "form object". It is not a database table (there is no
# stock_adjustments table); an adjustment IS just a stock movement. But the
# form has rules and fields of its own (a counted total, a direction that
# depends on the reason), so it gets a class that behaves like a model for
# as long as the request lasts:
#
#   adjustment = StockAdjustment.new(variant: v, reason: "damaged", quantity: "2", user: u)
#   adjustment.save     # => true, or false with adjustment.errors filled in
#
# Including ActiveModel::Model gives it validations, errors and
# attribute assignment, without Active Record.
class StockAdjustment
  include ActiveModel::Model

  # What each reason does to the count.
  #   :set  the number she typed is the new total ("I counted 7")
  #   :out  the number she typed is taken away
  #   :in   the number she typed is added
  DIRECTIONS = {
    "recount"  => :set,
    "damaged"  => :out,
    "lost"     => :out,
    "personal" => :out,
    "found"    => :in
  }.freeze

  attr_accessor :variant, :user, :reason, :quantity, :note

  validates :reason, inclusion: { in: DIRECTIONS.keys, message: "is needed. Say why the count is changing" }
  validates :quantity, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 100_000,
    message: "must be a whole number" }
  validates :note, length: { maximum: 200 }

  # Records the adjustment. Returns false (with errors) if it can't be done.
  def save
    return false unless valid?

    saved = false
    # Lock first, THEN work out the change. The difference between "what she
    # counted" and "what the app thinks" must be taken from the latest
    # number, not one read a moment ago that a sale may have changed since.
    variant.with_lock do
      change = change_for(variant.stock_on_hand)

      if change.zero?
        errors.add(:quantity, direction == :set ? "is what the app already shows, so nothing changed" : "must be more than zero")
      elsif variant.stock_on_hand + change < 0
        errors.add(:quantity, "is more than the #{variant.stock_on_hand} in stock")
      else
        StockLedger.record!(variant: variant, quantity: change, reason: reason, user: user, note: note.to_s.squish.presence)
        saved = true
      end
    end

    saved
  end

  private
    def direction
      DIRECTIONS[reason]
    end

    def change_for(on_hand)
      amount = quantity.to_i

      case direction
      when :set then amount - on_hand
      when :out then -amount
      when :in  then amount
      end
    end
end
