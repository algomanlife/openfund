# Shared settings for the isolated capacity environment. Source this file.
# Everything is local: synthetic Gains on :18090, backend on :18080,
# disposable PostgreSQL 17 cluster on :55432 (database openfund_load_test).
export CAP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
# in-repo location: scripts/capacity → repository root is two levels up
if [ -f "$CAP_DIR/../../render.yaml" ]; then export OPENFUND_DIR="${OPENFUND_DIR:-$(cd "$CAP_DIR/../.." && pwd)}"; else export OPENFUND_DIR="${OPENFUND_DIR:-$CAP_DIR/../openfund}"; fi
export BACKEND_DIR="$OPENFUND_DIR/apps/backend"
export DATABASE_URL="${DATABASE_URL:-postgres://postgres@127.0.0.1:55432/openfund_load_test}"
export TARGET="${TARGET:-http://127.0.0.1:18080}"
export MOCK_PORT=18090
export GAINS_API="http://127.0.0.1:$MOCK_PORT/v1/arbitrum"
export GAINS_WSS="ws://127.0.0.1:$MOCK_PORT/v1/arbitrum/ws"
export MOCK_T0="${MOCK_T0:-1794000000000}"
case "$TARGET" in
  http://127.0.0.1:*|http://localhost:*|https://*staging*|https://*-stg.*) ;;
  *) echo "refusing: TARGET $TARGET is not local or an explicitly named staging host" >&2; return 1 2>/dev/null || exit 1 ;;
esac
