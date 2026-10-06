# ComfyZone

Back-office for a TikTok live-selling business: purchases, stock, and sales.

Rails 8 + Inertia + React (TypeScript) + Tailwind, on Postgres.

## First-time setup (Mac)

You need three things installed:

| Tool | Version | One way to get it |
|---|---|---|
| Ruby | 3.3.6 (see `.ruby-version`) | `brew install mise && mise use -g ruby@3.3.6`, or rbenv |
| Node | 20 or newer | you likely have it already (`node -v`) |
| Postgres | 14 or newer, running | `brew install postgresql@16 && brew services start postgresql@16`, or Postgres.app |

Then, in this folder:

```sh
bin/setup
```

That installs gems and npm packages, creates the database, runs migrations,
seeds a dev login, and starts the app. Open http://localhost:3000.

**Dev login:** `owner@comfyzone.test` / `password`

## Everyday commands

| Command | What it does |
|---|---|
| `bin/dev` | Start the app (Rails on :3000 and Vite together) |
| `bin/rails test` | Run the tests |
| `bin/rails console` | A Ruby prompt with the app loaded, for poking at data |
| `bin/rails routes` | List every URL the app answers to |
| `bin/rails db:migrate` | Apply new migrations |
| `npm run check` | Type-check the React code |

## Learning notes

`docs/lessons/` explains what was built in each step and why.
Start with [01-foundation.md](docs/lessons/01-foundation.md).
