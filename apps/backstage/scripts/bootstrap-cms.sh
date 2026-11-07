#!/usr/bin/env bash
# Openfund CMS bootstrap — one repeatable, idempotent command (v0.3.1).
#
# Runs the complete Directus initialization sequence in dependency order:
#   schema → editorial content → production catalog (challenge_plans,
#   fa/en translations) → terminal sections → application-table
#   registration (Data Studio views with financial fields read-only), then
#   website expansion content.
#
# Never overwrites editorial edits (idempotent seeds; pass --refresh to
# the content seeds to force-reset them). Safe to re-run after deploys.
#
# Usage:
#   DIRECTUS_URL=... DIRECTUS_ADMIN_EMAIL=... DIRECTUS_ADMIN_PASSWORD=... ./bootstrap-cms.sh [--refresh]
# Example:
#   Read credentials from secret environment variables, not shell arguments.
set -euo pipefail
cd "$(dirname "$0")"

URL="${DIRECTUS_URL:?DIRECTUS_URL is required}"
EMAIL="${DIRECTUS_ADMIN_EMAIL:?DIRECTUS_ADMIN_EMAIL is required}"
PASSWORD="${DIRECTUS_ADMIN_PASSWORD:?DIRECTUS_ADMIN_PASSWORD is required}"
REFRESH=""
if [ "${1:-}" = "--refresh" ]; then REFRESH="--refresh"; fi
if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != "--refresh" ]; }; then
  echo 'usage: bootstrap-cms.sh [--refresh] (credentials via environment)' >&2
  exit 2
fi
node -e "require('../../web-react/node_modules/esbuild')" || {
  echo 'Install frontend dependencies first: npm ci --prefix apps/web-react' >&2
  exit 1
}

echo "== Openfund CMS bootstrap: $URL =="
echo "== 1/6 schema (collections, fields, translations, permissions) =="
python3 apply_schema.py --url "$URL" --email "$EMAIL" --password "$PASSWORD"

echo "== 2/6 editorial content =="
python3 seed_content.py --url "$URL" $REFRESH

echo "== 3/6 production catalog + bilingual translations =="
node seed_production_content.mjs --url "$URL" --email "$EMAIL" --password "$PASSWORD"

echo "== 4/6 website expansion content =="
node seed_website_content.mjs --url "$URL" --email "$EMAIL" --password "$PASSWORD" $REFRESH

echo "== 5/6 terminal sections =="
python3 seed_terminal_content.py --url "$URL" $REFRESH

echo "== 6/6 application tables in Data Studio (read-only financial views) =="
python3 register_user_tables.py --url "$URL" --email "$EMAIL" --password "$PASSWORD"

echo "== CMS bootstrap complete (idempotent; editorial edits preserved) =="
