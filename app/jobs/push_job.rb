# Sends one notification to every device that wants it.
#
# A job, because each send is a web request to Google or Apple that can take
# a second or more; nobody recording a sale should wait for that. In
# production Solid Queue runs it inside the Puma process (SOLID_QUEUE_IN_PUMA).
class PushJob < ApplicationJob
  queue_as :default

  # Don't put the job on the queue until the database transaction that
  # caused it has committed. Stock changes happen inside transactions; if the
  # sale is rolled back (say the last one had just sold), no notification
  # must go out about it.
  self.enqueue_after_transaction_commit = true

  def perform(topic_key, payload, except_user_id = nil)
    return unless Push.configured?

    Push.audience(topic_key, except_user_id: except_user_id).each do |subscription|
      Push.deliver(subscription, payload)
    end
  end
end
