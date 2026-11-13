#!/usr/bin/env bash
# Comparable runs: every run starts from the same seeded database.
#   reset-db.sh snapshot   copy openfund_load_test → openfund_load_seed_test (after seeding)
#   reset-db.sh restore    recreate openfund_load_test from the snapshot (before each run)
# The backend must be stopped (a template copy needs no open connections).
# Session cookies in results/users.json stay valid because the snapshot keeps auth_sessions.
set -euo pipefail
source "$(dirname "$0")/env.sh"
ADMIN="${DATABASE_URL%/*}/postgres"; DB="${DATABASE_URL##*/}"; SEED="${DB%_test}_seed_test"
case "$DB" in *_test) ;; *) echo "refusing: $DB is not a *_test database" >&2; exit 1 ;; esac
lsof -ti tcp:18080 -sTCP:LISTEN | xargs kill 2>/dev/null || true; sleep 1
case "${1:?snapshot|restore}" in
  snapshot) psql "$ADMIN" -qc "DROP DATABASE IF EXISTS $SEED" -c "CREATE DATABASE $SEED TEMPLATE $DB" ;;
  restore)  psql "$ADMIN" -qc "DROP DATABASE IF EXISTS $DB WITH (FORCE)" -c "CREATE DATABASE $DB TEMPLATE $SEED" ;;
esac
echo "$1: $DB ($(psql "$DATABASE_URL" -Atc "select count(*) filter (where status='open')||' open / '||count(*)||' positions' from trading_positions"))"
