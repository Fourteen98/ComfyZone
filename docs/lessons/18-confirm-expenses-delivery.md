# Lesson 18: A confirm dialog, expenses, and delivery at the point of sale

Three things in this step:

1. **"Are you sure?" now looks like the app**, not like a browser pop-up.
2. **Expenses**: what the business spends that isn't stock, and a real
   **net profit** on the reports.
3. **Delivery when the sale is made**: customers have a delivery area and an
   address, and recording a sale asks "collect or send?".

After pulling this step, run:

```sh
bundle install && npm install && bin/rails db:migrate
bin/dev
```

## 1. What she can do

- **Confirm dialogs** everywhere something is cancelled, removed or
  deleted. On a phone they rise from the bottom, in reach of a thumb. The
  buttons say what they do ("Cancel the order" / "Keep the order").
- **Expenses** (new menu item): record an amount, what it was for, the day,
  and optionally how it was paid. Categories are suggested as she types and
  she can invent her own. The page totals a period and shows where the
  money went.
- **Reports** gain *Expenses* and *Net profit* (profit less expenses), and
  the dashboard gains two tiles: *Expenses this month* and *Net profit this
  month*.
- **Settings > Delivery areas**: the places she delivers to, each with its
  usual fee.
- **Record a sale** now asks *How will they get it?* Choose "It is sent to
  them", pick the area, and the fee fills in (she can change it for that
  order). The total includes it.
- **Customers remember where they are.** The first delivery saves the area
  and address on the customer; next time it is filled in already.
- The order page's delivery form has the same area picker.

During a live, claims are still one box and one tap. Delivery for those is
set afterwards on the order page.

## 2. The confirm dialog: awaiting an answer

The browser's `window.confirm` has one great property: it is a plain
function that returns yes or no, so code reads top to bottom.

```ts
if (!window.confirm('Delete this?')) return
router.delete(...)
```

A styled dialog is a React component, and a component can't "return a
value" to the code that opened it. The bridge is a **Promise**:

```ts
if (!(await confirmAction('Delete this purchase? Nothing else changes.', { confirm: 'Delete', danger: true }))) return
router.delete(...)
```

`app/frontend/lib/confirm.ts` is a small message desk:

```
confirmAction(msg) ──► hands { msg, answer } to the listener, returns a Promise
                                  │
<ConfirmDialog/> (one, in AppLayout) shows it
                                  │
            a button is tapped ──► answer(true/false) settles the Promise
```

So the calling code still reads top to bottom; only `async`/`await` was
added. All fourteen places that used `window.confirm` now use it.

**PHP comparison**: there is no direct equivalent, since PHP runs a request
from top to bottom and stops. In the browser, things happen later (a tap, a
response). A Promise is a value that stands for "the answer, when there is
one", and `await` means "pause this function until then".

The dialog itself is the HTML `<dialog>` element opened with `showModal()`.
The browser then traps keyboard focus inside it, blocks the page behind,
closes on Escape and announces it to screen readers. Hand-building those
correctly is hard; the platform does it for free.

Two details worth copying:

- **The safe button is first** in the page, so it is what the keyboard
  lands on. Pressing Enter by reflex backs out, it does not delete.
- **If no dialog is mounted, it falls back to `window.confirm`.** A
  destructive action must never end up unguarded.

## 3. Expenses: when a plain string beats a table

Sales channels got a table (lesson 16). Expense categories are a plain text
column, and the form suggests values with a `<datalist>`:

```tsx
<TextField list="expense-categories" ... />
<datalist id="expense-categories">{categories.map(...)}</datalist>
```

| | Sales channels | Expense categories |
|---|---|---|
| Does code branch on them? | yes (`kind`) | no |
| Need ordering, hiding? | yes | no |
| So | a table and a settings screen | a string, with suggestions |

`Expense.categories` builds the suggestions: hers first (most used first),
then a starter list. A new category needs no setup; she just types it.
The cost is that "Packaging" and "packaging " could become two categories;
`normalizes` squeezes spaces, and the suggestions make reuse the easy path.
If she later wants to rename or merge categories, that is the moment to
promote it to a table.

Unlike payments and stock, **expenses can be edited and deleted**. Not
everything needs a ledger. Payments and stock are ledgers because other
numbers are derived from them and money or goods physically moved between
people; an expense is her own note of what she spent, and fixing a typo
should be easy.

