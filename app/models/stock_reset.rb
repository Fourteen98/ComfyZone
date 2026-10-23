# Setting many counts at once: "these 12 are wrong, make them 0", "all of the
# Amazon pants to 0", or a full reset of the whole shop before a fresh count.
#
#   reset = StockReset.new(user: u, variant_ids: [3, 4, 9])          # to 0
#   reset = StockReset.new(user: u, variant_ids: [3, 4], to: "5")    # each to 5
#   reset = StockReset.new(user: u, everything: true, confirm: "RESET")
#   reset.save      # true, or false with reset.errors
#   reset.changed   # how many items actually changed
#   StockReset.undo!(batch: reset.batch, user: u)
#
# Like a stock take (StockTake), every change is an ordinary "recount"
# movement through StockLedger, so each item's history says what happened,
# who did it and when. Nothing is deleted: the old numbers stay in the
# history, and the whole reset can be undone.
#
# All the movements of one reset share a `batch` code. That is what lets the
# Stock page say "Reset 12 items at 14:02 · Undo", and undo exactly those.
#
# A product counted as one total (StockPool) is reset as a whole: its sizes'
# own numbers mean nothing, so choosing any of them means the product.
class StockReset
  include ActiveModel::Model

  # What she must type before a full reset. A tap can be a mistake; typing
  # a word can't.
  CONFIRM_WORD = "RESET".freeze
  # How long the Stock page offers "Undo" for the latest reset.
  UNDO_FOR = 1.day
  UNDO_PREFIX = "undo:".freeze

  attr_accessor :user, :variant_ids, :everything, :to, :confirm
  attr_reader :changed, :batch

  def save
    @changed = 0
    target = target_count
    return false unless target && ready?

    @batch = SecureRandom.hex(8)
    Variant.transaction do
      variants = chosen.includes(:product).order(:id).to_a
      pooled, single = variants.partition { |variant| variant.product.stock_pooled? }

      single.each { |variant| set!(variant, target) }
      # One total for the product: it all sits on the first size (as
      # StockPool does), every other size goes to 0.
      pooled.map(&:product).uniq.each do |product|
        product.lock!
        sizes = Variant.where(product_id: product.id).order(:position, :id).to_a
        first = sizes.find(&:active)
        sizes.each { |size| set!(size, size == first ? target : 0) }
      end
    end

    true
  end

  # What one sentence should say about it: "12 items set to 0."
  def summary
    what = @changed == 1 ? "1 item" : "#{@changed} items"
    everything? ? "Full reset: #{what} set to 0." : "#{what} set to #{target_count}."
  end

  # Puts back what a reset took away (or added), as new recount movements.
  # Sales made since are not touched: undoing only reverses the reset's own
  # changes. Raises ArgumentError if there is nothing (left) to undo.
  def self.undo!(batch:, user:)
    movements = StockMovement.where(batch: batch.to_s).includes(:variant).order(:id).to_a
    raise ArgumentError, "There is no reset to undo" if batch.to_s.start_with?(UNDO_PREFIX) || movements.empty?

    undone = 0
    Variant.transaction do
      # Inside the transaction, with the first variant locked, so two quick
      # taps on Undo can't both get past this check.
      movements.first.variant.lock!
      raise ArgumentError, "That reset has already been undone" if StockMovement.exists?(batch: UNDO_PREFIX + batch.to_s)

      movements.each do |movement|
        StockLedger.record!(variant: movement.variant, quantity: -movement.quantity, reason: "recount", user: user,
          note: "Undo: #{movement.note}", batch: UNDO_PREFIX + batch.to_s, quiet: true)
        undone += 1
      end
    end
    undone
  end

  # The latest reset still worth offering to undo, for the Stock page:
  #   { batch:, items:, note:, at: Time, by: "Fazila" }   or nil
  def self.latest_undoable
    last = StockMovement.where.not(batch: nil).where.not("batch LIKE ?", "#{UNDO_PREFIX}%")
      .where(created_at: UNDO_FOR.ago..).order(id: :desc).first
    return if last.nil? || StockMovement.exists?(batch: UNDO_PREFIX + last.batch)

    { batch: last.batch, items: StockMovement.where(batch: last.batch).count, note: last.note, at: last.created_at, by: last.user&.name }
  end

  private
    def everything?
      ActiveModel::Type::Boolean.new.cast(everything) == true
    end

    def ids
      Array(variant_ids).map(&:to_i).select(&:positive?).uniq
    end

    # Everything that holds any stock, archived items included: a full reset
    # means nothing is left anywhere. Otherwise just the chosen items.
    def chosen
      everything? ? Variant.where.not(stock_on_hand: 0) : Variant.where(id: ids)
    end

    # The number to set. Always 0 for a full reset.
    def target_count
      return 0 if everything?

      value = to.to_s.strip
      return 0 if value.empty?
      return value.to_i if value.match?(/\A\d{1,6}\z/) && value.to_i <= 100_000

      errors.add(:base, "The count must be a whole number, like 0 or 5")
      nil
    end

    def ready?
      if everything?
        errors.add(:base, "Type #{CONFIRM_WORD} to reset everything") unless confirm.to_s.strip.upcase == CONFIRM_WORD
      elsif ids.empty?
        errors.add(:base, "Choose the sizes or colours to reset first")
      end
      errors.empty?
    end

    # Each count is worked out under the variant's lock, from the freshest
    # number, so a sale at the same moment isn't lost (lesson 12).
    def set!(variant, target)
      variant.with_lock do
        difference = target - variant.stock_on_hand
        next if difference.zero?

        note = everything? ? "Full reset" : "Reset to #{target}"
        StockLedger.record!(variant: variant, quantity: difference, reason: "recount", user: user, note: note, batch: @batch, quiet: true)
        @changed += 1
      end
    end
end
