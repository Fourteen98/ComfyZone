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
      }
    }
  end
end
