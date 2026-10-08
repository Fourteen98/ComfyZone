# Lesson 26: the phone number is the customer

Before this step a customer could be typed in as "024 222 3333" on Monday
and "0242223333" on Tuesday and become two customers. Now the phone number
is the one thing that identifies a customer, and the app makes sure it
means the same thing however it was typed.

## 1. One shape for every number: E.164

```
024 222 3333   0242223333   +233 24 222 3333   233242223333   00233242223333
                                   ↓
                            +233242223333
```

That shape is called **E.164**: a plus, the country code, then the number
with its leading 0 dropped and no spaces. It is the international standard,
and it is what WhatsApp's `wa.me/233242223333` links and `tel:` links want.

`PhoneNumber.normalize` (app/models/phone_number.rb) does the conversion.
Ghana is the default: a number with no country code is taken to be
Ghanaian. The React side has a twin (`app/frontend/lib/phone.ts`) so the
form can show "Saved as +233 24 222 3333" while she types, but Rails has the
final say.

```ruby
normalizes :phone, with: ->(phone) { PhoneNumber.normalize(phone) }
```

`normalizes` (Rails 7.1+) runs on every assignment AND on lookups:
`Customer.find_by(phone: "024 222 3333")` finds `+233242223333`, because
Rails normalises the value you search for too. That is why
`Customer.for_sale` could become one line:

```ruby
customer = (number && find_by(phone: number)) || (handle && find_by(handle: handle)) || new
```

The phone is checked **first**, so it wins over a username.

## 2. Kept as typed when it makes no sense

If the text can't be read as a number ("hello", "12345"), `normalize`
returns it squished rather than nil. Returning nil would make the field
silently empty; keeping it lets validation point at it: "doesn't look like
a phone number. Try 024 123 4567".

## 3. Unique, twice

```ruby
validates :phone, uniqueness: { message: ->(customer, _) { "already belongs to #{...}" } }
```

```ruby
add_index :customers, :phone, unique: true, where: "phone IS NOT NULL"
```

The validation gives a friendly message naming who has the number. The
index is the real guarantee: two requests at the same moment can both pass
the validation (each checks before the other has saved), but only one can
get past the index.

`where: "phone IS NOT NULL"` makes it a **partial** unique index: only rows
with a number take part. Plenty of TikTok buyers have no number yet, and
they must not clash with each other.

## 4. A migration that tidies up the past

`20261008060001_make_phone_the_customer_identity.rb`:

1. rewrites every customer and supplier phone into the new shape;
2. finds customers who now share a number: they were always the same
   person. The oldest is kept; orders move to it, its blanks are filled
   from the others, and the others are deleted;
3. only then adds the unique index (it would fail with duplicates present).

The number-rewriting rules are **copied** into the migration instead of
calling `PhoneNumber`. A migration has to do exactly what it did on the day
it ran, forever; if `PhoneNumber` changes next year, an old migration
calling it would quietly do something different on a fresh database.

The `down` method can't un-merge people, so it only removes the rule. Some
changes are one-way, and it is better to say so than to pretend.

## 5. Searching

Stored numbers start `+233`, but she will search the way she types:
"024 22". `PhoneNumber.search_digits` drops the leading 0, so the search is
for "2422", which is inside "+233242223333".

## 6. The PhoneField component

`components/ui/PhoneField.tsx`, used on every form that takes a number
(record a sale, customers, suppliers, new supplier on a purchase, shop
checkout):

- a country picker, Ghana (+233) chosen to start with;
- type `024...` or `24...`: the same number;
- paste or type `+44 7700 900123`: it switches to the UK by itself;
- under the box: "Saved as +233 24 222 3333" with a tick, or "Ghana
  numbers have 9 digits after +233 (6 so far)";
- the parent only ever receives the stored shape.

The box keeps exactly what she typed (spaces and all) in its own state, and
only the clean number goes up. A field that rewrites itself under the
cursor while you type is maddening.

On "Record a sale", adding a new buyer now asks for the number first, and
the moment it matches someone she has, it says "This number is Ama's. The
sale will go to them" with a button to pick her.

## 7. Phone numbers you can use

`components/PhoneLinks.tsx` shows a number as two links: call it, or open a
WhatsApp chat (`https://wa.me/233242223333`). It is on the order, supplier
and purchase pages.

## Try it

```ruby
PhoneNumber.normalize("(024) 222-3333")
Customer.find_by(phone: "0242223333")
Customer.new(name: "Test", phone: "024 222 3333").tap(&:valid?).errors[:phone]
```
