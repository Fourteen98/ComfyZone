# Passkeys: logging in with Face ID, a fingerprint or a device PIN.
#
# Two changes, because a passkey login needs two things stored:
#   1. on each user, a random id the device remembers them by
#   2. a table of the devices each user has registered
class CreatePasskeys < ActiveRecord::Migration[8.1]
  def up
    # --- 1. users.webauthn_id ---
    # An opaque id handed to the device instead of the email address, so a
    # passkey reveals nothing personal. Same three-stage pattern as the
    # roles migration: add as optional, fill in existing rows, then require.
    add_column :users, :webauthn_id, :string

    # gen_random_uuid() is built into Postgres; each existing user gets
    # their own random value.
    execute "UPDATE users SET webauthn_id = replace(gen_random_uuid()::text, '-', '')"

    change_column_null :users, :webauthn_id, false
    add_index :users, :webauthn_id, unique: true

    # --- 2. the passkeys table ---
    create_table :passkeys do |t|
      t.references :user, null: false, foreign_key: true

      t.string :name, null: false         # "Fazy's iPhone", so she can tell them apart
      t.string :external_id, null: false  # the id the device gives this key
      t.text :public_key, null: false     # used to check the device's signature

      # Devices count their uses. If the number ever goes backwards the key
      # may have been copied, and the login is refused.
      t.bigint :sign_count, null: false, default: 0

      t.datetime :last_used_at
      t.timestamps
    end

    add_index :passkeys, :external_id, unique: true
  end

  def down
    drop_table :passkeys
    remove_column :users, :webauthn_id
  end
end
