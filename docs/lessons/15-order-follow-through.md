# Lesson 15: Following an order through

What changed: an order no longer stops at "To be paid". She can record
payments (MoMo, cash, bank), add delivery details and a delivery fee, mark
orders packed and delivered, and undo a sale at any point: cancel before
delivery, record a return after it, and refund money.

After pulling this step, run:

```sh
bundle install && npm install && bin/rails db:migrate
bin/dev
```

## 1. What she can do

- **Record a payment** on the order page. The amount starts at what is owed;
  part-payments add up. When they cover the order it becomes **Paid** by
  itself.
- **Add delivery**: collected or sent, the fee the buyer pays, and where to.
- **Mark as packed**, then **Mark as delivered**. Each has an **Undo**.
- **Pay on delivery**: pack an unpaid order straight away. It carries an
  "Owes GH₵ ..." badge until the money is recorded.
- **Work down a list**: the *To pack* and *To deliver* tabs on Orders have
  one button per order, so a packer does not need to open each one.
- **Cancel** an order until it is delivered. Stock comes back.
- **Record a return** of a delivered order, choosing whether the items are
  fit to go back on the shelf.
- **Give money back**. A cancelled or returned order that was paid for shows
  under *Refunds due* until the refund is recorded.
- The dashboard's *Orders to pack* and *Money owed to you* are now real, and
  the tiles are links.

## 2. A state machine, without a gem

```
claimed ──► paid ──► packed ──► delivered ──► returned
   │          │         │
   └──────────┴─────────┴──► cancelled
```

An order is always in exactly one stage, and only some moves are allowed.
That is a *state machine*. There are gems for it, but the plain version is
short and you can read all of it in `app/models/order.rb`:

```ruby
def pack!
  transaction do
    lock!
    raise WrongStage, "Only an order that is waiting can be packed. ..." unless claimed? || paid?

    update!(status: "packed", packed_at: Time.current)
  end
end
```

Every move has the same three parts:

1. **`lock!`** so two people tapping at once take turns (lesson 10).
2. **A guard** that raises `Order::WrongStage` if the move is not allowed
   from here. The check is made after the lock, on fresh data.
3. **The change**, with a timestamp.

Controllers never write `order.update(status: ...)`. They call `pack!`,
`deliver!`, `cancel!`, and rescue `WrongStage`, whose message is written for
the person and shown as it is. The rules live in one file.

## 3. "Paid" is worked out, never set

Nobody taps "mark as paid". She records money, and the order decides:

```ruby
def settle
  return unless claimed? || paid?

  if total_pesewas.positive? && balance_pesewas <= 0
    self.status = "paid"
    ...
  else
    self.status = "claimed"
    ...
  end
end
```

`settle` runs whenever what is owed or what is paid changes: a payment, a
refund, a delivery fee, a removed item. So a paid order that gains a GH₵ 25
delivery fee goes back to "To be paid" with GH₵ 25 owing, without anyone
remembering to change it. A fact you can calculate should be calculated, not
typed.

Packed and delivered orders are left alone by `settle`. Those stages are
about the parcel. The money shows beside them as a second badge.

## 4. A second ledger

`payments` follows the same design as `stock_movements`:

| | Stock | Money |
|---|---|---|
| Ledger (rows only added) | `stock_movements` | `payments` |
| Running total | `variants.stock_on_hand` | `orders.paid_pesewas` |
| The only writer | `StockLedger.record!` | `Order#record_payment!`, `#refund!` |
| A correction is | an adjustment row | a refund row (negative amount) |

`Payment#readonly?` returns `persisted?`, so a saved payment cannot be
edited or deleted. If she types the wrong amount, she records the
difference back, and both rows stay visible. There is a test that the
total always equals the sum.

