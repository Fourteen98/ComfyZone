# An exact place within a region ("East Legon" in Greater Accra), and what
# delivery there usually costs the buyer.
#
# The list grows by itself: DeliveryArea.locate finds a place or adds it,
# so typing a new one while recording a sale is all it takes. Settings >
# Locations is for setting fees and tidying up.
class DeliveryArea < ApplicationRecord
  include HasMoney

  has_many :customers, dependent: :nullify
  has_many :orders, dependent: :nullify

  money :fee, blank_as_zero: true

  normalizes :name, with: ->(name) { name.squish }

  validates :name, presence: true, length: { maximum: 40 },
    uniqueness: { case_sensitive: false, scope: :region, message: "is already in that region" }
  validates :region, inclusion: { in: Region::ALL, message: "is needed. Which region is it in?" }

  scope :ordered, -> { order(Arel.sql("region NULLS LAST, lower(name)")) }
  scope :active, -> { where(active: true) }

  # Fold a duplicate ("Medina") into this place ("Madina"): its customers
  # and orders move here, then it is removed.
  def absorb!(other)
    raise ArgumentError, "A place can't be merged with itself" if other == self

    transaction do
      other.customers.update_all(delivery_area_id: id, region: region)
      other.orders.update_all(delivery_area_id: id)
      other.reload.destroy!
    end
  end

  # The place called `name` in `region`: the one already there (however it
  # was capitalised), or a new one. Returns nil if either part is missing
  # or the region isn't one of Ghana's.
  #
  #   DeliveryArea.locate(region: "Ashanti", name: "adum")   # finds "Adum"
  #   DeliveryArea.locate(region: "Ashanti", name: "Bantama") # adds it
  def self.locate(region:, name:)
    name = normalize_value_for(:name, name.to_s)
    return if name.blank? || !Region.known?(region)

    where(region: region).where("lower(name) = ?", name.downcase).first || create!(region: region, name: name)
  rescue ActiveRecord::RecordNotUnique
    # Two people typed the same new place at the same moment. The unique
    # index let one through; this one just uses it.
    where(region: region).where("lower(name) = ?", name.downcase).first
  end
end
