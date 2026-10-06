# Lesson 11: Required suppliers, and pick-up or delivery

What changed, following your feedback on purchases:

- **Every purchase must name a supplier**, chosen from a list.
- **Every supplier needs a name and a phone number.** A new one can be added
  on the purchase form without leaving it.
- **Every purchase says how the goods arrived**, pick-up or delivery, and
  what that cost. The cost is shared into the items exactly as before.

After pulling this step, run:

```sh
bundle install && npm install && bin/rails db:migrate
bin/dev
```

This is a small feature, but it is the first time we *tightened rules on
tables that already hold data*. That is a different skill from creating
tables, and most real-world Rails work is of this kind.

## 1. Changing a table that is in use

`db/migrate/..._add_delivery_to_purchases.rb` adds two columns to
`purchases`. Each needed a different approach:

| Column | Rule wanted | How |
|---|---|---|
| `transport_cost_pesewas` | required, usually 0 | `null: false, default: 0`. Existing rows get 0 automatically. One line. |
| `delivery_method` | required, no sensible default | Add as optional, backfill existing rows, then `change_column_null ... false` |

For `delivery_method` there is no honest default for new rows (she must
choose), so a column default would be wrong. But old rows need *some*
value before the column can be made required. The migration marks them
"delivery" and leaves their money where it was, so no cost that was already
calculated changes. When you backfill, change as little as possible and say
in a comment what you assumed.

## 2. Three places a rule can live

The same step uses all three, on purpose:

| Rule | Database | Model | Why there |
|---|---|---|---|
| `delivery_method` is pickup or delivery | `CHECK` constraint + `NOT NULL` | `enum ..., validate:` | Old rows could be fixed, so the database can enforce it fully |
| A supplier has a phone number | nothing | `validates :phone, presence:` | Old suppliers may have none, and we cannot invent numbers |
| A purchase has a supplier | column stays nullable | `validates :supplier, presence:` | Old purchases may have none |

The pattern: **enforce in the database when every existing row can be made
to comply; enforce only in the model when it cannot.** A model-only rule
applies from now on, each time a record is saved, without rejecting history.
Suppliers saved earlier without a number show "No phone number yet" and are
asked for one the next time they are edited.

## 3. Enums with validation

```ruby
enum :delivery_method, { pickup: "pickup", delivery: "delivery" }, prefix: true,
  validate: { message: "is needed. Was it a pick-up or a delivery?" }
```

- `prefix: true` names the generated methods `delivery_method_pickup?` and
  `delivery_method_delivery?`, so they cannot collide with anything else on
  the model (a bare `delivery?` would be easy to misread next to `received?`).
- Without `validate:`, assigning an unknown value raises an exception. With
  it, you get an ordinary validation error that goes back to the form.

## 4. A gotcha worth remembering: `belongs_to` does not validate

The purchase form can create a supplier on the spot. The controller builds
it and assigns it:

```ruby
purchase.supplier = Supplier.new(name: "Makola Traders", phone: "")
```

My first version saved the purchase **with no supplier at all** when the new
supplier was invalid. Rails tried to save the supplier, failed quietly, and
carried on. A test caught it. The fix is one option:

```ruby
belongs_to :supplier, optional: true, validate: true
```

`has_many` validates new children by default; `belongs_to` does not. When a
form can create the parent record, ask for it explicitly.

Rails saves a new `belongs_to` record as part of saving the child, in the
same transaction. So with `validate: true` the outcomes are clean:

| Supplier | Purchase | Result |
|---|---|---|
| valid | valid | both saved |
| invalid | anything | nothing saved, errors on the supplier fields |
| valid | invalid | nothing saved; the supplier is not left behind |

Each row has a test.

## 5. Putting errors under the right field

The new supplier's fields on the form are `new_supplier_name` and
`new_supplier_phone`, but the errors live on the `Supplier` object as `name`
and `phone`. `form_errors` in the controller moves them across, and removes
Rails' generic "Supplier is invalid". The person sees "is needed so you can
reach them" under the phone box, which is where they will look.

Error messages here are written to read on their own under a field, since
React shows the message without the attribute name in front.

## 6. A reusable either/or control

`components/ui/ChoiceCards.tsx` renders "We picked them up" / "They were
delivered" as two large cards. Underneath they are plain radio buttons,
visually hidden, with the card styled from the radio's state:

```tsx
<label className="... has-checked:border-wine-800 has-checked:bg-wine-50">
  <input type="radio" className="sr-only" ... />
```

Using real radios means arrow keys, screen readers and form semantics all
work without any extra code. The same component will serve payment method
and delivery choices on orders.

The label beside it changes with the choice: "What the trip cost you" for a
pick-up, "What you paid for delivery" otherwise. Small, but it tells her
what number belongs in the box.

## 7. `tel:` links

On the purchase page the supplier's number is a link:

```tsx
<a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
```

On a phone, tapping it starts a call. The link strips spaces and brackets;
the number is still displayed the way she typed it.

## Try it yourself

1. **Record a pick-up** with a trip cost and check the "really costs" figure
   on the purchase page against your own arithmetic.
2. **Add a supplier from the purchase form**, first without a phone number,
   then with one.
3. **Roll the migration back and forward** and compare `db/schema.rb`:
   `bin/rails db:rollback`, then `bin/rails db:migrate`.
4. **Ask the database directly** (it refuses, whatever Rails thinks):
   ```ruby
   Purchase.first.update_column(:delivery_method, "by drone")
   ```
5. **Reproduce the gotcha**: remove `validate: true` from the `belongs_to`,
   run `bin/rails test test/controllers/purchases_controller_test.rb`, read
   the failure, and put it back.
