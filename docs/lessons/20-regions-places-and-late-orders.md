# Lesson 20: Regions and places, and orders added after a live

What changed, following your feedback:

1. **A location is now a region and an exact place.** The region is one of
   Ghana's sixteen. The place is picked from a list that grows by itself:
   type one that isn't there and it is added. Reports show sales by region
   and by place.
2. **A live that has ended can still take an order that was missed.**

After pulling this step, run:

```sh
bundle install && npm install && bin/rails db:migrate
bin/dev
```

## 1. What she can do

- **Record a sale**: after the buyer, *Where are they?* asks for the region
  and the exact place. Known places in that region are suggested as she
  types; a new one says "New place. It will be added to Ashanti."
- The location is saved **on the customer**, whether the order is delivered
  or collected, so next time it is already filled in.
- **Delivery** uses that place: its usual fee fills in, and she can change
  it for the order.
- **Customers** have the same two fields on their form, and the order
  page's delivery form too.
- **Settings > Locations** lists the places under each region. That is
  where she sets a place's usual delivery fee, fixes a spelling, or hides
  one.
- **Reports** gain *Where buyers are* (by region) and *Top places*. The
  orders download has Region and Place columns.
- **An ended live** has an *Add a missed order* button (on its page and on
  its Edit page). It brings the claim screen back for that live.

## 2. Two levels, two different kinds of list

| | Region | Exact place |
|---|---|---|
| How many | 16, fixed | grows without limit |
| Who decides | the country | whoever is typing |
| Lives in | code: `Region::ALL` | the `delivery_areas` table |
| Input | a `<select>` | a text box with suggestions |
| Checked by | `inclusion: { in: Region::ALL }` | found or created |

Earlier lessons asked "table or constant?" one list at a time. Here both
answers sit side by side in one feature. The test is always the same: *can
the people using the app legitimately need a new value?* For regions, no.
For places, every day.

A fixed outer level is also what makes the analysis trustworthy. Free-text
places will have the odd duplicate or misspelling, but every one of them
hangs off a clean region, so "sales by region" is always right.

## 3. Find or create

```ruby
def self.locate(region:, name:)
  name = normalize_value_for(:name, name.to_s)
  return if name.blank? || !Region.known?(region)

  where(region: region).where("lower(name) = ?", name.downcase).first || create!(region: region, name: name)
rescue ActiveRecord::RecordNotUnique
  where(region: region).where("lower(name) = ?", name.downcase).first
end
```

Three things in a few lines:

- **Match loosely, store as typed.** "osu", " OSU " and "Osu" all find the
  same place. Without this, the growing list would fill with near-twins.
- **Never trust the region.** It arrives from a form, so it is checked
  against the fixed list before anything is created.
- **The race.** Two people type the same new place at the same moment; both
  look, both find nothing, both insert. The unique index lets one through
  and raises `RecordNotUnique` for the other, which then simply uses the
  winner's row. "Check then insert" is never safe by itself; the index is
  what makes it safe, and the `rescue` is what makes it pleasant.

Rails has `find_or_create_by` for the simple case. It is written out here
because the match is case-insensitive.

## 4. Changing an index in a migration

A place name used to be unique everywhere. Now it only has to be unique
within its region (there is more than one Nkwanta):

```ruby
remove_index :delivery_areas, name: "index_delivery_areas_on_lower_name", column: "lower(name)", unique: true
add_index :delivery_areas, "region, lower(name)", unique: true, name: "index_delivery_areas_on_region_and_lower_name"
```

Note that `remove_index` is given the column and options as well as the
name. Rails doesn't need them to remove the index, but it needs them to
put it *back*: that is what makes the migration reversible. Try
`bin/rails db:rollback` and `db:migrate`.

The same goes for `remove_column :delivery_areas, :position, :integer,
null: false, default: 0`: the type and options are there for the way back.

## 5. A value stored twice, kept honest

`customers.region` exists even though a customer's place already has a
region. That is deliberate duplication, because a customer can have a
region with no place ("somewhere in Volta"). The danger of storing a thing
twice is the two disagreeing, so one line makes that impossible:

```ruby
before_validation { self.region = delivery_area.region if delivery_area&.region }
```

Whenever a place is set, the region follows it. There is a test that tries
to save a customer as "Volta" with a place in Ashanti and gets Ashanti.

## 6. Suggest, don't restrict

```tsx
<TextField list="where_places" ... />
<datalist id="where_places">{here.map((place) => <option value={place.name} />)}</datalist>
```

A `<select>` only allows what is listed. A text box with a `<datalist>`
*offers* what is listed and accepts anything. That one element is the whole
"select that keeps growing" idea, with no library. The options are filtered
to the chosen region, and changing the region clears the place, because a
place belongs to its region.

`LocationFields` is used in three places (sale, customer, order delivery),
and reports the known place it landed on, so each caller can use the
place's usual fee.

## 7. Analysis: which table to join through

"Sales by region" could mean the region an order was *delivered to* or the
region the *buyer is in*. The reports use the buyer's:

```ruby
orders.joins(:customer).group("customers.region")
```

That counts collected orders too, which is what she wants when asking
"where are my customers?". Had it gone through `orders.delivery_area`,
every pick-up would have vanished from the figures. When a report can be
read two ways, decide which question it answers and write it down.

Orders with no region show as "Not recorded" rather than being dropped, so
the panel always adds up to total sales.

## 8. Adding to a live that has ended

Three small changes:

- `OrdersController#create` no longer insists the live is running.
- The live's page shows the claim screen again when asked (`?add=1`), and
  only then loads the product and buyer lists.
- The order is **dated when the live ended**:

```ruby
order.update_column(:created_at, live_session.ended_at) if live_session&.ended_at
```

A missed claim really happened during the live. Dated today, it would turn
up in today's sales and be missing from the live's own day. The stock
movement keeps today's timestamp, because the shelf really did change
today. Two different facts, two different times.

`update_column` writes one column directly, skipping validations and
`updated_at`. That is right for a deliberate, narrow correction like this,
and wrong as a general habit.

## Things to know

- **Places from before this step have no region.** They are listed under
  "No region yet" in Settings > Locations; open each and choose one. Until
  then they aren't offered when recording a sale.
- **The hand-set order of places is gone.** They are listed by region, then
  alphabetically.
- **Anyone who can record a sale can add a place**, by typing it. Tidying
  (renaming, hiding, deleting) needs *Change business settings*.
- **Misspelt twins** ("Madina" and "Medina") are two places. Fix one by
  renaming it in Settings; there is no merge yet.
- **Lives don't ask where the buyer is**, to keep claims fast. Set it on
  the customer or the order afterwards.

## Try it yourself

1. **Grow the list**: record a sale to a new place in a region, then find
   it in Settings > Locations and give it a fee.
2. **Type it three ways**: "osu", "OSU", " Osu ". Check only one exists.
3. **In the console**:
   ```ruby
   DeliveryArea.locate(region: "Ashanti", name: "bantama")
   DeliveryArea.locate(region: "Atlantis", name: "Deep End")    # => nil
   Customer.group(:region).count
   r = SalesReport.new(ReportPeriod.preset("month"))
   r.by_region
   r.by_place
   ```
4. **Roll the migration back and forward** and read `db/schema.rb` each
   time, looking at the indexes on `delivery_areas`.
5. **Add a missed order** to yesterday's live, then check Reports for
   yesterday and for today.
