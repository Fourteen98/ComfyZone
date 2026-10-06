# Lesson 14: Live sales, customers and orders

What changed: the part of the app she will use most. She can start a live,
tap what people claim, and stock drops as she goes. Claims become orders;
buyers become customers. The dashboard now shows real sales.

After pulling this step, run:

```sh
bundle install && npm install && bin/rails db:migrate
bin/dev
```

## 1. What she can do

- **Start a live** from *Live sales*. While one is running, the menu link
  and a banner on the dashboard go straight to it.
- **Record a claim in three taps**: type the buyer's TikTok name, tap the
  product and the size/colour, tap *Claim*. The screen clears for the next
  buyer.
- **Known buyers are suggested** as she types; new ones are saved with
  their first claim.
- **One order per buyer per live.** If Ama claims a dress, then a scarf ten
  minutes later, both land on one order: one payment, one parcel.
- **Undo**: remove a line or cancel an order, and the stock comes back.
- **End the live** and see what it sold, and the profit (for those allowed
  to see costs).
- **Record a sale outside a live** (WhatsApp, a walk-in) from *Orders*.
- **Customers** lists everyone with their orders and spend.

## 2. The rule that matters most: never sell what you don't have

Two helpers tap the last dress for two different buyers at the same
moment. Exactly one of them must succeed. The whole design serves that.

```ruby
# OrderTaker#add
StockLedger.record!(variant: variant, quantity: -quantity, reason: "sale",
                    source: @order, user: user, guard_stock: true)
```

```ruby
# StockLedger.record!
variant.with_lock do
  if guard_stock && variant.stock_on_hand + quantity < 0
    raise NotEnough, "Only #{left} left of #{variant.full_name}"
  end
  ...
end
```

The check happens **inside the lock**, against the freshest number. The
second helper's request waits for the first to finish, then sees zero and is
refused with "has just sold out". The stock numbers on her screen are only
a guide; they were right when the page loaded. The server decides.

The stock is taken *before* the order line is written. If taking it fails,
there is nothing to clean up.

## 3. All or nothing, again

A claim can involve a new customer, a new order, several lines and several
stock movements. `OrderTaker#save` wraps them in one transaction:

```ruby
Order.transaction do
  begin
    customer.save! if customer.new_record?
    @order = open_order
    wanted.each { |variant_id, quantity| add(variant_id, quantity) }
    @order.recalculate!
    saved = true
  rescue StockLedger::NotEnough => problem
    errors.add(:items, problem.message)
    raise ActiveRecord::Rollback
  end
end
```

If the buyer wants a dress and a scarf and the scarf has just gone, the
dress is put back too and nothing is saved, not even the new customer. She
gets one clear message and can tell the buyer straight away. The test
"a claim that can't be fully met changes nothing at all" checks every table.

Note the shape: `rescue` a specific error, record a friendly message, then
`raise ActiveRecord::Rollback` to undo the transaction quietly. `Rollback` is
the one exception a transaction block swallows.

## 4. Snapshots: history does not change

```ruby
item.unit_price_pesewas = variant.selling_price_pesewas
item.unit_cost_pesewas  = variant.average_cost_pesewas
```

Each order line copies the price charged and the cost at that moment. If she
raises the price next week, or the next purchase costs more, this order's
revenue and profit stay exactly as they were. The rule for any record of
something that happened: **store what it was, not a pointer to what it is.**

`orders.total_pesewas` is a different kind of copy: a cached sum of the
lines, like `stock_on_hand`. It is recalculated whenever lines change, so
lists never have to add up items.

## 5. Three ways the database enforces a rule

This step's migrations each show a different tool:

**A partial unique index** (only one live can run at a time):

```ruby
add_index :live_sessions, "(1)", unique: true, where: "ended_at IS NULL"
```

The index covers only rows where `ended_at` is NULL, and indexes the same
constant for all of them, so a second running live collides with the first.
The model has a friendly validation too, but two simultaneous taps on
"Start" would both pass a validation. Only the index is airtight; the
controller rescues `RecordNotUnique` and sends her to the live that won.

**A partial index for optional uniqueness** (TikTok names):

```ruby
add_index :customers, :handle, unique: true, where: "handle IS NOT NULL"
```

Handles are unique, but customers without one are fine in any number.

**A check constraint** on `orders.status` and `order_items.quantity`.

Rule of thumb: validations give good messages; constraints give guarantees.
For anything involving money, stock or "only one", have both.

## 6. Normalising input once

People will type `@Ama_K`, `ama_k ` and `AMA_K`. All three must be the same
customer:

```ruby
normalizes :handle, with: ->(handle) { handle.to_s.strip.delete_prefix("@").gsub(/\s+/, "").downcase.presence }
```

`normalizes` cleans the value on assignment and also inside queries, so
`Customer.find_by(handle: "@Ama_K")` finds `ama_k`. Clean data on the way
in, once, and every comparison afterwards is simple.

## 7. Sharing code between controllers

The live screen and the *Record a sale* page need the same products and
buyers, and post to the same action. `app/controllers/concerns/sale_capture.rb`
holds the shared prop builders, included by both controllers. On the React
side they share one component, `SaleCapture`. One capture screen to
maintain, used in two places.

`POST /orders` serves both: with a `live_session_id` the claim joins that
live; without it, it is a one-off sale. A claim cannot be attached to a
live that has ended (`LiveSession.running.find_by`).

## 8. On the React side

- **`SaleCapture` keeps its own state** (buyer, basket, search) because none
  of it exists on the server until *Claim*. After a successful claim it
  clears itself and puts the cursor back in the buyer box.
- **One grid, two layouts.** The elements are written in phone order; `lg:`
  classes move the claim panel into a second column on desktop. No
  duplicated markup.
- **The floating claim bar** on phones sits above the app's bottom bar and
  respects the iPhone home indicator with `env(safe-area-inset-bottom)`.
- **Phone keyboards are tamed** on the buyer box (`autoCapitalize="none"`,
  `autoCorrect="off"`) so TikTok names are not "corrected".
- **A ticking clock** with `setInterval` inside `useEffect`, whose clean-up
  function clears the interval when she leaves the page.

## Not in this step (the next one)

- **Marking orders paid, packed and delivered**, recording payments (MoMo,
  cash), and delivery fees. For now every order is "To be paid" or
  "Cancelled".
- **Returns** after delivery.
- **Stock on screen does not refresh by itself** during a live. It updates
  after each of her own claims. If two people sell at once, the server still
  prevents overselling; the second sees "has just sold out".

## Try it yourself

1. **Run a pretend live**: start one, claim for three buyers (one of them
   twice), remove a line, end it, and read the summary.
2. **Prove the last one can't sell twice**: find a variant with 1 left, open
   the live in two browser windows, pick it in both, claim in both.
3. **Look at the records**:
   ```ruby
   o = Order.last
   o.items.pluck(:quantity, :unit_price_pesewas, :unit_cost_pesewas)
   o.stock_movements.pluck(:quantity, :reason)
   o.profit_pesewas
   ```
4. **Test the snapshot**: change a product's price, then check that an
   existing order's total did not move.
5. **Ask the database for two lives**:
   ```ruby
   LiveSession.create!(user: User.first)
   LiveSession.new(user: User.first, title: "x", started_at: Time.current).save!(validate: false)
   ```
