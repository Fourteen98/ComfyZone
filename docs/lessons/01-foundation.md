# Lesson 1: The foundation

What exists after this step: a Rails app you can log in to, with React
rendering every screen. No business features yet. The goal was to get one
full round trip working (browser → Rails → database → React) so every later
feature is a repeat of the same pattern.

## 1. How a request flows

This is the single most important picture. Follow `GET /` when logged in:

```
Browser asks for /
   │
   ▼
config/routes.rb             root "dashboard#show"
   │                         "which controller handles this URL?"
   ▼
Authentication concern       before_action :require_authentication
   │                         "is there a valid session cookie?"  no → redirect to /session/new
   ▼
DashboardController#show     render inertia: "Dashboard", props: { today: ... }
   │                         "which React page, and with what data?"
   ▼
app/frontend/pages/Dashboard.tsx
                             function Dashboard({ today }) { ... }
```

Classic Rails ends with an ERB template. Here the last step is a React
component instead. Everything before it is ordinary Rails.

## 2. What Inertia actually does

Inertia is glue, not a framework. It does two things:

- **First page load:** Rails returns normal HTML containing an empty
  `<div id="app">` plus the page name and props as JSON. React boots and
  renders that page.
- **Every click after that:** an Inertia `<Link>` or form asks Rails for the
  same URL, but Rails answers with *just the JSON* (page name + props). React
  swaps the component without a full page reload.

Same routes, same controllers, both times. You never write an API endpoint or
a `fetch()` call.

The contract between the two sides is one line:

```ruby
render inertia: "Dashboard", props: { today: "Tuesday, 6 October 2026" }
#               └─ file under app/frontend/pages/   └─ becomes the component's props
```

## 3. Where things live

```
app/
  controllers/
    application_controller.rb    base class; includes Authentication
    inertia_controller.rb        base for React pages; shares `auth.user` with every page
    dashboard_controller.rb      the home page
    sessions_controller.rb       login / logout
    passwords_controller.rb      forgot-password (still classic ERB views)
    concerns/authentication.rb   the login machinery (generated; worth reading once)
  models/
    user.rb                      has_secure_password
    session.rb                   one row per logged-in device
    current.rb                   Current.user / Current.session for this request
  frontend/                      ← all React code
    entrypoints/inertia.tsx      boots React; loaded by the Rails layout
    entrypoints/application.css  Tailwind
    layouts/AppLayout.tsx        top bar + flash messages
    pages/Dashboard.tsx          one file per screen
    pages/Sessions/New.tsx       the login form
    types/index.ts               TypeScript types shared across pages
  views/layouts/application.html.erb   the one HTML shell around everything
config/routes.rb                 URL → controller map
db/migrate/                      database changes, in order
db/schema.rb                     the current database shape (generated; don't edit)
db/seeds.rb                      creates the dev login
test/                            tests
```

## 4. The commands that built this

You can reproduce the whole thing from an empty folder:

```sh
# A new app using Postgres. --skip-javascript drops Rails' default JS setup
# (importmap, Turbo, Stimulus) because Vite + React replace it.
rails new comfyzone -d postgresql --skip-javascript --skip-jbuilder \
  --skip-action-mailbox --skip-action-text --skip-kamal --skip-thruster

# The Inertia adapter for Rails, then its installer, which sets up Vite,
# React, TypeScript and Tailwind in one go.
bundle add inertia_rails
bin/rails generate inertia:install --framework=react --typescript --tailwind --vite

# Rails 8's built-in login. Creates User, Session, the Authentication concern,
# sessions/passwords controllers, and two migrations.
bin/rails generate authentication

# Create the database and tables.
bin/rails db:prepare
```

After the generators, these were written by hand:

- `routes.rb`: added `root "dashboard#show"`.
- `DashboardController` and `pages/Dashboard.tsx`: the first React page.
- `SessionsController#new`: changed from an ERB view to
  `render inertia: "Sessions/New"`, and the login form rewritten in React.
- `InertiaController`: shares the logged-in user with every page.
- `AppLayout.tsx`: the shared frame.

## 5. Rails ideas worth refreshing

**Generators write boilerplate, migrations change the database.**
`rails generate` creates files. A migration is a small Ruby file describing one
database change; `db:migrate` runs the ones not yet applied and updates
`db/schema.rb`. You never edit the database by hand.

**`resource` vs `resources`.** `resources :passwords` gives the full set of
URLs with an `:id`. `resource :session` (singular) gives the same without an
id, because you only ever have one. Run `bin/rails routes` to see both.

**`before_action`.** Code that runs before controller actions. The
Authentication concern uses it so every page requires login by default, and
`allow_unauthenticated_access` opts specific actions out. Secure by default:
forgetting to think about a new page leaves it locked, not open.

**`has_secure_password`.** One line on `User` that hashes passwords with
bcrypt into `password_digest` and gives you `User.authenticate_by(...)`.
The real password is never stored.

**`Current`.** A per-request global. `Current.user` is whoever is logged in
for this request, usable from controllers and models.

**Flash.** `redirect_to somewhere, notice: "Saved"` shows a message once on
the next page. In React it arrives as `usePage().flash.notice`.

## 6. How forms work with Inertia

Look at `pages/Sessions/New.tsx` next to `SessionsController#create`:

| React | Rails |
|---|---|
| `useForm({ email_address: '', password: '' })` | `params.permit(:email_address, :password)` |
| `form.post('/session')` | `def create` |
| `form.errors.email_address` | `redirect_to ..., inertia: { errors: { email_address: [...] } }` |
| `form.processing` (true while waiting) | (nothing; Inertia tracks it) |

Every form in the app will follow this shape. For model-backed forms the Rails
side becomes `inertia: { errors: product.errors }`, so your model validations
show up next to the right fields automatically.

## 7. Try it yourself

Small exercises to get your hands back in. Each takes a few minutes.

1. **Pass a new prop.** In `DashboardController#show` add
   `user_count: User.count` to the props. Show it in `Dashboard.tsx`
   (add it to the `Props` type too). Save and watch the page update.
2. **Use the console.** Run `bin/rails console`, then:
   `User.first`, `User.first.sessions`, `Session.count`. Log in from the
   browser and run `Session.count` again.
3. **Break a test on purpose.** In `DashboardController` change `"Dashboard"`
   to `"Home"`, run `bin/rails test`, read the failure, change it back.
4. **Read the routes.** Run `bin/rails routes -c sessions` and match each
   line to an action in `SessionsController`.

## What's next

Lesson 2 adds the first real feature: **products**. That introduces a model
with validations, a migration you write yourself, a full set of CRUD pages,
and money handling.
