# Lesson 30: swapping a size

A delivered dress comes back: wrong size. She sends out the right one.
That is two stock movements and a change to the order, and they must all
happen together or not at all. `Order#swap!` does it in one transaction:

```ruby
order.swap!(item: line, to: l_black, quantity: 1, by: user,
            restock: true, same_price: true, send_again: true)
```

1. **The old one comes back.** `returned_quantity` goes up on its line, and
   (if it can be sold again) it goes back into stock as a "return".
2. **The new one goes out.** A "sale" movement with `guard_stock: true`, so
   if the L sold out a moment ago the whole swap is refused and nothing
   above is kept.
3. **The order is recalculated.** Totals come from what was *kept* on each
   line, so the old size stops counting and the new one starts.
4. **History.** A line is added to the order's note ("10 Oct: swapped
   1 × M / Black for L / Black"), and each stock movement says "Swap for ...".

## The three choices

| Choice | Default | Why |
| --- | --- | --- |
| `restock` | yes | Untick if it came back damaged |
| `same_price` | yes for another size of the same piece, no for a different piece | A size swap shouldn't change the bill; a different dress has its own price |
| `send_again` | yes | The order goes back to "To deliver" so the new one gets sent |

If the price changes, nothing special is needed for the money: the order's
balance simply becomes positive (they owe the difference, the order shows
in "Still owing") or negative (it shows in "Refunds due"). The existing
payment and refund screens handle the rest.

## Lines are unique per variant

`order_items` has a unique index on `(order_id, variant_id)`. So swapping
*to* something already on the order adds to that line rather than making a
second one (`find_or_initialize_by`). Swapping back to a size that was
swapped away earlier works the same way: its line gains quantity again.

## Who may do it

`orders.refund`, the same permission as returns: stock comes in and money
may change hands. Unpaid orders don't offer swaps at all; editing the order
is the simpler way to change a size before it is paid.

## When what they want isn't there: money back

The button is "Swap or refund an item", and the first question is **what
do they want instead?**

- **Something else:** another size, colour or piece (`Order#swap!`, above).
  Sizes and colours that are sold out still show, dashed. Tapping one says
  so and offers to **put them on the waiting list** for it (lesson 29), then
  to swap for something else for now or give their money back.
- **Their money back:** `Order#take_back!`.

```ruby
order.take_back!(item: line, quantity: 1, by: user, restock: true,
                 refund: { amount: "120", via: "momo", note: "Took back ... TX123" })
```

It takes the item back exactly like a swap does (returned quantity up,
restocked unless damaged, total follows what they kept), then records the
refund through the existing `Order#refund!`. Reusing it means the refund is
an ordinary negative payment: it shows in Money received, it can never be
more than they paid, and if it's wrong the **whole** take-back rolls back,
because `refund!` runs inside `take_back!`'s transaction.

The refund box starts at what those pieces cost them. If nothing is left on
the order it starts at everything they paid, delivery included, and the
order becomes "returned". Leave it empty to refund later: the order then
shows in "Refunds due" like any other.
