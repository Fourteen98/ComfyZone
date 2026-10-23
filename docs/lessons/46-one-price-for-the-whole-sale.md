# 46. One price for the whole sale

## What she sees

Under the items in **This sale** (Record a sale, the drawer, and the live
screen): "Bargained for the whole sale? **Set one price**". She types 300, taps
**Use this price**, and the sale total is GH₵ 300. The line under the items
says "GH₵ 40.00 off the usual GH₵ 340.00", with **Change price** and
**Usual prices** (undo). Delivery is still added on top.

The small **Price** button on each item still sets one item's price.

## How it works

Nothing new is stored. The total is turned into an **agreed price on each
item** (lesson 39), the same thing as bargaining each item by hand. So stock,
profit, reports, returns and refunds all keep working with no changes on the
server.

`lib/agreedTotal.ts` → `splitTotal(lines, target)` does the sharing:

1. Each line gets its share of the target **by value**: a GH₵ 200 dress takes
   twice the cut of a GH₵ 100 top. That keeps profit per product honest.
2. Prices are whole pesewas per piece, so each share is rounded **down**.
3. The pesewas left over are handed out: one extra pesewa per piece on the
   line with the most pieces that still fits, repeated until nothing is left.
   A line of 1 piece can take any amount, so then the total is always exact.
4. Only when every line has several pieces can a few pesewas be left (3 of one
   dress for GH₵ 100 is 33.33 each = 99.99). The screen says so.

## Ideas worth knowing

**Reuse the model you already have.** A "discount on the order" column would
have meant changing the order total, payments, refunds, the profit report and
returns (what is a returned item's price if the discount was on the whole
order?). Turning the total into per-item prices needed none of that.

**Rounding money: round down, then hand out the remainder.** Rounding each
share to the *nearest* pesewa can overshoot or undershoot the total. Rounding
all down guarantees you're under, and then you add back exactly what's
missing. The same method is used to split rent, bills, or delivery costs.

**Testing a function by trying thousands of random cases.** Instead of a few
hand-picked examples, `test/frontend/agreed_total.test.ts` makes 3,000 random
sales and checks *properties* that must always hold: never over the target,
the reported total is the real sum, exact when a single-piece line exists.
This "property-based" style finds edge cases you wouldn't think to write.
Run it with `npm run test:js` (Node runs TypeScript directly).
