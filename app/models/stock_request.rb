# Someone asked for a size or colour that was sold out (the waiting list).
#
#   StockRequest.ask!(customer: ama, variant: orange_3xl, source: "live", user: me)
#
# It earns its keep twice:
#   1. When the item is back, she can tell everyone who asked (one WhatsApp
#      tap each). StockLedger notices the moment stock returns.
#   2. How many people are waiting is real, unmet demand: RestockAdvisor
#      counts it when suggesting what to buy.
#
# A request stays open until it is closed: they bought it (closed by
# OrderTaker automatically) or she took them off the list.
class StockRequest < ApplicationRecord
  SOURCES = %w[ live sale shop manual ].freeze

  belongs_to :customer
  belongs_to :variant
  belongs_to :user, optional: true # empty when asked on the shop

  validates :quantity, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 50 }
  validates :source, inclusion: { in: SOURCES }
  validates :note, length: { maximum: 200 }

  scope :open, -> { where(closed_at: nil) }
  scope :newest_first, -> { order(created_at: :desc) }
  # Open requests for things that are on the shelf again: time to tell them.
  scope :back_in_stock, -> { open.joins(:variant).where("variants.stock_on_hand > 0") }
  scope :still_waiting, -> { open.joins(:variant).where("variants.stock_on_hand <= 0") }
  # Back in stock and not yet told: what the menu badge counts.
  scope :to_tell, -> { back_in_stock.where(told_at: nil) }

  # Put someone on the list. Asking again for the same thing doesn't add a
  # second entry (a unique index makes sure); it keeps the larger quantity.
  def self.ask!(customer:, variant:, source:, user: nil, quantity: 1, note: nil)
    customer.save! if customer.new_record?
    request = open.find_or_initialize_by(customer: customer, variant: variant)
    request.assign_attributes(source: request.source.presence_in(SOURCES - [ "manual" ]) || source, user: request.user || user,
      quantity: [ request.quantity.to_i, quantity.to_i ].max.clamp(1, 50), note: note.presence || request.note)
    request.save!
    request
  end

  # They bought it: everything they had asked for of that item is done.
  def self.fulfil(customer:, variant:)
    open.where(customer: customer, variant: variant).update_all(closed_at: Time.current, updated_at: Time.current)
  end

  def told!
    update!(told_at: Time.current)
  end

  def close!
    update!(closed_at: Time.current)
  end

  # What she sends on WhatsApp when it is back. Short, friendly, and asks a
  # question, so they answer.
  def message
    first = customer.name.to_s.split.first
    greeting = first ? "Hi #{first}" : "Hello"
    "#{greeting}, good news from The Comfy Zone: the #{variant.product.name} in #{variant.name} you asked about is back. " \
      "Shall I keep #{quantity > 1 ? quantity : 'one'} for you?"
  end
end
