class CreateSalesChannels < ActiveRecord::Migration[8.1]
  # A migration should not use the app's models (app/models/sales_channel.rb):
  # the model will change over the years, but this migration must keep
  # working exactly as written. So it declares a bare stand-in of its own,
  # which knows the table and nothing else.
  class Channel < ActiveRecord::Base
    self.table_name = "sales_channels"
  end

  class Live < ActiveRecord::Base
    self.table_name = "live_sessions"
  end

  def up
    # Where a sale came from: TikTok, WhatsApp, a walk-in...
    # Managed in Settings > Sales channels.
    create_table :sales_channels do |t|
      t.string :name, null: false
      # How buyers on this channel are known:
      #   social  by a username (@ama_k)
      #   direct  by their name or phone number
      # It decides what the "who is buying?" box asks for.
      t.string :kind, null: false, default: "social"
      t.integer :position, null: false, default: 0
      t.boolean :active, null: false, default: true
      t.timestamps
    end
    # An index on an expression: "TikTok" and "tiktok" count as the same name.
    add_index :sales_channels, "lower(name)", unique: true, name: "index_sales_channels_on_lower_name"
    add_check_constraint :sales_channels, "kind IN ('social', 'direct')", name: "sales_channels_kind_known"

    # Deleting a channel keeps its orders and lives, with the channel cleared.
    add_reference :orders, :sales_channel, null: true, foreign_key: { on_delete: :nullify }
    add_reference :live_sessions, :sales_channel, null: true, foreign_key: { on_delete: :nullify }

    # The starting list. These are created here, not only in db/seeds.rb,
    # because the app needs them to work and the backfill below needs TikTok.
    [ %w[ TikTok social ], %w[ Instagram social ], %w[ Facebook social ], %w[ Snapchat social ],
      %w[ WhatsApp direct ], [ "Phone call", "direct" ], %w[ Walk-in direct ] ].each_with_index do |(name, kind), index|
      Channel.create!(name: name, kind: kind, position: index + 1)
    end

    # Backfill. Until now every live was a TikTok live, so that much is
    # known for certain. Sales recorded outside a live are left empty: we
    # can't know where they came from, and a guess would spoil the reports.
    tiktok = Channel.find_by!(name: "TikTok")
    Live.update_all(sales_channel_id: tiktok.id)
    execute "UPDATE orders SET sales_channel_id = #{tiktok.id} WHERE live_session_id IS NOT NULL"
  end

  def down
    remove_reference :live_sessions, :sales_channel, foreign_key: true
    remove_reference :orders, :sales_channel, foreign_key: true
    drop_table :sales_channels
  end
end
