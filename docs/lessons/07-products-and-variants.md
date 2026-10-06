# Lesson 7: Products and variants

What changed: **Products** is live in the sidebar. She can add a product,
choose its options from the lists in Settings, tick the choices it comes in,
and the app creates every variant. Each variant can have its own price.

After pulling this step, run:

```sh
bundle install && npm install && bin/rails db:migrate
bin/dev
```

This is the first feature where several tables must change together, so it
introduces associations, transactions, and where to put logic that does not
belong to one model.

## 1. Three tables and how they relate

```
products                 product_options               variants
--------                 ---------------               --------
Ankara wrap dress  1---*  Size:   M, L                 M / Black   <- what is
price GH₵ 120            Colour: Black, Red   ----->  M / Red        stocked
status active                                          L / Black      and sold
                   1------------------------------*    L / Red
```

In the models:

```ruby
class Product < ApplicationRecord
  has_many :options, class_name: "ProductOption"
  has_many :variants
end

class Variant < ApplicationRecord
  belongs_to :product
end
```

`belongs_to` goes on the table holding the foreign key (`variants.product_id`).
`has_many` is the other side. Together they give you `product.variants` and
`variant.product`.

**The rule that keeps everything simple: every product has at least one
variant.** A scrunchie with no sizes gets a single "Default" variant. So
stock, purchases and sales will always point at a variant, and there is only
one code path whether she sells dresses or phone cases.

In the console:

```ruby
dress = Product.first
dress.options.map { |o| [o.name, o.labels] }
dress.variants.pluck(:sku, :name)
dress.variants.first.product == dress   # => true
```

## 2. Money: integers, always

```ruby
t.integer :price_pesewas
```

GH₵ 120.50 is stored as `12050`. Floating-point numbers cannot represent
most decimals exactly (`0.1 + 0.2 == 0.3` is false), and the errors
accumulate over hundreds of sales. Whole pesewas never drift.

The conversion lives in exactly two places:

| Direction | Where | Example |
|---|---|---|
| What she types → pesewas | `app/models/pesewas.rb` | `"120.50"` → `12050` |
| Pesewas → what she reads | `app/frontend/lib/format.ts` | `12050` → `GH₵ 120.50` |

`Pesewas.parse` uses `BigDecimal`, which is exact. Try
`Pesewas.parse("19.99")` and compare with `(19.99 * 100).to_i` in the console.

## 3. A concern with a class macro

```ruby
class Product < ApplicationRecord
  include HasMoney
  money :price
end
```

`money :price` reads like `has_many` or `validates` because it is the same
kind of thing: a method that runs once when the class loads and defines
other methods. Open `app/models/concerns/has_money.rb` to see it create
`price`, `price=` and a validation. Now any model with a `*_pesewas` column
gets the same behaviour in one line (purchases and orders will reuse it).

`OptionValues` is the other new concern. Its code was written for
`OptionPreset` in lesson 5 and moved out when `ProductOption` needed the
same thing. That is the right moment to extract a concern: on the second
use, not in anticipation.

## 4. Transactions: all or nothing

Saving a product touches three tables. `Product#save_with_options` wraps
the work in a transaction:

```ruby
transaction do
  options.destroy_all if persisted?
  # ...build the new options...
  if save
    VariantGenerator.new(self).sync!
  else
    raise ActiveRecord::Rollback
  end
end
```

If anything inside fails, the database is put back exactly as it was,
including the `destroy_all`. Without the transaction, a validation error
halfway through could leave a product with new options and old variants.

The test "a failed save changes nothing" in `test/models/product_test.rb`
proves it. The price screen uses the same idea: one bad price saves none.

## 5. A plain Ruby object for logic between models

`app/models/variant_generator.rb` is not a model or a controller. It is a
small class with one job: make the variants match the options.

```ruby
VariantGenerator.new(product).sync!
```

The heart of it is `Array#product`, Ruby's "every combination":

```ruby
[ "M", "L" ].product([ "Black", "Red" ])
# => [["M","Black"], ["M","Red"], ["L","Black"], ["L","Red"]]
```

Editing options must not wipe out prices, so `sync!` matches existing
variants by a `combination_key` (`"colour=black|size=m"`), keeps those that
still apply, creates the missing ones, and removes the rest. A unique index
on `[product_id, combination_key]` makes duplicates impossible even under
simultaneous requests.

When logic spans several models and belongs to none, give it its own class.
Models stay about their own data; controllers stay thin.

## 6. Enums, scopes and avoiding N+1

```ruby
enum :status, { active: "active", archived: "archived" }
```

gives `product.archived?`, `product.archived!`, `Product.active` and
`Product.archived`. Products are archived, never deleted, because past sales
will refer to them. There is deliberately no delete route.

Scopes are named, chainable queries:

```ruby
Product.active.search("ankara").ordered.includes(:variants)
```

Nothing is sent to the database until the result is used. `includes` loads
all variants in one extra query; without it, the list page would run one
query per product (watch the log while loading `/products` to see just two).

`search` uses `sanitize_sql_like`, so a typed `%` is treated as a character
and not as a wildcard, and the `?` placeholder keeps user input out of the
SQL string entirely. Never build SQL with string interpolation.

## 7. Two permissions on one controller

```ruby
require_permission "products.view", only: %i[ index show ]
require_permission "products.manage", except: %i[ index show ]
```

A Sales assistant can look things up; only someone with `products.manage`
can change them. The React side hides the buttons with `useCan()`, and the
tests confirm Rails refuses the requests regardless.

## 8. On the React side

- `ProductOptionsEditor` is controlled, like the list editor in lesson 5.
  It works on a draft shape (`choices` on offer, `selected` ticked), and the
  form sends only the ticked ones.
- The "What you'll be able to sell" panel recomputes on every tap
  (`lib/variants.ts`). It is only a preview; Rails does the real generating.
  Logic that matters lives on the server; the browser copy is for comfort.
- Search is a plain `GET /products?q=...`, so the address bar always
  describes what is on screen.

## Not in this step

- **Photos** come next, as their own small step (file uploads deserve a
  lesson to themselves).
- **Categories** are not built yet.
- **Renaming a choice** (for example "Blk" to "Black") is treated as removing
  one variant and adding another, so that variant's own price is reset.
- **Stock** shows nowhere yet; it arrives with purchases.

## Try it yourself

1. **Add a product** with Size (Letter sizes: M, L, XL) and Colour (two
   colours). Check the preview count before saving.
2. **In the console**, inspect it: `Product.last.variants.pluck(:sku, :name, :combination_key)`.
3. **Price one variant differently**, then edit the product and untick a
   size. Confirm the special price survived.
4. **See the transaction work**:
   ```ruby
   p = Product.last
   p.save_with_options([{ name: "Size", values: [{ label: "M" }, { label: "m" }] }])  # => false
   p.errors.full_messages
   p.reload.variants.count   # unchanged
   ```
5. **Watch the queries**: load `/products` and count the SELECTs in the
   terminal. Then remove `.includes(:variants)` from the controller, reload,
   count again, and put it back.
