# Lesson 23: foreign currency, email, push notifications, and deploys that wait for tests

Four small things, each a tidy example of one Rails idea.

| What | The idea it teaches |
| --- | --- |
| Purchases in dollars, yuan... | Keep the original figure AND the converted one; `decimal` for rates; check constraints |
| "Forgot password" by email | Mailers, signed tokens, config from environment variables |
| Notifications on her phone | Background jobs, `enqueue_after_transaction_commit`, service worker `push` |
| Deploys wait for CI | GitHub Actions `workflow_run` |

---

## 1. A purchase paid in another currency

### The decision: what do we store?

The whole app runs on cedis: stock value, profit, reports. Rewriting all of
that to understand currencies would be a big change for a small need. So the
rule is:

> **Cedis stay the truth. The foreign figures are kept beside them, as a record.**

```
purchases
  currency        "USD"          (default "GHS")
  exchange_rate   15.5           (cedis for ONE dollar; empty for cedi purchases)

purchase_items
  foreign_unit_cost_minor  1250  ($12.50, as cents)
  unit_cost_pesewas        19375 (12.50 x 15.5 = GH₵ 193.75, what everything else reads)
```

Nothing downstream changed. `receive!`, the moving average cost, reports:
all still read `unit_cost_pesewas`.

Transport and other fees stay in cedis. The shipping agent and the duty are
paid here, in cedis, even when the goods were paid for in dollars.

### `decimal`, never `float`, for a rate

```ruby
add_column :purchases, :exchange_rate, :decimal, precision: 12, scale: 4
```

`precision: 12, scale: 4` means 12 digits in total, 4 after the point.
Postgres stores it exactly, and Rails hands it to you as a `BigDecimal`.
A float would store 15.5 fine but 0.0092 (a naira rate) as
0.00919999999999999984..., and those errors grow when multiplied by
thousands of items.

The conversion in `PurchaseItem#price_in_foreign`:

```ruby
self.unit_cost_pesewas = (minor * rate.to_d).round
```

Integer cents times BigDecimal rate is exact; only the last step rounds.

### A rule the database enforces

```ruby
add_check_constraint :purchases,
  "(currency = 'GHS' AND exchange_rate IS NULL) OR (currency <> 'GHS' AND exchange_rate > 0)",
  name: "purchases_rate_matches_currency"
```

The model validates the same thing, with a friendly message. The
constraint is the seatbelt: `update_columns`, a console slip, or a future
bug can skip a validation, but nothing can skip the database.

Laravel comparison: this is `DB::statement('ALTER TABLE ... ADD CONSTRAINT ... CHECK')`,
but Rails has a migration helper for it and writes it into `schema.rb`.

### `Currency` is a constant, not a table

Same reasoning as `Country` and `Region`: the shop does not invent
currencies. `app/models/currency.rb` uses `Data.define` (Ruby 3.2+), which
makes a tiny immutable class:

```ruby
Entry = Data.define(:code, :name, :symbol)
Entry.new("USD", "US dollar", "$").symbol  # => "$"
```

To add a currency, add a line there.

### One reusable change on the front end

`MoneyField` gained a `symbol` prop (default `GH₵`). The purchase form
passes the chosen currency's sign, so the same component now does every
currency.

---

## 2. Email, so "forgot password" works

### The pages are now React

`PasswordsController` now inherits from `InertiaController` and renders
`Passwords/New` and `Passwords/Edit`. The brand photo + form frame that the
login page had was pulled out into `components/AuthShell.tsx`, and all
three pages use it.

### How the reset link works (there is no tokens table)

```ruby
user.password_reset_token                    # makes the token
User.find_by_password_reset_token!(token)    # reads it back
```

Both come free with `has_secure_password`. The token is the user's id,
**signed** with the app's secret, together with a fingerprint of the current
password hash. So:

- it can't be forged (no secret, no valid signature);
- it expires after 15 minutes (the expiry is inside the signed part);
- it works **once**: changing the password changes the fingerprint, and the
  old token no longer matches.

Laravel keeps these in a `password_reset_tokens` table. Rails needs no
table because the token carries its own proof.

### A mailer is a controller for emails

```ruby
class PasswordsMailer < ApplicationMailer
  def reset(user)
    @user = user
    mail subject: "...", to: user.email_address
  end
end

PasswordsMailer.reset(user).deliver_later   # queued as a background job
```

Views live in `app/views/passwords_mailer/` (one `.html.erb`, one
`.text.erb`; Rails sends both and the mail app picks). See it without
sending: `http://localhost:3000/rails/mailers`.

### Settings come from the environment

`config/environments/production.rb` reads `SMTP_ADDRESS`, `SMTP_PORT`,
`SMTP_USERNAME`, `SMTP_PASSWORD` and `MAIL_FROM`. They are set in
`deploy/.env` on the server and passed in by `docker-compose.yml`. No mail
password is ever in git.

If `SMTP_ADDRESS` is missing, deliveries are switched off and
`ApplicationMailer.sending?` is false. The forgot page then says "ask the
shop owner to set a new password for you" instead of showing a form that
would silently do nothing. **A feature that can't work should say so.**

Two small security points in `create`:

