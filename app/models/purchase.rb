# One restock. Starts "ordered" (editable, stock untouched); receiving it
# adds the stock and locks it.
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

  validates :purchased_on, presence: true
  validates :supplier, presence: { message: "is needed. Choose who you bought from" }
  validates :reference, length: { maximum: 60 }
  validates :note, length: { maximum: 500 }
  validate :items_make_sense
  validate :not_changed_after_receiving, on: :update

  before_destroy :only_while_ordered

  scope :newest_first, -> { order(purchased_on: :desc, id: :desc) }

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
  def save_with_items(lines)
    saved = false

    transaction do
      items.destroy_all if persisted?
      Array(lines).each do |line|
        line = line.to_h.symbolize_keys
        next if line[:quantity].to_i.zero? # a row left at 0 means "none of these"

        items.build(variant_id: line[:variant_id], quantity: line[:quantity], unit_cost: line[:unit_cost])
      end

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
        problems = item.errors.map { |error| error.attribute == :unit_cost ? "cost #{error.message}" : error.full_message.downcase }
        errors.add(:items, "#{name}: #{problems.to_sentence}")
      end

      ids = current.map(&:variant_id)
      errors.add(:items, "The same item is listed twice") if ids.uniq.size != ids.size
    end

    def not_changed_after_receiving
      return unless status_was == "received"

      errors.add(:base, "This purchase has been received and added to stock, so it can't be changed")
    end

    def only_while_ordered
      return if ordered?

      errors.add(:base, "A received purchase can't be deleted, because its stock has been counted")
      throw :abort
    end
end
