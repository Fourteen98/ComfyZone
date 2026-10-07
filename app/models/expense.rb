# Something the business paid for that isn't stock.
class Expense < ApplicationRecord
  include HasMoney

  # Offered before she has typed any of her own.
  SUGGESTED = [ "Packaging", "Riders and delivery", "Data and airtime", "Advertising", "Rent", "Wages", "Equipment", "Other" ].freeze

  belongs_to :user

  money :amount

  normalizes :category, with: ->(text) { text.to_s.squish }
  normalizes :note, with: ->(text) { text.to_s.squish.presence }

  validates :spent_on, presence: true
  validates :category, presence: true, length: { maximum: 40 }
  validates :note, length: { maximum: 200 }
  validates :paid_via, inclusion: { in: ->(_) { PaymentMethod.keys } }, allow_nil: true
  validate { errors.add(:amount, "must be more than zero") if amount_pesewas && amount_pesewas <= 0 }
  validate { errors.add(:spent_on, "can't be in the future") if spent_on && spent_on > Date.current }

  scope :newest_first, -> { order(spent_on: :desc, id: :desc) }
  scope :during, ->(period) { where(spent_on: period.from..period.to) }

  # Every category she has used, then the suggestions she hasn't.
  def self.categories
    used = group(:category).order(Arel.sql("COUNT(*) DESC")).pluck(:category)
    used + (SUGGESTED - used)
  end

  # "Packaging" => 4500, biggest first.
  def self.by_category
    group(:category).sum(:amount_pesewas).sort_by { |_, amount| -amount }
  end
end
