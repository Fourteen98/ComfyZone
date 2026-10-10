# Costs that belong to one live (data bundle, a host, a ring light hire)
# can be pinned to it, so a live's profit is what it really made.
class AddLiveSessionToExpenses < ActiveRecord::Migration[8.1]
  def change
    # on_delete: :nullify: deleting a live keeps the expense, just unpinned.
    add_reference :expenses, :live_session, foreign_key: { on_delete: :nullify }
  end
end
