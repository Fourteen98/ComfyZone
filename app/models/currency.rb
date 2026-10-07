# The currencies a purchase can be paid in.
#
# A constant, like Country and Region: the shop doesn't invent currencies.
# Everything the shop SELLS is in cedis; this list only matters when goods
# are bought from abroad (see Purchase#currency).
module Currency
  HOME = "GHS".freeze

  Entry = Data.define(:code, :name, :symbol)

  ALL = [
    Entry.new("GHS", "Ghana cedi", "GH₵"),
    Entry.new("USD", "US dollar", "$"),
    Entry.new("CNY", "Chinese yuan", "¥"),
    Entry.new("GBP", "British pound", "£"),
    Entry.new("EUR", "Euro", "€"),
    Entry.new("NGN", "Nigerian naira", "₦"),
    Entry.new("AED", "UAE dirham", "AED"),
    Entry.new("TRY", "Turkish lira", "₺"),
    Entry.new("XOF", "West African CFA franc", "CFA"),
    Entry.new("INR", "Indian rupee", "₹"),
    Entry.new("ZAR", "South African rand", "R")
  ].freeze

  CODES = ALL.map(&:code).freeze

  def self.find(code)
    ALL.find { |entry| entry.code == code }
  end

  def self.symbol(code)
    find(code)&.symbol || code
  end

  # For the select on the purchase form.
  def self.options
    ALL.map { |entry| { code: entry.code, name: entry.name, symbol: entry.symbol } }
  end
end
