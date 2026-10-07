# Lesson 22: Countries, and where suppliers are

What changed, following your feedback:

1. **Suppliers have a location**, which I had left off: country, region,
   exact place, and an address line.
2. **Country sits above region everywhere.** A supplier in Guangzhou or a
   buyer in London can now be recorded properly.

After pulling this step, run:

```sh
bundle install && npm install && bin/rails db:migrate
bin/dev
```

## 1. What she can do

- **Suppliers**: the form has Country, Region, Exact place and Address.
  The supplier's page and the list show where they are, with an *Abroad*
  badge for anyone outside Ghana.
- **Recording a purchase** with a new supplier asks for the same, so goods
  bought abroad are tagged with the country from the start.
- **Customers, sales and deliveries**: the location picker now starts with
  Country, set to Ghana.
  - In Ghana: Region, then Exact place, as before.
  - Abroad: just the country and a *City or area*. There is no region.
- **Reports**: *Where buyers are* lists Ghana's regions and other countries
  side by side. The orders download has a Country column.
- **Settings > Locations** groups places under their region, or under their
  country for places abroad.

## 2. A third level, and a rule between levels

```
Country   195 or so, fixed     Country::ALL   (Ghana is Country::HOME)
Region    16, fixed            Region::ALL    only exists in Ghana
Place     grows as she types   delivery_areas
```

The new part is a rule that links two levels: **a region only applies at
home**. It is enforced in three places, each doing a different job:

| Where | What it does |
|---|---|
| The form (`LocationFields`) | hides Region when the country isn't Ghana |
| The model (`Located`, `DeliveryArea`) | validates it, with a message |
| `locate` | drops a region sent for a foreign country |

The form makes the wrong thing hard to do; the model makes it impossible to
save. Never rely on the form alone: a request can be sent without it.

## 3. A concern, extracted on the second use (again)

Customers had a region and a place. Suppliers needed the same, plus
country. Rather than copy the code, it moved to
`app/models/concerns/located.rb`:

```ruby
class Customer < ApplicationRecord
  include Located
end

class Supplier < ApplicationRecord
  include Located
end
```

`Located` brings the association, the validations and three methods:

```ruby
supplier.locate(country: "China", region: "", place: "Guangzhou")   # set, if anything was said
supplier.relocate(...)                                               # clear first, then set
supplier.where_text                                                  # "Guangzhou, China"
```

Why two setters? They answer different forms:

- **`locate`** is for a form where location is optional and incidental
  (recording a sale). Saying nothing must change nothing.
- **`relocate`** is for an edit form, where emptying the fields *means*
  "clear it".

The same data, two intentions. Naming them separately is clearer than one
method with a flag.

The controllers got the matching concern, `LocationPicker`, with
`location_options` (what the picker needs) and `where_from` (reading what
it sent back). Five controllers use it.

## 4. "Ghana, region not known" means nothing

The picker has to start somewhere, and it starts at Ghana. So a form that
was never touched arrives saying "Ghana, no region, no place". If that were
saved, every customer would be recorded as "in Ghana" whether or not anyone
knew, and the reports' "Not recorded" would lie.

So that one combination is treated as silence:

```ruby
if Country.home?(country)
  return unless Region.known?(region)     # Ghana alone says nothing
  ...
```

A default value in a form is not information. Watch for this whenever a
select is pre-filled.

## 5. Uniqueness when a column can be NULL

A place abroad has no region, so `region` is NULL for it. That breaks a
plain unique index, because in SQL **NULL is never equal to NULL**:

```sql
-- these two rows do NOT conflict under UNIQUE (country, region, lower(name))
('China', NULL, 'guangzhou')
('China', NULL, 'guangzhou')
```

The fix is to index an expression that turns NULL into something
comparable:

```ruby
add_index :delivery_areas, "country, COALESCE(region, ''), lower(name)", unique: true
```

There is a test that tries to insert Guangzhou twice, skipping validations,
and expects the database to refuse. Without `COALESCE` it would pass
straight through. Any unique index over a nullable column deserves this
thought.

## 6. One label from two columns, in SQL

"Where buyers are" shows a region for buyers at home and a country for
buyers abroad, in one ranked list. That label is computed in the query:

```sql
CASE WHEN customers.country IS NOT NULL AND customers.country <> 'Ghana'
     THEN customers.country ELSE customers.region END
```

and the report groups by it. `CASE` is SQL's if/else. Grouping by an
expression, not just a column, is what lets one query answer a question
that spans two columns.

## 7. A backfill that only claims what is certain

```ruby
execute "UPDATE customers SET country = 'Ghana' WHERE region IS NOT NULL"
```

Anyone with a Ghanaian region is in Ghana. Anyone without one is left with
no country, because we do not know. Same principle as the TikTok backfill
in lesson 16.

## 8. Added straight after: location on the live claim screen

The live claim screen now has a folded row under the buyer's name: *Add
where they are*. Tapping it opens the same country, region and place
picker. For a buyer she already knows, the row shows where they are
("Osu, Greater Accra") with *Change*.

It stays folded so that a claim is still one box and one tap when she is
in a hurry. Pick-up or delivery is not asked during a live at all; that is
chosen afterwards on the order, where the buyer's place then fills in the
usual fee.

The React detail worth a look is how it avoids overwriting by accident:

```tsx
const [liveWhere, setLiveWhere] = useState<Where | null>(null)   // null = she hasn't touched it
const shownWhere = liveWhere ?? knownWhere ?? nowhere(home)
```

What is *shown* falls back to the known buyer's location. What is *sent*
is only `liveWhere`, and only if she entered something. Keeping "what the
user typed" apart from "what we are displaying" is how a form avoids
saving its own defaults back as if they were answers.

## Things to know

- **Money is still in cedis only.** For a purchase paid in dollars or yuan,
  enter what it cost in cedis. Shipping and customs go in the purchase's
  transport and other-costs boxes, and are spread into the cost of each
  item as before.
- **Delivery fees abroad are typed by hand** unless she sets a usual fee
  for that city in Settings > Locations.
- **The table is still called `delivery_areas`**, though it now holds every
  kind of place. Renaming a table that seven files depend on is a job for
  a quiet day.
- **Existing suppliers have no location** until she edits them.

## Try it yourself

1. **Add a supplier abroad**, then record a purchase from them and see the
   country on the purchase page.
2. **Record a sale to a buyer in another country** and find them in
   Reports under *Where buyers are*.
3. **In the console**:
   ```ruby
   Supplier.group(:country).count
   Customer.group(:country, :region).count
   DeliveryArea.locate(country: "China", name: "guangzhou")
   DeliveryArea.new(country: "China", region: "Ashanti", name: "X").tap(&:valid?).errors.full_messages
   Supplier.first.where_text
   ```
4. **See the NULL problem for yourself**: in `bin/rails dbconsole`, run
   `SELECT NULL = NULL;` and read the answer.
5. **Read `located.rb`**, then find the five places `LocationPicker` is
   included. Which controllers call `locate`, and which `relocate`? Why?
