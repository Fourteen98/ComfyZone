# Lesson 4: People, roles and permissions

What changed: the app now knows *who may do what*. There is a Settings area
with a Team page (people who can log in) and a Roles page (named sets of
permissions). This is the first step with real database changes, a real
model with rules, and full create/edit/delete screens, so it is the template
for every feature that follows.

After pulling this step, run:

```sh
bin/rails db:migrate   # apply the two new migrations
bin/rails db:seed      # create the starting roles
```

## 1. The design in one picture

```
Permission (code)          Role (database)              User (database)
-----------------          ---------------              ---------------
"products.view"            Sales assistant              Ama
"products.manage"    <--   permissions: [               role_id ---> Sales assistant
"orders.create"              "products.view",
"costs.view"                 "orders.create" ]
...
fixed list, in             editable in                  each person has
app/models/permission.rb   Settings > Roles             exactly one role
```

- **Permissions live in code** because each one is enforced by code. A
  permission nobody checks would be a lie.
- **Roles live in the database** because the business decides them.
- **The Owner role is special** (`system: true`): it can do everything,
  including permissions added in future, and can't be edited or deleted.

Every question in the app goes through one method:

```ruby
Current.user.can?("orders.refund")   # true or false
```

## 2. Migrations: changing the database safely

A migration is a small file describing one change. Rails records which ones
have run (in the `schema_migrations` table), so `db:migrate` only runs new
ones. **The database is never changed any other way.**

```sh
bin/rails generate migration CreateRoles   # makes the timestamped file
bin/rails db:migrate                       # runs it, updates db/schema.rb
bin/rails db:rollback                      # undoes the last one
bin/rails db:migrate:status                # what has run
```

### The simple case: `db/migrate/..._create_roles.rb`

A new table. Rails can reverse `create_table` by itself, so one `change`
method is enough. Two things worth noticing:

- `t.string :permissions, array: true` is a Postgres array column. One row
  holds the whole list, so no join table is needed.
- `add_index :roles, "lower(name)", unique: true` makes names unique in the
  database itself, ignoring capitals. Model validations can be beaten by two
  requests arriving at once; a unique index cannot.

### The instructive case: `..._add_profile_and_role_to_users.rb`

The `users` table already has rows, and we want `name` and `role_id` to be
required. You cannot add a NOT NULL column to a table with rows that have
nothing to put in it. So it goes in three stages:

1. add the columns, allowing NULL
2. fill them in for existing rows (with plain SQL)
3. then forbid NULL

Two rules this file follows, which you should keep:

- **Never use model classes inside a migration.** `Role.create!` works today,
  but models keep changing, and this migration must still run on a fresh
  database in two years. SQL does not depend on your models.
- **Write `up` and `down` when Rails can't guess the reverse.** Try it:
  `bin/rails db:rollback` then `bin/rails db:migrate`.

`db/schema.rb` is generated from the result. Never edit it; do commit it.

## 3. Seeds are not migrations

| | Migration | Seed |
|---|---|---|
| Changes | the *shape* of the database | the *starting contents* |
| Runs | once, in order | any time, repeatedly |
| Example | add a `roles` table | create the Manager role |

`db/seeds.rb` uses `find_or_create_by!(name: "Manager") { ... }`. The block
only runs on creation, so re-running seeds adds anything missing without
overwriting roles she has since edited. The option presets (sizes, colours,
lengths) will be seeded the same way.

## 4. Models hold the rules

Read `app/models/role.rb` and `app/models/user.rb`. Things to notice:

- **Validations** (`validates :name, presence: true`) decide whether a record
  may be saved. When one fails, `save` returns false and `errors` explains.
- **`has_many :users, dependent: :restrict_with_error`** refuses to delete a
  role that still has people in it.
- **`delegate :can?, to: :role`** lets you write `user.can?(...)`.
- **A custom validation**, `business_keeps_an_owner`, stops the last Owner
  being demoted or switched off. Rules like this belong in the model, so no
  screen, console session or future API can bypass them.

Try in `bin/rails console`:

```ruby
Role.pluck(:name)
r = Role.new(name: "owner")
r.valid?            # => false
r.errors.full_messages
User.first.can?("costs.view")
```

## 5. Guarding controllers

`app/controllers/concerns/authorization.rb` adds one line you can put at the
top of any controller:

```ruby
class Settings::RolesController < InertiaController
  require_permission "roles.manage"
```

It is a `before_action`: it runs before every action, and redirects away
unless `Current.user.can?` says yes. A misspelt key raises an error when the
app boots, so typos cannot silently leave a page open.

**The server check is the security.** React also receives the person's
permissions (`auth.permissions`, shared from `InertiaController`) and uses
them to hide menu items and buttons via `useCan()`. That is only politeness:
anyone can type a URL or send a request by hand, and the tests prove Rails
turns them away.

## 6. CRUD: the shape every feature will have

One line of routing:

```ruby
namespace :settings do
  resources :roles, except: :show
end
```

gives six routes (run `bin/rails routes -g settings`):

| Request | Action | Does |
|---|---|---|
| GET /settings/roles | index | list |
| GET /settings/roles/new | new | empty form |
| POST /settings/roles | create | save a new one |
| GET /settings/roles/:id/edit | edit | filled-in form |
| PATCH /settings/roles/:id | update | save changes |
| DELETE /settings/roles/:id | destroy | remove |

And every create/update action has the same skeleton:

```ruby
def create
  role = Role.new(role_params)
  if role.save
    redirect_to settings_roles_path, notice: "Created the #{role.name} role."
  else
    redirect_to new_settings_role_path, inertia: { errors: role.errors }
  end
end
```

`role_params` is **strong parameters**: the list of fields a browser is
allowed to set. Anything else in the request is ignored, which is what stops
someone adding `system: true` to a form post.

On the React side, one `Form.tsx` serves both new and edit: Rails sends
`role: nil` for new and the record for edit.

## 7. Tests as a safety net

There are now 45 tests. The valuable ones here are the negative ones:
*a helper cannot open Settings*, *cannot post to it directly*, *the Owner
role cannot be edited*, *a switched-off person cannot log in*. Permission
bugs are invisible in normal use, so tests are the only thing that catches
them. Run `bin/rails test` after every change.

## Try it yourself

1. **Add a person** with the Packer role, log in as them in a private
   window, and see what disappears. Try opening `/settings/roles` directly.
2. **Add a permission.** Add `"stock.count" => "Do stock counts"` to the
   Stock group in `permission.rb`. Reload the role form: it appears, with no
   migration, because permissions are code.
3. **Break a guard.** Comment out `require_permission` in
   `Settings::RolesController`, run `bin/rails test`, read which tests fail,
   and put it back.
4. **Roll back and forward.** `bin/rails db:rollback`, look at
   `db/schema.rb`, then `bin/rails db:migrate && bin/rails db:seed`.
