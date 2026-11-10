#!/usr/bin/env bash
# Openfund Directus upgrade staging harness (no Docker required).
#
# Rehearses a Directus version upgrade against an ISOLATED local PostgreSQL
# cluster and local upload folders. It never reads production credentials and
# never talks to production. Directus is installed from npm into scratch
# folders (pinned exact versions) because the official container image is
# not required to exercise schema migrations, permissions and the public API.
# The production image is still the final artifact: see
# docs/deployment/DIRECTUS_MIGRATION_RUNBOOK.md for the image-level step.
#
# Requirements: PostgreSQL 17 client+server binaries on PATH, python3, curl,
# Node 22 (for Directus 11.x) and Node 26 (for Directus >= 12.6.0) available as
# NODE22_BIN / NODE26_BIN directories (or on PATH for the version you use).
#
# Commands (all state lives under $STAGE, default ~/openfund-staging):
#   init                         create the isolated Postgres cluster (port $PGPORT)
#   seed  <old-version>          fresh DB + app migrations + Directus <old> + bootstrap-cms.sh
#   backup                       custom-format pg_dump + uploads copy of the seeded DB
#   upgrade <new-version> [--aged]
#                                restore the backup into a new DB, install and
#                                start <new-version>, run its migrations.
#                                --aged back-dates directus_migrations by 90 days
#                                so Directus 12's "upgrade grace period" logic sees
#                                an existing installation (a freshly seeded DB is
#                                otherwise treated as a clean install).
#   check <label>                run cms-check.mjs inventory + verify (+ baseline)
#   stop                         stop Directus and Postgres
#
# Credentials below are throw-away staging values, not secrets.
set -euo pipefail
export LC_ALL=C

STAGE="${STAGE:-$HOME/openfund-staging}"
PGPORT="${PGPORT:-5555}"
PORT="${PORT:-8055}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
PSQL_ARGS=(-h 127.0.0.1 -p "$PGPORT" -U postgres)
ADMIN_EMAIL="admin@example.com"        # Directus validates the TLD; example.com is accepted
ADMIN_PASSWORD="stage-admin-pass-1"

node_for() { # <directus-version> -> directory containing the right node binary
  case "$1" in
    11.*) echo "${NODE22_BIN:-}" ;;
    *)    echo "${NODE26_BIN:-}" ;;
  esac
}

directus_env() { # <db> <uploads-dir>
  export DB_CLIENT=pg DB_HOST=127.0.0.1 DB_PORT="$PGPORT" DB_USER=postgres DB_DATABASE="$1"
  export KEY=stage-key-not-secret-0001 SECRET=stage-secret-not-secret-0001
  export ADMIN_EMAIL ADMIN_PASSWORD PORT PUBLIC_URL="http://127.0.0.1:$PORT"
  export WEBSOCKETS_ENABLED=false CORS_ENABLED=true CORS_ORIGIN=true CORS_METHODS=GET,HEAD,OPTIONS MAX_PAYLOAD_SIZE=1mb
  export TELEMETRY=false PROJECT_OWNER_ENABLED=false IP_TRUST_PROXY=true
  export STORAGE_LOCATIONS=local STORAGE_LOCAL_ROOT="$2"
  mkdir -p "$2"
}

install_directus() { # <version> -> installs into $STAGE/directus-<version>
  local dir="$STAGE/directus-$1" nb; nb="$(node_for "$1")"
  mkdir -p "$dir"
  if [ ! -x "$dir/node_modules/.bin/directus" ]; then
    ( cd "$dir"; [ -n "$nb" ] && export PATH="$nb:$PATH"; npm init -y >/dev/null; npm i "directus@$1" --no-audit --no-fund >/dev/null )
  fi
  echo "$dir"
}

start_directus() { # <version> <dir>
  local nb; nb="$(node_for "$1")"
  ( cd "$2"; [ -n "$nb" ] && export PATH="$nb:$PATH"
    npx directus bootstrap 2>&1 | tee "$STAGE/bootstrap-$1.log" | grep -E 'Done|ERROR|rror' || true
    nohup npx directus start >"$STAGE/server-$1.log" 2>&1 & )
  for _ in $(seq 1 40); do curl -fsS "http://127.0.0.1:$PORT/server/ping" >/dev/null 2>&1 && return 0; sleep 1; done
  echo "Directus $1 did not become ready; see $STAGE/server-$1.log" >&2; return 1
}

