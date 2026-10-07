# What the storefront needs from tables that already exist.
class PrepareForTheShop < ActiveRecord::Migration[8.1]
  # A tiny stand-in for the model, so this migration keeps working even if
  # app/models/sales_channel.rb changes later (same trick as the migration
  # that created the channels).
  class Channel < ActiveRecord::Base
    self.table_name = "sales_channels"
  end

  def up
    # 1. She chooses what appears on the shop, product by product. Off by
    #    default: nothing goes public until she ticks it.
    add_column :products, :listed, :boolean, null: false, default: false
    add_index :products, :listed, where: "listed" # a partial index: only the listed rows

    # 2. An order placed on the website wasn't recorded by a member of staff.
    change_column_null :orders, :user_id, true

    # 3. The shopper's link to their order: /order/<token>. They have no
    #    login, so the link itself is the key. It must be unguessable, which
    #    an id (1, 2, 3...) is not.
    add_column :orders, :public_token, :string
    add_index :orders, :public_token, unique: true

    # 4. A channel for web orders, found by `system_key` so she can rename
    #    it ("Website", "Online shop") without the code losing track of it.
    add_column :sales_channels, :system_key, :string
    add_index :sales_channels, :system_key, unique: true

    Channel.reset_column_information
    unless Channel.exists?(system_key: "web")
      taken = Channel.where("lower(name) = 'website'").exists?
      Channel.create!(name: taken ? "Online shop" : "Website", kind: "direct", system_key: "web",
                      position: Channel.maximum(:position).to_i + 1)
    end
  end

  def down
    Channel.where(system_key: "web").delete_all
    remove_column :sales_channels, :system_key
    remove_column :orders, :public_token
    change_column_null :orders, :user_id, false
    remove_column :products, :listed
  end
end
