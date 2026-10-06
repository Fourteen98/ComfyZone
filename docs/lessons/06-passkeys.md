# Lesson 6: Passkeys (Face ID and fingerprint login)

What changed: people can log in with Face ID, a fingerprint or their screen
lock instead of a password. Each person sets it up once per device on a new
**My account** page. Passwords still work as a backup.

After pulling this step, run:

```sh
bundle install         # a new gem: webauthn
npm install            # a new package: @simplewebauthn/browser
bin/rails db:migrate
bin/dev
```

Then log in with your password, open **My account** (your name in the
sidebar, or the person icon on a phone), and choose **Add a passkey**.
On a Mac this uses Touch ID.

## 1. What a passkey is

The technology is called **WebAuthn**; "passkey" is the friendly name.

When she adds a passkey, her phone creates a **key pair**:

| Half | Lives | Used to |
|---|---|---|
| Private key | on her device only, locked behind her face or fingerprint | sign things |
| Public key | in our `passkeys` table | check a signature |

Something signed with the private key can be checked with the public key,
but the public key cannot be used to sign. So our database holds nothing
worth stealing, and her face or fingerprint never leaves the phone: the phone
only uses it to decide whether to unlock the private key.

A passkey is also bound to the exact address of the site. One made on
`http://localhost:3000` will not answer to a look-alike address, which is why
passkeys cannot be phished. (One of the tests proves this.)

## 2. The "ceremony": why this feature has JSON endpoints

Every other screen follows the Inertia pattern: one request, Rails answers
with a page. A passkey needs a short conversation instead:

```
Browser                              Rails
   |  1. POST .../challenge  ------->  invents a random challenge,
   |                                   remembers it in the session
   |  <------- challenge (JSON) -----
   |
   |  2. device asks for Face ID / fingerprint
   |     and signs the challenge
   |
   |  3. POST the signed answer ---->  checks the signature against the
   |                                   stored public key; logs her in
   |  <------- ok (JSON) -----------
```

The browser has to do something between two requests, so these four
endpoints return JSON and are called with `fetch()` from
`app/frontend/lib/passkeys.ts`. They are the only place the app does that.

The **challenge** is what stops a recorded answer being replayed: it is
random, used once (`session.delete`), and the signature covers it.

Registration and login are the same ceremony with a different ending:

| | Registration | Login |
|---|---|---|
| Controller | `Account::PasskeysController` | `Sessions::PasskeysController` |
| Who may call | someone already logged in | anyone |
| Device does | creates a key pair | signs with an existing key |
| Rails does | stores the public key | checks the signature, starts a session |

## 3. The migration

`db/migrate/..._create_passkeys.rb` does two things.

**`users.webauthn_id`**: a random id the device stores instead of her email.
It uses the same three-stage pattern as the roles migration (add as
optional, backfill with SQL, then require), this time with Postgres's
built-in `gen_random_uuid()` so every existing user gets a different value.
New users get one from a model callback:

```ruby
before_validation(on: :create) { self.webauthn_id ||= WebAuthn.generate_user_id }
```

**The `passkeys` table**: one row per registered device. A person can have
several (phone, laptop). `sign_count` is a counter the device increases on
every use; if it ever goes backwards the key may have been cloned, and the
gem refuses the login.

## 4. Rails things worth noticing

**Scoping lookups to the current user.**

```ruby
passkey = Current.user.passkeys.find(params.expect(:id))
```

Not `Passkey.find(...)`. Going through `Current.user.passkeys` means the
query itself can only see your own rows, so asking for someone else's id
gives 404. Prefer this to fetching a record and then checking the owner:
you cannot forget the check.

**`allow_unauthenticated_access`** on the login controller, because by
default every controller requires login.

**`rescue WebAuthn::Error`** at the end of an action: the gem raises when
any check fails, and we turn that into one friendly message. We
deliberately do not say *which* check failed.

**Namespaced controllers without a namespace clash.** There is already a
`Session` model, so the login controller lives in `Sessions::` (plural):

```ruby
scope "session", module: "sessions", as: "session" do
  resource :passkey, only: :create do
    post :challenge
  end
end
```

`scope` sets the URL prefix, `module` the folder, `as` the helper prefix.
Run `bin/rails routes -g passkey` to see the result.

**Configuration in an initializer.** `config/initializers/webauthn.rb` reads
`APP_ORIGIN` from the environment, defaulting to `http://localhost:3000`.
In production it must be set to the real `https://` address.

## 5. Testing without a phone

`test/test_helpers/passkey_test_helper.rb` uses the gem's `FakeClient`,
which creates real key pairs and real signatures. Only the human is faked,
so the server checks run for real. Read
`test/controllers/sessions/passkeys_controller_test.rb`: the refusals are
the important tests (wrong challenge, unknown device, another website,
switched-off account, removed passkey).

## Things to know

- **`localhost` only in development.** Browsers allow passkeys on `https://`
  sites and on `localhost`. Opening the dev app from her phone over Wi-Fi
  (an address like `http://192.168.x.x:3000`) will not offer passkeys. They
  will work on her phone once the app is deployed with HTTPS.
- **A passkey made in development does not carry over to production.** It
  is tied to the address, so everyone registers again on the live site.
- **Removing a passkey here does not delete it from the device.** The phone
  may still offer it; the app will refuse it with a clear message. It can be
  deleted from the phone's password settings.

## Try it yourself

1. **Add a passkey** on your Mac, log out, and log back in with it.
2. **Look at what was stored**: in `bin/rails console`, run
   `Passkey.last.attributes`. Notice there is no secret in there.
3. **Watch the ceremony**: open the browser's Network tab, log in with the
   passkey, and find the `challenge` request and the request after it.
4. **Break the binding**: change the default in
   `config/initializers/webauthn.rb` to `http://localhost:9999`, restart, and
   try to log in with your passkey. Read the result, then change it back.
