# ADR 0044 — Cross-region operation forwarding (one wallet, two regions)

- **Status:** Proposed. Not implemented. Needs owner approval of the design,
  then regional sync activation ([ADR 0033](0033-regional-authority-and-synchronization.md) §3) before any production use.
- **Date:** 2026-11-17
- **Owner decision 2:** both regions operational, one identity, consistent
  account state, one Backstage.

## Context

ADR 0033 gives every account one **home region**. A database trigger refuses
financial writes elsewhere (`account_not_writable_in_region`, 409), and the
other region holds only read-only projections (`GET /accounts/remote`). With
sync off, today:

- a wallet that signs in on `openfi.live` gets a new Iran user and account,
  unrelated to its GLOBAL history;
- a GLOBAL account cannot be traded from the Iran site.

Enabling sync alone gives read-only visibility, not the ability to act from
either site.

## Decision (proposed)

Keep exactly one writer per account. Make every **frontend** work for every
account by **forwarding** a write to the account's home region.

1. **Identity.** The wallet is the identity key. Sign-in (SIWE) is verified
   locally. Before creating a user, the region asks its peer over the signed
   channel (`GET /sync/v1/identity/:wallet`, new):
   - if the peer knows the wallet, the local user becomes a projection of
     that user (same `user_id`), not a new account;
   - if neither knows it, the visiting region becomes home.
   With the peer unreachable, sign-in still succeeds, but **no account is
   created**: the user is told that the account cannot be opened until the
   regions reconnect.
2. **Forwarding.** A state-changing request on a non-home account (order,
   close, protection change, cancel, withdrawal request) becomes a signed
   `op.v1` call to the home region (`POST /sync/v1/ops`, new). The call
   carries:
   - the verified wallet and user id;
   - the account id and the ownership epoch it was read at;
   - the operation and its body;
   - an idempotency key (the client's, or derived from it);
   - the active key id.
   The home region re-checks ownership, epoch and authorization, then executes
   through its own engine, exactly as a local request. The idempotency tables
   (`trading_orders.idempotency_key`, `position_close_requests`) make a retry
   return the first result. The result returns to the visiting region and its
   browser. The visiting region writes nothing financial.
3. **Failure.** If the home region is unreachable or the epoch moved, the
   visiting region answers `503 home_region_unreachable` (or `409
   ownership_changed`). It never records a local financial write and never
   queues one for later.
4. **Replay protection.** The ADR 0033 HMAC signing applies, with timestamp,
   nonce and key id, plus a per-key nonce store with a 10-minute window.
   Operation results are signed too.
5. **Audit.** Both sides record `regional_operation_forwarded` and
   `regional_operation_executed` with the same correlation id. Backstage
   shows them per region.
6. **Reads.** The visiting region serves positions and balances from its
   projection (seconds behind) and marks them as remote. After a forwarded
   write, it shows the home region's returned state.
7. **Backstage.** Region-changing admin actions go to the home region's admin
   API with that region's token, held only by Backstage. They are never
   exposed through Cloudflare.

## Gates

1. Two-region integration tests in `test/regional-sync.test.mjs`, which
   already boots two real regions:
   - the same wallet signs in on both and gets one user;
   - an order forwarded from the visiting region executes once;
   - a close forwarded during a peer timeout is not duplicated on retry;
   - an epoch change mid-flight is refused;
   - a withdrawal request is not duplicated;
   - reconciliation reports zero unexplained differences.
2. Backups of both databases and a restore rehearsal in isolation.
3. Sync activation (ADR 0033), staging dry run, reconciliation.
4. Explicit owner approval of production activation.

## Consequences

- The visiting region adds one round trip to the home region on writes.
  Iran-to-Render latency becomes part of order latency for GLOBAL-home
  accounts used from Iran.
- During an outage between the regions, accounts can be traded only on their
  home region. That is the intended safety property; lockdown policy is a
  separate owner decision.
