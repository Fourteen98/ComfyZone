# Lesson 21: The phone app, and six smaller gaps

A wide step. Seven things changed; each is small, and most reuse an idea
from an earlier lesson. Read the sections that interest you.

1. The app can be **installed on a phone**, with an offline page.
2. **Part-returns**: she kept the dress and sent back the scarf.
3. **Stock take**: count many items on one screen.
4. **Merging duplicates**: customers and places entered twice.
5. **Payment methods** are now managed in Settings.
6. **Badges in the menu** for low stock and orders to pack.
7. **A standard dashboard per role.**

After pulling this step, run:

```sh
bundle install && npm install && bin/rails db:migrate
bin/dev
```

## 1. An installable app (PWA)

A "progressive web app" is a website that a phone will put on the home
screen and open full-screen, with no app store. Three pieces make it one:

| Piece | File | What it is for |
|---|---|---|
| Manifest | `app/views/pwa/manifest.json.erb` | name, icons, colours, "open without browser bars" |
| Service worker | `app/views/pwa/service-worker.js` | a script the browser keeps for the site |
| HTTPS | already there | phones refuse to install anything else |

Rails 8 ships the controller (`Rails::PwaController`) and both files with
the routes commented out. Switching it on was two lines in
`config/routes.rb` and a `<link rel="manifest">` in the layout. Both URLs
are public on purpose: the phone fetches them before anyone has logged in.

**Icons.** `icon-maskable.png` has the logo shrunk into the middle with
plain colour around it. Android crops icons to its own shape (circle,
squircle); a "maskable" icon promises the important part is in the centre.

**The service worker does one job**: if a page can't load because there is
no signal, show `public/offline.html` instead of the browser's error.

```js
if (event.request.mode !== "navigate") return
event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_PAGE)))
```

What it deliberately does *not* do is keep copies of pages or data to use
offline. That is the tempting next step and the wrong one here: an old copy
of "3 left" would let her sell stock that has gone. For this app, no answer
is better than a stale one. The offline page says so, and points at *Add a
missed order* for claims noted on paper.

It is registered only in production (`import.meta.env.PROD`), because in
development it would fight Vite's live reload.

**Installing.** *My account* has an *On your phone* panel. On Android,
Chrome fires a `beforeinstallprompt` event, usually before any button
exists; `lib/install.ts` catches it the moment the file loads and keeps it
for when she taps *Install the app*. iPhones have no such event, so the
panel shows the Share > Add to Home Screen steps instead.

## 2. Part-returns

One new column:

```ruby
add_column :order_items, :returned_quantity, :integer, null: false, default: 0
add_check_constraint :order_items, "returned_quantity >= 0 AND returned_quantity <= quantity"
```

`quantity` stays as what was sold. What still counts is
`quantity - returned_quantity`, which the model calls `kept`. Totals, cost,
units and every report use `kept`.

The design choice worth noticing: **record the return, don't rewrite the
sale**. Lowering `quantity` from 2 to 1 would have "worked", and erased the
fact that two were sold and one came back. Keeping both numbers means the
order page can say "2 × Scarf, 1 returned".

Money needs no code of its own. The total shrinks, the payments don't, so
`balance_pesewas` goes negative, and the order already knew how to show
that as "to give back" and list itself under *Refunds due* (lesson 15).
Good earlier modelling paid for this feature.

`return!` (the whole order) is now a one-line call to `return_items!`.
One code path, two entry points.

## 3. Stock take

`StockTake` is a form object over many variants:

```ruby
take = StockTake.new(user: user, counts: { "12" => "7", "13" => "", "14" => "0" })
```

- **Blank is not zero.** An empty box means "I didn't count this"; `0`
  means "I looked and there are none". Mixing them up would wipe stock.
- **All or nothing**: one unreadable number refuses the whole sheet.
- Each real difference becomes an ordinary `recount` movement, so a stock
  take leaves exactly the trail a hand correction would.

**A routing lesson.** `/stock/count` had to be declared *above*
`resources :stock`, or Rails would read it as `/stock/:id` with an id of
"count". Routes are tried from the top; the first match wins.

## 4. Merging duplicates

