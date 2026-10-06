#!/usr/bin/env bash
# Idempotently create the comfyzone Postgres role + its four databases on the
# HOST PostgreSQL. Safe to run repeatedly — it only creates what's missing and
# always (re)sets the role password to match .env, so there's one source of
# truth for the password.
#
# Run once (and again if you rotate the password) from the deploy/ folder:
#   ./provision-db.sh
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Missing .env — copy .env.production.example to .env and fill it in first." >&2
  exit 1
fi

# Load COMFYZONE_DATABASE_PASSWORD (and anything else) from .env.
set -a
# shellcheck disable=SC1091
. ./.env
set +a
: "${COMFYZONE_DATABASE_PASSWORD:?Set COMFYZONE_DATABASE_PASSWORD in .env}"

echo "Provisioning comfyzone role + databases on the host Postgres…"

sudo -u postgres psql -v ON_ERROR_STOP=1 -v pw="$COMFYZONE_DATABASE_PASSWORD" <<'SQL'
-- Create the login role only if it doesn't exist…
SELECT format('CREATE ROLE comfyzone LOGIN PASSWORD %L', :'pw')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'comfyzone')\gexec

-- …then always sync the password to .env.
ALTER ROLE comfyzone WITH LOGIN PASSWORD :'pw';

-- Create each database (owned by comfyzone) only if missing.
SELECT format('CREATE DATABASE %I OWNER comfyzone', d)
FROM (VALUES
  ('comfyzone_production'),
  ('comfyzone_production_cache'),
  ('comfyzone_production_queue'),
  ('comfyzone_production_cable')
) AS t(d)
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = d)\gexec
SQL

echo "Done. Role 'comfyzone' + 4 databases are ready."
