# Lesson 25: the shop, part 1 (browse, bag, checkout)

The public shop now lives at `/`, and the back office moved to `/admin`.
This lesson covers the first slice: listing products, a bag, and guest
checkout where the shopper pays later. Paying online (Paystack) and
optional accounts are the next two slices.

## 1. Moving the back office with one line

```ruby
scope path: "admin" do
  root "dashboard#show", as: :admin_root
  resources :orders ...
end
```

`scope path:` changes **only the URL**. The controller is still
`OrdersController`, the helper is still `orders_path`; it just returns
`/admin/orders` now. Compare the three tools:

| | URL | Controller folder | Helper name |
| --- | --- | --- | --- |
| `scope path: "admin"` | `/admin/orders` | unchanged | unchanged |
| `scope module: :shop` | unchanged | `shop/` | unchanged |
| `namespace :admin` | `/admin/orders` | `admin/` | `admin_orders_path` |

`namespace` is the three options at once. Here only the URL needed to
change, so Rails code that used helpers didn't need touching. The React
side had the paths written as text (`'/orders'`), so those were rewritten
to `'/admin/orders'`.

Old links are not left to die. One route catches the old addresses and
redirects:

```ruby
get ":section(/*rest)", to: redirect { ... }, constraints: { section: /orders|stock|.../ }
```

`*rest` is a "glob": it swallows everything after the first segment.

## 2. Public controllers

Every controller inherits "must be logged in" from the `Authentication`
concern. The shop opts out, in one base class:

```ruby
class Shop::BaseController < InertiaController
  allow_unauthenticated_access
end
```

The rule for everything under `app/controllers/shop/`: **build props by
hand, never reuse a back-office props method.** A back-office method might
gain a `cost` field next month; a shop page must never send one. There is
a test that reads the product page's JSON and fails if "cost", "sku" or
"stock_on_hand" appears in it.

Stock is shown the way a shop assistant would say it: "in stock", "only 2
left", "sold out". The quantity picker is capped at 20, so 50 in stock
looks the same as 500.

## 3. The bag is a cookie, not a table

```ruby
session[:cart]   # => { "12" => 2, "15" => 1 }   variant id => how many
```

`Cart` (app/models/cart.rb) wraps that hash. Rails encrypts and signs the
session cookie, so the shopper can't read or forge it. No table, no
cleanup job, works for guests.

Two decisions worth noticing:

- **The bag holds no stock.** Stock is taken only when the order is
  placed. Otherwise every abandoned bag would lock pieces away.
- **The bag re-checks itself every time it is read.** `Cart#lines` loads
  only variants that are still active and still on the shop; anything else
  drops out of the cookie.

## 4. Checkout reuses the live screen's engine

`ShopOrder` is a form object for the checkout form. It validates what the
shopper typed, then hands over to **`OrderTaker`**, the class the live
screen already uses:

```ruby
OrderTaker.new(customer:, user: nil, sales_channel: SalesChannel.web, shop: true, lines: cart.to_order_lines, ...)
```

So a web order gets, for free, everything a live claim has: stock taken
under a row lock, refusal if the last one just went, all-or-nothing in one
transaction. Afterwards it is an ordinary order in the back office, "To be
paid", on the "Website" channel, with nobody as the recorder
(`orders.user_id` is now allowed to be empty).

One shared pool of stock, one door to it (`StockLedger`), is what makes it
impossible to sell the same dress on a live and on the website.

### Stricter, because strangers type here

- Name and phone are required.
- A returning customer is matched by phone. Their saved name and location
  are **not** overwritten by whatever was typed.
- A town she doesn't have is **not** added to her places list (in the back
  office it is). It goes into the address text instead.
  `locate(..., add_place: false)` is that switch.
- `rate_limit to: 5, within: 10.minutes` on placing an order. Without it a
  script could empty the shelves with fake orders.

## 5. The order link is a secret

```ruby
has_secure_token :public_token     # in Order
get "order/:token"                 # /order/Xk3vP9...
```

A guest has no login, so the link is the key. `/order/142` would let
anyone read order 141 and 143 by changing the number (this is called an
IDOR, "insecure direct object reference"). A 24-character random token
can't be guessed. `has_secure_token` generates it when the order is created.

## 6. "Show on the shop" is opt-in

`products.listed` defaults to `false`. Nothing is public until she ticks
"Show on the shop" on the product form or taps "Put on the shop" on its
page. `Product.on_shop` (active AND listed) is the single definition the
shop's queries use.

The index on it is partial:

```ruby
add_index :products, :listed, where: "listed"
```

Only the listed rows are in the index, which is exactly the rows the shop
asks for.

## 7. Finding a row whatever it is renamed to

Web orders go on a sales channel she can rename ("Website", "Online
shop"). Code that did `find_by(name: "Website")` would break the day she
renames it. So the row carries a `system_key` of `"web"` that she never
sees, and `SalesChannel.web` finds it by that. The same idea as
`payment_methods.key`.

## Try it

1. Tick "Show on the shop" on a product, then open `/` in a private window.
2. Place an order, then find it in `/admin/orders`.
3. In the console: `Order.last.public_token`, `Order.last.user` (nil),
   `Order.last.sales_channel.system_key`.
4. Put something in the bag, take the product off the shop, reload `/cart`.
