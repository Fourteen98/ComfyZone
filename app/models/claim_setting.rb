# How long an unpaid claim keeps its stock: one row, edited in
# Settings → Unpaid claims. nil hours = no deadline for that kind.
#
#   live_pay_hours  claims taken during a live (TikTok, Instagram...)
#   sale_pay_hours  sales recorded by hand (Record a sale)
#   remind_hours    how long before the deadline she is warned
#
# WhatsApp reservations have their own, much shorter clock (WhatsappSetting).
class ClaimSetting < ApplicationRecord
  HOURS = { only_integer: true, greater_than_or_equal_to: 1, less_than_or_equal_to: 720, allow_nil: true,
            message: "must be between 1 hour and 30 days (720 hours), or empty for no deadline" }.freeze

  validates :live_pay_hours, :sale_pay_hours, numericality: HOURS
  validates :remind_hours, numericality: { only_integer: true, greater_than_or_equal_to: 1, less_than_or_equal_to: 48 }

  # The one row, made on first use.
  def self.current
    first || create!
  end

  # The deadline that applies to this order, in hours, or nil for none.
  # WhatsApp reservations and website orders have their own ways.
  def hours_for(order)
    return if order.whatsapp_conversation_id || order.user_id.nil?

    order.live_session_id ? live_pay_hours : sale_pay_hours
  end
end
