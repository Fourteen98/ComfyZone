# Unpaid claims get a deadline ("pay within 24 hours"), and customers get a
# record of how often they actually pay.
#
#   claim_settings          one row: how long live claims and hand-recorded
#                           sales may stay unpaid (nil = no deadline), and how
#                           long before the deadline she is warned.
#   orders.cancel_reason    "unpaid" when it was released (or cancelled by her)
#                           because the buyer never paid. Counted against the
#                           customer's reliability. Other cancellations: nil.
#   orders.hold_reminded_at when she was warned the deadline is near, so the
#                           warning goes once.
#
# orders.hold_until already exists (the WhatsApp reservation clock); live and
# hand-recorded claims now use it too.
class AddClaimDeadlines < ActiveRecord::Migration[8.1]
  def change
    create_table :claim_settings do |t|
      t.integer :live_pay_hours, default: 24 # live claims: on, a day to pay
      t.integer :sale_pay_hours               # sales recorded by hand: off until she turns it on
      t.integer :remind_hours, null: false, default: 3
      t.timestamps
    end

    add_column :orders, :cancel_reason, :string
    add_column :orders, :hold_reminded_at, :datetime

    reversible do |direction|
      direction.up do
        # WhatsApp reservations released before today were marked in the note.
        execute "UPDATE orders SET cancel_reason = 'unpaid' WHERE status = 'cancelled' AND note LIKE '%Not paid in time%'"
        # Devices that hear about new sales also hear about unpaid claims.
        execute "UPDATE push_subscriptions SET topics = array_append(topics, 'claims') " \
                "WHERE 'orders' = ANY (topics) AND NOT ('claims' = ANY (topics))"
      end
    end
  end
end
