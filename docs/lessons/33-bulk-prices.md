# 33. Bulk prices

## The rule

A product can have a **bulk price** and a **"from how many pieces"** (for example
GH₵ 100 from 6, normally GH₵ 120). An order gets the bulk price on a product when:

- it has that many pieces **of that product, any size or colour** (3 M + 3 L = 6), or
- the buyer is marked as a **bulk buyer** (Customers → Edit), whatever the count.

On the website, the count rule only works if she ticks "Offer the bulk price on the
website too". It is off by default, so wholesale prices stay private.

The bulk price never *raises* a price: a size already cheaper than it keeps its own
price.

## One rule, one place (`app/models/bulk_pricing.rb`)

The live screen, Record a sale, editing an order, the shop cart and the shop
checkout all need this rule. Five copies would drift apart, so there is one module:

- `BulkPricing.applies?(product, pieces:, bulk_buyer:, shop:)` checks whether the
  bulk price is on.
- `BulkPricing.unit_price(variant, bulk:)` gives the price of one piece.
- `BulkPricing.apply!(order)` brings every line of an order to the right price.

`OrderTaker` and `OrderEditor` call `apply!` after changing lines. The `Cart` calls
`applies?` for its own lines. The screen has a small copy of the rule in
`app/frontend/lib/bulk.ts`, only to show the total while she picks; **Rails decides
the real price when it saves.**

## Ideas worth knowing

**1. Re-pricing the whole order, not just the new line.** On a live, Ama claims 2
dresses, then 1 more ten minutes later. The third claim joins the same order, and
`apply!` counts *all* the dress lines (3), so the first two drop to the bulk price
too. If a piece is taken off later and the count falls below, they go back up.

**2. Respecting a hand-typed price.** On the edit page she can type any price for a
special deal. `apply!` only touches a line whose price is exactly the normal or the
bulk price. Anything else was typed by hand, so it is left alone (and not labelled
"bulk").

**3. Remembering how a line was priced (`order_items.bulk`).** Prices on an order
are snapshots (lesson on order items). The `bulk` flag remembers *why* a price was
lower, so the order page can say "Bulk price".

**4. A check constraint for "both or neither".** The database itself refuses a bulk
price without a count, or a count without a price:

```sql
(bulk_price_pesewas IS NULL AND bulk_min_quantity IS NULL)
OR (bulk_price_pesewas > 0 AND bulk_min_quantity >= 2)
```

The model gives friendly messages first. The constraint is the safety net.

## Where she sees it

- **Product form:** a "Bulk price (optional)" box, and the website switch.
- **Product page:** the bulk price under the selling price.
- **Picking products to sell:** "Bulk GH₵ 100 from 3" on the product row. In the
  sale, "1 more for the bulk price", then ~~GH₵ 120~~ **GH₵ 100 bulk**.
- **Customer:** a "Bulk buyer" switch and badge.
- **Order page:** "Bulk price" under those lines.
- **Website (if offered):** "Buy 6 or more, any size or colour: GH₵ 100 each", and
  the bag shows the crossed-out price.
