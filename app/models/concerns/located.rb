# Where someone is: a country, a region (Ghana only) and an exact place.
# Shared by customers and suppliers.
#
#   class Customer < ApplicationRecord
#     include Located
#   end
#
#   customer.locate(country: "Ghana", region: "Ashanti", place: "Adum")
#   supplier.locate(country: "China", region: "", place: "Guangzhou")
#   customer.where_text    # => "Adum, Ashanti"
#   supplier.where_text    # => "Guangzhou, China"
#
# Needs these columns on the model: country, region, delivery_area_id.
#
# The three levels can be known to different depths: a country alone, or a
# region with no place. The one combination that means nothing is "Ghana"
# with no region; that is treated as "not recorded".
module Located
  extend ActiveSupport::Concern

  included do
    belongs_to :delivery_area, optional: true # the exact place, if known

    normalizes :country, :region, with: ->(text) { text.presence }
    # When the place is known, country and region always follow it, so the
    # three can never disagree.
    before_validation :follow_the_place

    validates :country, inclusion: { in: Country::ALL }, allow_nil: true
    validates :region, inclusion: { in: Region::ALL }, allow_nil: true
    validate { errors.add(:region, "only applies in #{Country::HOME}") if region && country && !Country.home?(country) }
  end

  # Set where they are from what a form sent. A place typed for the first
  # time is added to the list. If the form says nothing useful (no country,
  # or Ghana with no region), nothing is changed.
  #
  # add_place: false looks the place up but never adds it. For forms the
  # public fills in (the shop checkout), so strangers can't grow the list.
  def locate(country:, region:, place:, add_place: true)
    country = country.presence || Country::HOME
    return unless Country.known?(country)

    if Country.home?(country)
      return unless Region.known?(region)

      self.country, self.region = country, region
    else
      self.country, self.region = country, nil
    end
    self.delivery_area = DeliveryArea.locate(country: self.country, region: self.region, name: place, add: add_place)
  end

  # For an edit form, where an emptied field means "clear it": forget where
  # they were, then set whatever was sent.
  def relocate(country:, region:, place:)
    self.country = self.region = self.delivery_area = nil
    locate(country: country, region: region, place: place)
  end

  # "Adum, Ashanti" at home; "Guangzhou, China" abroad; nil if not recorded.
  def where_text
    [ delivery_area&.name, region, (country unless Country.home?(country)) ].compact.join(", ").presence
  end

  def abroad?
    country.present? && !Country.home?(country)
  end

  private
    def follow_the_place
      return unless delivery_area&.country

      self.country = delivery_area.country
      self.region = delivery_area.region
    end
end
