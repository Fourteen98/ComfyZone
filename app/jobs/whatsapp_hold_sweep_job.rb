# Every minute: any WhatsApp reservation past its hold time and still
# unpaid is released. A safety net under WhatsappHoldJob.
class WhatsappHoldSweepJob < ApplicationJob
  queue_as :default

  def perform
    Order.claimed.where(hold_until: ..Time.current, payment_claimed_at: nil, paid_pesewas: 0).find_each do |order|
      Whatsapp::Hold.expire(order)
    end
  end
end