```ruby
def absorb!(other)
  transaction do
    other.orders.update_all(customer_id: id)
    gained = other.slice(:handle, :name, :phone, ...).compact
    other.reload.destroy!
    gained.each { |attribute, value| self[attribute] = value if self[attribute].blank? }
    save!
  end
end
```

Three things in order, and the order matters:

1. **Move what points at the duplicate** (`update_all`: one UPDATE, however
   many orders).
2. **Remember what it knew, then delete it.** Deleting comes *before*
   copying, because two customers can't hold the same username at once.
3. **Fill blanks only.** The customer being kept is never overwritten.

`other.reload` before `destroy!` matters: without it, Rails still thinks
the duplicate has orders (it loaded them earlier) and
`dependent: :restrict_with_error` would refuse.

Places merge the same way, minus the blank-filling.

## 5. Payment methods: promoting a constant to a table

Lesson 15 said of `Payment::WAYS`: "this list probably will change".
It has. The move from constant to table had one trap:

```ruby
t.string :key, null: false    # what payments.via stores; never changes
t.string :name, null: false   # what she sees; free to change
```

Old payments store `"momo"`. If the new table used `name` as the link,
renaming "Mobile money" to "MoMo" would orphan every one of them. So each
method has a **key** set once (`attr_readonly :key`) and a **name** she can
edit. The migration creates the four original methods with their original
keys, so nothing already recorded changes.

A method that has been used can be hidden but not deleted
(`before_destroy` adds an error and `throw :abort`). The controller uses
`destroy` without the `!`, which returns false instead of raising.

Also new: each method says whether it has a transaction ID
(`wants_reference`), replacing a hard-coded `via === 'momo' || 'bank'` in
React.

## 6. Badges in the menu

```ruby
alerts: {
  low_stock: user&.can?("stock.view") ? StockLedger.needing_attention.count : nil,
  to_pack: user&.can?("orders.view") ? Order.paid.count : nil
}
```

Added to `inertia_share`, so every page gets them. That is two COUNT
queries on every request: cheap here, but it is the kind of thing to
measure before adding a third and a fourth.

On a phone, Stock sits under *More*, so *More* shows a dot when anything
inside it has a badge.

These are in-app only. A notification that reaches her when the app is
closed (web push) needs keys, a subscription per device and a background
job; that is a step of its own.

## 7. A dashboard per role, by duck typing

`Dashboard.new(user)` asks its subject three things: `can?(key)`,
`dashboard_layout`, and `update(...)`. A `Role` answers all three. So
setting a role's standard dashboard is:

```ruby
Dashboard.new(role).save(tiles: ..., panels: ...)
```

No new class, no `if role`. "If it walks like a duck": Ruby doesn't care
what type an object is, only whether it responds to the methods you call.
The layout is filtered by what the *role* may see, for free.

Reading a layout now falls through three levels: the person's own, then
their role's, then the app's default.

## Things to know

- **The home-screen icon is cropped from the logo photo.** A flat,
  transparent version of the logo would look sharper.
- **iPhones**: install from Safari. Other iPhone browsers can't.
- **A part-return leaves the order "Delivered"** with a smaller total. It
  becomes "Returned" only when everything is back.
- **Merges can't be undone.** The confirm dialog says so.
- **A stock take lists every active item.** With hundreds of products it
  will be a long page; the search box filters it.
- **Badges count low *or* out of stock**, the same number as the dashboard
  tile.

## Try it yourself

1. **Install it** (after deploying): open the site on your phone, go to
   *My account*, and add it to the home screen. Then switch on flight mode
   and open it.
2. **Return part of an order**: deliver one with two items, send one back,
   and record the refund it asks for.
3. **In the console**:
   ```ruby
   OrderItem.where("returned_quantity > 0").map { |i| [ i.quantity, i.returned_quantity, i.kept ] }
   PaymentMethod.pluck(:key, :name)
   PaymentMethod.find_by(key: "momo").update(key: "x")    # silently ignored: attr_readonly
   Dashboard.new(Role.find_by(name: "Packer")).choices[:tiles].pluck(:label)
   ```
4. **Break the routing on purpose**: move the `scope "stock"` block below
   `resources :stock`, open `/stock/count`, read the error, and put it back.
5. **Read `service-worker.js`**. Then say out loud why caching the orders
   page "to make it faster" would be a mistake in this app.
