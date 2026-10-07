# One device that has notifications switched on. See Push for the whole story.
class PushSubscription < ApplicationRecord
  belongs_to :user

  # The companies that run push services: Google (Chrome, Android, Samsung),
  # Apple (iPhone, Safari), Mozilla (Firefox) and Microsoft (Edge).
  SERVICES = %w[ googleapis.com push.apple.com mozilla.com windows.com ].freeze

  validates :endpoint, presence: true, uniqueness: true, length: { maximum: 2000 }
  validate :endpoint_is_a_push_service
  validates :p256dh, :auth, presence: true, length: { maximum: 500 }
  validate :topics_are_known

  # Rows whose topics array contains this one. `?` and ANY() is how you ask
  # Postgres "is this value in the array column" (same as roles.permissions).
  scope :wanting, ->(topic) { where("? = ANY (topics)", topic) }
  scope :newest_first, -> { order(created_at: :desc) }

  # Saves (or updates) the device's subscription for this person.
  #
  # The endpoint identifies the DEVICE, not the person. If a helper logs in
  # on a phone the owner used, the row is handed over to the helper instead
  # of both getting that phone's notifications.
  def self.register!(user:, endpoint:, p256dh:, auth:, device: nil)
    subscription = find_or_initialize_by(endpoint: endpoint)
    fresh = subscription.new_record? || subscription.user_id != user.id

    subscription.assign_attributes(user: user, p256dh: p256dh, auth: auth, device: device.to_s.first(60).presence)
    # A new device starts with everything this person is allowed to hear.
    subscription.topics = Push.topics_for(user).map(&:key) if fresh
    subscription.save!
    subscription
  end

  private
    # The endpoint comes from the browser, and the SERVER later posts to it.
    # Left unchecked, a logged-in person could save any address and have the
    # server send requests there, including to machines only the server can
    # reach. So only a real push service, over https, is accepted.
    def endpoint_is_a_push_service
      uri = URI.parse(endpoint.to_s)
      known = uri.is_a?(URI::HTTPS) && SERVICES.any? { |service| uri.host == service || uri.host.to_s.end_with?(".#{service}") }
      errors.add(:endpoint, "isn't a push service this app knows") unless known
    rescue URI::InvalidURIError
      errors.add(:endpoint, "isn't a valid address")
    end

    def topics_are_known
      unknown = topics - Push::TOPICS.map(&:key)
      errors.add(:topics, "has one this app doesn't know: #{unknown.to_sentence}") if unknown.any?
    end
end
