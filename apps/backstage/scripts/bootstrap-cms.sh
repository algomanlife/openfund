#!/usr/bin/env bash
# Openfund CMS bootstrap — one repeatable, idempotent command (v0.3.1).
#
# Runs the complete Directus initialization sequence in dependency order:
#   schema → editorial content → production catalog (challenge_plans,
#   fa/en translations) → terminal sections → application-table
#   registration (Data Studio views with financial fields read-only).
#
# Never overwrites editorial edits (idempotent seeds; pass --refresh to
# the content seeds to force-reset them). Safe to re-run after deploys.
#
# Usage:
#   ./bootstrap-cms.sh <CMS_URL> <ADMIN_EMAIL> <ADMIN_PASSWORD> [--refresh]
# Example:
#   ./bootstrap-cms.sh https://openfund-cms.onrender.com admin@example.com 'secret' 
set -euo pipefail
cd "$(dirname "$0")"

URL="${1:?usage: bootstrap-cms.sh <CMS_URL> <ADMIN_EMAIL> <ADMIN_PASSWORD> [--refresh]}"
EMAIL="${2:?missing admin email}"
PASSWORD="${3:?missing admin password}"
REFRESH=""
if [ "${4:-}" = "--refresh" ]; then REFRESH="--refresh"; fi

echo "== Openfund CMS bootstrap: $URL =="
echo "== 1/5 schema (collections, fields, translations, permissions) =="
python3 apply_schema.py --url "$URL" --email "$EMAIL" --password "$PASSWORD"

echo "== 2/5 editorial content =="
python3 seed_content.py --url "$URL" $REFRESH

echo "== 3/5 production catalog + bilingual translations =="
node seed_production_content.mjs --url "$URL" --email "$EMAIL" --password "$PASSWORD"

echo "== 4/5 terminal sections =="
python3 seed_terminal_content.py --url "$URL" $REFRESH

echo "== 5/5 application tables in Data Studio (read-only financial views) =="
python3 register_user_tables.py --url "$URL" --email "$EMAIL" --password "$PASSWORD"

echo "== CMS bootstrap complete (idempotent; editorial edits preserved) =="
