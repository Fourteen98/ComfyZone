# The phone number becomes the thing that identifies a customer.
#
#   1. Rewrite every customer and supplier phone into one shape,
#      +233242223333, however it was typed.
#   2. Customers that turn out to share a number are the same person:
#      fold them into the oldest one (orders move over, blanks are filled).
#   3. A unique index, so the database itself refuses a second customer
#      with the same number from now on.
#
# The rewriting rules are copied here rather than calling PhoneNumber: a
# migration must keep doing exactly what it did on the day it ran, even if
# app/models/phone_number.rb changes later.
class MakePhoneTheCustomerIdentity < ActiveRecord::Migration[8.1]
  HOME = "233"

  def self.normalize(text)
    text = text.to_s.strip
    return nil if text.empty?

    digits = text.gsub(/\D/, "")
    if text.start_with?("+") then "+#{digits}"
    elsif digits.start_with?("00") then "+#{digits.delete_prefix('00')}"
    elsif digits.start_with?(HOME) && digits.length == 12 then "+#{digits}"
    elsif digits.start_with?("0") && digits.length == 10 then "+#{HOME}#{digits[1..]}"
    elsif digits.length == 9 then "+#{HOME}#{digits}"
    else text.squish # can't tell: leave it for someone to fix by hand
    end
  end

  def up
    # 1. One shape for every number.
    %w[ customers suppliers ].each do |table|
      select_rows("SELECT id, phone FROM #{table} WHERE phone IS NOT NULL").each do |id, phone|
        execute "UPDATE #{table} SET phone = #{quote(self.class.normalize(phone))} WHERE id = #{id.to_i}"
      end
    end

    # 2. Same number = same person. Keep the oldest; fold in the others.
    duplicated = select_values("SELECT phone FROM customers WHERE phone IS NOT NULL GROUP BY phone HAVING COUNT(*) > 1")
    duplicated.each do |phone|
      keep, *others = select_values("SELECT id FROM customers WHERE phone = #{quote(phone)} ORDER BY id").map(&:to_i)

      others.each do |other|
        execute "UPDATE orders SET customer_id = #{keep} WHERE customer_id = #{other}"
        # Anything the kept customer doesn't know yet is taken from the
        # duplicate. The username is cleared on the duplicate first, since
        # two customers can't hold one at the same time.
        handle = select_value("SELECT handle FROM customers WHERE id = #{other}")
        execute "UPDATE customers SET handle = NULL WHERE id = #{other}"
        execute <<~SQL
          UPDATE customers AS kept SET
            handle = COALESCE(kept.handle, #{quote(handle)}),
            name = COALESCE(kept.name, dup.name),
            location = COALESCE(kept.location, dup.location),
            country = COALESCE(kept.country, dup.country),
            region = COALESCE(kept.region, dup.region),
            delivery_area_id = COALESCE(kept.delivery_area_id, dup.delivery_area_id),
            note = COALESCE(kept.note, dup.note)
          FROM customers AS dup
          WHERE kept.id = #{keep} AND dup.id = #{other}
        SQL
        execute "DELETE FROM customers WHERE id = #{other}"
      end

      say "Merged #{others.size + 1} customers who shared #{phone}"
    end

    # 3. From now on, the database refuses a second customer with a number.
    #    "WHERE phone IS NOT NULL": many customers (TikTok usernames) have
    #    no number yet, and those don't clash with each other.
    # (The plain index that was there for searching is replaced by this one.)
    remove_index :customers, :phone, if_exists: true
    add_index :customers, :phone, unique: true, where: "phone IS NOT NULL"
  end

  def down
    # The rewritten numbers and merged customers can't be un-merged; only
    # the rule is removed.
    remove_index :customers, :phone
    add_index :customers, :phone
  end
end
