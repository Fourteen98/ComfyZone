# Lesson 27: correcting a purchase that is already in stock

Until now a purchase locked the moment its goods arrived. The reason was
sound: receiving it wrote stock movements and set average costs, and
changing the purchase afterwards would leave those out of step. But people
forget things, so the lock is replaced by a correction that keeps stock in
step: `Purchase#revise!`.

## The same pattern as editing an order

`OrderEditor` (lesson 19) already does this for sales: the form sends the
order **as it should now be**, and only the difference moves through the
stock ledger. `revise!` is the same idea for purchases:

```ruby
purchase.assign_attributes(purchase_params)   # date, supplier, costs, note...
purchase.revise!(lines, by: Current.user)     # lines = the whole purchase, as it should be
```

For each item it compares before and after (quantity, landed total):

| What changed | What happens |
| --- | --- |
| More units | the extra go into stock, at their landed cost (blended into the average) |
| Fewer units | they come out again, with `guard_stock: true` |
| Same units, new price | the units still on the shelf are re-valued |

Every stock change is an ordinary movement with reason "purchase", the
purchase as its source, and the note "Purchase corrected", so the item's
history shows exactly what happened and why.

## You can't un-buy a sold dress

Lowering a quantity takes units out of stock. If they have already been
sold, there is nothing to take out: `StockLedger.record!(... guard_stock: true)`
raises `NotEnough`, `revise!` catches it, rolls the whole transaction back
and says why. Nothing is half-saved.

## Re-valuing without moving stock

A corrected price changes what the shelf is worth, not how many are on it.
`StockLedger.revalue!` adjusts the average cost directly:

```
12 on the shelf at GH₵ 50; 10 of them came from a purchase now known to have
cost GH₵ 3 more each:     (12 × 50 + 10 × 3) / 12 = GH₵ 52.50
```

Only units still on the shelf can be re-valued (at most `stock_on_hand` of
them). Ones already sold went out at the old cost, and their order lines
keep it: a sale is a record of that day.

## A trap worth remembering: `lock!` reloads

```ruby
purchase.assign_attributes(note: "new")
purchase.lock!      # SELECT ... FOR UPDATE, then RELOADS the record
purchase.note       # => the OLD note
```

`lock!` is `reload(lock: true)`, so anything assigned but not yet saved is
thrown away. `revise!` locks the row with `Purchase.lock.find(id)` instead,
which locks it in the database without touching the object in hand.

## Another: asking the database for records you haven't saved

After `items.destroy_all` and `items.build(...)`, the new lines exist only
in memory. `items.includes(...).to_a` runs a query, finds nothing (they
aren't saved), and returns `[]`. The first version of `revise!` did exactly
that and quietly took everything out of stock. A test caught it. The fix is
to use the in-memory lines (`live_items`).

## Deleting, behind its own permission

A purchase still on the way can be deleted by anyone with
`purchases.manage`: nothing touched stock.

A purchase already in stock needs **`purchases.delete`** ("Delete purchases
already in stock"). Owners have it automatically (the system role can do
everything, including permissions added later); for other roles tick it in
Settings > Roles.

`Purchase#remove!` takes each item's units back out of stock (one movement
each, note "Purchase deleted (supplier, date)") and then deletes the
purchase, all in one transaction. If some of the stock has been sold
already, there is nothing to take out, so the whole delete is refused:
"correct it instead".

Plain `purchase.destroy` still refuses a received purchase. Only `remove!`,
the deliberate path, can delete one. A guard that the normal method keeps,
with one explicit way around it, is safer than removing the guard.

The movements the purchase made when it arrived stay in each item's
history: the ledger is never rewritten. Their link to the purchase just
leads nowhere now (`movement.source` returns nil for a deleted record).
