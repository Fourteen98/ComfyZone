# 47. Unpaid claims: a time to pay, and who actually pays

## The problem

On a live, someone types "mine!", the dress comes off the shelf, and they
never pay. The dress sits out of stock while other people would have bought
it. And next live, the same person does it again.

## What she has now

- **A time to pay.** Settings → Unpaid claims: claims from a live get 24
  hours (change it, or leave empty for no deadline). Sales recorded by hand
  can have their own time (off until she sets one). Any payment, even part,
  stops the clock.
- **A warning first.** 3 hours before (also a setting), one notification
  lists who still hasn't paid ("Unpaid claims" under My account → Notifications).
- **On the order:** "Pay by 11:32 am today", with **Remind on WhatsApp** (opens
  WhatsApp on her phone with the message written, from her own number),
  **One more day**, and **No deadline**. And "They didn't pay: release it" to
  do it straight away.
- **When time is up** the order is cancelled as *unpaid*: everything goes back
  on sale, people on the waiting list are told, and one notification says
  what was released.
- **Who pays.** Each customer's record: "Didn't pay 2 of 4 orders: ask for
  payment first" in red, amber if it happened once, "Paid all 7 orders" in
  green. It shows on the customer, on the order, and as soon as she picks or
  types the buyer when recording a sale or a live claim.
- **Orders → Filters → Payment → Deadline to pay** lists them soonest first,
  each with a "Pay by…" badge.

## The pieces

| File | Job |
|---|---|
| migration `add_claim_deadlines` | `claim_settings` table; `orders.cancel_reason`, `orders.hold_reminded_at`. |
| `models/claim_setting.rb` | The times. `hours_for(order)`: live, hand-recorded, or none. |
| `models/claim_hold.rb` | `start!`, `release!`, `expire`, `sweep!` (warn, then release). |
| `jobs/claim_hold_sweep_job.rb` | Every minute (`config/recurring.yml`). Replaces the WhatsApp-only sweep. |
| `Customer.reliability` | Paid vs released-unpaid, for many customers in one query. |
| `controllers/orders/holds_controller.rb` | One more day / no deadline. |
| `controllers/settings/claims_controller.rb` + `Settings/Claims.tsx` | The settings page. |
| `ReliabilityBadge.tsx` | The red/amber/green badge, used in four places. |

## Ideas worth knowing

**Generalise when the second case arrives.** WhatsApp reservations already
had a clock (`hold_until`, a sweep, release). Live claims needed the same, so
the WhatsApp code became the general `ClaimHold`, and WhatsApp now only adds
its messages on top. Same column, same job, one set of rules.

**Record *why*, not just *what*.** A cancelled order could be a mistake, a
change of mind, or someone who never paid. Only the last says anything about
the customer. `cancel_reason = "unpaid"` keeps that difference, so the score
counts only what it should.

**Counting with `FILTER` in one query.**
`COUNT(*) FILTER (WHERE cancel_reason = 'unpaid')` counts only matching rows
inside a `GROUP BY customer_id`. Two different counts per customer, for 500
customers, in one trip to the database.

**Batching notifications.** At the end of a live, twenty claims may run out
in the same minute. Twenty buzzes would be noise. The sweep collects what it
released and sends one ("4 claims released: Ama, Kofi, Esi and others"), and
`hold_reminded_at` makes sure each warning goes only once.

**The payment always wins.** Releasing locks the order and re-checks it's
still unpaid, so a payment recorded at the same moment can never be undone by
the clock.

**`wa.me` links.** `https://wa.me/233241112222?text=...` opens a chat with
that number, message typed in. It needs no API and no template: it is her
own phone, her own number. (Sending automatically, without her tapping,
needs WhatsApp templates: part 2 of the WhatsApp work.)
