# 34. What the stock will sell for

## The question

"What it cost you" says how much money is sitting on the shelves. The next
question is: **if all of it sells, what comes back, and how much of that is
profit?**

## Where it shows

- **Stock page:** an "If everything on hand sells" card with two rows. One is the
  total at your selling prices, with the profit and margin. The other, shown only
  if some products have a bulk price, is the total if it all went at bulk prices,
  the lowest you'd expect.
- **Each product on the Stock page:** "Sells for GH₵ …" under its name.
- **Dashboard:** two new tiles you can switch on in "Edit dashboard": *Stock will
  sell for* and *Profit in your stock*.

People who may not see costs see what the stock sells for, but never the profit.

## How it's worked out (`StockLedger.sales_estimate`)

One SQL query adds up three sums over the same items the Stock page lists:

```sql
SUM(stock × COALESCE(variant price, product price))           -- sells for
SUM(stock × LEAST(that price, COALESCE(bulk price, that price))) -- at bulk prices
SUM(stock × average cost)                                       -- what it cost
```

- `COALESCE(a, b)` means "a, or b if a is empty". A size with its own price uses
  it, and every other size uses the product's price.
- `LEAST(...)` keeps the bulk total honest: a bulk price never *raises* a price,
  the same rule as `BulkPricing` (lesson 33).
- `GREATEST(stock, 0)` stops a miscounted negative stock from subtracting money.

The result is a small value object (`Data.define`) that also knows the profit
(`sells_for - cost`). Asking the database for three sums in one `pick` is one round
trip instead of loading every variant into Ruby.

## Why "estimate"

The card says so plainly. Delivery fees, discounts and hand-typed deals aren't in
it. Items with no cost recorded count as GH₵ 0 cost, which makes the profit look
bigger, so the card warns about that when it applies.
