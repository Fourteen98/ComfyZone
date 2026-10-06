# GET /settings has no page of its own: it sends you to the first settings
# section you are allowed to open.
class SettingsController < InertiaController
  def show
    if can?("settings.manage")
      redirect_to settings_option_presets_path
    elsif can?("users.manage")
      redirect_to settings_users_path
    elsif can?("roles.manage")
      redirect_to settings_roles_path
    else
      redirect_to root_path, alert: "You don't have access to Settings."
    end
  end
end
