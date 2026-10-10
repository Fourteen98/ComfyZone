# Notifications that pop up on a phone even when the app is closed.
#
# How web push works, end to end:
#
#   1. On "My account" she taps "Turn on notifications". The browser asks
#      permission, then gives us an address for THAT device at Google's or
#      Apple's push service. We save it (PushSubscription).
#   2. Something happens (stock runs low). The app calls Push.notify, which
#      queues a background job.
#   3. The job posts a small encrypted message to each saved address. The
#      push service wakes the phone, and the phone wakes our service worker
#      (app/views/pwa/service-worker.js), which shows the notification.
#
# The VAPID keys are how the push service knows the message really comes
# from this app: we sign with the private key, and the phone was given the
# public one when it subscribed. They live in environment variables on the
# server (never in git). Make a pair with:  bin/rails push:keys
#
#   Push.notify("low_stock", title: "Running low", body: "Ankara dress: 2 left", path: "/admin/stock")
module Push
  Topic = Data.define(:key, :label, :hint, :permission)

  # What a device can ask to hear about. Each needs a permission: turning a
  # topic on never shows someone what their role may not see.
  TOPICS = [
    Topic.new("low_stock", "Stock running low", "When something drops to its warning level, or sells out.", "stock.view"),
    Topic.new("orders", "New sales", "When someone else records a sale (not during a live).", "orders.view"),
    Topic.new("back_in_stock", "Back in stock", "When something people asked for comes back.", "customers.view")
  ].freeze

  def self.topic(key)
    TOPICS.find { |topic| topic.key == key.to_s } || raise(ArgumentError, "unknown push topic #{key.inspect}")
  end

  def self.topics_for(user)
    TOPICS.select { |topic| user.can?(topic.permission) }
  end

  # --- setup ---

  def self.public_key  = ENV["VAPID_PUBLIC_KEY"].presence
  def self.private_key = ENV["VAPID_PRIVATE_KEY"].presence

  # Until both keys are set the feature is simply off: nothing is offered on
  # the Account page and Push.notify does nothing.
  def self.configured?
    public_key.present? && private_key.present?
  end

  # --- sending ---

  # Call this from anywhere. It returns at once; the sending happens in a job
  # after the current database transaction commits (see PushJob).
  #
  #   except: the person who caused it. Nobody needs a buzz about their own tap.
  def self.notify(topic_key, title:, body:, path: "/", except: nil)
    topic = topic(topic_key)
    return unless configured?

    PushJob.perform_later(topic.key, { "title" => title, "body" => body, "path" => path, "tag" => topic.key }, except&.id)
  end

  # Used by the job: everyone who should get this topic right now.
  def self.audience(topic_key, except_user_id: nil)
    topic = topic(topic_key)

    PushSubscription.wanting(topic.key).includes(user: :role)
      .reject { |subscription| subscription.user_id == except_user_id }
      .select { |subscription| subscription.user.active? && subscription.user.can?(topic.permission) }
  end

  # One message to one device. True if the push service accepted it.
  def self.deliver(subscription, payload)
    WebPush.payload_send(
      message: payload.to_json,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      vapid: { subject: ENV.fetch("APP_ORIGIN", "https://comfyzone.shop"), public_key: public_key, private_key: private_key },
      urgency: "high",     # wake the phone now, don't wait for it to be in use
      ttl: 12.hours.to_i   # if the phone is off, keep trying this long, then give up
    )
    subscription.update_column(:last_sent_at, Time.current)
    true
  rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription, WebPush::Unauthorized
    # The phone unsubscribed, the app was removed, or the keys changed. The
    # address is dead for good, so forget it rather than failing every time.
    subscription.destroy
    false
  rescue WebPush::ResponseError, SocketError, Timeout::Error, SystemCallError, OpenSSL::SSL::SSLError => problem
    # Anything else (push service down, no network) is worth a log line but
    # must never break whatever caused the notification.
    Rails.logger.warn("Push to subscription #{subscription.id} failed: #{problem.class}: #{problem.message.to_s.first(200)}")
    false
  end
end
