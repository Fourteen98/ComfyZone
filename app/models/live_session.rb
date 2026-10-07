# One live, on TikTok or any other social channel. See the migration for why only one can run at a time.
class LiveSession < ApplicationRecord
  belongs_to :user
  belongs_to :sales_channel, optional: true # the platform she is live on
  has_many :orders, dependent: :nullify

  normalizes :title, with: ->(title) { title.squish }

  before_validation :fill_in_defaults, on: :create

  validates :title, presence: true, length: { maximum: 60 }
  validate :channel_has_usernames
  validate :no_other_live_running, on: :create

  scope :running, -> { where(ended_at: nil) }
  scope :newest_first, -> { order(started_at: :desc) }

  # The live that is on right now, if any.
  def self.current
    running.first
  end

  def running?
    ended_at.nil?
  end

  def finish!
    update!(ended_at: Time.current) if running?
  end

  # Orders that still count as sales.
  def live_orders
    orders.counted
  end

  private
    def fill_in_defaults
      self.started_at ||= Time.current
      self.title = "Live, #{started_at.strftime('%-d %b')}" if title.blank?
    end

    def channel_has_usernames
      errors.add(:sales_channel, "must be somewhere buyers have usernames") if sales_channel && !sales_channel.social?
    end

    # A friendly message for the usual case. The unique index in the
    # database is what makes it truly impossible.
    def no_other_live_running
      errors.add(:base, "A live is already running. End it before starting another") if LiveSession.running.exists?
    end
end
