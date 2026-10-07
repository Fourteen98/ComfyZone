# Goods bought abroad are paid for in another currency. This records WHICH
# currency and the exchange rate she got, next to the cedi amounts the rest
# of the app already uses.
#
# Nothing existing changes meaning: unit_cost_pesewas stays the cedi cost
# (stock value and profit are worked out from it). The new columns keep the
# original figures so the purchase can be read, and edited, as it was paid.
class AddCurrencyToPurchases < ActiveRecord::Migration[8.1]
  def change
    # ISO code: "GHS", "USD", "CNY"... Every existing purchase was in cedis.
    add_column :purchases, :currency, :string, null: false, default: "GHS"
    # How many cedis ONE unit of that currency cost her (1 USD = 15.50).
    # decimal, never float: precision 12 / scale 4 holds up to 99,999,999.9999
    # exactly. Left empty for cedi purchases.
    add_column :purchases, :exchange_rate, :decimal, precision: 12, scale: 4

    # What one unit cost in the foreign currency, in its smallest unit
    # (cents, fen, kobo), the same way cedis are kept as pesewas.
    add_column :purchase_items, :foreign_unit_cost_minor, :integer

    # The database itself refuses a foreign purchase with no rate, and a
    # cedi purchase with one. A rule in the model can be skipped
    # (update_columns, a console slip); a check constraint can't.
    add_check_constraint :purchases,
      "(currency = 'GHS' AND exchange_rate IS NULL) OR (currency <> 'GHS' AND exchange_rate > 0)",
      name: "purchases_rate_matches_currency"
  end
end
