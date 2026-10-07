# A way money moves: Mobile money, Cash, Bank transfer...
# Managed in Settings > Payment methods.
class PaymentMethod < ApplicationRecord
  include Positioned

  normalizes :name, with: ->(name) { name.squish }

  before_validation :assign_key, on: :create

  validates :name, presence: true, length: { maximum: 30 }, uniqueness: { case_sensitive: false }
  validates :key, presence: true, uniqueness: true
  # The key is what old payments point at. It must never move.
  attr_readonly :key

  before_destroy :keep_if_used

  scope :ordered, -> { order(:position, :name) }
  scope :active, -> { where(active: true) }

  # For the pills on payment and expense forms.
  def self.options
    active.ordered.map { |method| { value: method.key, label: method.name, reference: method.wants_reference } }
  end

  # { "momo" => "Mobile money", ... } including hidden ones, for showing
  # what an old payment was made with.
  def self.names
    pluck(:key, :name).to_h
  end

  def self.keys
    pluck(:key)
  end

  def used?
    Payment.exists?(via: key) || Expense.exists?(paid_via: key)
  end

  private
    # "Mobile money" -> "mobile-money". If that is taken, add -2, -3 ...
    def assign_key
      return if key.present? || name.blank?

      base = name.parameterize.presence || "method"
      candidate = base
      number = 2
      while PaymentMethod.exists?(key: candidate)
        candidate = "#{base}-#{number}"
        number += 1
      end
      self.key = candidate
    end

    def keep_if_used
      return unless used?

      errors.add(:base, "#{name} has been used for payments, so it can't be deleted. Hide it instead.")
      throw :abort
    end
end
