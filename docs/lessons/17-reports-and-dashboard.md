# Lesson 17: Reports, and a dashboard each person arranges

What changed: a **Reports** page that answers "how is the business doing?"
for any stretch of days, two **CSV downloads** for a spreadsheet, and a
**dashboard each person can customise**.

After pulling this step, run:

```sh
bundle install && npm install && bin/rails db:migrate
bin/dev
```

## 1. What she can do

- **Reports** (in the menu): pick Today, Yesterday, This week, This month,
  Last month, Last 30 days, or any two dates. She sees sales, profit,
  orders and the average order, with a line comparing against the stretch
  just before ("Sales up 12% on the 7 days before").
- **A chart of sales over time**. Hover, or tap on a phone, for a day's
  exact figures.
- **Rankings**: best sellers, where sales came from (TikTok, WhatsApp...),
  how each live did, top customers, and money received by payment method.
- **Download** every order or payment in the period as a CSV file, which
  opens in Excel or Google Sheets.
- **Customise** (top right of the dashboard): tick which numbers and panels
  to show and put them in order. There are twelve numbers to choose from
  (up to eight at once) and five panels, including a 7-day sales chart.
  Each person has their own layout; a packer's dashboard can be nothing
  but "Orders to pack".

Profit and cost only appear for people whose role allows *See cost prices
and profit*, on the page, in the chart and in the downloads.

## 2. Letting the database do the adding up

The slow way to total a week's sales is to load every order into Ruby and
loop. The fast way is one SQL query that returns one number. Reports are
where you learn to write the second kind:

```ruby
orders.sum(:total_pesewas)                 # => 2_997_00        one number
orders.group(:status).count                # => { "paid" => 4, "claimed" => 9 }
orders.group("DATE(created_at)").sum(:total_pesewas)
                                           # => { Mon => 12000, Wed => 14000 }
```

`group` plus `sum` or `count` returns a **Hash**, keyed by whatever you
grouped by. That one fact covers most reporting. For more than one figure
per group, `pluck` with SQL expressions:

```ruby
line_items.joins(variant: :product)
  .group("products.id", "products.name")
  .order(Arel.sql("SUM(quantity * unit_price_pesewas) DESC"))
  .limit(10)
  .pluck("products.name", Arel.sql("SUM(order_items.quantity)"), ...)
```

`Arel.sql("...")` is you telling Rails "this string is SQL I wrote, not
something a user typed". Rails insists on it for raw SQL in `order` and
`pluck`, as a guard against SQL injection. Only ever wrap constants.

Watch the server log while you open Reports: about fifteen queries, each a
few milliseconds, however many orders there are.

**Compared with Laravel**: `->groupBy('status')->selectRaw('count(*)')` and
`DB::raw(...)` are the same ideas. `Arel.sql` is `DB::raw`.

## 3. A query object

All of that lives in `app/models/sales_report.rb`:

```ruby
report = SalesReport.new(ReportPeriod.preset("week"))
report.totals
report.over_time
report.top_products
```

It is a plain Ruby class, with no table. The queries span orders, items,
products, channels and payments; they would bloat any one model, and a
controller is no place for SQL. In one class they can be tested directly
(`test/models/sales_report_test.rb`) and reused: the dashboard's chart and
tiles call the same class, so the dashboard and the report can never
disagree.

`ReportPeriod` is its partner: one place that knows what "this week" means.

## 4. Time zones: which day was it?

Rails stores every time in UTC, and that is right. But "sales on Monday"
means Monday *on her clock*. Three things make that work:

```ruby
config.time_zone = "Africa/Accra"      # config/application.rb
```

