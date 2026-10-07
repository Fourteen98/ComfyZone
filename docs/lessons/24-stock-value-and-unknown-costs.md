# Lesson 24: why "Stock value" showed nothing, and the difference between 0 and "unknown"

## The bug

Stock value is a simple sum:

```
for every item:  how many on the shelf  x  what each one cost
```

"What each one cost" is `variants.average_cost_pesewas`, and until now
**only one thing ever set it: receiving a purchase.** Stock that arrived any
other way (a stock take of what was already on the shelf, "found more")
came in with no cost. The column's default is 0, so:

```
10 dresses  x  GH₵ 0  =  GH₵ 0      <- "the stock value is not calculating"
```

and every sale of them recorded a cost of 0, so profit equalled the full
selling price.

Nothing was broken in the arithmetic. The data was missing, and the app
never said so.

## The lesson: 0 is not the same as "don't know"

A column with `default: 0` cannot tell "free" from "nobody told me". The
strict fix is a nullable column (`NULL` = unknown). That would touch every
sum in the app, so here the rule is written down instead and enforced in
the three places it matters:

1. **Say so.** The Stock page now shows how many in-stock items have no
   cost, with a "No cost yet" tab, and rows read "No cost yet" instead of
   "GH₵ 0.00". A wrong-looking total with an explanation beside it is a
   very different thing from a wrong-looking total alone.

2. **Let her fix it.** Each item's page has "What each one cost you"
   (`CostCorrection`, `Stock::CostsController`, `PATCH /stock/:id/cost`).
   One tick applies it to the product's other sizes and colours that have
   no cost yet. Ones that already have a cost from a purchase are never
   overwritten in bulk.

3. **Don't average with it.** `StockLedger.blended_cost` used to do this:

   ```
   4 on the shelf at "0"  +  4 arriving at GH₵ 60   ->   8 at GH₵ 30   (wrong)
   ```

   Now, when the cost on file is 0, the arriving price is taken as the
   cost of all of them:

   ```
   4 of unknown cost  +  4 arriving at GH₵ 60   ->   8 at GH₵ 60
   ```

## Correcting past sales

An order line keeps a snapshot of the cost at the moment of sale, and
snapshots are normally never touched. But a snapshot of 0 was never a real
cost. So `CostCorrection` fills in exactly those:

```ruby
OrderItem.where(variant: target, unit_cost_pesewas: 0).update_all(unit_cost_pesewas: @pesewas)
```

`update_all` is one SQL `UPDATE`. It skips validations and callbacks, which
is right here: there is nothing to validate, and there may be many rows.
Lines that already have a cost are outside the `where`, so they stay as
they were. Profit on reports and the dashboard corrects itself, because
those are worked out from the lines each time.

## One definition, used twice

The dashboard tile and the Stock page each had their own sum, and they
differed slightly (the tile counted archived products and negative counts).
Both now call `StockLedger.value_pesewas`:

```ruby
def self.value_pesewas
  sellable.sum("GREATEST(variants.stock_on_hand, 0) * variants.average_cost_pesewas")
end
```

Two screens showing "the same number" must get it from the same method, or
one day they won't match and nobody will know which is right.

## Try it

```ruby
StockLedger.uncosted.count          # in stock, no cost
StockLedger.value_pesewas / 100.0   # the tile's number, in cedis
```
