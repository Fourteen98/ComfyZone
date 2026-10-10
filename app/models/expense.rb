# Something the business paid for that isn't stock.
class Expense < ApplicationRecord
  include HasMoney

  # Offered before she has typed any of her own.
  SUGGESTED = [ "Packaging", "Riders and delivery", "Data and airtime", "Advertising", "Rent", "Wages", "Equipment", "Other" ].freeze

  belongs_to :user
  # Optional: a cost that belongs to one live (data, a host, a ring light).
  belongs_to :live_session, optional: true
  # Optional: who sold it. The same suppliers as stock purchases, so a
  # dealer of polymer bags keeps one phone number in one place.
  # `autosave`: a supplier typed in the form is checked and saved with the
  # expense (and a bad phone number stops both, instead of being dropped).
  belongs_to :supplier, optional: true, autosave: true
  # Optional: what was in it, line by line. `autosave` saves the lines with
  # the expense, and removes lines marked for destruction (see #lines=).
  # `validate: false`: we check the lines ourselves (#lines_are_valid), to say
  # WHICH line is wrong instead of Rails' vague "Items is invalid".
  has_many :items, -> { order(:id) }, class_name: "ExpenseItem", inverse_of: :expense, autosave: true, validate: false, dependent: :delete_all

  money :amount
  money :delivery_fee, blank_as_zero: true

  # With lines, the amount is not typed: it is the lines plus delivery.
  before_validation :total_from_lines, if: :itemised?

  normalizes :category, with: ->(text) { text.to_s.squish }
  normalizes :note, with: ->(text) { text.to_s.squish.presence }

  validates :spent_on, presence: true
  validates :category, presence: true, length: { maximum: 40 }
  validates :note, length: { maximum: 200 }
  validates :paid_via, inclusion: { in: ->(_) { PaymentMethod.keys } }, allow_nil: true
  validate { errors.add(:amount, "must be more than zero") if amount_pesewas && amount_pesewas <= 0 }
  validate { errors.add(:spent_on, "can't be in the future") if spent_on && spent_on > Date.current }
  validates :delivery_fee_pesewas, numericality: { greater_than_or_equal_to: 0 }
  validate { errors.add(:delivery_fee, "is only for an expense with items") if delivery_fee_pesewas.to_i.positive? && !itemised? }
  validate :lines_are_valid

  scope :newest_first, -> { order(spent_on: :desc, id: :desc) }
  scope :during, ->(period) { where(spent_on: period.from..period.to) }

  # The lines being kept (not the ones about to be removed).
  def kept_items
    items.reject(&:marked_for_destruction?)
  end

  def itemised?
    kept_items.any?
  end

  def items_pesewas
    kept_items.sum(&:total_pesewas)
  end

  # Replaces all the lines with the ones given:
  #   [{ name: "Polymer bags", quantity: "500", unit_cost: "0.20" }, ...]
  # Blank rows (no name, no quantity) are skipped. Nothing is written until
  # the expense is saved; then old lines go and new ones are added together.
  def lines=(rows)
    items.each(&:mark_for_destruction)
    Array(rows).each do |row|
      row = row.to_h.symbolize_keys
      next if row[:name].blank? && row[:quantity].blank? && row[:unit_cost].blank?

      items.build(name: row[:name], quantity: row[:quantity], unit_cost: row[:unit_cost])
    end
  end

  # Every category she has used, then the suggestions she hasn't.
  def self.categories
    used = group(:category).order(Arel.sql("COUNT(*) DESC")).pluck(:category)
    used + (SUGGESTED - used)
  end

  # "Packaging" => 4500, biggest first.
  def self.by_category
    group(:category).sum(:amount_pesewas).sort_by { |_, amount| -amount }
  end

  private
    def total_from_lines
      self.amount_pesewas = items_pesewas + delivery_fee_pesewas.to_i
    end

    # Bring each line's problems up to the expense as "lines.0.quantity", so
    # the form can show them next to the right box.
    def lines_are_valid
      kept_items.each_with_index do |item, index|
        next if item.valid?

        item.errors.each { |error| errors.add(:"lines.#{index}.#{error.attribute}", error.message) }
      end
    end
end
