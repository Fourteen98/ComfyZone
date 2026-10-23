# Every minute: unpaid claims past their deadline go back on sale (live,
# hand-recorded and WhatsApp alike), and deadlines coming up are announced.
# See ClaimHold. For WhatsApp, also a safety net under WhatsappHoldJob.
class ClaimHoldSweepJob < ApplicationJob
  queue_as :default

  def perform
    ClaimHold.sweep!
  end
end
