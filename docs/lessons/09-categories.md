# Lesson 9: Categories, and what we took from ShapeSync

What changed: products can sit in a category. Categories are managed in
**Settings > Categories** (add, rename, reorder, hide, delete), chosen on the
product form, and used as filter chips above the product list.

After pulling this step, run:

```sh
bundle install && npm install && bin/rails db:migrate && bin/rails db:seed
bin/dev
```

Before building this I read how your ShapeSync project (Laravel) does
categories. Since you know that codebase, this lesson uses it as the
comparison: what we kept, what we changed and why, and how the Laravel
pieces map onto Rails.

## 1. What ShapeSync does, and what we borrowed

| ShapeSync (`product_categories`) | ComfyZone (`categories`) | Verdict |
|---|---|---|
| `slug`, unique, generated from the name | same | **Borrowed.** Clean addresses now, and the storefront will need them |
| Slug kept when the name changes | same | **Borrowed.** Saved or shared links keep working |
| `is_active` flag to switch a category off | `active` | **Borrowed.** Hiding is gentler than deleting |
| `withCount('products')` for the list | one grouped `COUNT` | **Borrowed** the idea |
| Ordering by `sort_order` | `position`, with up/down arrows | **Borrowed** |
| Products → category foreign key `onDelete('cascade')` | `on_delete: :nullify` | **Changed.** See below |
| Category is required on every product | optional | **Changed.** She can add stock first and sort it later |
| `category_images` table | not built | **Deferred** until the storefront needs it |
| Seeded with "New Arrivals", "Best Sellers", "Clearance" | Dresses, Tops, Loungewear... | **Changed.** See below |

### The important change: cascade

ShapeSync's products migration has:

```php
$table->foreign('product_category_id')->references('product_category_id')
      ->on('product_categories')->onDelete('cascade');
```

`cascade` means: delete a category, and the database deletes every product
in it. ShapeSync softens this with soft deletes, but the rule itself is
dangerous for a table other things depend on. Ours says:

```ruby
add_reference :products, :category, null: true, foreign_key: { on_delete: :nullify }
```

Delete a category and its products stay, with their category cleared. There
is a test that goes around Rails entirely (`delete_all`) to prove the
database enforces this on its own.

### Categories versus collections

ShapeSync's seeded categories mix two different ideas:

- **What a thing is:** Dresses, Tops. A product has one, and it rarely changes.
- **How it is being sold right now:** New Arrivals, Best Sellers, Clearance.
  These change constantly, a product can be in several, and most can be
  worked out from data (new = added in the last 30 days; best seller =
  most sold).

Here, categories are only the first kind. The second kind will come from
real data once there are sales, with no manual upkeep.

One thing I could not confirm: ShapeSync's `ProductCategoryService` orders
by `sort_order` and filters on `is_featured`, but the create migration has
neither column. They may be added by a later migration I did not read, or
those methods may fail if called. Worth a look next time you are in there.

## 2. Laravel to Rails, side by side

The same feature in both frameworks:

| Idea | Laravel (ShapeSync) | Rails (ComfyZone) |
|---|---|---|
| Table definition | `Schema::create(...)` in a migration class with `up`/`down` | `create_table` in `change`; Rails works out the reverse |
| Model | `class ProductCategory extends Model` | `class Category < ApplicationRecord` |
| Mass-assignment guard | `$fillable` on the model | `params.expect(...)` in the controller (strong parameters) |
| Type casting | `$casts = ['is_active' => 'boolean']` | automatic, read from the column type |
| Has many | `return $this->hasMany(Product::class, ...)` | `has_many :products` |
| Belongs to | `return $this->belongsTo(...)` | `belongs_to :category, optional: true` |
| Query scope | `scopeOrdered($query)` | `scope :ordered, -> { order(:position, :name) }` |
| Model events | `static::creating(function ($model) {...})` in `boot()` | `before_validation :assign_slug, on: :create` |
| Slug helper | `Str::slug($name)` | `name.parameterize` |
| Count related rows | `withCount('products')` | `Product.group(:category_id).count` |
| Eager loading | `->with('category')` | `.includes(:category)` |
| Seeder | a `Seeder` class with `run()` | `db/seeds.rb` |
| Route list | `php artisan route:list` | `bin/rails routes` |
| Console | `php artisan tinker` | `bin/rails console` |

Two differences in philosophy are worth noticing:

- **Where the guard sits.** Laravel protects the *model* with `$fillable`.
  Rails protects the *request* with strong parameters. The Rails view is
  that which fields are editable depends on who is asking, which is a
  controller concern.
- **Service classes.** ShapeSync has a `ProductCategoryService` wrapping
  mostly one-line queries. Rails convention puts those in the model as
  scopes and methods, and reserves separate classes for logic spanning
  several models (like our `VariantGenerator`). Fewer layers, and
  `Category.active.ordered` reads as well as any service method.

Also: ShapeSync uses UUID primary keys with custom key names
(`product_category_id`). We use Rails' default integer `id`. Custom keys cost
you a little configuration on every association; the defaults cost nothing.

## 3. New Rails ideas in this step

**An optional association.**

```ruby
belongs_to :category, optional: true
```

Since Rails 5 `belongs_to` is required by default; `optional: true` allows
nil. Pair it with `null: true` on the column.

**Two layers of protection.** `has_many :products, dependent: :nullify` in
the model and `on_delete: :nullify` in the database say the same thing. The
model version runs when you call `destroy`; the database version holds even
when Rails is bypassed. For data integrity, prefer having both.

**A custom member route.**

```ruby
resources :categories, except: :show do
  patch :move, on: :member   # PATCH /settings/categories/:id/move
end
```

**Filtering with query strings.** `/products?category=dresses&q=wrap` is a
plain GET. The controller narrows the query step by step:

```ruby
products = Product.where(status: status).ordered
products = products.search(params[:q]) if params[:q].present?
products = products.where(category: Category.find_by(slug: params[:category])) if ...
```

Each line adds a condition; one SQL query runs at the end.

## 4. A bug worth learning from

While testing the filter chips I found the list snapping back to "All" a
moment after clicking one. The cause was in the search box code from
lesson 7:

```tsx
const firstRender = useRef(true)
useEffect(() => {
  if (firstRender.current) { firstRender.current = false; return }
  // ...search after 300ms
}, [query])
```

In development React deliberately runs each effect twice on first load, to
flush out exactly this kind of fragile code. The "skip the first run" flag
was used up by the first run, so the second scheduled a search with stale
filters. The fix states the real condition instead of counting runs:

```tsx
if (query === filters.q) return   // already showing these results
```

Lesson: in an effect, check what is true, not how many times you have run.

## Try it yourself

1. **Organise the categories** in Settings: reorder them, hide one, add one.
2. **Assign a few products**, then use the chips and the search box together
   and watch the address bar.
3. **Prove the safety net**: delete a category that has products, then check
   they are still under "No category".
4. **Compare in the console** with what you know from Tinker:
   ```ruby
   Category.ordered.pluck(:name, :slug)
   Category.find_by(slug: "dresses").products.count
   Product.group(:category_id).count
   ```
5. **Read the SQL**: `Product.where(category: Category.first).search("a").to_sql`
