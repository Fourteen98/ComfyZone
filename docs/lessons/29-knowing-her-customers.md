# Lesson 29: knowing her customers

Four features that turn the orders she has already recorded into answers:
who her customers are, who is waiting for what, what to buy next, and what
actually makes money.

| Feature | Where | The Rails idea |
| --- | --- | --- |
| Customer insights | Customers → a customer | query object (`CustomerInsights`) |
| Waiting list | Waiting list; stock item; sale screen; shop | a new table, partial unique index, auto-closing |
| What to buy next | Stock → What to buy next | query object (`RestockAdvisor`), `Data.define` rows |
| Profit per product and live | Reports; a live's page | grouped SQL; an optional `belongs_to` |

## 1. Query objects, again

`CustomerInsights` and `RestockAdvisor` are like `SalesReport` (lesson 17):
plain Ruby classes whose only job is to ask questions. Nothing is stored;
everything is worked out from orders each time. That means there is nothing
to keep in sync: edit an order, correct a purchase, and every insight is
right on the next page load.

Two small techniques worth noticing:

**The median, not the average**, for "how fast do they pay":

```ruby
waits.sort[waits.size / 2]
```

One order paid a month late would drag an average up and make a reliable
customer look slow. The middle value ignores the one-off.

**Counting what they KEPT.** Insights and advice count
`quantity - returned_quantity` (the `kept` method on `OrderItem`), and only
orders that are still sales (`Order.counted`). A returned dress isn't a
favourite size.

## 2. The waiting list (`stock_requests`)

```ruby
add_index :stock_requests, %i[ customer_id variant_id ], unique: true, where: "closed_at IS NULL"
```

A **partial unique index**: one *open* request per person per item. Closed
requests (they bought it, or came off the list) don't count, so the same
person can ask again next month. `StockRequest.ask!` finds the open one or
makes it, so asking twice never adds a second entry.

The list looks after itself:

- `OrderTaker#add` calls `StockRequest.fulfil(customer:, variant:)`: buying
  the thing takes you off the list for it.
- `StockLedger.record!` calls `announce_back_in_stock`: the moment a sold-out
  item has stock again **and** someone is waiting, a push notification goes
  out (topic "Back in stock").
- The menu badge (`alerts.to_tell`) counts items that are back and whose
  waiters haven't been told.

Four ways onto the list, one table: the sale screen (tap a sold-out size
once the buyer is named), the item's stock page ("Someone asked for it"),
the customer's page, and the shop ("Tell me when it's back").

### Telling them: a pre-written WhatsApp

```ts
`https://wa.me/${digits}?text=${encodeURIComponent(message)}`
```

`wa.me` opens a chat with the message already typed. She reads it and taps
send; the app never sends anything by itself. The message is built in
Ruby (`StockRequest#message`) so the wording lives in one place.

## 3. What to buy next

For each size and colour:

```
pace        = units sold in the window / weeks in the window
target      = pace × weeks of cover (rounded up) + people waiting
suggestion  = target − on the shelf   (never below 0)
```

Two dials on the page: how far back to look (30/60/90 days) and how long
stock should last (2/4/8 weeks). The waiting list counts as demand, which
is often the only signal for something that sold out fast.

"Not moving" is the other half: on the shelf with no sales in the whole
window, biggest money first. Things added during the window are left out,
since they haven't had a fair chance.

`Data.define` makes the rows: small immutable value objects with methods,
for when a Hash isn't enough and a full model is too much.

```ruby
Row = Data.define(:variant, :sold, :waiting, :on_hand, :per_week, :weeks_left, :suggest) do
  def tied_pesewas = on_hand * variant.average_cost_pesewas
end
```

## 4. Profit per product and per live

**Per product:** `SalesReport#product_profit` ranks by profit, not sales,
with the margin (profit ÷ sales). Landed cost already includes transport
and purchase fees (lesson 5), so this is the real per-piece profit.
Products sold before a cost was recorded are flagged rather than shown at a
fake 100% margin.

**Per live:** a live has costs of its own (data bundle, a host, hired
lights). Expenses gained an optional `live_session_id`:

```ruby
belongs_to :live_session, optional: true
```

and a live's profit is now its goods profit **minus** those costs, on the
live's page and in Reports. `optional: true` matters: most expenses (rent,
packaging) belong to no live.

## Try it

```ruby
CustomerInsights.new(Customer.first).summary
CustomerInsights.gone_quiet.first(5)
RestockAdvisor.new(days: 30, cover_weeks: 4).buy.map { |r| [ r.variant.full_name, r.suggest ] }
StockRequest.to_tell.count
```