- The answer is the same whether or not the email exists. Otherwise the
  page tells a stranger which emails have accounts.
- `User.active`: someone whose access was switched off can't reset their
  way back in.

---

## 3. Push notifications

### The journey of one notification

```
 sale drops stock to 3
        |
 StockLedger.record!  -> warn_if_running_low -> Push.notify("low_stock", ...)
        |
 PushJob (queued; runs after the transaction commits)
        |
 WebPush.payload_send  --- encrypted message --->  Google / Apple push service
                                                          |
                                                    wakes the phone
                                                          |
                          service worker "push" event -> showNotification
```

### The pieces

| File | Job |
| --- | --- |
| `app/models/push.rb` | Topics, who gets what, sending one message |
| `app/models/push_subscription.rb` | One row per device |
| `app/jobs/push_job.rb` | Sends in the background |
| `app/controllers/account/push_subscriptions_controller.rb` | On, off, topics, test |
| `app/frontend/lib/push.ts` | Asking permission and subscribing in the browser |
| `app/frontend/components/PushSettings.tsx` | The "Notifications" panel on My account |
| `app/views/pwa/service-worker.js` | Shows the notification, opens the right page on tap |
| `lib/tasks/push.rake` | `bin/rails push:keys` |

### Why a job, and why "after commit"

Each send is a web request to Google or Apple. Nobody recording a sale
should wait for that, so `Push.notify` only queues a `PushJob`.

But stock changes inside a database transaction. Suppose the job were
queued immediately and then the sale failed and rolled back: a "sold out"
notification would go out for a sale that never happened. One line fixes it:

```ruby
class PushJob < ApplicationJob
  self.enqueue_after_transaction_commit = true
end
```

Rails holds the job back until the surrounding transaction commits, and
drops it if the transaction rolls back. There is a test for exactly this
("a sale that is rolled back says nothing").

### Notify on the crossing, not the state

```ruby
gone_low = before > level && after <= level
sold_out = before.positive? && after <= 0
```

Comparing before and after means one notification when stock **crosses**
the line. Checking only "is it low?" would buzz on every sale after that.

### Who hears what

- Each **device** picks its topics (`push_subscriptions.topics`, a Postgres
  array like `roles.permissions`).
- Each topic needs a **permission** (`stock.view`, `orders.view`), checked
  again at send time. Ticking a box never shows someone what their role
  can't see.
- "New sales" skips the person who recorded it, and skips live claims
  entirely: during a live they arrive every few seconds, and the phone that
  would buzz is the one she is streaming from.

### VAPID keys

The push service needs to know a message really comes from this app. We
sign with a private key; the phone got the matching public key when it
subscribed. Make the pair **once**:

```
bin/rails push:keys
```

and put both lines in `deploy/.env`. Until they are set the feature is
simply off: no panel on the Account page, and `Push.notify` does nothing.
Changing the keys later disconnects every phone.

### A security detail worth noticing

The endpoint is supplied by the browser and the **server** later posts to
it. Unchecked, a logged-in person could save any address and make the
server send requests there (this is called SSRF). So
`PushSubscription` only accepts https addresses at the real push services
(Google, Apple, Mozilla, Microsoft). Brakeman, the security scanner in CI,
is what flagged the first, looser version of that check.

### iPhone

Apple only allows notifications from a web app that has been added to the
home screen and opened from there (iOS 16.4+). The panel detects that case
and says so.

### What could not be tested here

The tests cover everything up to the call to the push service (which is
replaced by a stand-in). A real notification arriving on a real phone can
only be checked on the live site: turn it on, then tap **Send a test**.

---

## 4. Deploys wait for the tests

Before, `deploy.yml` and `ci.yml` both started on a push to `main`, side by
side. A broken commit deployed while its tests were still failing.

Now `deploy.yml` starts when CI **finishes**:

```yaml
on:
  workflow_run:
    workflows: [ CI ]
    types: [ completed ]
    branches: [ main ]

jobs:
  deploy:
    if: >-
      github.event_name == 'workflow_dispatch' ||
      (github.event.workflow_run.conclusion == 'success' &&
       github.event.workflow_run.event == 'push')
```

- `conclusion == 'success'`: every CI job passed (tests, RuboCop, Brakeman,
  bundler-audit, TypeScript).
- `event == 'push'`: CI also runs for pull requests; those must not deploy.
- The checkout uses `workflow_run.head_sha`, so the commit deployed is the
  commit that was tested.

One thing to know: `workflow_run` uses the workflow file on the **default
branch**. The change takes effect once it is merged to `main`.

If CI fails, the site keeps running the last good version, and GitHub
emails you. The manual "Run workflow" button still deploys without waiting.

---

## Try it yourself

1. `bin/rails console`, then `Currency.symbol("CNY")` and
   `Purchase.last.exchange_rate.class`.
2. Open `http://localhost:3000/rails/mailers/passwords_mailer/reset`.
3. In the console: `user = User.first; t = user.password_reset_token;`
   `User.find_by_password_reset_token(t)` finds them. Now
   `user.update!(password: "something-new")` and try the same token again.
4. Run `bin/rails push:keys` twice and notice the keys differ every time.
   That is why the pair is made once and kept.
