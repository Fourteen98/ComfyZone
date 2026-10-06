# Adds name, active flag and role to users.
#
# This migration has a wrinkle worth studying: the table already has rows.
# We want `name` and `role_id` to be required (NOT NULL), but existing users
# have neither. So it runs in three stages:
#
#   1. add the columns, allowing NULL for now
#   2. fill them in for the rows that already exist
#   3. only then forbid NULL
#
# It uses `up`/`down` instead of `change` because step 2 is raw SQL, which
# Rails cannot reverse automatically.
class AddProfileAndRoleToUsers < ActiveRecord::Migration[8.1]
  def up
    # 1. Add the columns.
    add_column :users, :name, :string
    add_column :users, :active, :boolean, null: false, default: true
    add_reference :users, :role, foreign_key: true

    # 2. Backfill. Plain SQL on purpose: a migration should never call model
    #    classes (Role, User), because the models will keep changing long
    #    after this file is written, and the migration must still run on a
    #    fresh database years from now.
    #
    #    Anyone who already has a login was set up by the business owners,
    #    so they become Owners.
    execute <<~SQL
      INSERT INTO roles (name, description, system, permissions, created_at, updated_at)
      VALUES ('Owner', 'Full access to everything. Cannot be changed or removed.', TRUE, '{}', NOW(), NOW())
    SQL

    execute <<~SQL
      UPDATE users
      SET role_id = (SELECT id FROM roles WHERE name = 'Owner'),
          name    = INITCAP(SPLIT_PART(email_address, '@', 1))
    SQL

    # 3. Now every row has a value, so the rule can be enforced.
    change_column_null :users, :name, false
    change_column_null :users, :role_id, false
  end

  def down
    remove_reference :users, :role, foreign_key: true
    remove_column :users, :active
    remove_column :users, :name
    execute "DELETE FROM roles WHERE name = 'Owner' AND system = TRUE"
  end
end
