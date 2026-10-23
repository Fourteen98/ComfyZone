# 49. Customer accounts: sign up, stay logged in, passkeys

## What shoppers get

- **Sign up** (`/signup`): name, phone number, password (8+), email optional.
  Optional: guests can still order exactly as before.
- **Stay logged in for a year** on that phone. Every visit pushes the year
  forward (at most once a day), so a regular customer practically never
  logs in again.
- **Log in** (`/login`) with phone + password, or **Face ID / fingerprint**
  once they set it up under My account → "Face ID and fingerprint".
- **My account** (`/account`): their website orders with status and what is
  left to pay, their details, password, log out, delete the account.
- **Checkout** starts from their saved name, phone and delivery details, and
  remembers new ones ("Remember these details for next time").
- **After a guest order**, the order page says "Create an account to keep
  track of this order". Signing up from there adds that order to the account.
- **Forgot password?** No SMS: they message the shop on WhatsApp (Settings →
  WhatsApp → "Your WhatsApp number" makes the button), and staff make a
  one-time link on the customer's page ("Forgot password: make a link" →
  Send on WhatsApp). It works once, for a day.

## The pieces

| File | Job |
|---|---|
| migration `create_shop_accounts` | `shop_accounts`, `shop_sessions`, `shop_passkeys`, `orders.shop_account_id`, `whatsapp_settings.business_phone`. |
| `models/shop_account.rb` | `has_secure_password`, phone rules, `generates_token_for :reset_password`, links the back office `Customer`. |
| `concerns/shop_authentication.rb` | The shopper's login: cookie, sliding year, session fixation, `?back=`. |
| `controllers/shop/{accounts,sessions,passkey_sessions,passkeys,passwords}_controller.rb` | Sign up, log in/out, passkeys, reset. |
| `controllers/customers/shop_accounts_controller.rb` | Back office: reset link, remove account. |
| `pages/Shop/Account/*` | LogIn, SignUp, Show, ForgotPassword, ResetPassword. |

## Ideas worth knowing

**Two separate worlds.** Staff log in with `users`, `sessions`, the
`session_id` cookie and `Current.user`. Shoppers have `shop_accounts`,
`shop_sessions`, the `shop_session_id` cookie and `Current.shop_account`.
Nothing is shared, so no bug in the shop can ever make a shopper staff. The
tests check it both ways, passkeys included.

**Why "My orders" doesn't show every order with their phone number.**
Sign-up doesn't prove the phone is theirs (that would need an SMS code). If
the account pulled in orders by phone, anyone could type a stranger's number
and read their orders and address. So it shows only orders placed *from the
account*. The one safe exception: signing up from an order's own page, whose
secret link proves they placed it.

**Passwords are never stored.** `has_secure_password` keeps a bcrypt hash: a
one-way scramble, deliberately slow to compute, so even a stolen database
doesn't give the passwords away. `authenticate_by(phone:, password:)` takes
the same time whether or not the phone exists, and the error never says which
one was wrong, so the login page can't be used to find out who has an account.

**Session fixation.** On log in, `reset_session` gives the browser a brand-new
session (keeping the bag), so a session id someone planted earlier never
becomes a logged-in one.

**Links that work once.** `generates_token_for :reset_password` makes a signed
token that contains part of the password hash. As soon as the password
changes, the old token no longer matches: used once, it's dead. It also
expires after a day.

**Open redirects.** `?back=/checkout` brings them back after logging in, but
only to a path on this site: `//evil.example` (which browsers read as another
website) is refused.

**Rate limits.** Ten log-in tries in three minutes and ten sign-ups an hour
per connection: plenty for a person, useless for a script guessing passwords.
