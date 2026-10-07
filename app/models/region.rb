# Ghana's sixteen regions.
#
# A constant, not a table and not a Settings screen: nobody at the shop
# should be able to add a seventeenth, and reports group by these exact
# names. (Compare delivery areas, the places WITHIN a region, which are
# data and grow as she types.)
module Region
  ALL = [
    "Greater Accra", "Ashanti", "Central", "Eastern", "Western", "Western North", "Volta", "Oti",
    "Bono", "Bono East", "Ahafo", "Northern", "Savannah", "North East", "Upper East", "Upper West"
  ].freeze

  def self.known?(name)
    ALL.include?(name)
  end
end
