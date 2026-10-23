# 44. Recording a sale in a drawer, and editing purchases

## What changed

**Orders → Record a sale** no longer leaves the list. The sale screen slides up
from the bottom on a phone (in from the right on a computer). On a phone a
round **+** stays above the bottom bar, so it is one tap away however far down
the list she is. Record the sale and the drawer closes: she is back on the
same list, same tab and search, with the new order on top. Drag the handle
down, tap the dimmed list, or press Escape to put it away; anything half typed
is still there when it opens again.

**Purchases** have a pencil on every row of the list, and the button on a
purchase is now plainly **Edit purchase** (it used to say "Correct this
purchase", which didn't read as editing). Editing a purchase that is already in
stock still corrects stock to match.

**A bug fixed on the way:** a purchase whose product was archived later lost
those lines in the edit form, so saving would have taken them out of stock.
The form now always includes what is already on the purchase.

## The pieces

| File | Job |
|---|---|
| `components/SaleDrawer.tsx` | The sliding panel: backdrop, drag handle, close, loading skeleton. Holds a `SaleCapture`. |
| `SaleCapture` prop `inDrawer` | Sends `return_to: "list"`, keeps its state on errors, sticks its total bar to the drawer's bottom. |
| `OrdersController#index` prop `sale` | `InertiaRails.optional`: the products and buyers, sent only when asked. |
| `OrdersController#create` | With `return_to: "list"`, goes back to the list she came from (`orders_list_url`). |
| `PurchasesController#pickable_products(purchase)` | Adds the archived products and retired sizes already on the purchase. |

## Ideas worth knowing

**Optional props and partial reloads.** The orders list shouldn't pay for the
sale screen's data (every product and buyer) on every visit, most of which
never open the drawer. `InertiaRails.optional { ... }` means "leave this out
unless asked". The drawer asks with `router.reload({ only: ['sale'] })`: a
*partial reload*, where Inertia fetches the same page but only that one prop,
and merges it in. The first opening shows a grey skeleton for a moment; after
that the data is kept in React state and opens instantly.

**`preserveState: 'errors'`.** After a POST, Inertia normally rebuilds the page
from scratch. Here that's what we want on success (the list comes back fresh
and the drawer, being state, starts closed). But on a mistake ("only 2 left")
it would throw away the drawer and everything in it. `'errors'` means: keep the
React state only when the response has validation errors.

**Redirecting back, safely.** "Back to the list she came from" uses the
`Referer` header, which the browser sends and anyone could fake. So only its
path and query are used (`request_uri`), and only if the path is the orders
list. A faked `https://evil.example/admin/orders` sends her to our own
`/admin/orders`, never to another site (an "open redirect").

**`position: fixed` inside a sliding panel.** The sale screen's total bar is
`fixed` to the bottom of the screen. Inside the drawer that breaks: an
ancestor with a `transform` (the slide animation) becomes the reference for
`fixed` children. So in the drawer the bar is `sticky bottom-0` instead,
which sticks to the bottom of the drawer's own scrolling area.

**Drag to close with pointer events.** `pointerdown` remembers where the
finger started, `pointermove` moves the sheet by the distance (with the CSS
transition off, so it follows the finger exactly), and `pointerup` decides:
past a third of the way (or 140px), close; otherwise snap back.
`setPointerCapture` keeps the moves coming even when the finger leaves the
handle. Pointer events cover mouse, pen and touch with one set of code.

**`inert`.** While closed, the drawer is only moved off screen, not removed.
`inert` makes everything in it unfocusable and invisible to screen readers,
so Tab doesn't wander into a hidden form.