### What "profit" means now

```
Sales                       what buyers paid for goods
- cost of those goods    =  Profit        (gross)
- expenses               =  Net profit    (what is really left)
```

Delivery fees buyers pay are still outside all of this: money passing
through to the rider. If she pays a rider out of her own pocket, that is an
expense.

Expenses count on the day in `spent_on`, a plain `date` column, so there is
no time-zone arithmetic: `where(spent_on: period.from..period.to)`.

## 4. Delivery areas, and three kinds of "fee"

```
delivery_areas.fee_pesewas      the USUAL fee for Osu                (a default)
orders.delivery_fee_pesewas     what THIS order was charged          (a fact)
orders.delivery_area_id         where this order went                (a fact)
customers.delivery_area_id      where this customer usually is       (a convenience)
```

The same snapshot rule as prices (lesson 14): the order stores what was
charged, not a pointer to today's fee. Raise Osu from 20 to 25 next month,
or delete the area altogether, and old orders still say 20. There is a test
for exactly that.

In `Order#set_delivery!`, the precedence is spelled out:

```ruby
self.delivery_fee = if !delivery_method_delivery? then 0       # a pick-up is free
elsif fee.to_s.strip.empty? && area then area.fee              # nothing typed: the usual
else fee                                                       # typed: this order's own
end
```

A default the person can override, with the override always winning, is
one of the most common patterns in business software.

### Learning from use

```ruby
def remember_where_they_are
  customer.delivery_area ||= delivery_area
  customer.location ||= delivery_address
  ...
end
```

Nobody fills in a customer's address as a chore. The first delivery does it
as a side effect, and only into blanks: one parcel sent to her sister's
house does not change where the customer lives. To change it on purpose,
edit the customer.

## 5. All or nothing still holds

Recording a sale can now create a customer, an order, lines, stock
movements **and** set delivery. `set_delivery!` runs inside `OrderTaker`'s
transaction, so a bad fee refuses the whole sale. The test "a bad fee
refuses the whole sale" checks that no order, stock movement or customer
is left behind. When you add a step to something transactional, add it
*inside* the transaction and add the test.

## 6. One set of questions, used twice

"Collect or send, where, how much, what address" is asked on the
record-a-sale screen and on the order page. Both use
`components/DeliveryFields.tsx`, which holds no state: it receives a value
and reports changes. `OrderDeliveryForm` shrank to a thin wrapper around
it. This is the React equivalent of last lesson's concern: when a second
place needs the same thing, extract it.

On the Rails side the settings screen for delivery areas reuses
`Positioned` for ordering and `HasMoney` for the fee. Two concerns, and the
model is fifteen lines.

## 7. New permissions

*See expenses* and *Record and change expenses* were added under **Money**.
The Owner role has every permission automatically. **Other roles do not
gain new permissions by themselves**: a role is a saved list. To let a
manager see expenses, tick the boxes in Settings > Roles.

## Things to know

- **Production starts with no delivery areas.** Until some are added in
  Settings, the fee is typed by hand, exactly as before.
- **Old expenses**: none exist, so net profit for past months equals profit
  until she enters them. Expenses can be back-dated.
- **A customer has one area and one address.** A second address is typed on
  the order.
- **Lives don't ask about delivery**, to keep claims fast.

## Try it yourself

1. **Read the three files of the dialog** in order: `lib/confirm.ts`,
   `components/ui/ConfirmDialog.tsx`, then any caller. Then open a dialog
   and try Escape, Tab, and clicking outside.
2. **Add two areas, then record a delivery sale** to a new customer. Record
   a second sale to the same customer and watch delivery fill itself in.
3. **Prove the snapshot**: change an area's fee, then look at the old order.
4. **In the console**:
   ```ruby
   Expense.during(ReportPeriod.preset("month")).by_category
   Expense.categories
   r = SalesReport.new(ReportPeriod.preset("month"))
   r.totals[:profit_pesewas] - r.expenses_pesewas     # net profit
   Order.where.not(delivery_area_id: nil).group(:delivery_area_id).sum(:delivery_fee_pesewas)
   ```
5. **Write a report of your own**: orders and delivery fees per area this
   month. Add it to `SalesReport` with a test, then to the Reports page as
   a `BarList`.
