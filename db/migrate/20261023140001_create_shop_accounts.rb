# Accounts for shoppers on the website (staff log in with `users`, a
# separate world: a shopper can never reach the back office).
#
#   shop_accounts   one per phone number. Name, password (hashed), and the
#                   delivery details they saved, to fill in checkout.
#                   customer_id: the back office's record for this person
#                   (same phone), so her customer list stays one per person.
#   shop_sessions   one per device they are logged in on. A signed cookie
#                   holds its id for a year, so they rarely log in again.
#   shop_passkeys   Face ID / fingerprint logins, added from their account.
#   orders.shop_account_id   orders placed on the website while logged in.
#                   "My orders" shows only these (see ShopAccount).
#   whatsapp_settings.business_phone   the shop's WhatsApp number, for links.
class CreateShopAccounts < ActiveRecord::Migration[8.1]
  def change
    create_table :shop_accounts do |t|
      t.string :name, null: false
      t.string :phone, null: false, index: { unique: true }
      t.string :email
      t.string :password_digest, null: false
      t.string :webauthn_id, null: false, index: { unique: true }
      t.references :customer, foreign_key: { on_delete: :nullify }
      # Saved for checkout.
      t.string :delivery_method
      t.string :address
      t.string :country
      t.string :region
      t.string :place
      t.datetime :last_login_at
      t.timestamps
    end

    create_table :shop_sessions do |t|
      t.references :shop_account, null: false, foreign_key: { on_delete: :cascade }
      t.string :ip_address
      t.string :user_agent
      t.datetime :last_seen_at
      t.timestamps
    end

    create_table :shop_passkeys do |t|
      t.references :shop_account, null: false, foreign_key: { on_delete: :cascade }
      t.string :name, null: false
      t.string :external_id, null: false, index: { unique: true }
      t.text :public_key, null: false
      t.bigint :sign_count, null: false, default: 0
      t.datetime :last_used_at
      t.timestamps
    end

    add_reference :orders, :shop_account, foreign_key: { on_delete: :nullify }

    # The shop's own WhatsApp number, for "Message us" links on the website
    # (e.g. "Forgot password?"). Set in Settings > WhatsApp.
    add_column :whatsapp_settings, :business_phone, :string
  end
end