Paying **more than is owed is refused** ("is more than the GH₵ 240 still
owed"). In practice that is a typing slip, 500 for 50, and it is cheaper to
stop it than to untangle it.

## 5. Two totals, on purpose

```
total_pesewas          the goods          -> sales, profit, live totals
delivery_fee_pesewas   what the rider gets
due_pesewas            the two together   -> what the buyer pays
```

The delivery fee is money passing through her hands. If it were added into
`total_pesewas`, every sales and profit figure would be inflated by her
delivery bills. So it has its own column, and only `due_pesewas` and the
balance include it. The dashboard test checks this: "delivery fees are not
sales".

## 6. Migrations: three new things

**`up` and `down` instead of `change`.** Adding the `returned` stage means
replacing a check constraint. Rails cannot reverse "remove this constraint"
unless it knows what the constraint was, so the migration spells out both
directions. The `down` also moves any `returned` rows to `cancelled` first;
otherwise the old rule could not be put back. Try
`bin/rails db:rollback STEP=2` then `db:migrate`.

**A CHECK that allows NULL.** `delivery_method IN ('pickup', 'delivery')`
passes when the value is NULL, because a comparison with NULL is "unknown",
and a CHECK only fails on "false". That is exactly what we want: not decided
yet is fine, a wrong value is not.

**A column name to avoid.** The way of paying is stored in `via`, not
`method`. Every Ruby object already has a method called `method`, and a
column of that name would fight with it. Similar traps: `class`, `type`
(Rails uses it for inheritance), `hash`, `send`.

`Payment::WAYS` is checked in the model only, with no constraint. From
lesson 11: enforce in the database what will not change; this list probably
will.

## 7. Rails ideas in the controllers

**Singular resources.**

```ruby
resource :stage, only: :update      # PATCH /orders/7/stage
resource :delivery, only: :update   # PATCH /orders/7/delivery
```

`resource` (no s) is for something there is exactly one of. No id of its
own in the URL, and no `index`.

**One controller per thing that happens.** Payments, refunds, stages,
deliveries and returns each have a small controller in
`app/controllers/orders/`, mostly one action. That is the Rails habit:
when you want a custom action like `orders#refund`, ask whether it is
really `create` on a new resource (`refunds#create`). The pay-off here is
permissions: each controller has one `require_permission` line, and
payments (`orders.fulfil`) and refunds (`orders.refund`) need different ones.

**A permission that depends on the record.** Cancelling a fresh claim is
routine; cancelling a paid order means handing money back. The same action
needs a different permission depending on the order, so it cannot be a line
at the top of the class:

```ruby
def cancel
  authorize!(permission_to_cancel)
  return if performed?   # authorize! already redirected
  ...
end
```

`performed?` is true once a response has been set. Without that line the
action would carry on and cancel the order anyway.

**Raising with the record.** `record_payment!` raises
`ActiveRecord::RecordInvalid`, which carries the invalid payment. The
controller turns that into form errors:

```ruby
rescue ActiveRecord::RecordInvalid => problem
  redirect_to order_path(order), inertia: { errors: problem.record.errors }
```

**Cleaning up after a failed save.** A bug the tests caught:
`set_delivery!` assigned new values, validation failed, and the order
object in memory was left holding values that were never saved. The next
`lock!` on it refused to run. The fix is `restore_attributes` in a `rescue`,
which puts the object back as the database has it. A method that can fail
should leave things as it found them.

## 8. On the React side

- **`key` to reset a form.** After a part-payment, the amount box should
  start at the new balance. `useForm` only reads its starting values once,
  so the form is given `key={`pay-${balance}`}`. When a key changes React
  throws the old component away and builds a new one, fresh state included.
- **`display: contents`.** On a phone the page reads: where it stands,
  items, payments, delivery. On a wide screen the first and last share a
  side column. The side column's wrapper is `contents xl:block`: on a phone
  the wrapper disappears from layout and its children are ordered with
  `order-1` / `order-3` around the main column. One set of markup, two
  arrangements.
- **Two new reusable pieces**: `ui/Steps` (the Claimed, Paid, Packed,
  Delivered track) and `ui/ChoicePills` (a row of radio pills, the small
  sibling of `ChoiceCards`). `StatStrip` tiles can now take an `href`.
- **The server says what is allowed.** The page receives
  `can: { fulfil, refund, cancel, ... }` for this person and this order, and
  only decides which buttons to draw. Every action checks again in Rails.

## Things to know

- **Whole orders only.** A return or cancellation covers the whole order.
  For "she kept the dress and sent back the scarf", record the return and
  make a new order for the dress. Part-returns can come later.
- **Refunding less than was paid** (keeping the delivery fee on a return,
  say) leaves the remainder showing as "to give back". There is no
  "write it off" button yet.
- **Items can only be removed while an order is "To be paid".** Once paid,
  refund first or cancel.
- **Payment methods are a fixed list** (`Payment::WAYS`) for now.
- **Who may do what**: paying, packing and delivering need *Mark orders
  paid, packed and delivered*. Refunds, returns, and cancelling an order
  that has money on it or is packed need *Cancel and refund orders*. Check
  the Packer and Sales assistant roles in Settings.

## Try it yourself

1. **Walk one order all the way**: part-pay by MoMo, pay the rest in cash,
   pack, deliver. Then record a return and the refund.
2. **Watch `settle` work**: pay an order in full, then add a GH₵ 20 delivery
   fee and watch it go back to "To be paid".
3. **Read the two ledgers** in `bin/rails console`:
   ```ruby
   o = Order.last
   o.payments.pluck(:amount_pesewas, :via)
   o.paid_pesewas == o.payments.sum(:amount_pesewas)
   o.stock_movements.pluck(:quantity, :reason)
   ```
4. **Break the rules on purpose**:
   ```ruby
   o.pack!; o.pack!                      # WrongStage
   Payment.last.update!(note: "x")       # ReadOnlyRecord
   o.update_column(:status, "lost")      # the database says no
   ```
5. **Log in as a Packer** (make one in Settings) and see which buttons are
   missing on an order page.
