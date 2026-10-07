# An exact place: "East Legon" in Greater Accra, Ghana, or "Guangzhou" in
# China. For places she delivers to, also what delivery usually costs.
#
# The list grows by itself: DeliveryArea.locate finds a place or adds it,
# so typing a new one while recording a sale is all it takes. Settings >
# Locations is for setting fees and tidying up.
#
# (The table is still called delivery_areas from when it only held places
# she delivered to. Customers and suppliers now use it too.)
class DeliveryArea < ApplicationRecord
  include HasMoney

  has_many :customers, dependent: :nullify
  has_many :suppliers, dependent: :nullify
  has_many :orders, dependent: :nullify

  money :fee, blank_as_zero: true

  normalizes :name, with: ->(name) { name.squish }
  normalizes :region, with: ->(region) { region.presence }

  validates :name, presence: true, length: { maximum: 40 },
    uniqueness: { case_sensitive: false, scope: %i[ country region ], message: "is already there" }
  validates :country, inclusion: { in: Country::ALL, message: "is needed" }
  # In Ghana a place sits in one of the 16 regions. Abroad it has none.
  validates :region, inclusion: { in: Region::ALL, message: "is needed. Which region is it in?" }, if: -> { Country.home?(country) }
  validates :region, absence: { message: "only applies in #{Country::HOME}" }, if: -> { country.present? && !Country.home?(country) }

  # Ghana first, by region; then other countries by name.
  scope :ordered, -> { order(Arel.sql("(country = 'Ghana') DESC NULLS LAST, country, region NULLS LAST, lower(name)")) }
  scope :active, -> { where(active: true) }

  # The place called `name` there: the one already known (however it was
  # capitalised), or a new one. Returns nil if there is no name, or the
  # country or region isn't a real one.
  #
  #   DeliveryArea.locate(country: "Ghana", region: "Ashanti", name: "adum")  # finds "Adum"
  #   DeliveryArea.locate(country: "China", region: nil, name: "Guangzhou")    # adds it
  def self.locate(name:, country: Country::HOME, region: nil)
    name = normalize_value_for(:name, name.to_s)
    region = region.presence
    return if name.blank? || !Country.known?(country)
    return if Country.home?(country) ? !Region.known?(region) : region.present?

    matching = where(country: country, region: region).where("lower(name) = ?", name.downcase)
    matching.first || create!(country: country, region: region, name: name)
  rescue ActiveRecord::RecordNotUnique
    # Two people typed the same new place at the same moment. The unique
    # index let one through; this one just uses it.
    matching.first
  end

  # Fold a duplicate ("Medina") into this place ("Madina"): everyone and
  # everything there moves here, then it is removed.
  def absorb!(other)
    raise ArgumentError, "A place can't be merged with itself" if other == self

    transaction do
      other.customers.update_all(delivery_area_id: id, country: country, region: region)
      other.suppliers.update_all(delivery_area_id: id, country: country, region: region)
      other.orders.update_all(delivery_area_id: id)
      other.reload.destroy!
    end
  end

  # "Ashanti" at home, "China" abroad: the heading it is listed under.
  def group_name
    Country.home?(country) ? region : country
  end
end
