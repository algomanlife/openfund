#!/usr/bin/env bash
# Start the synthetic Gains server and the unmodified Openfund backend
# (production mode, single process — the Render topology; Node 26 as on
# Render since the Node 26 upgrade, override with BACKEND_NODE) against the
# disposable test database. Usage: start-backend.sh <run-dir> [pg_pool_max]
set -euo pipefail
source "$(dirname "$0")/env.sh"
RUN="${1:?run dir}"; mkdir -p "$RUN"; RUN="$(cd "$RUN" && pwd)"
[ -n "${2:-}" ] && export HARNESS_PG_MAX="$2"
# SKIP_MOCK=1 restarts only the backend (resilience.sh: restart under load)
if [ -z "${SKIP_MOCK:-}" ]; then
  pkill -f "capacity/harness/mock-gains.mjs" 2>/dev/null || true
fi
lsof -ti tcp:18080 | xargs kill 2>/dev/null || true
sleep 1
if [ -z "${SKIP_MOCK:-}" ]; then
  node "$CAP_DIR/harness/mock-gains.mjs" > "$RUN/mock-gains.log" 2>&1 &
  echo $! > "$RUN/mock.pid"
  sleep 1
fi
( cd "$BACKEND_DIR" && \
  PORT=18080 NODE_ENV=production ALLOWED_DOMAINS=127.0.0.1:18080 CMS_PUBLIC_URL=https://cms.invalid CORS_ORIGINS=http://127.0.0.1:18080 \
  METRICS_FILE="$RUN/backend-metrics.jsonl" \
  exec "${BACKEND_NODE:-node}" ${BACKEND_NODE_FLAGS:-} --import "$CAP_DIR/harness/preload.mjs" server.js ) >> "$RUN/backend.log" 2>&1 &
echo $! > "$RUN/backend.pid"
for i in $(seq 1 40); do curl -sf "$TARGET/health" >/dev/null && break; sleep 0.5; done
curl -sf "$TARGET/health" && echo " backend up (pid $(cat "$RUN/backend.pid"))"
sleep 2; grep -E "market-data|engine" "$RUN/backend.log" | head -5
