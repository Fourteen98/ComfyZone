# Lesson 10: Suppliers, purchases and the stock ledger

What changed: **Purchases** is live. She records what she buys, with
transport and fees; when the goods arrive, stock goes up and the app works
out what each item really cost. Products now show how many are in stock.

After pulling this step, run:

```sh
bundle install && npm install && bin/rails db:migrate
bin/dev
```

This is the heart of the system. Everything about stock and profit from
here on rests on three ideas introduced in this step: a ledger, a single
door for changes, and locking.

## 1. The life of a purchase

```
        Record a purchase
               |
               v
   +---------------------+   "The goods have arrived"   +----------------------+
   |  ordered            | ---------------------------> |  received            |
   |  "On the way"       |                              |  "In stock"          |
   |  editable, deletable|                              |  locked for good     |
   |  stock untouched    |                              |  stock + cost updated|
   +---------------------+                              +----------------------+
```

Two states, one direction. She can pay a supplier today and receive next
week, and stock is only counted when it is really on the shelf. The form's
two buttons map onto this: *Save, goods still on the way* and
*Save and add to stock*.

Once received, a purchase cannot be edited or deleted. That is deliberate:
the stock it added may already have been sold. Mistakes will be corrected by
a stock adjustment (next step), which leaves a visible trail, not by
rewriting the past.

## 2. The stock ledger

```
stock_movements for "Ankara wrap dress, M / Black"

  quantity   balance_after   reason       source           who
     +10          10         purchase     Purchase #4      Fazy
      -1           9         sale         Order #18        Ama       (coming)
      -1           8         adjustment   "damaged"        Fazy      (coming)
```

Every change to stock is one row, and rows are never edited or deleted:

```ruby
class StockMovement < ApplicationRecord
  def readonly?
    persisted?
  end
end
```

Rails checks `readonly?` before any update or delete, so `update` and
`destroy` on a saved movement raise an error. To fix a mistake you add a
row. When a number looks wrong, the history says exactly why.

`variants.stock_on_hand` is a **cache** of that history: the running total,
kept on the variant so lists and the live-sale screen can read it instantly.
The rule is that the cache must always equal the sum:

```ruby
variant.stock_on_hand == variant.stock_movements.sum(:quantity)   # always true
```

## 3. One door: `StockLedger`

That rule only holds if the two are always changed together. So exactly one
place in the app is allowed to change stock:

```ruby
StockLedger.record!(variant: v, quantity: 12, reason: "purchase",
                    source: purchase, total_cost_pesewas: 72_000, user: user)
```

It writes the movement, updates the running total, and updates the average
cost, inside one transaction. Purchases use it now; sales, returns and
adjustments will use the same door. Search the code for `stock_on_hand +=`
and you will find it in one file only. Keep it that way.

## 4. Locking: the bug you cannot see in testing

```ruby
variant.with_lock do
  variant.stock_on_hand += quantity
  variant.save!
  StockMovement.create!(...)
end
```

Imagine two helpers each selling the last dress at the same instant:

| Without a lock | With `with_lock` |
|---|---|
| A reads stock: 1 | A locks the row, reads 1 |
| B reads stock: 1 | B tries to lock, **waits** |
| A writes 0 | A writes 0, unlocks |
| B writes 0 | B now reads 0, and can refuse |
| Two sold, one existed | One sold |

`with_lock` runs `SELECT ... FOR UPDATE`, which makes the database queue
anyone else touching that row until you finish. This kind of bug never shows
up when one person tests alone, which is why it has to be designed out.

`Purchase#receive!` uses the same idea (`lock!`) so that tapping
"The goods have arrived" twice cannot add the stock twice. There is a test.

## 5. What an item really cost

She pays GH₵ 600 for dresses and GH₵ 400 for kaftans, plus GH₵ 100
transport. The transport is part of the cost of the goods, so it is shared
across them by value:

