# Deploying Comfyzone (comfyzone.shop)

Comfyzone runs **alongside Maven Heart on the same droplet**. The Rails app runs
as a Docker container (Puma) bound to `127.0.0.1:3000`; the host's **nginx** (the
same one that serves Maven Heart) reverse-proxies `comfyzone.shop` to it and
terminates TLS. It uses the **host's existing PostgreSQL** — a dedicated
`comfyzone` role + its own databases — so it never touches Maven Heart's data.

```
Internet ─▶ nginx (host, :80/:443, TLS)
               │  server_name comfyzone.shop
               ▼
         127.0.0.1:3000  ─▶  web (Rails/Puma, Docker, host network)
                                     │
                                     ▼
                         host PostgreSQL @ 127.0.0.1:5432
```

Files in this folder:

- `docker-compose.yml` — the `web` (Rails) service, on the host network.
- `.env.production.example` — copy to `.env` and fill in secrets.
- `provision-db.sh` — idempotent: creates the comfyzone role + databases on the host Postgres.
- `nginx/comfyzone.shop.conf` — the nginx reverse-proxy site.

---

## One-time server prep

1. **Point DNS.** Add A records for `comfyzone.shop` and `www.comfyzone.shop`
   at the droplet's public IP. Confirm: `dig +short comfyzone.shop`.

2. **Install Docker** (if not already):
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

3. **Set up `.env`** (the single source of truth for the DB password):
   ```bash
   cd deploy
   cp .env.production.example .env
   #  then edit .env:
   #   COMFYZONE_DATABASE_PASSWORD  -> a strong password (openssl rand -hex 24)
   #   RAILS_MASTER_KEY             -> contents of config/master.key for this app
   ```

4. **Create the database role + databases on the host Postgres** with the
   idempotent provisioning script (reads the password from `.env`, safe to
   re-run):
   ```bash
   ./provision-db.sh
   ```
   This creates the `comfyzone` role and its four databases (the primary plus one
   each for Solid Cache / Queue / Cable). The app connects over TCP to
   `127.0.0.1:5432`; the default `pg_hba.conf` already allows `127.0.0.1/32` with
   password auth, so no Postgres config change is normally needed.

---

## Deploy the app

From this `deploy/` folder on the server:

```bash
docker compose build
docker compose run --rm web ./bin/rails db:prepare   # load schema + migrate (one-time / after new migrations)
docker compose up -d
```

Check it's healthy:

```bash
docker compose ps
docker compose logs -f web         # watch boot; Ctrl-C to stop watching
curl -I http://127.0.0.1:3000      # should return an HTTP response
```

> Updating later: `git pull && docker compose build && docker compose run --rm web ./bin/rails db:prepare && docker compose up -d`.

---

## Wire up nginx + TLS

1. Install the site file and enable it:
   ```bash
   sudo cp nginx/comfyzone.shop.conf /etc/nginx/sites-available/comfyzone.shop.conf
   sudo ln -sf /etc/nginx/sites-available/comfyzone.shop.conf \
               /etc/nginx/sites-enabled/comfyzone.shop.conf
   sudo nginx -t && sudo systemctl reload nginx
   ```
   (No `default_server` here — Maven Heart stays the default site, so there's no
   conflict.)

2. Get the certificate (this also injects the HTTPS server block + redirect):
   ```bash
   sudo certbot --nginx -d comfyzone.shop -d www.comfyzone.shop
   ```
   `certbot renew` (already scheduled on the box for Maven Heart) will keep it
   fresh.

Visit **https://comfyzone.shop** — you should see the app.

---

## Notes & gotchas

- **Why host networking:** it lets the container reach the host Postgres on
  `127.0.0.1:5432` with no Postgres listen/pg_hba changes, and Puma binds
  `127.0.0.1:3000` so the app is only reachable through nginx. If you ever move
  Postgres off-box, switch to a bridge network + `DATABASE_URL`/`DB_HOST`
  pointing at the new host.
- **Migrations:** because we override the container command (to bind localhost),
  the entrypoint's automatic `db:prepare` doesn't run — run it explicitly as
  shown above whenever you add migrations.
- **Secrets:** `.env` holds the DB password and `RAILS_MASTER_KEY`. Keep it off
  git (the app already ignores `.env*`).
- **Background jobs:** Solid Queue runs inside Puma (`SOLID_QUEUE_IN_PUMA=true`),
  so there's no separate worker to manage.
- **Uploads:** Active Storage files persist in the `app_storage` Docker volume.
- **DB backups:** `sudo -u postgres pg_dump comfyzone_production > backup.sql`.
- **Dockerfile change:** the Dockerfile now installs Node + runs `npm ci` so
  `vite_rails` can build the frontend during `assets:precompile`; `node_modules`
  is dropped after the build to keep the runtime image slim.
- **Canonical host:** certbot serves both apex and `www`. To 301 `www` to the
  apex, add a small redirect server block after certbot runs, or handle it in
  the app.
