# ADR 0033 — Regional account authority, synchronization and the independent Iran runtime

- **Status:** Proposed. Implemented on branch `infra/iran-regional-authority`. Not deployed, not merged.
- **Date:** 2026-11-14
- **Baseline:** `main` @ `c07ab3d7eee65005bf0e023a3c7300766cef8a98` (merge of PR #119). PR #118 (product refinement) was still open and was accounted for: this change does not touch its files, apart from shared appends to `schema.sql` and `ci.yml`.
- **Builds on:** [ADR 0032](0032-iran-sovereign-regional-runtime.md) (regions, roles, modes, region fence). It refines ADR 0031: the edge may remain, but it is no longer the Iran execution path.

## 1. Decision summary

1. **Two independent regional runtimes from one codebase.**
   - GLOBAL runs on Render: Render behaviour is unchanged.
   - IRAN runs on Liara, with its own web/API app, worker app, PostgreSQL and Directus.
   - The same image runs in both. Region behaviour comes only from `OPENFUND_REGION`, `OPENFUND_ROLES` and `REGION_SYNC_*`.
2. **Every trading account has exactly one home region.** The database itself enforces this:
   - A trigger fence rejects any write to an account's financial rows unless this database's region owns the account and its ownership is `active`.
   - No code path can bypass the fence: not the engine, rewards, admin, a stale worker or a future route.
3. **Synchronization is event based.**
   - Each region writes a transactional outbox (triggers, same transaction as the change) and pushes it to the peer over signed HTTPS.
   - The receiver applies events through a durable, ordered, idempotent inbox into **read models**. Foreign data never enters the engine's tables.
4. **Ownership moves only by an explicit, audited, two-sided handoff:** release with fencing at epoch+1, a verified bundle, then acceptance. It never moves because of an outage.
5. **Reopening after an outage is gated by reconciliation.** Connectivity, drained queues, a completed checkpoint comparison in both directions, zero open discrepancies and zero quarantined accounts are all required.
6. **Market data is unchanged.**
   - The IRAN engine executes only on fresh authoritative Gains marks, the existing `tradeable()` contract.
   - Without them, execution is suspended and the server refuses it in `IRAN_ISOLATED`/`RECOVERY`.
   - Bitpin execution pricing remains out of scope.

## 2. Account ownership

| Element | Implementation |
|---|---|
| Identifier | `demo_accounts.id` (UUID, globally unique). Accounts are never re-keyed across regions |
| Home region, epoch, state | `account_ownership(account_id, home_region, epoch, state, reconciliation)`. States: `active`, `fenced`, `transferred`, `quarantined` |
| Creation | Trigger on `demo_accounts` insert: owned by the creating database's region. Existing rows are back-filled by `migrate.js` after the region claim. This is idempotent and never changes an existing row |
| Write fence | `BEFORE` trigger on `demo_accounts`, `openfund_challenges`, `trading_orders/positions/ledger/events`, `account_equity_risk/samples`, `position_close_requests`, `challenge_events/equity_days/trailing/strikes/reviews`, `fee_refunds`, `withdrawal_requests`. It takes the ownership row `FOR SHARE` and raises `account_not_writable_in_region` (HTTP 409) |
| Fencing token | `epoch`. A release takes the row `FOR UPDATE`: it waits for in-flight writers, then every later writer fails. This is tested with a writer holding an open transaction |
| Engine | Every monitoring-loop selection adds `openfund_account_writable(a.id)`. Trading rules and calculations are unchanged |
| Rule snapshot | `openfund_challenges.rules_snapshot` is unchanged and travels inside the handoff bundle |
| Audit | `account_ownership_events`: `created`, `released`, `granted`, `transferred`, `quarantined`, `released_quarantine`, `release_cancelled` |

### Handoff protocol

1. **Release (owner region A).** The account must be flat: no open position, no pending order, no open withdrawal.
   - Ownership becomes `fenced` at `epoch+1`.
   - The bundle is emitted (account, challenge, orders, positions, ledger, equity/trailing/strike state, withdrawals) with a digest: balance, realized PnL, ledger count/sum, last `balance_after` and position count.
2. **Accept (target region B).** The offer must be the newest, the source's ownership must be seen `fenced` at the same epoch, and the digest must match.
   - The import uses an import-scoped bypass for exactly that account.
   - The digest is re-verified on the imported rows.
   - B then creates `active` ownership at the same epoch and emits the account snapshot.
3. **Completion (region A).** A applies B's ownership event and marks its copy `transferred`.

Regional details:

- Purchase links stay with the region that took the payment (`purchase_order_id` is cleared).
- Plans are mapped by slug.
- Ledger and event ids are re-numbered regionally.
- `cancel-release` restores A at a new epoch, so a late acceptance is recognisably stale.

## 3. Synchronization

| Concern | Implementation |
|---|---|
| Capture | AFTER triggers append to `region_outbox` in the same transaction. Captured: user identity, account, ownership, challenge, challenge events/reviews, orders, positions, ledger and withdrawals. Never captured: avatar data, sessions, nonces or keys. Capture is off until the operator enables sync; enabling it runs the **initial state transfer** (snapshot) and turns on capture in one transaction under table locks, so no change falls in between |
| Ordering | One stream per user (`user:<id>`) with a gap-free `stream_seq` assigned under a row lock in commit order |
| Delivery | The worker (`sync` role) pushes batches. At-least-once. An event stays until acknowledged (no TTL). Retries use exponential backoff (cap 5 min). Definitive refusals are dead-lettered and can be re-queued |
| Effects | Exactly once. The `region_inbox` primary key is `event_id`. A per-stream checkpoint is updated in the same transaction. A gap is held. A duplicate is acknowledged with no effect. A different event at a used position opens a `sequence_conflict` |
| Read models | `region_remote_rows` (latest state, versioned by `stream_seq`) and `region_remote_entries` (append-only ledger and events). `GET /accounts/remote` shows the signed-in wallet's copies, read-only |
| Authority | An account event is accepted only from its home region and at the current epoch. A claim on an account that this region owns and has `active` quarantines the local account and opens `ownership_conflict` |
| Contracts | Versioned types (`user.v1` … `withdrawal.v1`, `checkpoint.v1`, `checkpoint_done.v1`, `handoff_bundle.v1`). Each has required fields and types. Unknown types or versions are refused as retryable, so the stream suspends rather than corrupts |
| Transport security | HMAC-SHA256 over method, path, timestamp, nonce and body hash. Key ids support rotation. ±5 min clock window. Single-use nonces. The source region is checked. HTTPS is required in production |
| Compatibility | `GET /sync/v1/hello` (signed): protocol, release, queues and discrepancies. The worker does not send to an incompatible peer. Different releases with the same protocol interoperate (tested) |
| Monitoring | `GET /admin/regional`: outbox pending, dead, oldest age and last ack; inbox held/rejected; peer status; ownership summary; discrepancies; last reconciliation; withdrawals awaiting review; engine and market-data health |

## 4. Modes and recovery

The ADR 0032 modes are unchanged. IRAN policy:

| | `GLOBAL_CONNECTED` | `IRAN_ISOLATED` | `RECOVERY` |
|---|---|---|---|
| Website, terminal, sign-in, profile, notes, support | yes | yes | yes |
| Trading execution, challenge start, funded-account review | yes, IRAN-owned accounts and fresh marks only | **no** (503) | **no** |
| Withdrawal requests, staff approve/reject | yes (IRAN-owned) | yes | yes |
| Recording a payout as paid | yes | **no** | **no** |
| Purchases / DePay | **no** (GLOBAL only) | no | no |

Reopening `RECOVERY → GLOBAL_CONNECTED` requires all of:

- a healthy database;
- a reachable peer with a compatible protocol;
- a local outbox with nothing pending or dead;
- no held gaps, locally or at the peer;
- a peer outbox that is drained;
- a reconciliation run started after `RECOVERY` began that is `complete` with 0 mismatches;
- no open discrepancies, locally or at the peer;
- no quarantined accounts, locally or at the peer.

A reconciliation appends a checkpoint, the authoritative balance and ledger count per account, to every user stream on both sides. Because it is ordered after all earlier events, each side compares its projection at exactly that point.

## 5. Isolation behaviour and limits

- The IRAN runtime boots and serves with Render and every foreign host unreachable. This is tested with the peer down and in a browser that aborts every non-local request.
- Wallet sign-in for normal wallets (EOA) works with the Arbitrum RPC unreachable, on `iran.openfund.cloud`, `iran.openfi.cloud` and `openfi.live`. viem falls back to local `ecrecover`; see the test. Contract wallets (EIP-1271/6492) and WalletConnect cannot sign in during isolation. This is unchanged and not faked.
- **The CMS is required for content pages.** Without a reachable Directus, the home page shows its "content unavailable" state. The Iran Directus deployment unit exists. Distributing GLOBAL-edited content to it is **not implemented**: today it is bootstrapped from the repository seeds (`apps/backstage/scripts/bootstrap-cms.sh`), so content is versioned in Git.
- Open positions during a long outage stay open, with their protections recorded but **not executed**. Decisions on risk evaluation, protection execution and challenge clocks during an extended outage belong to the separate market-data policy phase.

## 6. DNS and TLS

None of `iran.openfund.cloud`, `iran.openfi.cloud` or `openfi.live` is guaranteed to resolve for a cold resolver during a long international outage:

- `.cloud` and `.live` TLD servers are outside Iran.
- The `openfund.cloud`/`openfi.cloud` parent zones are on Cloudflare.

Delegating to Liara nameservers moves only the last hop. Let's Encrypt renewal needs the international network, and certificates last 90 days. An Iranian-registry fallback domain on domestic DNS is an optional future measure. It is not claimed to work.

## 7. Consequences

- GLOBAL: unchanged by default.
  - Sync is off until configured and enabled.
  - Capture triggers are inert while it is off.
  - The fence passes every write to GLOBAL-owned accounts.
  - The full existing backend suite passes.
- New per-write cost: one `FOR SHARE` lookup per financial row write.
- New stored data: an outbox row per captured change while sync is enabled. Rows remain until acknowledged.
- Not implemented here:
  - an operations dashboard UI (the operator API exists);
  - CMS content distribution;
  - purchases in IRAN (needs a cross-region payment-claim registry so one transaction can never provision twice);
  - automated database backup/restore on Liara (console only);
  - a frontend view of remote accounts.