- `Date.current` and `Time.current` now mean today and now **in Accra**.
  (`Date.today` uses the server's clock. Never use it in a Rails app.)
- `date.beginning_of_day..date.end_of_day` builds a range in that zone, and
  Rails converts it to UTC for the `WHERE`.
- When grouping by day inside SQL, the conversion must be done there too:

```sql
DATE(orders.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Accra')
```

Accra happens to be on UTC all year, so you will not see a difference
today. The code is still written correctly, because the day you host a
shop in another zone, or the server's own clock differs, a sale at
12:30 am would otherwise land on the wrong day and nobody would know why.

## 5. Days with no sales

`group` only returns groups that exist. A week with sales on Monday and
Wednesday comes back as two rows, and a chart drawn from that would put
them side by side as if Tuesday never happened. `over_time` walks every
date in the period and fills gaps with zero:

```ruby
(period.from..period.to).map { |date| { sales_pesewas: sales.fetch(date, 0), ... } }
```

Missing data and zero are different things, and charts must show zero.

## 6. Testing code that depends on today

```ruby
setup { travel_to Time.zone.local(2026, 10, 7, 15, 0) }
```

`travel_to` freezes the clock for a test. Without it, "this week" would be
a different week every time the tests run, and they would fail on Mondays.
The helper `sell(at: ...)` uses the block form to make orders in the past.

## 7. Sending a file instead of a page

```ruby
send_data csv, type: "text/csv; charset=utf-8", filename: "comfyzone-orders-....csv"
```

Nothing is written to disk. Three details:

- **The link is a plain `<a>`**, not an Inertia `<Link>`. Inertia expects a
  page back; a download has to be left to the browser.
- **Route constraints.** `constraints: { kind: /orders|payments/ }` makes
  `/reports/export/users.csv` a 404 before any controller code runs.
- **CSV injection.** A spreadsheet treats a cell beginning with `=`, `+`,
  `-` or `@` as a formula. A customer could be named
  `=HYPERLINK("http://...")`, and usernames start with `@`. The `safe`
  helper puts an apostrophe in front of such cells, which spreadsheets read
  as "this is text". Any app that exports what people typed needs this.

## 8. The dashboard: code decides what is possible, data decides what is shown

```ruby
Tile.new("orders_to_pack", "Orders to pack", %w[ orders.view ], :count, "/orders?status=paid", -> { Order.paid.count })
```

`Dashboard::TILES` and `PANELS` are the catalogue. Each entry names the
permissions it needs and holds a **lambda** for its number. The lambda only
runs for tiles a person actually shows, so twelve possible tiles do not
mean twelve queries.

Her choice is stored in one column:

```ruby
add_column :users, :dashboard_layout, :jsonb
# { "tiles": ["sales_today", "orders_to_pack"], "panels": ["recent_orders"] }
```

**When is a JSON column right?** For small settings that belong to one row
and are always read whole. It is the wrong tool for anything you search,
sum or join on; that wants real columns. Rails reads and writes it as a
plain Hash.

`NULL` means "never customised", which is different from "chose nothing".
Someone who has not customised keeps getting the standard layout, including
any improvements to it later.

**Never trust what was saved.** The layout is filtered twice: when saving
(unknown keys and keys she may not see are dropped) and again every time
it is read. So if her role loses *See stock levels* next month, the stock
tile simply disappears from her dashboard, with nothing to clean up.

`send("#{panel.key}_panel")` in the controller calls a method by name. That
is safe only because the names come from `Dashboard::PANELS`. Never `send`
a string that came from the request.

## 9. On the React side

- **Charts without a library.** `ui/BarChart` is divs with percentage
  heights. It states its scale, shows exact figures on hover or tap, and
  carries a real `<table>` for screen readers. One colour, because one
  thing is measured. `ui/BarList` is a ranked list with bars, which answers
  "which is biggest?" better than a pie chart.
- **Discriminated unions.** A panel arrives as `{ key, data }` where the
  shape of `data` depends on `key`. The `DashboardPanel` type spells out
  each pairing, so inside `case 'low_stock':` TypeScript knows exactly what
  `panel.data` is.
- **A controlled component.** `ui/PickAndOrder` (tick and arrange) keeps no
  state. It is given the list and reports each change; the form owns the
  data. It will be reusable anywhere something needs choosing and ordering.
- **Two bugs found by looking at a phone**, both worth knowing:
  `grid-cols-1` is `minmax(0, 1fr)`, which lets a column be narrower than
  its longest unbreakable text (without it one long product name pushed the
  page sideways); and a `<table>` cannot be hidden with `sr-only` directly,
  it needs a wrapper.

## Things to know

- **A sale counts on the day the order was made**, and only while it is
  still a sale. Cancel or return an order and it leaves that day's figures.
- **Money received follows a different clock**: the day each payment was
  recorded. It includes delivery fees and payments for older orders, so it
  will not equal Sales. The page says so.
- **Top customers can list one person twice** if they were entered twice
  by name only (see lesson 16).
- **The dashboard layout is per person.** There is no per-role default yet.
- **No purchases or expenses report yet**, so "profit" is sales minus the
  cost of the goods sold, not minus rent or data bundles.

## Try it yourself

1. **Customise your dashboard**: add the 7-day chart and "Profit this
   month", reorder them, save. Then reset.
2. **Count the queries**: open Reports with the server log visible.
3. **Ask the questions yourself** in `bin/rails console`:
   ```ruby
   r = SalesReport.new(ReportPeriod.preset("month"))
   r.totals
   r.by_channel
   Order.counted.group(:status).sum(:total_pesewas)
   Order.counted.group("DATE(created_at)").count
   User.first.dashboard_layout
   ```
4. **Write a query of your own**: units sold per category this month.
   (Hint: `OrderItem.joins(variant: { product: :category }).group("categories.name").sum(:quantity)`.)
   Then add it to `SalesReport` with a test.
5. **Add a tile**: one line in `Dashboard::TILES`, for example the number
   of customers. It appears on the Customise page with no other change.
6. **Open a download** in a spreadsheet and total the Goods column. Compare
   with the Sales figure on the page (remember cancelled orders are in the
   file, marked as such, but not in Sales).
