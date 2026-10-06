# Settings > Roles: named sets of permissions.
class Settings::RolesController < InertiaController
  require_permission "roles.manage"
  before_action :set_role, only: %i[ edit update destroy ]
  before_action :protect_system_role, only: %i[ edit update destroy ]

  # GET /settings/roles
  def index
    # One query for the roles, one grouped query for the head counts,
    # instead of a separate COUNT per role (the "N+1 queries" problem).
    people = User.group(:role_id).count

    render inertia: "Settings/Roles/Index", props: {
      roles: Role.ordered.map { |role|
        {
          id: role.id,
          name: role.name,
          description: role.description,
          system: role.system,
          permissions_count: role.effective_permissions.size,
          users_count: people.fetch(role.id, 0)
        }
      },
      permissions_total: Permission::KEYS.size
    }
  end

  # GET /settings/roles/new
  def new
    render inertia: "Settings/Roles/Form", props: { role: nil, permission_groups: Permission.as_groups }
  end

  # POST /settings/roles
  def create
    role = Role.new(role_params)

    if role.save
      redirect_to settings_roles_path, notice: "Created the #{role.name} role."
    else
      redirect_to new_settings_role_path, inertia: { errors: role.errors }
    end
  end

  # GET /settings/roles/:id/edit
  def edit
    render inertia: "Settings/Roles/Form", props: {
      role: {
        id: @role.id,
        name: @role.name,
        description: @role.description,
        permissions: @role.permissions,
        users_count: @role.users.count
      },
      permission_groups: Permission.as_groups
    }
  end

  # PATCH /settings/roles/:id
  def update
    if @role.update(role_params)
      redirect_to settings_roles_path, notice: "Saved the #{@role.name} role."
    else
      redirect_to edit_settings_role_path(@role), inertia: { errors: @role.errors }
    end
  end

  # DELETE /settings/roles/:id
  def destroy
    if @role.destroy
      redirect_to settings_roles_path, notice: "Deleted the #{@role.name} role.", status: :see_other
    else
      redirect_to edit_settings_role_path(@role), alert: @role.errors.full_messages.to_sentence, status: :see_other
    end
  end

  private
    def set_role
      @role = Role.find(params.expect(:id))
    end

    def protect_system_role
      return if @role.editable?

      redirect_to settings_roles_path, alert: "The #{@role.name} role is built in and can't be changed."
    end

    # `permissions: []` means "an array of simple values".
    def role_params
      params.expect(role: [ :name, :description, permissions: [] ])
    end
end
