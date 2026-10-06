#!/usr/bin/env bash
# Nightly backup of everything that can't be rebuilt from git:
#
#   1. the database         (orders, stock, customers, payments...)
#   2. the uploaded photos  (the app_storage Docker volume)
#
# Keeps the last 14 days in BACKUP_DIR. Run as root from cron:
#
#   sudo crontab -e
#   15 2 * * * /var/www/comfyzone/deploy/backup.sh >> /var/log/comfyzone-backup.log 2>&1
#
# IMPORTANT: these files sit on the same droplet as the app. If the droplet
# is lost, so are they. Copy BACKUP_DIR somewhere else as well (see the
# "Off the server" note at the bottom, and deploy/README.md).
set -euo pipefail

cd "$(dirname "$0")"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/comfyzone}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" # customer names and phone numbers are in here

# --- 1. Database ---------------------------------------------------------
# -Fc is Postgres's own compressed format; restore it with pg_restore.
# Written to a .part file first, so a dump that dies halfway is never
# mistaken for a good backup.
sudo -u postgres pg_dump -Fc comfyzone_production > "$BACKUP_DIR/db-$STAMP.dump.part"
mv "$BACKUP_DIR/db-$STAMP.dump.part" "$BACKUP_DIR/db-$STAMP.dump"

# --- 2. Photos -----------------------------------------------------------
# Read straight out of the running container, so there is no need to know
# where Docker keeps the volume on disk.
docker compose exec -T web tar czf - -C /rails storage > "$BACKUP_DIR/photos-$STAMP.tgz.part"
mv "$BACKUP_DIR/photos-$STAMP.tgz.part" "$BACKUP_DIR/photos-$STAMP.tgz"

# --- 3. Tidy up ----------------------------------------------------------
find "$BACKUP_DIR" -name '*.part' -delete
find "$BACKUP_DIR" -type f \( -name 'db-*.dump' -o -name 'photos-*.tgz' \) -mtime +"$KEEP_DAYS" -delete

echo "$(date -Is) backup ok: $(du -sh "$BACKUP_DIR" | cut -f1) in $BACKUP_DIR"

# --- Off the server ------------------------------------------------------
# Add one line here once you have somewhere to send them, for example with
# rclone to DigitalOcean Spaces, Backblaze B2 or Google Drive:
#
#   rclone sync "$BACKUP_DIR" remote:comfyzone-backups
