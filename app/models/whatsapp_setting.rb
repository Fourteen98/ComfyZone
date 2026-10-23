# The WhatsApp shop's settings: one row, edited in Settings > WhatsApp.
class WhatsappSetting < ApplicationRecord
  DEFAULT_WELCOME = "Welcome to The Comfy Zone by Fazy".freeze

  normalizes :momo_number, :momo_name, :momo_network, :welcome, with: ->(text) { text.to_s.squish.presence }

  validates :hold_minutes, numericality: { only_integer: true, greater_than_or_equal_to: 5, less_than_or_equal_to: 1440 }
  validates :momo_number, :momo_name, presence: { message: "is needed so the bot can tell people how to pay" }, if: :enabled?
  validates :welcome, length: { maximum: 120 }

  # The one row, made on first use.
  def self.current
    first || create!
  end

  # Keys are in the server's environment (see docs/whatsapp-setup.md).
  def self.connected?
    Whatsapp::Client.configured?
  end

  def greeting = welcome || DEFAULT_WELCOME

  # "MoMo 024 123 4567 (MTN), name: Fazila Issah"
  def momo_line
    [ "MoMo #{momo_number}", momo_network && "(#{momo_network})", momo_name && "name: #{momo_name}" ].compact.join(" ").sub(") name", "), name")
  end
end
