# 32. Supplies, item by item, from a dealer

## The need

Polymer bags, delivery stickers and tape are not stock (you don't sell them), so they
are **expenses**. But one trip to the packaging dealer brings several things at
once, plus a delivery charge, and next time you want to know what you paid and who
to call.

## What changed

**Database** (`db/migrate/20261010110001_add_supplies_to_expenses.rb`):

| Table | New | Why |
|---|---|---|
| `expenses` | `supplier_id` (optional) | who sold it, from the same supplier list as stock |
| `expenses` | `delivery_fee_pesewas` | what delivery cost on top |
| `expense_items` | name, quantity, unit_cost_pesewas | one line per kind of item |

An expense with **no lines** works exactly as before: one typed amount. An expense
**with lines** adds itself up:

```
500 × Polymer bags      @ 0.20 = 100.00
1000 × Delivery stickers @ 0.05 =  50.00
Delivery                           15.00
Total                             165.00   <- amount_pesewas
```

Reports, the dashboard and profit per live already read `amount_pesewas`, so they
needed no change at all. This is a good habit: **keep the number everything else
reads, and make the new detail feed it.**

## Ideas worth knowing

**1. `before_validation` to work out a value.** `Expense#total_from_lines` sets the
amount from the lines just before validating, so a typed amount can never disagree
with the lines.

**2. Replacing child rows safely (`lines=` + `autosave`).** Assigning
`expense.items = [...]` on a saved record writes to the database *immediately*,
even if the expense then fails validation. Instead, `lines=` *marks* the old lines
for destruction and *builds* the new ones in memory. `has_many ..., autosave: true`
then removes and adds them only when the expense saves, all in one transaction.

**3. Errors that point at the right box.** Each bad line is reported as
`lines.1.quantity`, and the form shows it under the second line's "How many".
`validate: false` on the association turns off Rails' vague "Items is invalid".

**4. A new supplier saved with the expense.** `belongs_to :supplier, autosave: true`
means a supplier typed into the form is checked first. If the phone number is wrong,
*nothing* is saved, so you never get an expense pointing at a half-made supplier.

**5. "What did I pay last time?" (`ExpenseItem.last_prices`).** Postgres's
`DISTINCT ON (lower(name))` with `ORDER BY lower(name), spent_on DESC` keeps one
row per item name: the newest one. The form uses it to suggest names and fill in
the last price ("Last time GH₵ 0.20 each, from Auntie Ama, 10 Oct").

## Where to find it

- **Expenses → Add an expense → Item by item.** Choose or add the dealer, with
  their phone number.
- **The supplier's page:** tap-to-call and WhatsApp, a **Record supplies** button,
  and a "Supplies from them" list. A dealer you only buy packaging from doesn't show
  the empty stock boxes.
- **Expenses list:** each row shows who it was from and what was in it.
  `?supplier_id=` shows one dealer's history.
