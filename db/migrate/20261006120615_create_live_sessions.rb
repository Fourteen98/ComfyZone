class CreateLiveSessions < ActiveRecord::Migration[8.1]
  def change
    # One TikTok live. Orders claimed during it are tagged with it, which is
    # what lets her see which lives actually make money.
    create_table :live_sessions do |t|
      t.string :title, null: false
      t.datetime :started_at, null: false
      t.datetime :ended_at # NULL while the live is still running
      t.references :user, null: false, foreign_key: true # who started it
      t.text :note

      t.timestamps
    end

    # At most ONE live can be running at a time. A unique index on a
    # constant, limited to rows where ended_at is NULL, lets a single such
    # row exist: a second one would collide on the constant. The database
    # guarantees it even if two people tap "Start" at the same instant.
    add_index :live_sessions, "(1)", unique: true, where: "ended_at IS NULL", name: "index_live_sessions_one_running"
    add_index :live_sessions, :started_at
  end
end
