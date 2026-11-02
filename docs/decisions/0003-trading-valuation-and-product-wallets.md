# 0003 — Shared simulation valuation and product wallet policy

Date: 2026-11-02. Baseline: main 1aaa806, including Render PR #23.

Keep the existing Engine, PostgreSQL ledger, product routes, SIWE boundary,
Vela workspace and single Node/SSE process. Fix financial and session integrity
inside those modules instead of adding alternate providers or account systems.

`trading-math.js` owns Decimal gross/net estimates, account valuation and the
simulation liquidation threshold. Frontend rendering consumes server position
values; unsupported Gains fee-adjusted PnL remains unknown. Submissions/retries
are owner-scoped; partial closes create closed slices with parent provenance,
proportional allocations and an atomic idempotency record. Existing financial
ledger rows are never rewritten.

API account realized PnL and portfolio round trips include opening fees; the DB
close-settlement field remains intact for historical compatibility. Persist only
observed fresh equity risk data; do not reconstruct absent history or enforce
unassigned commercial challenge rules. Explicitly expose the measurement basis.

Prop signs on Ethereum Sepolia, Perpetual on Arbitrum One. The wallet must approve
network changes/signatures. Both share the existing wallet identity/session and
retain product isolation. Cookie mutation ordering prevents late verification
from re-establishing the prior wallet after a logout. SSE revalidates sessions.

Render remains one Node API/web, one PostgreSQL 17 and one Directus service. Repair
public hostname references, Directus-specific DB settings, shared region and web
build dependencies within that graph. No production apply is part of this change.

Consequences: free-demo funding stays virtual; no on-chain execution; historical
analytical net values change to correctly include both fees; partial closes are
reported as closed slices (not invented independent opening executions). Actual
wallet extensions, contract wallets and Render deployment require external proof.
