#!/usr/bin/env bash
# Resilience scenario under constant load (no automatic stop conditions, so
# the planned outages do not end the run):
#   t=0      backend + synthetic Gains up; N streams (sse-swarm) and N chart
#            users (k6) ramp in over 30 s
#   t=60     market-data outage: the synthetic Gains server stops for 20 s
#            (marks go stale; the engine must not settle on stale marks),
#            then restarts; the backend must reconnect on its own
#   t=150    graceful backend restart (SIGTERM, wait for exit, start again)
#            while streams, orders and the engine loop are active
#   t=CONST  generators stop; integrity audit, SL/TP delay, log scan
# Usage: OPENFUND_DIR=<build> ./harness/resilience.sh <name> [charts=300] [seconds=300]
set -uo pipefail
cd "$(dirname "$0")/.."
source harness/env.sh
NAME="${1:?run name}"; N="${2:-300}"; S="${3:-300}"
RUN="$PWD/results/$NAME"; rm -rf "$RUN"; mkdir -p "$RUN"
export RUN_DIR="$RUN" STOP_FILE="$RUN/STOP" USERS="$PWD/results/users.json" STAGE_RAMP_S=30
log() { echo "{\"t\":$(date +%s)000,\"event\":\"$1\"}" | tee -a "$RUN/events.jsonl"; }
./harness/start-backend.sh "$RUN" | tail -1
START_MS=$(($(date +%s)*1000)); echo "start_ms=$START_MS" > "$RUN/run.txt"; echo "CONST=$N:$S" >> "$RUN/run.txt"
node harness/sse-swarm.mjs "$USERS" "$RUN/sse.jsonl" "const:$N:$S" > "$RUN/sse.log" 2>&1 & SSE=$!
CONST="$N:$S" VISITOR_RATIO=0 k6 run --quiet --no-usage-report k6/charts.js > "$RUN/k6-charts.log" 2>&1 & KC=$!

sleep 60
log market_data_down; kill "$(cat "$RUN/mock.pid")"; sleep 20
node harness/mock-gains.mjs >> "$RUN/mock-gains.log" 2>&1 & echo $! > "$RUN/mock.pid"; log market_data_up

sleep 70
OLD=$(cat "$RUN/backend.pid"); log backend_sigterm; T0=$(date +%s%N)
kill -TERM "$OLD"; for i in $(seq 1 60); do kill -0 "$OLD" 2>/dev/null || break; sleep 0.5; done
log backend_exited
SKIP_MOCK=1 ./harness/start-backend.sh "$RUN" | tail -1; log backend_up
echo "restart_ms=$(( ($(date +%s%N) - T0) / 1000000 ))" >> "$RUN/run.txt"

wait $KC; kill -INT $SSE 2>/dev/null; wait $SSE
END_MS=$(($(date +%s)*1000)); echo "end_ms=$END_MS" >> "$RUN/run.txt"
node harness/sltp-latency.mjs "$RUN" "$START_MS" "$END_MS" > "$RUN/sltp-latency.log" 2>&1
node harness/integrity.mjs "$RUN" > "$RUN/integrity.log" 2>&1
{
  echo "restart: $(grep restart_ms "$RUN/run.txt")"
  echo "integrity: $(grep -o '"violations": [0-9]*' "$RUN/integrity.json")"
  echo "sltp: $(cat "$RUN/sltp-latency.log")"
  echo "pool-after-end errors: $(grep -c 'Cannot use a pool' "$RUN/backend.log")"
  echo "unhandled errors: $(grep -cE 'Unhandled|uncaught' "$RUN/backend.log")"
  echo "market-data reconnects: $(grep -c 'ws subscribed' "$RUN/backend.log")"
  node -e '
    const l=require("fs").readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse)
    const s=l.reduce((a,r)=>({drops:a.drops+r.drops,reconnects:a.reconnects+r.reconnects,errors:Object.entries(r.errors).reduce((e,[k,v])=>(e[k]=(e[k]||0)+v,e),a.errors)}),{drops:0,reconnects:0,errors:{}})
    const last=l.slice(-20); console.log("sse:",JSON.stringify(s),"active at end:",Math.min(...last.map(r=>r.active)),"/",last[0].target)' "$RUN/sse.jsonl"
  tail -1 "$RUN/k6-charts.log"
} | tee "$RUN/RESULT"
lsof -ti tcp:18080 | xargs kill 2>/dev/null; true
