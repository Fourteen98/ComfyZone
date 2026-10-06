# Settings > Team: the people who can log in, and what role each has.
#
# The `Settings::` prefix (and the settings/ folder) is a namespace. It keeps
# these URLs under /settings/... and leaves the name UsersController free.
class Settings::UsersController < InertiaController
  require_permission "users.manage"
  before_action :set_user, only: %i[ edit update ]

  # GET /settings/users
  def index
    users = User.includes(:role).order(:name)

    render inertia: "Settings/Users/Index", props: {
      users: users.map { |user| user_props(user) }
    }
  end

  # GET /settings/users/new
  def new
    render inertia: "Settings/Users/Form", props: {
      user: nil,
      roles: role_options
    }
  end

  # POST /settings/users
  def create
    user = User.new(user_params)

    if user.save
      redirect_to settings_users_path, notice: "#{user.name} can now log in."
    else
      # Send the model's validation errors back to the form. React shows
      # each one under its field.
      redirect_to new_settings_user_path, inertia: { errors: user.errors }
    end
  end

  # GET /settings/users/:id/edit
  def edit
    render inertia: "Settings/Users/Form", props: {
      user: user_props(@user),
      roles: role_options
    }
  end

  # PATCH /settings/users/:id
  def update
    attributes = user_params
    # A blank password box means "leave the password alone".
    attributes = attributes.except(:password) if attributes[:password].blank?

    if @user.update(attributes)
      # Switching someone off also logs them out everywhere, immediately.
      @user.sessions.destroy_all unless @user.active?
      redirect_to settings_users_path, notice: "Saved changes to #{@user.name}."
    else
      redirect_to edit_settings_user_path(@user), inertia: { errors: @user.errors }
    end
  end

  private
    def set_user
      @user = User.find(params.expect(:id))
    end

    # Strong parameters: the only fields a browser is allowed to set.
    # `expect` returns 400 Bad Request if the shape is wrong.
    def user_params
      params.expect(user: [ :name, :email_address, :role_id, :password, :active ])
    end

    def user_props(user)
      {
        id: user.id,
        name: user.name,
        email_address: user.email_address,
        active: user.active,
        role: { id: user.role.id, name: user.role.name },
        is_you: user == Current.user
      }
    end

    def role_options
      Role.ordered.map { |role| { id: role.id, name: role.name, description: role.description } }
    end
end
