# Converts between what a person types ("120.50") and what the database
# stores (12050 pesewas). All money parsing in the app goes through here.
#
# BigDecimal does exact decimal arithmetic. Floats are never involved.
module Pesewas
  INVALID = :invalid
  # Digits, optionally followed by a dot and one or two more digits.
  FORMAT = /\A\d+(\.\d{1,2})?\z/

  # "120.50" -> 12050     "1,200" -> 120000     "" -> nil     "abc" -> :invalid
  def self.parse(input)
    text = input.to_s.gsub(/[,\s]|GH₵|GHS/i, "")
    return nil if text.empty?
    return INVALID unless text.match?(FORMAT)

    (BigDecimal(text) * 100).to_i
  end

  # 12050 -> "120.50"     12000 -> "120"     nil -> ""
  # Shaped for putting back into a form field.
  def self.to_input(pesewas)
    return "" if pesewas.nil?

    cedis, remainder = pesewas.divmod(100)
    remainder.zero? ? cedis.to_s : format("%d.%02d", cedis, remainder)
  end
end
