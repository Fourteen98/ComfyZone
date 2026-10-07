class AddDashboardLayoutToRoles < ActiveRecord::Migration[8.1]
  def change
    # The dashboard people in this role start with, until they customise
    # their own. Same shape as users.dashboard_layout. NULL = the app's
    # standard layout.
    add_column :roles, :dashboard_layout, :jsonb
  end
end
