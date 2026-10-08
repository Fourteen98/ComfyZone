# Phone numbers, in one standard shape: "+233242223333".
#
# That shape is called E.164: a plus, the country code, then the number
# with no leading 0 and no spaces. Every customer and supplier phone is
# stored like this, which is what lets the phone number be the ONE thing
# that identifies a customer: "024 222 3333", "0242223333",
# "+233 24 222 3333" and "233242223333" all become the same text, so the
# database can refuse a second customer with it.
#
#   PhoneNumber.normalize("024 222 3333")      # => "+233242223333"
#   PhoneNumber.normalize("+44 7700 900123")   # => "+447700900123"
#   PhoneNumber.normalize("hello")             # => "hello" (left as typed, so validation can say so)
#   PhoneNumber.valid?("+233242223333")        # => true
#   PhoneNumber.format("+233242223333")        # => "+233 24 222 3333"
#
# Ghana is the default: a number typed without a country code is taken to
# be Ghanaian. (The frontend twin of this file is app/frontend/lib/phone.ts.)
module PhoneNumber
  HOME_CODE = "233"
  # Ghana: 9 digits after +233 (24 222 3333).
  HOME_LENGTH = 9
  E164 = /\A\+[1-9]\d{6,14}\z/ # 7 to 15 digits, never starting with 0

  def self.normalize(text)
    text = text.to_s.strip
    return nil if text.empty?

    digits = text.gsub(/\D/, "")
    e164 = if text.start_with?("+") then "+#{digits}"
    elsif digits.start_with?("00") then "+#{digits.delete_prefix('00')}"           # 00 44 ... = +44 ...
    elsif digits.start_with?(HOME_CODE) && digits.length == HOME_CODE.length + HOME_LENGTH then "+#{digits}" # 233 24...
    elsif digits.start_with?("0") && digits.length == HOME_LENGTH + 1 then "+#{HOME_CODE}#{digits[1..]}"    # 024 ...
    elsif digits.length == HOME_LENGTH then "+#{HOME_CODE}#{digits}"                                        # 24 222 3333
    end

    # Couldn't make sense of it: keep what was typed, squished, so the
    # validation can point at it instead of it silently vanishing.
    e164 || text.squish
  end

  def self.valid?(e164)
    return false unless e164.to_s.match?(E164)
    # A Ghanaian number has exactly 9 digits after the code.
    return e164.length == 1 + HOME_CODE.length + HOME_LENGTH if e164.start_with?("+#{HOME_CODE}")

    true
  end

  # For people: "+233 24 222 3333". Other countries get the code split
  # off and the rest in threes, which reads fine everywhere.
  def self.format(e164)
    return e164 unless valid?(e164)

    if e164.start_with?("+#{HOME_CODE}")
      local = e164.delete_prefix("+#{HOME_CODE}")
      "+#{HOME_CODE} #{local[0, 2]} #{local[2, 3]} #{local[5..]}"
    else
      # Elsewhere we don't know where the country code ends, so keep it
      # whole and group the last six digits: "+447700 900 123".
      "#{e164[0..-7]} #{e164[-6, 3]} #{e164[-3..]}"
    end
  end

  # The digits to look for when someone searches by number. "024 22" must
  # find "+23324 22...", so a leading 0 (the local trunk prefix) is dropped.
  def self.search_digits(text)
    text.to_s.gsub(/\D/, "").sub(/\A0+/, "")
  end
end
