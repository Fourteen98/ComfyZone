# What the country / region / place picker needs, and how to read what it
# sends back. Shared by every controller with a location on its form:
# customers, suppliers, purchases, sales and deliveries.
module LocationPicker
  extend ActiveSupport::Concern

  private
    # The fixed lists (countries, Ghana's regions) and the places known so
    # far, each with its usual delivery fee.
    def location_options
      {
        countries: Country::ALL,
        home: Country::HOME,
        regions: Region::ALL,
        places: DeliveryArea.active.where.not(country: nil).ordered.map { |area|
          { id: area.id, country: area.country, region: area.region, name: area.name, fee: area.fee, fee_pesewas: area.fee_pesewas }
        }
      }
    end

    # { country:, region:, place: } out of whatever hash the form sent them
    # in, ready to splat into locate(...) or relocate(...). nil if the form
    # didn't send a location at all.
    def where_from(given)
      return unless given.respond_to?(:permit) && (given.key?(:country) || given.key?(:region))

      given.permit(:country, :region, :place).to_h.symbolize_keys.reverse_merge(country: nil, region: nil, place: nil)
    end

    # For a record's edit form: where it is now, as the picker's value.
    def where_now(record)
      { country: record.country || Country::HOME, region: record.region.to_s, place: record.delivery_area&.name.to_s }
    end
end
