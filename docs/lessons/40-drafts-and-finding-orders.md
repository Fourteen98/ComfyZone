# 40. Draft sales, and finding orders

## Drafts: save a sale halfway

A buyer on WhatsApp goes quiet mid-order, or the phone rings. On **Record a sale**,
**Save as draft** (top of "This sale") keeps everything:

- where the sale came from, and the buyer (picked, or typed in new)
- what they picked, and any agreed prices
- delivery, where they are, and "Did they pay?"

The drafts are listed on top of **Record a sale** (and the Orders page says
"2 sales saved as drafts · Finish them"). **Open** fills the screen back in.
**Record sale** turns it into a real order and deletes the draft, and **Save
draft** updates it. Anyone who records sales can finish anyone's draft, and it
shows who started it.

**A draft holds no stock.** Stock is only taken when the sale is recorded, so a
forgotten draft never hides a dress from a live. If something sold in the
meantime, opening the draft lowers that quantity to what's left and says so.

## Finding orders

The Orders page now shows **25 at a time** (Newer / Older), with:

- **One search box:** a name, `@username`, a phone number in any shape
  (`024 123 4567`, `+233…`), an order number (`#412`), or a product
  (`ankara`).
- **Filters:**
  - *When* (today, this week, this month, last 30 days)
  - *Payment* (nothing paid, part paid, paid in full, **unpaid 3+ days**)
  - *Came from* (WhatsApp, TikTok…)
  - *Live* (from a live or not)
  - *Delivery* (collect, sent, not decided)
- **Chips:** each filter in use is a chip with ×, plus *Clear all*.
- **Tabs that count what you've filtered:** search "ama" and *To be paid 2*
  means two of Ama's orders are unpaid.
- **Addresses you can share:** everything is in the address bar, so a filtered
  list can be bookmarked or sent to whoever packs.

## Ideas worth knowing

**A query object (`app/models/order_search.rb`).** One class turns the URL's
filters into a database query. The page, the tab counts and the tests all use it,
so they can't disagree. Unknown values ("forever", "drop table") are ignored, not
trusted.

**Offset pagination.** `offset((page - 1) * 25).limit(25)` gives page *n*. It's
simple and right for a list read newest-first, a page or two deep.

**Searching phones.** Numbers are stored as `+233241234567`. The search keeps only
the digits she typed, drops a leading 0, and looks for them inside the stored
number, so every way of writing it finds her.

**Storing a screen as JSON (`order_drafts.payload`, `jsonb`).** A draft is the
sale screen's own state, saved as is. The controller lists exactly which keys it
may hold (`PAYLOAD`), so anything else is dropped. The model caps the size, and
Rails checks everything again when the sale is finally recorded. The draft is
never trusted, only remembered.