```
dresses carry 600/1000 of 100 = 60   ->  660 for 10  =  GH₵ 66 each, not 60
kaftans carry 400/1000 of 100 = 40   ->  440 for 5   =  GH₵ 88 each, not 80
```

Without this, every profit figure would be too high by her transport bill.

**To the exact pesewa.** Three equal lines sharing GH₵ 1.00 would get 33.33
each, losing a pesewa. `share_out_extra_costs` gives each line its share
rounded down, then hands out the leftover pesewas one at a time to the lines
that lost the most (the "largest remainder" method). The shares always sum
to exactly what she paid. Ruby's `Rational` keeps the fractions exact until
the last step.

**Moving average.** When new stock arrives at a different cost, it blends
with what is on the shelf:

```
10 on hand at GH₵ 50   +   10 arriving at GH₵ 70   =   20 at GH₵ 60
```

That average is what profit on each sale will be measured against.

## 6. New things in the migrations

- **`t.date`** for the purchase day: a date with no time of day.
- **`on_delete:` chosen per relationship.** Purchase lines cascade with
  their purchase (a line is meaningless alone). Variants *refuse* to be
  deleted while a line points at them (the default). Suppliers nullify.
  Three relationships, three different right answers.
- **Check constraints.**
  ```ruby
  add_check_constraint :purchase_items, "quantity > 0"
  ```
  The database itself rejects bad values, whatever code is talking to it.
  Model validations give friendly messages; constraints are the last line.
- **Polymorphic references.**
  ```ruby
  t.references :source, polymorphic: true   # source_type + source_id
  ```
  One pair of columns that can point at a Purchase today and an Order
  later. In the models: `belongs_to :source, polymorphic: true` and
  `has_many :stock_movements, as: :source`.
- **Adding NOT NULL columns with a default** to an existing table needs no
  backfill: existing rows simply get the default.

## 7. Retiring variants instead of deleting them

Lesson 7 left a note: once variants have history, unticking a size must not
delete them. Now it doesn't. `VariantGenerator` deletes a variant only if
nothing refers to it; otherwise it sets `active: false`, and ticking the
choice again brings the same variant back with its stock.

`product.variants` means the ones on sale now; `product.all_variants`
includes retired ones:

```ruby
has_many :variants, -> { where(active: true).order(:position) }
has_many :all_variants, class_name: "Variant", dependent: :destroy
```

## 8. Permissions on data, not just pages

A Sales assistant can open a product page but should not see what it cost.
The controller sends `nil` for fields a person may not see:

```ruby
stock: can?("stock.view") ? variant.stock_on_hand : nil,
average_cost_pesewas: can?("costs.view") ? variant.average_cost_pesewas : nil,
```

The number never reaches their browser, so there is nothing to find by
inspecting the page. Hiding a value with CSS or in React would not be enough.

## Things to know

- **Receiving is final.** Stock adjustments, coming next, are how you
  correct a wrong count.
- **One cost per product per purchase.** All sizes and colours of a product
  on one purchase share a unit cost, which matches how clothing is usually
  bought. If a supplier charges more for larger sizes, record them as two
  purchases for now.
- **Supplier is optional**, and typing a new name creates the supplier.

## Try it yourself

1. **Record a purchase** with two products and some transport, saving it as
   on the way. Check a product page: stock is still 0. Then mark it arrived.
2. **Read the ledger** in `bin/rails console`:
   ```ruby
   v = Variant.where("stock_on_hand > 0").first
   v.stock_movements.pluck(:quantity, :balance_after, :reason, :unit_cost_pesewas)
   v.stock_on_hand == v.stock_movements.sum(:quantity)
   v.stock_movements.first.source      # the Purchase it came from
   ```
3. **Try to cheat the ledger**: `StockMovement.last.update!(quantity: 999)`.
   Read the error.
4. **Check the cost maths** by hand for one line of your purchase against
   what the purchase page shows.
5. **Watch the lock**: with the server log visible, mark a purchase as
   arrived and find the `FOR UPDATE` in the SQL.
