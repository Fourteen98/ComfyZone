# Counting the shelves: many recounts in one go.
#
#   take = StockTake.new(user: user, counts: { "12" => "7", "13" => "", "14" => "0" })
#   take.save      # true, or false with take.errors
#   take.changed   # how many items were corrected
#
# A blank count means "not counted": that item is left alone. A count equal
# to what the app already shows changes nothing either. Everything else
# becomes one "recount" movement in the stock ledger, exactly as if it had
# been corrected by hand on the item's own page.
#
# All or nothing: one unreadable number refuses the whole sheet, so she is
# never left wondering which half was saved.
class StockTake
  include ActiveModel::Model

  attr_accessor :user, :counts
  attr_reader :changed

  def save
    @changed = 0
    typed = (counts || {}).to_h.transform_values { |value| value.to_s.strip }.reject { |_, value| value.empty? }

    Variant.transaction do
      Variant.where(id: typed.keys).includes(:product).order(:id).each do |variant|
        value = typed[variant.id.to_s]
        unless value.match?(/\A\d{1,6}\z/)
          errors.add(:counts, "\"#{value}\" for #{variant.full_name} isn't a whole number")
          raise ActiveRecord::Rollback
        end

        # The difference is worked out by the ledger's caller under the
        # variant's lock, from the freshest number (lesson 12).
        variant.with_lock do
          difference = value.to_i - variant.stock_on_hand
          next if difference.zero?

          StockLedger.record!(variant: variant, quantity: difference, reason: "recount", user: user, note: "Stock take")
          @changed += 1
        end
      end
    end

    errors.empty?
  end
end
