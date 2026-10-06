# Lesson 16: Sales channels, and buyers who are not usernames

What changed, following your feedback: buyers do not only come from TikTok.
A sale now records **where it came from** (TikTok, Instagram, WhatsApp, a
phone call, a walk-in...), and a buyer can be known by **a name or a phone
number**, not only a username.

After pulling this step, run:

```sh
bundle install && npm install && bin/rails db:migrate
bin/dev
```

(No `db:seed` needed: the migration adds the starting channels itself.)

## 1. What she can do

- **Record a sale** now starts with *Where did this sale come from?* and a
  row of pills. The choice stays selected, so several WhatsApp orders can be
  entered one after another.
- **Find the buyer** with one search box that looks through names, phone
  numbers and usernames. Tap a match to pick them.
- **Add a new buyer** with whatever she knows: a name, a number, a
  username. One is enough. What she typed in the search box is carried
  into the right field.
- **Go live anywhere**: starting a live asks which platform (TikTok,
  Instagram...) and remembers the last one. During the live, the fast
  one-box username screen is unchanged.
- **Settings > Sales channels**: add, rename, reorder, hide or delete
  channels, and say how buyers are known on each.
- Orders show where they came from, in lists and on the order page.

## 2. What was wrong before

The buyer box turned everything into a TikTok-style username. Typing
"Mrs Mensah" for a WhatsApp order saved a customer called `@mrsmensah`.
The model had quietly assumed one kind of buyer. Two separate things
needed fixing:

| Question | Before | Now |
|---|---|---|
| Where did the sale come from? | not recorded | `orders.sales_channel_id` |
| Who is the buyer? | always a username | a picked customer, or name / phone / username |

They are separate because they vary separately: a known Instagram buyer
may order on WhatsApp next time.

## 3. A lookup table instead of a list in code

Last lesson, payment methods went into a constant (`Payment::WAYS`). Sales
channels went into a table. The difference:

| | Constant in code | Table + Settings screen |
|---|---|---|
| Who can change it | you, with a deploy | her, any time |
| Does code depend on particular values? | can do | must not |
| Good for | stages, delivery methods | categories, channels |

Channels are her vocabulary ("Saturday market", "Jumia"), so they are data.
But the code does need to know one thing about each: how buyers are
identified there. So the table has a `kind` column with two fixed values,
`social` (usernames) and `direct` (name or number). The **names are hers;
the kinds are ours**. That split, free-form rows carrying one fixed
attribute the code can branch on, comes up again and again.

`orders.sales_channel_id` is nullable with `on_delete: :nullify`: deleting
a channel keeps the orders. Hiding (`active: false`) is the gentler choice
and keeps the history, the same as categories.

## 4. Data inside a migration

This migration does three things that are worth knowing.

**It creates rows.** Normally starting data lives in `db/seeds.rb`. But the
app cannot record a sale properly without channels, and the backfill below
needs "TikTok" to exist. So the migration inserts the starting list, and
`db/seeds.rb` uses `find_or_create_by!`, which finds them and does nothing.

**It does not use the app's models.**

```ruby
class Channel < ActiveRecord::Base
  self.table_name = "sales_channels"
end
```

`app/models/sales_channel.rb` will change over the years (new validations,
renamed columns). A migration must keep working exactly as written, on a
fresh machine, long after. So it declares a bare stand-in that knows the
table and nothing else.

**It backfills only what is certain.** Every live so far was a TikTok live,
so those lives and their orders are marked TikTok. Sales recorded outside a
live are left empty. We do not know where they came from, and a guess would
quietly spoil every "sales by channel" figure later. *Unknown* is a better
answer than *probably*.

**An index on an expression.**

```ruby
add_index :sales_channels, "lower(name)", unique: true
```

The database itself treats "TikTok" and "tiktok" as the same name. The
model's `uniqueness: { case_sensitive: false }` gives the friendly message;
the index is the guarantee.

## 5. Extracting a concern, at the right moment

