# A sale saved halfway: the buyer, what they picked, prices agreed, delivery,
# whether they paid. Picked up later from Record a sale, by anyone who can
# record sales. A draft holds NO stock: stock is only taken when the sale
# is recorded, so a forgotten draft never locks anything away.
#
# `payload` is jsonb: the screen's own state, stored as it is. It is only
# ever read back by that screen, and checked by Rails when finally recorded.
class CreateOrderDrafts < ActiveRecord::Migration[8.1]
  def change
    create_table :order_drafts do |t|
      t.references :user, null: false, foreign_key: true  # who started it
      t.string :label, null: false                       # "Ama Owusu: 3 items, GH₵ 555"
      t.jsonb :payload, null: false, default: {}
      t.timestamps
    end
    add_index :order_drafts, :updated_at
  end
end
