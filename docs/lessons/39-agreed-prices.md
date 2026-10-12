# 39. Agreed prices: when the buyer bargains

## The situation

The bulk price for Amazon pants starts at 10 pieces. A buyer takes 6 and bargains:
"GH₵ 180 each". The usual price doesn't apply, the bulk price doesn't apply, and
the agreed price should be recorded as it is.

## How she does it

On **Record a sale** or the **live screen**, every line in "This sale" has a small
**✎ Price** button. Tap it and type the agreed price for one piece. The line shows
~~GH₵ 200.00~~ **GH₵ 180.00 agreed**, and the total follows. **Back to the normal
price** undoes it.

On the order page the line says *"Agreed price, normally GH₵ 200.00 each"*. On
the order's **Edit** page she can still change it later, the same way as before.

## The rules (`OrderTaker#agree_price`, `OrderEditor#set_price`, `BulkPricing`)

| She types | What happens |
|---|---|
| a price different from the normal one | saved, and the line is marked `agreed` |
| the normal price | no bargain: it's a normal line again, and bulk can apply |
| nothing | normal or bulk price, as before |
| nonsense ("1o0") | the sale is refused with which item and why, and no stock moves |

**An agreed price always wins.** If a 3rd dress later in the live reaches the bulk
count, the bulk rule re-prices the *other* lines, but never an agreed one. A deal
at exactly the bulk price below the count stays too.

**Shoppers can't set prices.** The website ignores a price sent with an order.
Only the back office can bargain.

## Ideas worth knowing

**Store the reason, not just the number (`order_items.agreed`).** A price of
GH₵ 180 alone doesn't say *why* it's lower: bulk, or a deal? A boolean column
remembers, so the page can say so and the bulk rule knows to keep away. That's
the same idea as `order_items.bulk` (lesson 33).

**The one rule lives where prices are decided.** The screen only *shows* the
agreed price. Rails parses it, checks it and saves it inside the same transaction
that takes the stock. A bad price rolls the whole claim back, so stock and price
can't disagree.
