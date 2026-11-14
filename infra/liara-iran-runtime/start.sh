#!/bin/sh
# Iran runtime entrypoint. Refuses to start without an explicit region, so a
# misconfigured app can never run as GLOBAL against the Iran database (or the
# reverse: the database region claim is checked again by migrate/server).
set -eu
[ "${OPENFUND_REGION:-}" = "IRAN" ] || { echo "OPENFUND_REGION=IRAN is required for this image" >&2; exit 64; }
cd /app/apps/backend
# Exactly one app runs migrations (the web app, MIGRATE_ON_START=1); the
# worker waits for a migrated database instead of racing the schema.
if [ "${MIGRATE_ON_START:-0}" = "1" ]; then node migrate.js; fi
exec node server.js
