# One restock. Starts "ordered" (editable, stock untouched); receiving it
# adds the stock. A received purchase can still be corrected with revise!,
# which moves stock and cost by exactly the difference (see below).
class Purchase < ApplicationRecord
  include HasMoney

  # Every purchase names who it was bought from. (The column still allows
  # NULL so purchases recorded before this rule keep loading; the presence
  # validation below applies whenever one is saved.)
  #
  # validate: true matters when a NEW supplier is typed in on the purchase
  # form: by default belongs_to does not check a new associated record, and
  # the purchase would quietly save with no supplier at all.
  belongs_to :supplier, optional: true, validate: true
  belongs_to :user
  # `validate: false`: checked by hand below for clearer messages, like Product's options.
  has_many :items, class_name: "PurchaseItem", dependent: :destroy, inverse_of: :purchase, validate: false
  has_many :stock_movements, as: :source # the other end of the polymorphic link

  enum :status, { ordered: "ordered", received: "received" }
  # How the goods reached her. `prefix` names the helper methods
  # delivery_method_pickup? / delivery_method_delivery? so they can't clash
  # with anything else. `validate: true` turns a bad value into a normal
  # validation error instead of an exception.
  enum :delivery_method, { pickup: "pickup", delivery: "delivery" }, prefix: true,
    validate: { message: "is needed. Was it a pick-up or a delivery?" }

  money :transport_cost, blank_as_zero: true # the trip to collect, or the delivery fee
  money :extra_costs, blank_as_zero: true    # anything else: duty, loading, handling

  # --- currency ---
  # Most purchases are in cedis. One from abroad records the currency she
  # paid in and the rate she got; the lines keep both the foreign cost and
  # its cedi value (see save_with_items).
  validates :currency, inclusion: { in: Currency::CODES, message: "isn't one this app knows" }
  validates :exchange_rate,
    numericality: { greater_than: 0, less_than: 100_000, message: "is needed. How many cedis did one of that currency cost you?" },
    if: :foreign?
  before_validation { self.exchange_rate = nil unless foreign? }

  validates :purchased_on, presence: true
  validates :supplier, presence: { message: "is needed. Choose who you bought from" }
  validates :reference, length: { maximum: 60 }
  validates :note, length: { maximum: 500 }
  validate :items_make_sense
  validate :not_changed_after_receiving, on: :update

  before_destroy :only_while_ordered

  scope :newest_first, -> { order(purchased_on: :desc, id: :desc) }

  def foreign?
    currency != Currency::HOME
  end

  # The rate as she typed it, without trailing zeros: 15.5, not 15.5000.
  def exchange_rate_text
    exchange_rate && exchange_rate.to_s("F").sub(/\.?0+\z/, "")
  end

  # What the supplier was paid in their own currency (smallest units), or
  # nil for a cedi purchase.
  def foreign_goods_total_minor
    live_items.sum { |item| item.quantity.to_i * item.foreign_unit_cost_minor.to_i } if foreign?
  end

  # --- totals (all in pesewas) ---

  def goods_total_pesewas
    live_items.sum(&:goods_total_pesewas)
  end

  # Everything paid on top of the goods themselves. This is what gets
  # shared across the items when they arrive.
  def added_costs_pesewas
    transport_cost_pesewas.to_i + extra_costs_pesewas.to_i
  end

  def total_pesewas
    goods_total_pesewas + added_costs_pesewas
  end

  def units
    live_items.sum { |item| item.quantity.to_i }
  end

  # Saves the purchase and replaces its lines. All or nothing.
  #
  #   purchase.save_with_items([{ variant_id: 3, quantity: 12, unit_cost: "60" }, ...])
  #
  # unit_cost is in the PURCHASE'S currency. For a dollar purchase "60" means
  # $60; the line keeps that and works out the cedi cost from the rate.
  def save_with_items(lines)
    saved = false

    transaction do
      items.destroy_all if persisted?
      build_lines(lines)

      if save
        # Buying something from a supplier shows they sell it. Remember that,
        # so the supplier's page stays up to date without anyone maintaining it.
        supplier.sells!(items.includes(:variant).map { |item| item.variant.product_id })
        saved = true
      else
        raise ActiveRecord::Rollback
      end
    end

    saved
  end

  # Correcting a purchase whose goods are already in stock: something was
  # left off, a quantity or a price was wrong.
  #
  #   purchase.assign_attributes(note: "...", transport_cost: "50")
  #   purchase.revise!(lines, by: user)   # => true, or false with errors
  #
  # The lines are the WHOLE purchase as it should now be (like the form
  # sends), not a list of changes. For each item the difference between
  # before and after is sent through the stock ledger:
  #
  #   more than before   the extra units go into stock at their landed cost
  #   fewer than before  the units come out again (refused if they have
  #                      already been sold: you can't un-buy a sold dress)
  #   same units, new cost  the units still on the shelf are re-valued
  #
  # Order lines already sold keep the cost they were sold at: a sale is a
  # record of what happened that day.
  def revise!(lines, by:)
    raise ArgumentError, "revise! is for received purchases; use save_with_items" unless received?

    revised = false
    transaction do
      # Lock the row so two corrections can't run at once. Not `lock!`:
      # that reloads the record and would throw away the changes the
      # controller has just assigned (date, supplier, costs...).
      self.class.lock.find(id)
      # What each item was, before anything changes: quantity and landed total.
      before = items.reload.to_h { |item| [ item.variant_id, [ item.quantity, item.landed_total_pesewas.to_i ] ] }

      @revising = true
      items.destroy_all
      build_lines(lines)
      raise ActiveRecord::Rollback unless valid?

      # The lines just built, still in memory (asking the database would
      # find none: they aren't saved yet).
      fresh = live_items
      share_out_extra_costs(fresh)
      save!
      fresh.each(&:save!)
      after = fresh.to_h { |item| [ item.variant_id, [ item.quantity, item.landed_total_pesewas ] ] }

      (before.keys | after.keys).each do |variant_id|
        settle_difference(Variant.find(variant_id), before[variant_id], after[variant_id], by)
      end

      supplier.sells!(fresh.map { |item| item.variant.product_id })
      revised = true
    rescue StockLedger::NotEnough => problem
      errors.add(:items, "#{problem.message}, so this purchase can't be lowered that far. Those units have already gone out.")
      raise ActiveRecord::Rollback
    ensure
      @revising = false
    end

    revised
  end

  # Deleting a purchase, whatever its state. (Plain `destroy` still refuses
  # a received one, so nothing deletes stock-carrying history by accident;
  # this is the deliberate way, behind the purchases.delete permission.)
  #
  # A received purchase's stock is taken back out first, one movement per
  # item. If some of it has already been sold there is nothing to take
  # out, so the whole thing is refused and nothing changes.
  #
  # The stock movements it made when it arrived stay in each item's
  # history: the ledger is never rewritten. Their link to the purchase
  # simply leads nowhere any more.
  def remove!(by:)
    transaction do
      self.class.lock.find(id) # see revise! for why not lock!

      if received?
        items.includes(:variant).each do |item|
          StockLedger.record!(variant: item.variant, quantity: -item.quantity, reason: "purchase", user: by,
            guard_stock: true, note: "Purchase deleted (#{[ supplier&.name, purchased_on.strftime('%-d %b %Y') ].compact.join(', ')})")
        end
      end

      @removing = true
      destroy!
    end
    true
  rescue StockLedger::NotEnough => problem
    errors.add(:base, "#{problem.message}, so this purchase can't be deleted: some of its stock has already gone out. Correct it instead.")
    false
  ensure
    @removing = false
  end

  # The goods have arrived: add them to stock and lock the purchase.
  def receive!(by:)
    transaction do
      # Lock the purchase row first, so two people tapping "arrived" at the
      # same moment can't add the stock twice.
      lock!
      raise AlreadyReceived if received?

      # Load the lines once and use the SAME objects throughout: the landed
      # totals worked out below live on these objects until saved.
      lines = items.includes(variant: :product).to_a
      share_out_extra_costs(lines)

      lines.each do |item|
        item.save!
        StockLedger.record!(
          variant: item.variant,
          quantity: item.quantity,
          reason: "purchase",
          source: self,
          user: by,
          total_cost_pesewas: item.landed_total_pesewas
        )
      end

      # update_columns skips validations and callbacks on purpose: the
      # "can't change after receiving" rule must not block the very change
      # that marks it received.
      update_columns(status: "received", received_at: Time.current, updated_at: Time.current)
    end
  end

  class AlreadyReceived < StandardError; end

  private
    def build_lines(lines)
      Array(lines).each do |line|
        line = line.to_h.symbolize_keys
        next if line[:quantity].to_i.zero? # a row left at 0 means "none of these"

        item = items.build(variant_id: line[:variant_id], quantity: line[:quantity])
        if foreign?
          item.price_in_foreign(line[:unit_cost], rate: exchange_rate)
        else
          item.unit_cost = line[:unit_cost]
        end
      end
    end

    # One item's correction. was / now are [quantity, landed total], or nil
    # when the item wasn't on the purchase before / isn't any more.
    def settle_difference(variant, was, now, by)
      old_quantity, old_total = was || [ 0, 0 ]
      new_quantity, new_total = now || [ 0, 0 ]

      # Same units, different cost: re-value the ones still on the shelf.
      # Done first, so units added below blend in on top of the right value.
      kept = [ old_quantity, new_quantity ].min
      if kept.positive?
        change_each = Rational(new_total, new_quantity) - Rational(old_total, old_quantity)
        StockLedger.revalue!(variant: variant, change_each_pesewas: change_each, units: kept) unless change_each.zero?
      end

      difference = new_quantity - old_quantity
      return if difference.zero?

      StockLedger.record!(
        variant: variant, quantity: difference, reason: "purchase", source: self, user: by,
        # Units coming in carry their landed cost; units going out don't
        # change the average (they leave at whatever it is).
        total_cost_pesewas: difference.positive? ? (Rational(new_total, new_quantity) * difference).round : nil,
        note: "Purchase corrected",
        guard_stock: difference.negative?
      )
    end

    def live_items
      items.reject(&:marked_for_destruction?).reject(&:destroyed?)
    end

    # Splits the added costs (transport + other fees) across the lines in proportion to their value, to
    # the exact pesewa.
    #
    #   Goods: line A GH₵ 600, line B GH₵ 400.  Extra costs: GH₵ 100.
    #   A carries 60, B carries 40.
    #
    # Simple rounding could leave the shares adding up to 99.99 or 100.01.
    # The "largest remainder" method avoids that: give every line its share
    # rounded DOWN, then hand the few leftover pesewas, one each, to the
    # lines that were rounded down the most.
    def share_out_extra_costs(lines)
      weights = lines.map(&:goods_total_pesewas)
      weights = lines.map(&:quantity) if weights.sum.zero? # all free: share by count
      total_weight = weights.sum

      exact = weights.map { |weight| Rational(added_costs_pesewas * weight, total_weight) }
      shares = exact.map(&:floor)
      leftover = added_costs_pesewas - shares.sum

      by_biggest_remainder = lines.each_index.sort_by { |i| [ -(exact[i] - shares[i]), i ] }
      by_biggest_remainder.first(leftover).each { |i| shares[i] += 1 }

      lines.each_with_index do |item, i|
        item.landed_total_pesewas = item.goods_total_pesewas + shares[i]
      end
    end

    def items_make_sense
      current = live_items
      return errors.add(:items, "Add at least one item with a quantity") if current.empty?

      current.each do |item|
        next if item.valid?

        name = item.variant ? "#{item.variant.product.name}, #{item.variant.name}" : "An item"
        problems = item.errors.map { |error| error.attribute.in?(%i[ unit_cost foreign_unit_cost ]) ? "cost #{error.message}" : error.full_message.downcase }
        errors.add(:items, "#{name}: #{problems.to_sentence}")
      end

      ids = current.map(&:variant_id)
      errors.add(:items, "The same item is listed twice") if ids.uniq.size != ids.size
    end

    def not_changed_after_receiving
      return unless status_was == "received"
      return if @revising # a correction through revise!, which keeps stock in step

      errors.add(:base, "This purchase has been received and added to stock, so it can't be changed")
    end

    def only_while_ordered
      return if ordered? || @removing

      errors.add(:base, "A received purchase can't be deleted, because its stock has been counted")
      throw :abort
    end
end
