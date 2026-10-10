# What one customer is buying.
#
# Orders are not created with Order.create. They come from OrderTaker
# (app/models/order_taker.rb), which also takes the stock.
class Order < ApplicationRecord
  belongs_to :customer
  belongs_to :live_session, optional: true
  belongs_to :sales_channel, optional: true # where the sale came from
  belongs_to :delivery_area, optional: true # where it was sent, if it was
  # Who recorded it. Empty for an order the shopper placed on the website.
  belongs_to :user, optional: true

  # Fills `public_token` with a long random string when the order is
  # created. /order/<token> is the shopper's own link to it (they have no
  # login), so it has to be impossible to guess.
  has_secure_token :public_token
  has_many :items, class_name: "OrderItem", dependent: :destroy, inverse_of: :order
  has_many :stock_movements, as: :source

  has_many :payments, dependent: :restrict_with_exception

  # The stages:
  #
  #   claimed ──► paid ──► packed ──► delivered ──► returned
  #      │          │         │
  #      └──────────┴─────────┴──► cancelled
  #
  # "paid" is never set by hand: an order becomes paid when its payments
  # cover what is owed (see #settle). Every other move is one of the methods
  # below, and every one of them starts with `lock!`.
  enum :status, {
    claimed: "claimed", paid: "paid", packed: "packed", delivered: "delivered",
    cancelled: "cancelled", returned: "returned"
  }

  # prefix: true gives delivery_method_pickup? / delivery_method_delivery?
  enum :delivery_method, { pickup: "pickup", delivery: "delivery" }, prefix: true,
    validate: { allow_nil: true, message: "is needed. Will they collect it, or is it being sent?" }

  include HasMoney
  money :delivery_fee, blank_as_zero: true

  NO_LONGER_A_SALE = %w[ cancelled returned ].freeze
  # What the buyer still has to pay, as SQL, for sums and filters.
  BALANCE_SQL = "total_pesewas + delivery_fee_pesewas - paid_pesewas".freeze

  scope :newest_first, -> { order(created_at: :desc, id: :desc) }
  scope :counted, -> { where.not(status: NO_LONGER_A_SALE) } # everything that is still a sale
  scope :owing, -> { counted.where("#{BALANCE_SQL} > 0") }
  # Money she is holding that belongs to the buyer: a cancelled or returned
  # order that was paid for, or a live order that was paid too much.
  scope :refund_due, -> {
    where(status: NO_LONGER_A_SALE).where("paid_pesewas > 0").or(counted.where("#{BALANCE_SQL} < 0"))
  }

  # Raised when an order is asked to do something its stage doesn't allow.
  # The message is written for the person, and shown as it is.
  class WrongStage < StandardError; end

  # Items that still count as sold (returned ones don't).
  def units
    items.sum(&:kept)
  end

  def cost_pesewas
    items.sum(&:cost_pesewas)
  end

  # Delivery is left out: that money passes through to the rider.
  def profit_pesewas
    total_pesewas - cost_pesewas
  end

  def counts?
    !status.in?(NO_LONGER_A_SALE)
  end

  # Goods plus delivery. Nothing is due on an order that is no longer a sale.
  def due_pesewas
    counts? ? total_pesewas + delivery_fee_pesewas : 0
  end

  # Above zero: the buyer owes her. Below zero: she owes the buyer.
  def balance_pesewas
    due_pesewas - paid_pesewas
  end

  # Bring the stored total in line with the lines.
  def recalculate!
    update!(total_pesewas: items.reload.sum(&:total_pesewas))
  end

  # After the lines have been changed (by OrderEditor): bring the total and
  # the claimed/paid stage back in line with them. Call inside a lock.
  def resettle!
    self.total_pesewas = items.reload.sum(&:total_pesewas)
    settle
    save!
  end

  # ---- Money -----------------------------------------------------------

  # Money in. Raises ActiveRecord::RecordInvalid (carrying the payment and
  # its errors) if the amount or the way is wrong.
  def record_payment!(amount:, via:, by:, reference: nil)
    transaction do
      lock!
      raise WrongStage, "This order is #{status}, so there is nothing to pay." unless counts?

      payment = payments.new(user: by, via: via, reference: reference)
      payment.amount = amount
      # Paying more than is owed is nearly always a typing slip (500 for 50),
      # so it is refused. The limit is read here, inside the lock.
      save_payment!(payment, limit: balance_pesewas,
                    over_limit: "is more than the GH₵ #{Pesewas.to_input(balance_pesewas)} still owed")
    end
  end

  # Money back to the buyer: stored as a negative payment.
  def refund!(amount:, via:, by:, note: nil)
    transaction do
      lock!

      payment = payments.new(user: by, via: via, note: note)
      payment.amount = amount
      save_payment!(payment, limit: paid_pesewas, refund: true,
                    over_limit: "is more than the GH₵ #{Pesewas.to_input(paid_pesewas)} they have paid")
    end
  end

  # ---- Delivery --------------------------------------------------------

  # area: a DeliveryArea (or nil). Its usual fee is used when no fee is
  # given; a fee that IS given wins, so one order can be an exception.
  def set_delivery!(delivery_method:, fee:, address:, area: nil)
    transaction do
      lock!
      raise WrongStage, "Delivery can't be changed once an order is #{status}." unless claimed? || paid? || packed?

      self.delivery_method = delivery_method.presence
      # A pick-up has no address, area or fee, whatever was left in the form.
      self.delivery_address = delivery_method_delivery? ? address.to_s.strip.presence : nil
      self.delivery_area = delivery_method_delivery? ? area : nil
      self.delivery_fee = if !delivery_method_delivery? then 0
      elsif fee.to_s.strip.empty? && area then area.fee
      else fee
      end
      settle # a new fee can turn "paid" back into "to be paid"
      save!
      remember_where_they_are
    end
  rescue ActiveRecord::RecordInvalid
    # Nothing was saved, so put this object back the way the database has
    # it. The errors stay on it for the controller to read.
    restore_attributes
    raise
  end

  # ---- Moving along ----------------------------------------------------

  # Packing an unpaid order is allowed: that is "pay on delivery".
  def pack!
    transaction do
      lock!
      raise WrongStage, "Only an order that is waiting can be packed. This one is #{status}." unless claimed? || paid?

      update!(status: "packed", packed_at: Time.current)
    end
  end

  # From paid as well as packed, for a sale handed over on the spot.
  def deliver!
    transaction do
      lock!
      raise WrongStage, "This order is #{status}, so it can't be marked delivered." unless claimed? || paid? || packed?

      now = Time.current
      update!(status: "delivered", packed_at: packed_at || now, delivered_at: now)
    end
  end

  # Undo a tap on the wrong order: delivered -> packed -> waiting.
  # Swapping: they send back some of one line and take something else
  # instead, usually the same piece in another size.
  #
  #   order.swap!(item: line, to: xl_variant, quantity: 1, by: user)
  #
  #   restock:     the one coming back can be sold again (usually yes)
  #   same_price:  charge what they paid for the old one (a size swap), or
  #                the new one's own price (a different piece). Any
  #                difference shows as owing, or as a refund due.
  #   send_again:  a delivered order goes back to "to deliver", so the new
  #                one gets sent out
  #
  # Stock moves both ways in one transaction: the old one comes in, the new
  # one goes out (refused if it has just sold out). The swap is written into
  # the order's note so the history is on the order itself.
  def swap!(item:, to:, quantity:, by:, restock: true, same_price: true, send_again: true)
    transaction do
      lock!
      raise WrongStage, "Only a paid, packed or delivered order can have a swap. To change an unpaid one, edit it." unless paid? || packed? || delivered?

      item = items.find(item.id)
      count = quantity.to_i
      raise WrongStage, "Choose how many to swap." unless count.positive?
      raise WrongStage, "Only #{item.kept} of #{item.variant.full_name} left on this order." if count > item.kept
      raise WrongStage, "That is the same item. Choose another size or colour." if to.id == item.variant_id

      # The old one comes back.
      put_back(item, by: by, reason: "return", quantity: count) if restock
      item.update!(returned_quantity: item.returned_quantity + count)

      # The new one goes out. guard_stock: refuse if it has just sold out.
      StockLedger.record!(variant: to, quantity: -count, reason: "sale", source: self, user: by, guard_stock: true,
        note: "Swap for #{item.variant.full_name}")
      line = items.find_or_initialize_by(variant: to)
      if line.new_record?
        line.unit_price_pesewas = same_price ? item.unit_price_pesewas : to.selling_price_pesewas
        line.unit_cost_pesewas = to.average_cost_pesewas
        line.quantity = 0
      end
      line.quantity += count
      line.save!

      self.total_pesewas = items.reload.sum(&:total_pesewas)
      update!(status: "packed", delivered_at: nil) if delivered? && send_again
      stamp = Time.current.in_time_zone.strftime("%-d %b")
      self.note = [ note.presence, "#{stamp}: swapped #{count} × #{item.variant.name} for #{to.name} (#{to.product.name})." ].compact.join("\n")
      save!
    end
  end

  def step_back!
    transaction do
      lock!
      if delivered?
        update!(status: "packed", delivered_at: nil)
      elsif packed?
        self.status = "claimed"
        self.packed_at = nil
        settle # claimed or paid, whichever the money says
        save!
      else
        raise WrongStage, "There is nothing to undo on this order."
      end
    end
  end

  # ---- Undoing a sale --------------------------------------------------

  # Take one line off the order and put its stock back. If it was the last
  # line, the order is cancelled.
  def remove_item!(item, by:)
    transaction do
      lock!
      raise WrongStage, "Items can only be removed while an order is waiting to be paid." unless claimed?

      put_back(item, by: by, reason: "cancellation")
      item.destroy!
      self.total_pesewas = items.reload.sum(&:total_pesewas)
      if items.none?
        self.status = "cancelled"
        self.cancelled_at = Time.current
      else
        settle # what she already paid may now cover the smaller order
      end
      save!
    end
  end

  # Cancel the whole order, any time before it is delivered, and put
  # everything back on the shelf. Money already paid is NOT touched: the
  # order shows a refund as due until she records giving it back.
  def cancel!(by:)
    transaction do
      # Lock the order so two people cancelling at once can't return the
      # stock twice.
      lock!
      raise WrongStage, "This order is already cancelled." if cancelled?
      raise WrongStage, "A #{status} order can't be cancelled. Record a return instead." unless claimed? || paid? || packed?

      items.includes(:variant).each { |item| put_back(item, by: by, reason: "cancellation") }
      update!(status: "cancelled", cancelled_at: Time.current)
    end
  end

  # The buyer sent back all of a delivered order, or part of it.
  #
  #   quantities: { item_id => how_many }   only those; nil = everything
  #   restock: true    the goods are fine and go back on the shelf
  #   restock: false   they are not sellable; stock is left alone
  #
  # Part of an order: it stays "delivered", its total shrinks to what was
  # kept, and if she was paid for more than that, the difference shows as
  # money to give back. All of it: the order becomes "returned".
  def return_items!(by:, restock:, quantities: nil)
    transaction do
      lock!
      raise WrongStage, "Only a delivered order can be returned. This one is #{status}." unless delivered?

      returning = items.includes(:variant).filter_map { |item|
        wanted = quantities ? quantities[item.id].to_i : item.kept
        [ item, wanted.clamp(0, item.kept) ] if wanted.positive? && item.kept.positive?
      }
      raise WrongStage, "Nothing was chosen to return." if returning.empty?

      returning.each do |item, count|
        put_back(item, by: by, reason: "return", quantity: count) if restock
        item.update!(returned_quantity: item.returned_quantity + count)
      end

      if items.reload.all? { |item| item.kept.zero? }
        # Everything came back. (The total is left as it was: a record of
        # what the order had been worth. Nothing is due on a returned order.)
        update!(status: "returned", returned_at: Time.current)
      else
        update!(total_pesewas: items.sum(&:total_pesewas))
      end
    end
  end

  # The whole order came back.
  def return!(by:, restock:)
    return_items!(by: by, restock: restock)
  end

  private
    # Keep the claimed/paid stage in step with the money. Called (inside a
    # lock, before a save) by anything that changes what is owed or paid.
    # Packed and delivered orders are left where they are: those stages are
    # about the parcel, and the balance shows separately.
    def settle
      return unless claimed? || paid?

      if total_pesewas.positive? && balance_pesewas <= 0
        self.status = "paid"
        self.paid_at ||= Time.current
      else
        self.status = "claimed"
        self.paid_at = nil
      end
    end

    # She always types a positive amount; `limit` is the most it may be.
    def save_payment!(payment, limit:, over_limit:, refund: false)
      payment.valid?
      amount = payment.amount_pesewas
      if amount && payment.errors[:amount].empty?
        payment.errors.add(:amount, over_limit) if amount > limit
      end
      # RecordInvalid carries the record, so the controller can read
      # problem.record.errors and send them back to the form.
      raise ActiveRecord::RecordInvalid, payment if payment.errors.any?

      payment.amount_pesewas = -amount if refund
      payment.save!
      self.paid_pesewas += payment.amount_pesewas
      settle
      save!
      payment
    end

    # The first delivery teaches us where a customer is, so the next one
    # starts filled in. Blanks only: what is already known is not replaced.
    def remember_where_they_are
      return unless delivery_method_delivery?

      customer.delivery_area ||= delivery_area
      customer.location ||= delivery_address
      customer.save! if customer.changed?
    end

    def put_back(item, by:, reason:, quantity: item.quantity)
      StockLedger.record!(variant: item.variant, quantity: quantity, reason: reason, source: self, user: by)
    end
end
