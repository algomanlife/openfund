#!/usr/bin/env bash
# One capacity run: fresh backend process, monitor + stop conditions,
# SSE swarm + k6 chart users + k6 visitors on the same stage schedule,
# then integrity audit and PostgreSQL statement statistics.
#
#   ./run.sh <name>
# Env knobs:
#   PROFILE=uncapped|render   render = backend throttled to 50 % of one core
#                             (Render starter 0.5 CPU) and PostgreSQL to 10 %
#                             (Render 0.1c-256mb) with cpulimit (SIGSTOP/SIGCONT
#                             duty cycle ≈ container CPU quota)
#   STAGES=baseline,low,...   subset of harness/stages.json (default all)
#   STAGE_RAMP_S / STAGE_HOLD_S, RECOVERY_S (+RECOVERY_CHARTS/VISITORS)
#   CONST=<charts>:<seconds> with VISITOR_RATIO for a flat sustained run
#   ASSET_CDN_HIT=0.95        share of hashed assets served by Cloudflare
#   HARNESS_PG_MAX            override pg.Pool max (sensitivity experiment only)
set -uo pipefail
cd "$(dirname "$0")"
source harness/env.sh
NAME="${1:?run name}"; RUN="$PWD/results/$NAME"; rm -rf "$RUN"; mkdir -p "$RUN"
export RUN_DIR="$RUN" STOP_FILE="$RUN/STOP" USERS="$PWD/results/users.json"
PGDATA_DIR=$(psql "$DATABASE_URL" -Atc "show data_directory"); export PGDATA_PID="$PGDATA_DIR/postmaster.pid"
echo "== run $NAME profile=${PROFILE:-uncapped} stages=${STAGES:-all} ramp=${STAGE_RAMP_S:-60}s hold=${STAGE_HOLD_S:-180}s const=${CONST:-} cdn=${ASSET_CDN_HIT:-0.95}" | tee "$RUN/run.txt"
env | grep -E '^(PROFILE|STAGES|STAGE_[A-Z_]*|RECOVERY[A-Z_]*|MON_POOL_STOP|CONST|VISITOR_RATIO|ASSET_CDN_HIT|HARNESS_PG_MAX)=' >> "$RUN/run.txt"

pkill -f "harness/throttle.mjs" 2>/dev/null; pkill -CONT -P "$(head -1 "$PGDATA_PID")" 2>/dev/null
./harness/start-backend.sh "$RUN" "${HARNESS_PG_MAX:-}" | tail -1
BPID=$(cat "$RUN/backend.pid")
psql "$DATABASE_URL" -qc "SELECT pg_stat_statements_reset()" >/dev/null
LIMITERS=()
if [ "${PROFILE:-uncapped}" = render ]; then
  node harness/throttle.mjs 50 pid "$BPID" & LIMITERS+=($!)
  node harness/throttle.mjs 10 children "$(head -1 "$PGDATA_PID")" & LIMITERS+=($!)
  echo "cpu limits: backend 50% / postgres 10%" | tee -a "$RUN/run.txt"
fi
sleep 3
START_MS=$(($(date +%s)*1000)); echo "start_ms=$START_MS" >> "$RUN/run.txt"

node harness/sse-swarm.mjs "$USERS" "$RUN/sse.jsonl" "${CONST:+const:${CONST}}" > "$RUN/sse.log" 2>&1 & SSE=$!
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_PORT=5665 K6_WEB_DASHBOARD_EXPORT="$RUN/k6-charts-dashboard.html" \
  k6 run --quiet --no-usage-report k6/charts.js > "$RUN/k6-charts.log" 2>&1 & KC=$!
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_PORT=5666 K6_WEB_DASHBOARD_EXPORT="$RUN/k6-visitors-dashboard.html" \
  k6 run --quiet --no-usage-report k6/visitors.js > "$RUN/k6-visitors.log" 2>&1 & KV=$!
node harness/monitor.mjs "$RUN" "$BPID" "$SSE" "$KC" "$KV" > "$RUN/monitor.log" 2>&1 & MON=$!

# k6 abort (error-rate stop condition) → stop the other generators too
( while kill -0 $KC 2>/dev/null || kill -0 $KV 2>/dev/null; do
    for p in $KC $KV; do if ! kill -0 $p 2>/dev/null && grep -q "thresholds on metrics .* have been crossed\|aborted" "$RUN"/k6-*.log 2>/dev/null && [ ! -f "$RUN/STOP" ]; then
      echo "{\"t\":$(date +%s)000,\"reason\":\"k6 error-rate threshold aborted the run\"}" > "$RUN/STOP"; kill -INT $SSE $KC $KV 2>/dev/null; fi; done
    sleep 5; done ) & WATCH=$!

wait $KC; wait $KV; kill -INT $SSE 2>/dev/null; wait $SSE
kill $WATCH 2>/dev/null; kill -INT $MON; wait $MON 2>/dev/null
for l in "${LIMITERS[@]:-}"; do [ -n "$l" ] && kill "$l" 2>/dev/null; done; sleep 0.5; pkill -f "harness/throttle.mjs" 2>/dev/null
kill -CONT "$BPID" 2>/dev/null; kill -CONT "$(head -1 "$PGDATA_PID")" 2>/dev/null; pkill -CONT -P "$(head -1 "$PGDATA_PID")" 2>/dev/null

END_MS=$(($(date +%s)*1000)); echo "end_ms=$END_MS" >> "$RUN/run.txt"
node harness/sltp-latency.mjs "$RUN" "$START_MS" "$END_MS" > "$RUN/sltp-latency.log" 2>&1; echo "sltp: $(cat "$RUN/sltp-latency.log")"
node harness/integrity.mjs "$RUN" > "$RUN/integrity.log" 2>&1; echo "integrity exit $? ($(grep -o '"violations": [0-9]*' "$RUN/integrity.json"))"
psql "$DATABASE_URL" -At -c "SELECT json_agg(t) FROM (SELECT calls, round(total_exec_time::numeric,1) total_ms, round(mean_exec_time::numeric,3) mean_ms, round(max_exec_time::numeric,1) max_ms, rows, left(regexp_replace(query,'\s+',' ','g'),220) query FROM pg_stat_statements WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database()) ORDER BY total_exec_time DESC LIMIT 30) t" > "$RUN/pg-statements.json"
grep -E "duration: [0-9]{3,}" "$(dirname "$PGDATA_DIR")/log" 2>/dev/null | tail -200 > "$RUN/pg-slow.log" || true
[ -f "$RUN/STOP" ] && echo "STOPPED: $(cat "$RUN/STOP" | head -c 300)"
tail -2 "$RUN/k6-charts.log" "$RUN/k6-visitors.log"
