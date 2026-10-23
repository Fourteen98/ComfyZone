# 43. Resetting counts, and adding a colour mid-purchase

## What she can do now

**Reset counts (Stock page → Reset counts).** The numbers stop being links and
become things to tap:

- tap a number to choose that one item,
- tap a colour or size heading to choose its whole row or column ("every XL"),
- tap **All** on a product to choose every size and colour of it,
- then at the bottom: **Set to 0** (or type another number) → confirm.

**Full reset.** In the same mode, "Full reset: everything to 0…" opens a box
where she must type **RESET**. Everything in the shop goes to 0, for starting
again from a fresh count.

**Undo.** For a day after a reset, the top of the Stock page says
"Reset to 0: 12 items, 14:02 by Fazila. [Undo]".

**A missing colour while recording a purchase.** Under each product on the
purchase form: **+ Add a colour or size**. Type "Green" (or tap a suggestion
from the colours she has used before), and the product gets Green in every
size it comes in. The new rows appear highlighted, ready to count.

## The pieces

| File | Job |
|---|---|
| `models/stock_reset.rb` | Works out the changes and writes them, one recount movement per item. Also `undo!` and `latest_undoable`. |
| `controllers/stock/resets_controller.rb` | `POST /admin/stock/reset`, `DELETE /admin/stock/reset/:batch` (undo). Needs `stock.adjust`. |
| migration `add_batch_to_stock_movements` | A `batch` code shared by all the movements of one reset. |
| `StockLedger.record!(…, quiet:, batch:)` | `quiet` skips "sold out" pushes; `batch` is stored on the movement. |
| `components/StockGrid.tsx` | With a `selection` prop, cells and headings choose instead of opening. |
| `Product#add_option_value` + `products/option_values_controller.rb` | Adds the choice to the option and runs `VariantGenerator.sync!`. |
| `components/AddOptionValue.tsx` | The inline "+ Add a colour" box. Reusable wherever variants are listed. |

## Ideas worth knowing

**A reset is not a delete.** It would be easy to run
`UPDATE variants SET stock_on_hand = 0`. But then the history would no longer
add up to the total, and nobody could tell what happened. So a reset goes
through the one door every stock change uses, `StockLedger`, as ordinary
"recount" movements: "-5, Reset to 0, by Fazila". The old numbers are still
there in each item's history.

**Grouping with a batch code, so it can be undone.** Each reset makes a random
code (`SecureRandom.hex(8)`) and stamps it on every movement it writes.
Undo finds those movements and writes the *opposite* of each one. Note what it
doesn't do: it doesn't put back the old *numbers*. If a reset took Black M from
5 to 0 and then one sold, undo adds 5 back and Black M is 4, not 5. Sales made
since are kept. Undo movements get the code `undo:<code>`, which is how a
second Undo knows it has already been done. That check happens inside a lock,
so two quick taps can't both get through.

**Asking for a typed word before a big, rare action.** A tap can be a slip of
the thumb; typing RESET can't. The word lives in one place
(`StockReset::CONFIRM_WORD`), and the page gets it as a prop, so the screen and
the server can never disagree about it. The server checks it too: the page's
check is a convenience, the server's is the rule.

**Quiet movements.** Normally a count dropping to 0 sends "Sold out" to her
phone. Forty items reset at once would be forty notifications about something
she did on purpose. `quiet: true` turns those off for this one kind of change.

**Products counted as one total.** For a pooled product (lesson 41), sizes'
own numbers mean nothing. So choosing *any* of its sizes resets the product:
the total goes on its first size and the rest go to 0, the same layout
`StockPool` uses.

**Choosing many things with toggles.** One small rule makes rows, columns and
"All" behave the same: `toggle(ids)` un-chooses them if they are *all* chosen
already, and otherwise chooses them all. A half-chosen row becomes fully
chosen on the first tap, which is what people expect.

**Adding a colour reuses the product's own machinery.** The product already
knows how to turn options into variants (`VariantGenerator`, lesson 7): add
"Green" to the Colour option, run `sync!`, and it makes M / Green, L / Green
and so on, leaving every existing variant, its stock and its price exactly as
they were. The new variants are worked out by comparing ids before and after.

**Reloading a page without losing what she typed.** The purchase form is
half filled in when she adds a colour. The add is an Inertia `router.post`
with `preserveState: true`: the server redirects back to the purchase form,
Inertia fetches fresh props (now with the green variants), and React keeps the
form's state (supplier, costs, quantities). Only the product list changes.

**Not a form inside a form.** HTML doesn't allow a `<form>` inside another, and
the add box sits inside the purchase form. So it is a plain `div` with
buttons, and Enter in its box is caught (`preventDefault`) so it adds the
colour instead of submitting the purchase.
