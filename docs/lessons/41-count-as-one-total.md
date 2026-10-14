# 41. Counting a product as one total

## When to use it

The sizes and colours of a product have drifted ("the app says 2 Black M, the
shelf says 0"), but you know the **total** is right, and counting every size
again isn't worth it today.

**Stock → open the product → "Sizes don't add up? Count as one total"**, then
type how many there are in all. From then on:

- The Stock page shows one number: **"8 in stock, all sizes and colours
  together"**. The product page shows it too.
- **Any size or colour can be sold** while the total is above 0. The sale screen
  says "8 left in all sizes and colours together" and offers every colour and
  size.
- **Sales still record which size and colour went**, so reports, best sellers,
  the restock advice and returns all keep working.
- *Low*, *Out*, push alerts and the waiting list use the total. The product
  counts once, not once per size.
- **Change total** fixes the number. **Count by size again** switches back and
  opens the stock take, so each size can be counted properly.

## How it works without breaking anything

**The ledger still keeps stock per variant.** Pooling writes ordinary "recount"
movements: the first size gets the whole total and the rest go to 0. That's
where the number is *kept*, not what it *means*.

**Selling goes through one door, `StockLedger.sell!`.** For a normal product it's
the usual guarded movement. For a pooled one it locks the *product* (two helpers
can't both sell the last piece), checks the total, and takes the pieces from the
sizes that hold stock, noting "Sold as M / Red (stock counted as one total)".
**No count ever goes below zero**, so stock value, the sales estimate and profit
are all exactly as before, and none of that code changed.

**Reading "how many can be sold" goes through `Variant#available`.** For a pooled
product it's the product's total, for others its own count. The sale screen, the
shop, `stock_level`, the waiting list and the low-stock list all ask that one
question.

**One honest cost.** Once the sizes' counts are mixed, so are their costs. Pooling
gives every size the product's average cost, worked out from what was on the
shelf.

**Advice still works.** The restock advisor can't know each size's count, so it
shares the total out the way the sizes have been selling (equally if none has
sold), which is the best available guess.
