# Lesson 19: Editing orders and lives

What changed, following your feedback: things she has recorded can now be
**corrected**, not only removed. An order's items, quantities, prices,
buyer, channel and note can be edited; a live can be renamed, moved to
another platform, or deleted if nothing was sold on it.

After pulling this step, run:

```sh
bundle install && npm install && bin/rails db:migrate
bin/dev
```

(There is no migration in this step; the command is harmless.)

## 1. What she can do

- **Edit** on any order page:
  - change a **quantity**, **add** another item, or **remove** one
  - change the **price** of a line, for a discount or a price agreed on
    the live. The product's own price is not touched.
  - **change the buyer** (picked the wrong person, or mistyped a username)
  - change **where the sale came from**, and add a **note**
- **Edit** on any live: rename it, change the platform (its orders follow),
  or delete it if it has no orders.

Stock follows every change: make 2 into 3 and one more leaves the shelf;
drop a line and it goes back.

## 2. What is editable, and what is not

Your rule was "everything except the obvious ones". Written down:

| Thing | Editable? | Why |
|---|---|---|
| Order: buyer, channel, note | always | they *describe* the order |
| Order: items, quantities, prices | while "To be paid" | after that, money was taken against those exact lines |
| Delivery details | until delivered | (lesson 15) |
| Live: name, platform | always | |
| Live with no orders | can be deleted | a mis-tap |
| Expenses, customers, suppliers, products | always | |
| Purchase not yet received | always | |
| **Payments** | never: record a refund | a ledger of money that moved |
| **Stock movements** | never: adjust | a ledger of goods that moved |
| **Received purchase** | never: adjust stock | its stock may already be sold |

The line runs between **descriptions** and **events**. A description can be
wrong and should be fixable. An event happened; you can't un-happen it,
you can only record a second event that corrects it. Once a paid order's
items could be silently rewritten, the payments on it would no longer
explain themselves.

To change the items on a paid order: refund the payment (the order goes
back to "To be paid"), edit, and take payment again. More steps, on
purpose, and every one of them leaves a trace.

## 3. Editing as "here is how it should be now"

There are two ways to design an edit:

- **Commands**: "add one of X", "remove Y", "set price of Z". Many small
  requests, each with its own endpoint.
- **Desired state**: the form sends the *whole order as it should now be*,
  and the server works out the difference.

`OrderEditor` does the second:

```ruby
order.items.each do |item|
  want = target.delete(item.variant_id)
  if want.nil?
    move_stock(item.variant, item.quantity, "cancellation")     # gone: all back
    item.destroy!
  else
    difference = want[:quantity] - item.quantity
    move_stock(item.variant, -difference, ...) unless difference.zero?   # only the change
    ...
  end
end
target.each { |variant_id, want| ... }                           # whatever is left is new
```

Compare what exists with what is wanted, act on the difference. This
"reconcile" shape is everywhere in software (it is how React updates a
page, and how `VariantGenerator` syncs variants in lesson 7). Its strength:
saving the same form twice does nothing the second time. There is a test,
"an unchanged order moves no stock".

**Only the difference touches the ledger.** Going from 2 to 3 writes one
movement of -1, not "+2 back, -3 out". The history then reads like what
happened.

## 4. One transaction, one lock, again

An edit can touch a customer, the order, several lines and several stock
movements. As with `OrderTaker`:

```ruby
Order.transaction do
  order.lock!
  ...
rescue StockLedger::NotEnough => problem
  errors.add(:items, problem.message)
  raise ActiveRecord::Rollback
end
```

If she raises one line and adds another, and the second has just sold out,
*nothing* changes: the first line's extra stock is put back by the
rollback. The test "more than there is refuses the whole edit" checks the
shelf afterwards.

One new detail: `order.reload unless saved`. A rollback undoes the
database, but the Ruby objects in memory still hold the half-made changes.
After a failed save, throw that state away.

## 5. Stock that is "yours already"

The edit page shows how many more of each thing she can add. For a variant
already on the order, the honest number is *on the shelf + what this order
is holding*:

```ruby
variant[:stock] += on_order.fetch(variant[:id], 0)
```

With 3 on the shelf and 2 on this order, she can set the quantity anywhere
up to 5. The server still decides when she saves.

## 6. A price on the line, not on the product

`order_items.unit_price_pesewas` was already a snapshot (lesson 14). Making
it editable is all a discount needs: no discount table, no percentage
field. The line simply records what she charged, and profit follows because
cost is a separate snapshot. Reports need no change.

## 7. "Only what was sent"

```ruby
note: given.key?(:note) ? given[:note] : @order.note,
```

An update should change the fields that were sent and leave the rest. If a
missing `note` were treated as blank, any future form that edits only the
channel would silently wipe notes. `key?` distinguishes "sent as empty"
(clear it) from "not sent" (leave it). There is a test for it.

## 8. Extracting on the second use, on the React side

The product list (search, tap to open sizes, tap to add) lived inside
`SaleCapture`. The edit page needed the same list, so it became
`components/ProductPicker.tsx`. `SaleCapture` got about a hundred lines
shorter and behaves exactly as before.

What moved and what stayed is the lesson:

- **Stayed with the parent**: the basket (what is picked). Each parent
  means something different by it: a new sale, or an order being changed.
- **Moved into the picker**: the search text and which product is open.
  Nobody else cares about those.

Keep state in the lowest component that needs it; lift only what must be
shared.

## Things to know

- **A live's orders follow the live's platform.** An order claimed on a
  live can't have its channel changed by itself; change the live instead.
- **Changing the buyer moves the whole order** to the other customer.
- **Deleting an order is not offered.** Cancel it; it stays in the record,
  marked cancelled.
- **Who can edit**: anyone with *Record sales*.

## Try it yourself

1. **Edit an order**: raise a quantity, discount a line, add an item, save.
   Then open one of those items under Stock and read its history.
2. **Save without changing anything** and confirm no new stock movement
   appears.
3. **Hit the wall**: pay an order in full, then open Edit.
4. **In the console**, watch the ledger stay honest:
   ```ruby
   o = Order.claimed.last
   v = o.items.first.variant
   v.stock_on_hand == v.stock_movements.sum(:quantity)
   o.stock_movements.pluck(:quantity, :reason)
   ```
5. **Read `OrderEditor#change_lines`**, then `VariantGenerator` from
   lesson 7. Both reconcile "what is" with "what should be". Spot the same
   three cases in each: keep, remove, add.
