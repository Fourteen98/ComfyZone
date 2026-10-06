# Lesson 13: The stock page, history and adjustments

What changed: **Stock** is live. It shows what is on hand, flags what is
running low or out, opens any item's full history, and lets her correct a
count. The dashboard's "Low on stock" tile and panel now show real data.

After pulling this step, run:

```sh
bundle install && npm install && bin/rails db:migrate
bin/dev
```

## 1. What she can do

- **Stock page**: every size and colour of every active product, with
  totals on top and tabs for *Running low* and *Out of stock*.
- **History**: tap any item to see every change, newest first: what
  happened, when, who did it, and the count afterwards. Purchases link back
  to the purchase.
- **Correct the count**, with a reason:

  | She chooses | She types | Stock |
  |---|---|---|
  | I counted them | how many there are | is set to that number |
  | Some are damaged | how many | goes down |
  | Some are lost or stolen | how many | goes down |
  | Kept or gave some away | how many | goes down |
  | Found more | how many | goes up |

- **Warning level per product**, on the product form: "Warn me when stock
  drops to". Default 2; 0 turns the warning off.

This is also how a wrongly entered purchase is corrected: count the item
and record the count. The purchase stays as it was, and the history shows
both what was entered and the correction.

## 2. A form object: a model with no table

An adjustment has rules (a reason, a whole number, cannot go below zero) and
a little logic (which way the number moves). But it is not a new kind of
record: an adjustment *is* a stock movement. So there is no
`stock_adjustments` table, and yet we still want `valid?`, `errors` and
`save`. That is a **form object**:

```ruby
class StockAdjustment
  include ActiveModel::Model

  attr_accessor :variant, :user, :reason, :quantity, :note

  validates :reason, inclusion: { in: DIRECTIONS.keys }
  validates :quantity, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  def save
    return false unless valid?
    # ...work out the change, then StockLedger.record!(...)
  end
end
```

`ActiveModel::Model` is the part of Active Record that has nothing to do
with databases: attribute assignment, validations, errors. Include it in a
plain class and the controller can treat it exactly like a model:

```ruby
adjustment = StockAdjustment.new(adjustment_params.merge(variant: variant, user: Current.user))
if adjustment.save
  redirect_to ..., notice: "Stock updated."
else
  redirect_to ..., inertia: { errors: adjustment.errors }
end
```

Same skeleton as every other `create` in the app. Reach for a form object
when a form does not map one-to-one onto a table.

You now have three places for logic outside models and controllers, each
with a job:

| Kind | Example | Use when |
|---|---|---|
| Concern | `HasMoney` | the same behaviour is needed by several models |
| Plain object | `VariantGenerator`, `StockLedger` | logic spans models and belongs to none |
| Form object | `StockAdjustment` | a form has rules but no table of its own |

## 3. Lock first, then decide

"I counted 7" has to become a change: 7 minus whatever the app thinks. The
order of operations matters:

```ruby
variant.with_lock do
  change = change_for(variant.stock_on_hand)   # read AFTER locking
  StockLedger.record!(variant: variant, quantity: change, ...)
end
```

If the current figure were read before locking, a sale landing in between
would make the difference wrong, and the count would be off by exactly that
sale. Inside the lock, nothing else can touch the row. The same rule
applies to "is there enough to take away?": check it inside the lock.

The form shows a preview ("Stock will go from 40 to 37") worked out in the
browser. It is a courtesy; Rails works the real figure out again when
saving. Never trust a number the browser calculated.

## 4. Comparing columns across tables, in SQL

"Low" depends on the *product's* warning level, so the query compares a
column on one table with a column on another:

```ruby
Variant.active.joins(:product).merge(Product.active)
  .where("variants.stock_on_hand <= products.low_stock_at")
```

- `joins(:product)` makes product columns available to the query.
- `merge(Product.active)` reuses a scope from another model inside this
  query, so "what counts as an active product" is defined in one place.
- The comparison runs in the database, which returns only matching rows.

The stock page itself loads every variant once and counts the tabs in Ruby,
because it needs all of them anyway. The dashboard needs only the urgent
few, so it asks the database for just those. Choose by how much of the data
you actually need.

## 5. Two permissions, and data that stays on the server

- `stock.view` opens the stock pages; `stock.adjust` allows corrections.
  A test confirms that seeing stock is not enough to change it.
- Stock *value* (what it cost) needs `costs.view`. For anyone else the
  controller sends `nil`, so the figure is never in their browser.
- On the dashboard, `low_stock` is `nil` for people who may not see stock,
  and an empty list when nothing is low. Those mean different things
  ("not allowed to know" versus "nothing to report"), so they are different
  values, and React hides the panel only for `nil`.

## 6. One vocabulary

`StockMovement::REASONS` lists the codes stored in the database.
`app/frontend/lib/stock.ts` maps them to the words she reads. Every screen
that mentions a reason uses that one map, so "Lost or stolen" is never
"Missing" somewhere else. When two files must agree like this, a comment in
each points at the other.

`StockLevelBadge` shows "Low" or "Out" and nothing at all when stock is
fine, so the eye goes straight to what needs attention. The word is always
shown with the colour; colour alone would fail for anyone who cannot tell
amber from red.

## Not in this step

- **A full stock take** (counting everything in one sitting, on one screen)
  would be a useful addition later. For now each item is counted on its own page.
- **Adjustments do not change the average cost.** Finding three more of
  something adds them at the cost already on record.
- **No alerts are sent.** Low stock shows on the dashboard and stock page;
  notifications can come later.

## Try it yourself

1. **Count something** differently from what the app shows, then read its
   history.
2. **Set a product's warning level** to a number above its stock and watch
   it appear under *Running low* and on the dashboard.
3. **In the console**, use the form object directly:
   ```ruby
   v = Variant.where("stock_on_hand > 0").first
   a = StockAdjustment.new(variant: v, user: User.first, reason: "lost", quantity: 9999)
   a.save            # => false
   a.errors.full_messages
   ```
4. **Read the SQL**: `StockLedger.needing_attention.to_sql`
5. **Check the invariant** still holds after your adjustments:
   `Variant.all.all? { |v| v.stock_on_hand == v.stock_movements.sum(:quantity) }`
