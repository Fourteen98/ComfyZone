# Where a sale came from: TikTok, WhatsApp, a walk-in...
# Managed in Settings > Sales channels.
class SalesChannel < ApplicationRecord
  include Positioned

  # Deleting a channel keeps its orders and lives, with the channel cleared.
  has_many :orders, dependent: :nullify
  has_many :live_sessions, dependent: :nullify

  # How buyers here are known: by a username, or by name and phone.
  enum :kind, { social: "social", direct: "direct" }, validate: { message: "is needed" }

  normalizes :name, with: ->(name) { name.squish }

  validates :name, presence: true, length: { maximum: 30 }, uniqueness: { case_sensitive: false }

  scope :ordered, -> { order(:position, :name) }
  scope :active, -> { where(active: true) }

  # The channel web orders are filed under. Found by its key, never by its
  # name, so renaming it in Settings is safe; made again if it was deleted.
  def self.web
    find_by(system_key: "web") || create!(name: exists?([ "lower(name) = 'website'" ]) ? "Online shop" : "Website", kind: "direct",
      system_key: "web", position: maximum(:position).to_i + 1)
  end

  # The channel a new live starts on: the one the last live used, otherwise
  # the first social one.
  def self.default_for_live
    last_used = LiveSession.newest_first.where.not(sales_channel_id: nil).first&.sales_channel
    last_used&.active? && last_used.social? ? last_used : active.social.ordered.first
  end
end
