# ADR 0032 — Iran sovereign regional runtime (foundations)

- **Status:** Proposed. PR 1 of 5 is implemented on branch `infra/iran-sovereign-runtime`. Nothing is deployed.
- **Date:** 2026-11-14
- **Audited commit:** `main` @ `ec9ed77f53fcc5131ac83397583ba5aa8152cc27` (merge of PR #117)
- **Related:** [ADR 0031](0031-iran-edge-on-liara.md) (Iran edge, reverse proxy), [ADR 0027](0027-trading-stream-fan-out-and-engine-loop-isolation.md), [ADR 0018](0018-payment-verification-and-recovery.md)

## 1. Context

ADR 0031 put an nginx reverse proxy on Liara in front of Render. It adds no
backend, so **the Iran edge stops working when the international link is
down.** The owner wants an Iranian runtime that keeps approved local
functions running through an international isolation of at least 120 days.

### 1.1 Verified production topology (at `ec9ed77`)

| Component | Where | Notes |
|---|---|---|
| `openfund` web service | Render, Frankfurt, 1 instance | One Node process: API, SIWE sessions, SSE, React app (same origin), and all jobs below |
| `openfund-db` | Render Postgres 17 | The only authoritative store: app tables, Directus tables, Footprint tables |
| `openfund-cms` | Render, Directus 11.17.4 image | Separate service. Media on a 5 GB Render disk |
| Iran edge | Liara Docker (nginx 1.28) | `iran.openfund.cloud` → Render. Stateless. Built in the `germany` build location |
| Start-up jobs (before this PR) | inside `server.js` | Engine loop (1 s), purchase expiry (60 s), payment recovery (60 s), live-settlement retries (60 s), treasury snapshots (60–120 min), Footprint ingestion, Gains market data |

### 1.2 Dependency map: what fails without international connectivity

| Dependency | Used by | Isolation effect on the Iran edge today | Effect on the Iran runtime (target) |
|---|---|---|---|
| Render (API, DB, CMS) | everything | **total outage** (502) | none: Iran has its own API, DB and CMS |
| Gains Network REST/WS (`api.gains.trade`) | `market-data.js`: the engine's only execution and mark source; `gains-portfolio.js` | engine loses all marks, so `tradeable()` returns `stale_price` | Execution is suspended. Display can use the Bitpin adapter (§7) |
| Hyperliquid (`api.hyperliquid.xyz`) | Footprint chart | Footprint unavailable | Footprint disabled; the chart falls back to candles |
| DePay, payment RPCs, Solana explorer | purchases, recovery, verification | purchases impossible | purchases refused by the server (global region only) |
| Arbitrum RPC (`AUTH_RPC_URL` / viem default) | SIWE ERC-6492/EIP-1271 checks | — | Normal wallets: viem 2.57.19 falls back to local `ecrecover` when the RPC call fails, so sign-in works (after the 5 s RPC timeout). Contract wallets cannot sign in (§8) |
| WalletConnect relay | remote wallets | — | unavailable. Browser-extension wallets sign locally and still work |
| TradingView widget, Google Fonts, other CDNs | frontend | — | must be removed or vendored for the Iran build (PR 2) |
| Treasury RPC + Chainlink | treasury snapshots | — | not run in Iran (global role) |
| GitHub, GHCR, npm, Docker Hub | build and deploy | no new deploys | deploy must use prebuilt images in a domestic registry (§13) |
| Cloudflare DNS, `.cloud` TLD | `iran.openfund.cloud` resolution | names expire from resolver caches | **not solvable under `openfund.cloud`** (§12) |
| Let's Encrypt (ACME) | Liara TLS issuance | no renewal | certificate expiry is a hard failure under HSTS (§12) |

## 2. Decision summary

1. **Two regional runtimes, one codebase.** GLOBAL (Render) and IRAN (Liara)
   run the same backend. Region-specific behaviour comes from configuration
   (`OPENFUND_REGION`, `OPENFUND_ROLES`) and adapters. Business logic is not
   duplicated.
2. **Each database belongs to one region, and the process checks this** (§3).
3. **Background jobs are roles** that can be switched on and off. The GLOBAL
   default is every role, which is exactly the previous behaviour (§5).
4. **IRAN denies by default.** The backend refuses every state-changing
   request that is not on an explicit non-financial allowlist (§5).
5. **Modes are durable and operator-controlled** (§6). No health check changes
   a mode.
6. Account ownership, outbox/inbox replication, Bitpin, withdrawal
   continuity, DNS and disaster tests follow in PRs 2–5. Each one is designed
   below and keeps the guarantees above.

## 3. Database region fence (implemented)

- New table `runtime_region` holds one row naming the region that owns the
  database. `migrate.js` claims it once, from `OPENFUND_REGION` (default
  `GLOBAL`). The Render database is therefore claimed `GLOBAL` on its next
  migration.
- `server.js` checks the claim before it serves. If it differs from the
  process's region, the server refuses to start. `migrate.js` exits non-zero
  on a mismatch.
- So an Iran process pointed at the Render database (or the reverse) cannot
  write a single row. A GLOBAL process on a database migrated before this
  release (no claim yet) starts as before. An IRAN process never accepts an
  unclaimed database.
- Changing a claim is a manual, reviewed DBA action. It is never automatic.

## 4. Regional account ownership (design, PR 3)

**Constraint:** two engines must never write to the same account.

- **Placement.** Ownership is a property of the *financial account*, not of
  the wallet. One wallet may have accounts in both regions. Use a dedicated
  table, not a column on `demo_accounts` or `openfund_challenges`:
  `account_ownership(account_id PK, home_region, epoch bigint, sequence bigint,
  fenced_at, fenced_by, transfer_ref)`. A dedicated table keeps the hot engine
  tables untouched and gives transfers their own audit trail.
- **Write authority.** Every engine mutation (`submitOrder`, `closePosition`,
  `updateProtection`, `cancelOrder`, loop sweeps, settlement) runs inside a
  transaction that runs
  `SELECT … FROM account_ownership WHERE account_id=$1 AND home_region=$self FOR SHARE`
  and increments `sequence`. Every ledger or event row records
  `(account_id, epoch, sequence)`. Accounts without an ownership row belong to
  GLOBAL, which is true of every existing account.
- **Read models.** The other region stores mirrored rows in
  `remote_account_view` tables. These are rebuilt from events and are never
  written by an engine.
- **Transfer (never automatic):**
  1. The operator requests a transfer.
  2. The owner region fences: `home_region=NONE` and `epoch+1`. It rejects new
     orders, waits until no open positions remain or closes them under the
     existing rules, and emits `ownership_released(epoch, final_sequence,
     balance_digest)`.
  3. The target region applies that event and reconciles the balance digest.
  4. A second operator approves, and the target sets `home_region=self` with
     the same epoch.

  A failed health check never starts a transfer. Existing production accounts
  are not migrated. A pilot migration needs a separate owner approval and a
  rehearsal on a copy.
- **Stale ownership.** An event whose epoch is lower than the current epoch
  is rejected and reported. A region that sees its own epoch superseded stops
  that account's processing.

## 5. Roles and isolation policy (implemented)

`apps/backend/region.js`:

| Role | Job | GLOBAL default | IRAN |
|---|---|---|---|
| `http` | API + web | on | default on |
| `market-data` | Gains marks | on | allowed, off by default |
| `engine` | trading loop | on | **refused** until PR 3 (ownership) and PR 4 (price policy) are signed off |
| `purchase-expiry` | order expiry | on | **refused** |
| `payment-recovery` | on-chain recovery | on | **refused** |
| `settlement` | live settlement | on | **refused** |
| `treasury` | snapshots | on | **refused** |
| `footprint` | Hyperliquid | on | allowed, off by default |

- If the `http` role is off, the process serves only `/health`, `/version` and
  `/runtime/status`. This is the worker-process shape.
- **IRAN request policy (default deny).** Allowed:
  - all `GET`/`HEAD`/`OPTIONS` requests;
  - `POST /auth/nonce|verify|logout` and `PATCH /auth/profile`;
  - `PUT /chart/workspaces/*`, `/portfolio/notes` and `/products/*/preferences`;
  - `POST /support/messages`;
  - `POST /trading/preview` (computes a quote, writes nothing);
  - `POST /admin/runtime/mode`.

  Everything else, including any route added later, gets `503
  {error:'operation_unavailable', operation, reason, region, mode}` before a
  handler runs. Denied operations include purchases, DePay, challenge
  start/provisioning, every trading mutation, withdrawals, rewards, live and
  perpetual routes, and admin financial actions. PR 4 adds withdrawal
  requests to the allowlist, together with the withdrawal state machine
  (§11).
- GLOBAL permits everything, in every mode. Render behaviour is unchanged.

## 6. Modes (implemented)

- **Storage.** `runtime_mode` is a single row holding the mode, epoch, actor
  and reason. `runtime_mode_events` is append-only (a trigger rejects
  `UPDATE`/`DELETE`) and records applied **and refused** transitions together
  with their gate results.
- **IRAN transitions:**
  - `GLOBAL_CONNECTED → IRAN_ISOLATED`, always: it is the restrictive direction.
  - `IRAN_ISOLATED → RECOVERY`.
  - `RECOVERY → IRAN_ISOLATED`, as rollback.
  - `RECOVERY → GLOBAL_CONNECTED`, only through the gates.

  GLOBAL has one fixed mode.
- **Transition request:** the admin token, a named `X-Admin-Actor`,
  `expectedEpoch` (optimistic concurrency with a row lock), the typed
  confirmation `CONFIRM-<MODE>` and a reason of at least 10 characters.
- **Gates.**
  - Every transition needs a healthy database.
  - Reopening (`GLOBAL_CONNECTED`) also needs a reachable global origin and a
    drained outbox. Until PR 3, IRAN writes no financial records, so the
    outbox gate passes and says so explicitly.
- **Endpoints:**
  - `GET /runtime/status`: public and read-only. Returns region, mode, epoch,
    roles and the allowed/denied operation table.
  - `GET /admin/runtime`: status, the next allowed modes, a gate dry-run and
    the history.
  - `POST /admin/runtime/mode`: performs a transition.
- **Fail closed.** An IRAN database without a `runtime_mode` row reads as
  `IRAN_ISOLATED`.

## 7. Bitpin domestic market data (design, PR 4)

Verified on 2026-11-14 against the live public API. The documentation site
renders client-side and could not be read, so the WebSocket channels and the
rate limits are **NOT VERIFIED**.

- `GET https://api.bitpin.ir/api/v1/mkt/markets/` returns `symbol` (`BTC_USDT`,
  `BTC_IRT`), `base`, `quote`, `tradable`, `suspended`, `price_precision`,
  `base_amount_precision` and `quote_amount_precision`.
- `GET https://api.bitpin.ir/api/v1/mkt/tickers/` returns `symbol`, `price`
  (string), `low`, `high`, `daily_change_price` and `timestamp` (Unix seconds,
  fractional). There is **no bid/ask and no volume**. Some inactive pairs
  return nulls or old timestamps.

Policy:

| Use | Gains (connected) | Bitpin (isolated) |
|---|---|---|
| Chart display | yes | yes, for mapped crypto `*_USDT` symbols, labelled "Bitpin, domestic" |
| Historical candles | yes | candle endpoint NOT VERIFIED; ticker sampling only until it is confirmed |
| Reference price | mark/index | **no.** A last-trade price is not a mark/index |
| Execution price | mark ± spread | **no** |
| SL/TP trigger | mark | **no** |
| Liquidation reference | mark | **no** |

- The engine keeps reading `market-data.js` (Gains) only. Bitpin data goes to
  a separate adapter (`DisplayFeed`) that the engine cannot import. A lint
  test will enforce this, in the same way as the Footprint isolation test.
- Forex, index, stock and commodity instruments have no domestic source. They
  stay suspended and are never mapped to a crypto price.
- Execution in isolation stays disabled until the owner approves a written
  per-symbol pricing policy. For example: Bitpin last trade with a staleness
  bound under N seconds, a cross-check against a second domestic venue within
  X bps, and a widened spread. Without that approval, no fills are simulated.

## 8. Authentication in isolation (design; behaviour partly verified)

- The Arbitrum One chain policy is unchanged (`AUTH_CHAINS`).
- **Normal (EOA) wallets** are verified with local `ecrecover` after the RPC
  call fails (viem `verifyHash` fallback, read in source). This is sound: no
  chain state is claimed. Cost: one 5 s RPC timeout per sign-in until
  `AUTH_RPC_URL` points at a reachable domestic endpoint or the call is
  short-circuited. A short-circuit is a later optimisation and must never
  skip the contract-wallet path.
- **Contract wallets (EIP-1271/ERC-6492)** need chain state, so they cannot
  sign in during isolation. The user sees a clear "unavailable" message; no
  verification is faked. Not changed.
- **WalletConnect** needs its foreign relay, so it is unavailable.
  **Browser-extension wallets** work.
- Sessions are rows in the regional database. A Render session never works in
  Iran, because cookies are host-only and the databases are separate. Users
  sign in once on the Iran origin while connected, and the 168 h session TTL
  then carries them for 7 days. A longer isolation TTL would be a separate,
  owner-approved security decision.
- End-to-end offline sign-in is **NOT VERIFIED** until the PR 5 fault
  injection.

## 9. Iran PostgreSQL, CMS and data (design, PR 2)

- Liara managed PostgreSQL. 17.x matches Render; the version cannot be changed
  later. Daily automatic backups plus manual backups (docs). Public access off;
  apps reach it on a private network.
- Separate credentials. Staging uses generated test accounts only. No
  production data is copied.
- Directus runs as a separate Liara app, as in production, with its own
  `directus-uploads` Liara disk (`"disks":[{"name":…,"mountTo":"/directus/uploads"}]`).
- CMS replication is one-way, GLOBAL → IRAN, through an export/import of
  content collections and media. It is never a database link.
- Encryption at rest and backup retention on Liara are **NOT VERIFIED** in
  the docs.

## 10. Replication (design, PR 3)

- **Outbox.** A transactional `region_outbox(event_id uuid, account_id,
  epoch, sequence, type, payload, created_at, acked_at)` row is written in the
  same transaction as the ledger change.
- **Inbox.** `region_inbox(event_id PK, source_region, applied_at)` provides
  deduplication.
- **Ordering.** Apply in `(account_id, sequence)` order. A gap holds the
  account. A lower epoch is rejected.
- **Delivery.** Push over the connected link, retried with backoff. An
  acknowledgment is durable only after the inbox commit.
- **No balance overwrite.** Read models are rebuilt by folding events. A
  reconciliation report compares the folded balance with the owner's digest.
  Any mismatch opens a manual-review item, and that item blocks the
  `GLOBAL_CONNECTED` gate.

## 11. Withdrawal continuity (design, PR 4)

- Current statuses: `requested`, `approved`, `paid`, `rejected`, `cancelled`.
- New statuses: `under_review` and `awaiting_settlement`. `paid` requires a
  settlement reference that was verified while connected.
- In IRAN, requests and reviews for **IRAN-owned** accounts are stored and
  audited locally and replicated after reconnection. Global-owned accounts
  stay read-only.
- Idempotency key: `(withdrawal_id, epoch)`. Payout instructions are issued
  only by the owner region once it is connected, and a `payout_instructed`
  event is unique per withdrawal.
- No automatic treasury payments.

## 12. DNS and TLS feasibility

**Key finding:** a name under `openfund.cloud` cannot be resolved from a cold
cache during a long isolation, *whatever* provider hosts it. Resolving
`iran.openfund.cloud` needs a referral from the `.cloud` TLD servers and
from the parent zone's Cloudflare nameservers, and both are outside Iran.
Delegating the subdomain only moves the *last* hop. Resolver caches keep NS
and A records for hours to days, not 120 days.

| Option | Survives 120-day isolation? | Notes |
|---|---|---|
| A. Delegate `iran.openfund.cloud` by NS to Liara DNS | **No** (the parent referral is foreign) | Liara's documented record types do not include NS. Subdomain zones and Liara nameserver hostnames are not in the docs: **NOT VERIFIED**, ask Liara support |
| B. Keep Cloudflare, use a DNS-only CNAME/A to Liara | **No** | Simple. Correct for connected mode. Never proxied |
| C. A separate `.ir` domain on domestic authoritative DNS (Liara DNS) | **Probably yes**, **NOT VERIFIED** | `.ir` is operated by IRNIC. Domestic resolution of the TLD during isolation must be tested from a domestic resolver with a cold cache (PR 5) |

**Recommendation.**

- Keep `iran.openfund.cloud` as a **DNS-only** record (option B) for
  connected mode.
- Register an owner-approved `.ir` fallback domain with authoritative DNS on
  Liara (option C). Register it with the same release, and accept it in
  `ALLOWED_DOMAINS` and the CORS lists.
- Do not touch the `openfund.cloud` Cloudflare nameservers.
- Liara's domain page shows the exact CNAME/ALIAS, TXT verification and
  `_acme-challenge` CNAME targets. They are not in the docs, so they are not
  reproduced here.

**TLS is the second blocker.**

- Liara issues Let's Encrypt certificates through DNS-01. Renewal needs a
  foreign ACME endpoint.
- Let's Encrypt certificates last 90 days, which is shorter than a 120-day
  outage.
- `openfund.cloud` sends HSTS with `includeSubDomains`, so an expired
  certificate on `iran.openfund.cloud` cannot be clicked through.

Mitigations (owner decision):

1. Before a risk period, install a commercial certificate with the longest
   validity the CA/Browser Forum still allows: 200 days from 2026-03-15.
   Upload of a custom certificate on Liara is **NOT VERIFIED**.
2. Renew it as soon as connectivity allows.
3. For the `.ir` domain, do not enable HSTS preload.

## 13. Liara infrastructure as code (capabilities, PR 2)

Confirmed in the docs:

- `@liara/cli` (CI pins `@9`): `liara create`, `app:list`, `deploy`
  (`--image`, `--port`, `--disks`, `--build-location iran|germany`),
  `db create -t postgres -v … --network`, `disk:create -a … -n … -s <GB>`,
  `env:set`, and `--api-token`.
- REST base `https://api.liara.ir/` with `Authorization: Bearer`. The
  per-resource endpoints are published at developers.liara.ir, which was not
  read: **NOT VERIFIED**.
- Private networks: apps reach each other by app id as hostname. The network
  cannot be changed after creation.
- Container-registry mirrors for Docker Hub/GHCR/Quay/MCR. Hostnames are not
  documented: NOT VERIFIED.
- A private registry per account.
- Cron in Docker through Supercronic.
- A dedicated no-port worker app type is not documented.

Plan:

- `infra/liara-iran/stack.json` is the desired state: apps, network,
  database, disks and env names, with no secrets.
- `scripts/liara/provision.mjs` lists the existing resources through the CLI
  (`--json` where supported), prints a diff, creates only missing resources
  behind `--apply`, and never deletes anything. Production also needs a
  confirmation string and the `liara-iran` GitHub environment's reviewers.
- Workers are a second Liara app running the same image with
  `OPENFUND_ROLES=…` and `http` off, which serves only `/health`.
- **Offline deploy.** The current edge builds in `germany`, which needs the
  international link. The Iran runtime is built once while connected, pushed
  to the Liara private registry, and deployed with `liara deploy --image`
  from that registry. Rollback uses the previous verified image tag stored
  there. Runtime boot needs no npm or Docker Hub access.

## 14. Disaster testing (design, PR 5)

- A docker-compose (or Liara staging) environment with toxiproxy/iptables
  that blocks Render, GitHub, Gains, Hyperliquid, DePay, the RPCs and foreign
  DNS.
- It runs the checks in the task list, including multi-day event
  accumulation driven by an accelerated clock.
- 120-day capacity is **calculated** from measured per-day growth (DB rows,
  disk, logs) with stated assumptions. A short fault test never proves
  120-day availability.

## 15. Consequences

- Render behaviour is unchanged. The new tables are additive. The guard is a
  pass-through for GLOBAL. Every role is on by default. The full existing
  backend suite passes.
- The Iran runtime cannot be misconfigured into financial processing:
  global roles are refused at configuration, financial writes are refused at
  the request, and a foreign database is refused at start-up.
- **The Iran runtime is still not a usable isolated product.** It has no
  local database, CMS or market data yet (PRs 2 and 4), and DNS/TLS blockers
  remain (§12).

## 16. PR roadmap

| PR | Scope | Status |
|---|---|---|
| 1 | This ADR, roles, region fence, default-deny policy, modes, operator API, tests | implemented, in review |
| 2 | Iran API/web/CMS/Postgres on Liara staging, `stack.json` + provisioning tool, offline image path, frontend CDN removal | pending |
| 3 | Account ownership, outbox/inbox, reconciliation | pending |
| 4 | Bitpin display adapter, withdrawal continuity, instrument suspension | pending |
| 5 | Fault injection, backup/restore drills, runbooks, DNS/TLS readiness, activation checklist | pending |
