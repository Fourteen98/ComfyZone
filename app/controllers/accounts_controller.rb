# GET /account: the logged-in person's own page.
# No permission needed: everyone may manage their own passkeys.
class AccountsController < InertiaController
  def show
    render inertia: "Account/Show", props: {
      passkeys: Current.user.passkeys.ordered.map { |passkey|
        {
          id: passkey.id,
          name: passkey.name,
          created_at: passkey.created_at.strftime("%-d %b %Y"),
          last_used_at: passkey.last_used_at&.strftime("%-d %b %Y")
        }
      },
      # nil until the server has its VAPID keys (see app/models/push.rb);
      # the page then leaves notifications out altogether.
      push: Push.configured? ? {
        public_key: Push.public_key,
        topics: Push.topics_for(Current.user).map { |topic| { key: topic.key, label: topic.label, hint: topic.hint } },
        devices: Current.user.push_subscriptions.newest_first.map { |subscription|
          {
            id: subscription.id,
            endpoint: subscription.endpoint, # lets the page spot which row is THIS device
            device: subscription.device || "A device",
            topics: subscription.topics,
            added: subscription.created_at.strftime("%-d %b %Y")
          }
        }
      } : nil
    }
  end
end
