class AddCategoryToProducts < ActiveRecord::Migration[8.1]
  def change
    # A product has at most one category, and may have none (null: true), so
    # existing products need no backfill.
    #
    # on_delete: :nullify is a rule enforced by the DATABASE: if a category
    # row is deleted, its products are kept and their category_id becomes
    # NULL. The alternative, :cascade, would delete every product in the
    # category along with it. For a table other records depend on, cascade
    # is almost never what you want.
    add_reference :products, :category, null: true, foreign_key: { on_delete: :nullify }
  end
end
