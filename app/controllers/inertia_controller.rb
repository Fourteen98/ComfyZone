# Parent class for every controller that renders a React page.
#
# `inertia_share` adds props to EVERY page automatically, so each controller
# doesn't have to repeat them. The block runs once per request.
# On the React side these arrive through `usePage().props`.
class InertiaController < ApplicationController
  inertia_share do
    user = Current.user

    {
      auth: {
        # Only send the fields React needs, never the whole record
        # (it would include password_digest).
        user: user && {
          id: user.id,
          name: user.name,
          email_address: user.email_address,
          role: user.role.name
        },
        # What this person may do. React uses it to hide buttons and menu
        # items. That is a convenience only: the real check is always
        # `require_permission` in the controller.
        permissions: user ? user.effective_permissions : []
      },
      # Small counts shown as badges in the menu, on every page, so things
      # that need doing are noticed without opening the dashboard. Two cheap
      # COUNT queries per request; nil = this person may not see it.
      alerts: {
        low_stock: user&.can?("stock.view") ? StockLedger.needing_attention.count : nil,
        to_pack: user&.can?("orders.view") ? Order.paid.count : nil
      }
    }
  end
end
