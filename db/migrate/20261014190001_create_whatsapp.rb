# Selling on WhatsApp (see app/models/whatsapp_bot.rb).
#
#   whatsapp_settings       one row: on/off, how long a reservation is held,
#                           and the MoMo details the bot sends for payment
#   whatsapp_conversations  one per customer phone number: where the bot is
#                           with them (state + context), and whether Fazy
#                           has taken over the chat
#   whatsapp_messages       every message in and out, for the inbox, and so
#                           a message WhatsApp delivers twice is handled once
#                           (wa_id is unique)
#   orders.hold_until       an unpaid WhatsApp reservation is cancelled then
#   orders.payment_claimed_at / payment_claim
#                           the customer says they paid (and the MoMo
#                           transaction ID): the clock stops, she confirms
class CreateWhatsapp < ActiveRecord::Migration[8.1]
  def change
    create_table :whatsapp_settings do |t|
      t.boolean :enabled, null: false, default: false
      t.integer :hold_minutes, null: false, default: 10
      t.string :momo_number
      t.string :momo_name
      t.string :momo_network
      t.string :welcome # the first line of the menu; a default is used if empty
      t.timestamps
    end

    create_table :whatsapp_conversations do |t|
      t.string :phone, null: false                    # +233241234567
      t.references :customer, foreign_key: true       # set once we know them
      t.string :profile_name                          # their WhatsApp name
      t.string :state, null: false, default: "menu"
      t.jsonb :context, null: false, default: {}
      t.datetime :handed_off_at                       # Fazy is replying herself
      t.datetime :last_inbound_at                     # opens the 24-hour window
      t.datetime :last_message_at
      t.integer :unread, null: false, default: 0
      t.boolean :sandbox, null: false, default: false # "Try it" in Settings: never touches real orders
      t.timestamps
    end
    add_index :whatsapp_conversations, :phone, unique: true
    add_index :whatsapp_conversations, :last_message_at

    create_table :whatsapp_messages do |t|
      t.references :whatsapp_conversation, null: false, foreign_key: { on_delete: :cascade }
      t.string :direction, null: false   # "in" or "out"
      t.string :wa_id                    # WhatsApp's own id for the message
      t.string :kind, null: false        # text, buttons, list, image, template, choice
      t.text :body                       # what it said, as text, for the inbox
      t.jsonb :payload, null: false, default: {}
      t.string :status, null: false      # received, sent, delivered, read, failed, simulated
      t.string :error
      t.references :user, foreign_key: true # a reply typed by staff
      t.timestamps
    end
    add_index :whatsapp_messages, :wa_id, unique: true, where: "wa_id IS NOT NULL"

    add_reference :orders, :whatsapp_conversation, foreign_key: true
    add_column :orders, :hold_until, :datetime
    add_column :orders, :payment_claimed_at, :datetime
    add_column :orders, :payment_claim, :string
    add_index :orders, :hold_until, where: "hold_until IS NOT NULL"
  end
end