Categories could be reordered with `move(:up)`. Channels needed exactly the
same. So the code moved out of `Category` into
`app/models/concerns/positioned.rb`, and both models now say:

```ruby
include Positioned
```

It was *not* written as a concern the first time. With one user you are
guessing what is general; with two you can see it. "Extract on the second
use" is a good habit. The existing category tests passed untouched, which
is what told us the move was safe.

Inside a concern, `self.class.ordered` is how shared code reaches the model
it has been included into (`Category` in one case, `SalesChannel` in the
other).

## 6. Who is this buyer? Matching rules

`Customer.for_sale` decides whether a sale belongs to a customer she
already has:

| She gives | Rule | Why |
|---|---|---|
| a picked customer | that customer | no guessing needed |
| a username | same username = same person | usernames are unique |
| a phone number | same digits = same person | "024 222 3333" = "0242223333" |
| only a name | always a new customer | two people can be called Ama |

And one more: new details **fill blanks but never overwrite**
(`customer.phone ||= phone`). A known `@kofi.b` gains his phone number the
first time it is typed; a known Ama does not get renamed by a typo.

Names can produce duplicates, by design. Merging two real people into one
is far worse than having one person twice, and the search box makes picking
the existing customer the easy path.

## 7. One endpoint, two shapes of input

`POST /orders` now accepts the buyer two ways:

```ruby
# The live screen:        buyer: "@ama_k"
# The record-a-sale page: buyer: { id: 4 }   or   { name: "...", phone: "..." }
def buyer
  given = params.dig(:order, :buyer)
  return Customer.for_claim(given) unless given.is_a?(ActionController::Parameters)

  Customer.for_sale(**given.permit(:id, :handle, :name, :phone).to_h.symbolize_keys)
end
```

`permit` on the nested hash is strong parameters doing its job: only those
four keys get through, whatever was sent.

Also note what the server does **not** trust: during a live, the channel
comes from the live itself, and a `sales_channel_id` in the request is
ignored. A hidden channel is ignored too. There are tests for both.

## 8. On the React side

- **`BuyerPicker`** is a small state machine of its own: *searching*,
  *picked* or *adding*. It returns early with a different piece of UI for
  each state, which reads more easily than one block full of conditions.
- **Lifting state up.** The picker owns the search text; the parent
  (`SaleCapture`) only needs "who was chosen, and what to call them", which
  the picker reports through `onChange`. Keep state in the lowest component
  that needs it and pass the conclusion upwards.
- **`key` to reset, again.** After each sale the parent bumps a counter
  used as the picker's `key`, and React builds a fresh, empty picker.
- **A component variant instead of a copy.** The pills on the dark "Going
  live?" card are `ChoicePills` with an `inverted` prop, not a second
  component.

## Things to know

- **Older sales outside a live have no channel.** They show without one.
  There is no screen yet to set it afterwards.
- **A customer has one username.** If someone buys from both TikTok and
  Instagram under different names, the second becomes a new customer.
- **"Sales by channel" figures** belong to the reports step, which this
  makes possible.
- **A live can only be on a `social` channel**, because the live screen
  identifies buyers by username.

## Try it yourself

1. **Record three sales**: a WhatsApp one by name and number, an Instagram
   one by username, and a walk-in with only a name. Look at Customers.
2. **Prove the phone rule**: record another sale typing the same number
   with different spacing, and check no second customer appears.
3. **Add your own channel** in Settings and use it.
4. **In the console**:
   ```ruby
   Order.joins(:sales_channel).group("sales_channels.name").sum(:total_pesewas)
   Customer.for_sale(phone: "0242223333")
   SalesChannel.create!(name: "tiktok", kind: "social")          # validation
   SalesChannel.new(name: "TIKTOK", kind: "social").save!(validate: false)  # the index
   ```
5. **Read the concern**: open `positioned.rb`, then find the two models
   that include it. Could suppliers use it? What would they need?
