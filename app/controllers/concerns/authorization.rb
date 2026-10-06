# Authentication answers "who are you?". Authorization answers "are you
# allowed to do this?". This concern is the second half.
#
# In a controller:
#
#   class Settings::RolesController < InertiaController
#     require_permission "roles.manage"                      # every action
#     require_permission "orders.refund", only: :refund      # just one
#   end
module Authorization
  extend ActiveSupport::Concern

  included do
    helper_method :can?
  end

  class_methods do
    def require_permission(key, **options)
      key = Permission.fetch!(key) # a typo raises when the app boots
      before_action(**options) { authorize!(key) }
    end
  end

  private
    def can?(key)
      Current.user&.can?(key) || false
    end

    def authorize!(key)
      return if can?(key)

      redirect_to root_path, alert: "You don't have access to that. Ask an Owner if you need it."
    end
end
