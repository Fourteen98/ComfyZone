# A place she delivers to, and what that usually costs the buyer.
# Managed in Settings > Delivery areas.
class DeliveryArea < ApplicationRecord
  include Positioned
  include HasMoney

  has_many :customers, dependent: :nullify
  has_many :orders, dependent: :nullify

  money :fee, blank_as_zero: true

  normalizes :name, with: ->(name) { name.squish }

  validates :name, presence: true, length: { maximum: 40 }, uniqueness: { case_sensitive: false }

  scope :ordered, -> { order(:position, :name) }
  scope :active, -> { where(active: true) }
end
