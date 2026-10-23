# One message in or out of a WhatsApp chat. Written by Whatsapp::Inbound
# (in) and Whatsapp::Client (out); WhatsApp's status updates (delivered,
# read, failed) are applied by wa_id.
class WhatsappMessage < ApplicationRecord
  belongs_to :whatsapp_conversation
  belongs_to :user, optional: true # staff who typed it

  validates :direction, inclusion: { in: %w[ in out ] }

  scope :inbound, -> { where(direction: "in") }
  scope :outbound, -> { where(direction: "out") }

  def inbound? = direction == "in"
end