stop_directus() { pkill -f "directus start" 2>/dev/null || true; sleep 1; }

cmd="${1:-}"; shift || true
mkdir -p "$STAGE"
case "$cmd" in
  init)
    [ -d "$STAGE/pgdata" ] || initdb -D "$STAGE/pgdata" --locale=C -U postgres -A trust >/dev/null
    mkdir -p /tmp/ofstagepg
    pg_ctl -D "$STAGE/pgdata" -o "-p $PGPORT -k /tmp/ofstagepg -c listen_addresses=127.0.0.1" -l "$STAGE/pg.log" start -w
    ;;
  seed)
    ver="$1"; stop_directus
    dropdb "${PSQL_ARGS[@]}" --if-exists stage_src; createdb "${PSQL_ARGS[@]}" stage_src
    # Same order as production: application migrations first, then Directus bootstrap, then CMS bootstrap.
    ( cd "$REPO"; DATABASE_URL="postgres://postgres@127.0.0.1:$PGPORT/stage_src" npm --prefix apps/backend run migrate >/dev/null )
    directus_env stage_src "$STAGE/uploads-src"
    dir="$(install_directus "$ver")"; start_directus "$ver" "$dir"
    ( cd "$REPO/apps/backstage/scripts"
      DIRECTUS_URL="http://127.0.0.1:$PORT" DIRECTUS_ADMIN_EMAIL="$ADMIN_EMAIL" DIRECTUS_ADMIN_PASSWORD="$ADMIN_PASSWORD" ./bootstrap-cms.sh )
    echo "$ver" >"$STAGE/seeded-version"
    ;;
  backup)
    stop_directus; mkdir -p "$STAGE/backup"
    pg_dump "${PSQL_ARGS[@]}" -Fc stage_src -f "$STAGE/backup/stage_src.dump"
    rm -rf "$STAGE/backup/uploads"; cp -R "$STAGE/uploads-src" "$STAGE/backup/uploads"
    ( cd "$STAGE/backup" && shasum -a 256 stage_src.dump > stage_src.dump.sha256 )
    echo "backup: $STAGE/backup/stage_src.dump"
    ;;
  upgrade)
    ver="$1"; aged="${2:-}"; stop_directus
    dropdb "${PSQL_ARGS[@]}" --if-exists stage_dst; createdb "${PSQL_ARGS[@]}" stage_dst
    pg_restore "${PSQL_ARGS[@]}" -d stage_dst --no-owner "$STAGE/backup/stage_src.dump"
    if [ "$aged" = "--aged" ]; then
      psql "${PSQL_ARGS[@]}" -d stage_dst -qtAc "update directus_migrations set timestamp = timestamp - interval '90 days'"
    fi
    rm -rf "$STAGE/uploads-dst"; cp -R "$STAGE/backup/uploads" "$STAGE/uploads-dst"
    directus_env stage_dst "$STAGE/uploads-dst"
    dir="$(install_directus "$ver")"; start_directus "$ver" "$dir"
    ;;
  check)
    label="$1"; mkdir -p "$STAGE/evidence"
    export DIRECTUS_ADMIN_EMAIL="$ADMIN_EMAIL" DIRECTUS_ADMIN_PASSWORD="$ADMIN_PASSWORD"
    base_args=()
    [ -f "$STAGE/evidence/inventory-baseline.json" ] && base_args=(--baseline "$STAGE/evidence/inventory-baseline.json")
    node "$HERE/cms-check.mjs" inventory --url "http://127.0.0.1:$PORT" --out "$STAGE/evidence/inventory-$label.json"
    [ -f "$STAGE/evidence/inventory-baseline.json" ] || cp "$STAGE/evidence/inventory-$label.json" "$STAGE/evidence/inventory-baseline.json"
    node "$HERE/cms-check.mjs" verify --url "http://127.0.0.1:$PORT" ${base_args[@]+"${base_args[@]}"} --out "$STAGE/evidence/verify-$label.json"
    ;;
  stop)
    stop_directus; pg_ctl -D "$STAGE/pgdata" stop -m fast || true
    ;;
  *) sed -n 2,32p "$0"; exit 2 ;;
esac
