class AddDashboardLayoutToUsers < ActiveRecord::Migration[8.1]
  def change
    # Which dashboard tiles and panels this person chose, and in what order:
    #
    #   { "tiles": ["sales_today", "orders_to_pack"], "panels": ["recent_orders"] }
    #
    # jsonb is Postgres's JSON column type. It suits small, loosely shaped
    # settings that belong to one row and are always read whole. (It would be
    # the wrong choice for anything we need to search, sum or join on; that
    # belongs in proper columns and tables.)
    #
    # NULL means "never customised": the person gets the default layout, and
    # keeps getting improvements to the default until they choose their own.
    add_column :users, :dashboard_layout, :jsonb
  end
end
