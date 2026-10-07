# One row per DEVICE that has switched notifications on.
#
# When a phone agrees to notifications, its browser hands back an address
# (the endpoint, a long URL at Google's or Apple's push service) and two
# keys. Sending a notification means posting an encrypted message to that
# address. A person with a phone and a laptop has two rows.
class CreatePushSubscriptions < ActiveRecord::Migration[8.1]
  def change
    create_table :push_subscriptions do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.string :endpoint, null: false   # where to send
      t.string :p256dh, null: false     # the device's public key (to encrypt for it)
      t.string :auth, null: false       # a shared secret from the device
      # What this device wants to hear about: ["orders", "low_stock"].
      # A Postgres array, like roles.permissions.
      t.string :topics, array: true, null: false, default: []
      t.string :device                  # "iPhone", "Android phone"... for the list on My account
      t.datetime :last_sent_at
      t.timestamps
    end

    # A device subscribes once. If someone else logs in on the same phone,
    # the row moves to them rather than a second one appearing.
    add_index :push_subscriptions, :endpoint, unique: true
  end
end
