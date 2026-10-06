# Lesson 12: A home for suppliers, and what each one sells

What changed, following your feedback:

- **Suppliers has its own place in the menu**, no longer tucked inside
  Purchases.
- **Each supplier records what they sell**: you choose products when adding
  or editing a supplier, and anything you buy from them is added
  automatically.
- **Each supplier has a page**: phone number you can tap to call, what they
  sell with the last price you paid, and every purchase from them.
- **You can search suppliers by what they sell** ("who do I get kaftans from?").
- **On a phone, a new "More" button** opens everything that does not fit in
  the bottom bar. Before this, Purchases could not be reached on a phone.

After pulling this step, run:

```sh
bundle install && npm install && bin/rails db:migrate
bin/dev
```

## 1. Many-to-many: the third table

A supplier sells many products. A product can come from several suppliers.
Neither table can hold the other's id, because there would need to be many
of them. The answer is always a third table with one row per pairing:

```
suppliers            product_suppliers             products
---------            -----------------             --------
Kumasi Fabrics  <--  supplier 1, product 4   -->   Ankara wrap dress
                <--  supplier 1, product 7   -->   Kaftan maxi
Makola Traders  <--  supplier 2, product 4   -->   Ankara wrap dress
```

In the models it takes two lines on each side:

```ruby
class Supplier < ApplicationRecord
  has_many :product_suppliers, dependent: :destroy
  has_many :products, through: :product_suppliers
end

class Product < ApplicationRecord
  has_many :product_suppliers, dependent: :destroy
  has_many :suppliers, through: :product_suppliers
end
```

`has_many :through` says "to get from here to there, go through that
table". It gives you:

```ruby
supplier.products              # what they sell
product.suppliers              # who sells it
supplier.product_ids           # => [4, 7]
supplier.product_ids = [4, 9]  # replace the whole set: adds 9, removes 7
```

In Laravel terms this is `belongsToMany` with a pivot table. Rails asks you
to name the join model (`ProductSupplier`) explicitly, which pays off the
day the pairing needs data of its own, such as "their usual price" or
"minimum order". (Rails also has `has_and_belongs_to_many`, with no join
model; most people avoid it for exactly that reason.)

## 2. `product_ids=` writes immediately

Most assignments in Rails only change the object in memory until you call
`save`. This one is different:

```ruby
supplier.product_ids = [4, 9]   # INSERTs and DELETEs happen right now
supplier.save                   # ...even if this then fails validation
```

So `Supplier#save_with_products` wraps both in a transaction and rolls back
if the supplier is invalid. There is a test: an invalid phone number must
not change what the supplier sells.

It also treats `nil` and `[]` differently on purpose:

| The form sent | Meaning | Result |
|---|---|---|
| no `product_ids` key at all | "I am not editing the list" | pairings left alone |
| `product_ids: []` | "they sell nothing" | pairings cleared |

That distinction is why the React form sends `[""]` for an empty list: with
nothing in it, the key would not arrive at all.

## 3. Keeping it up to date without anyone maintaining it

Lists that need manual upkeep go stale. So buying something from a supplier
records that they sell it:

```ruby
supplier.sells!(product_ids)   # in Purchase#save_with_items
```

```ruby
def sells!(product_ids)
  rows = product_ids.uniq.map { |id| { supplier_id: self.id, product_id: id } }
  ProductSupplier.insert_all(rows, unique_by: %i[ supplier_id product_id ])
end
```

`insert_all` writes every row in one SQL statement, and `unique_by` tells
Postgres to skip rows that would break the unique index
(`ON CONFLICT DO NOTHING`). So it can be called any number of times and
never creates a duplicate. An operation you can safely repeat is called
*idempotent*, and it is worth aiming for wherever you can.

Note what `insert_all` skips: validations and callbacks. That is fine here
(the database index is the real guard) but it is a trade you should always
make knowingly.

## 4. Backfilling with INSERT ... SELECT

The migration fills the new table from purchase history:

```sql
INSERT INTO product_suppliers (supplier_id, product_id, created_at, updated_at)
SELECT DISTINCT purchases.supplier_id, variants.product_id, NOW(), NOW()
FROM purchase_items
JOIN purchases ON purchases.id = purchase_items.purchase_id
JOIN variants  ON variants.id  = purchase_items.variant_id
WHERE purchases.supplier_id IS NOT NULL
```

One statement, run entirely inside the database: nothing is loaded into
Ruby, so it is as fast on a million rows as on ten. When a backfill can be
written as "the result of this query goes into that table", this is the
tool.

## 5. Searching across a relationship

```ruby
suppliers.where(
  "suppliers.name ILIKE :term
   OR regexp_replace(coalesce(suppliers.phone, ''), '\\D', '', 'g') LIKE :phone
   OR suppliers.id IN (
     SELECT supplier_id FROM product_suppliers
     JOIN products ON products.id = product_suppliers.product_id
     WHERE products.name ILIKE :term)",
  term: term, phone: phone)
```

Three ideas:

- **Named placeholders** (`:term`) let one value be used several times, and
  keep user input out of the SQL string.
- **A subquery with `IN`** finds suppliers by something they sell, without
  a JOIN that would repeat a supplier once per matching product.
- **Phones are compared digits to digits.** They are stored as typed
  ("020 111 2222"), so the query strips non-digits from the stored number
  and from what she typed. I only found this because a test searching
  "0111" failed.

## 6. Passing context between pages with a query string

The supplier page's "Record a purchase" button links to
`/purchases/new?supplier_id=7`. The purchases controller reads it and passes
`preselected_supplier_id` to the form, which selects that supplier and lists
their products first. No hidden state: the address says what will happen,
and it can be bookmarked.

## 7. On the React side

- `ProductMultiPicker` is another controlled component: the page owns the
  list of ids. Compare it with `ProductOptionsEditor` and
  `OptionValuesEditor`; all three share the same contract (`value` in,
  `onChange` out), which is what makes them easy to reuse.
- The phone **More sheet** in `AppLayout` closes itself when the page
  changes: `useEffect(() => setMoreOpen(false), [url])`. The bottom bar
  takes the first four sections marked `mobile: true` in `navigation.ts`;
  everything else lands in the sheet automatically, so new sections never
  go missing on a phone again.
- `StatStrip` picks its column layout from a lookup table, because Tailwind
  only generates classes it can find written out in full. A class built at
  runtime like `` `grid-cols-${n}` `` silently produces no CSS.

## Try it yourself

1. **Add a supplier** with two products, then record a purchase from their
   page that includes a third. Check that the third appears under "What
   they sell".
2. **Search** suppliers by a product name, then by part of a phone number.
3. **In the console**:
   ```ruby
   s = Supplier.first
   s.products.pluck(:name)
   s.product_ids
   Product.first.suppliers.pluck(:name)
   s.sells!(Product.ids); s.sells!(Product.ids)   # twice, on purpose
   ProductSupplier.where(supplier: s).count
   ```
4. **Read the SQL** behind a `through`: `Supplier.first.products.to_sql`.
5. **See the difference** between `nil` and `[]`:
   `s.save_with_products(nil)` then `s.save_with_products([])`.
