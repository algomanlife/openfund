# ADR 0063 — Public on-chain certificates and trade records on Arbitrum Sepolia

- Status: Accepted by the owner (2026-11-27).
- Builds on: [ADR 0062](0062-request-based-free-trial.md) (request-based Free
  Trial and its certificates).

## Context

The owner wants every challenge and Free Trial to be verifiable by anyone:
the purchase or trial start, phase passes, payouts and the final pass as
blockchain certificates, and every position event — open, close, partial
close, stop-loss or take-profit change — recorded on chain. Decisions of
2026-11-27:

1. Arbitrum Sepolia is enough; the main network is not needed.
2. Traders never sign and never pay: Openfund records and pays everything.
3. Everything is public and complete: anyone can read every trade of a
   challenge or trial.
4. Certificates are non-transferable NFTs.
5. Free Trial accounts are recorded like challenges.

A contract per position was considered and rejected: deploying a contract for
each position is slow and costly and gives nothing an event does not.

## Decision

- **Two contracts** (`packages/openfund-chain-records`, Solidity 0.8.28, no
  external libraries, Foundry tests):
  - `OpenfundCertificate`: soulbound ERC-721 with ERC-5192 `locked`; kinds
    purchase, trial, phase 1 pass, final pass, trial pass, payout; a status per
    token (active, passed, failed, expired, revoked); approvals and transfers
    revert; `tokenURI` = base URI + token id (served by
    `GET /chain/certificates/:tokenId`).
  - `OpenfundTradeLedger`: `record(Trade)` emits `TradeRecorded` (challenge,
    position and action indexed) with the full position data in fixed point
    (10 decimals); actions open, modify, partial close, close.
  - Both: an owner (two-step transfer) and recorder addresses, one per
    region. A repeated record id or token id is a no-op, never a revert, so
    retries cannot duplicate anything.
- **Transactional outbox.** `schema.sql` triggers write one `chain_records`
  row per record in the same transaction as the cause: purchase and trial
  certificates on challenge creation; phase and final pass certificates and
  outcomes on `challenge_events`; payouts on a paid, finalized withdrawal; and
  every position event on `trading_positions` (open on insert, close and
  partial close on the status change of a position or a partial-close slice,
  modify on any stop-loss or take-profit change). Controlled acceptance
  challenges and the retired free demo account are not recorded.
- **Record keys.** `cert:<kind>:<source uuid>` (the same source as the
  certificates table: order for purchase, challenge for trial and passes,
  withdrawal for payout), `status:<outcome>:<challenge>`,
  `trade:<action>:<position>[:<tx>:<time>]`. The token id and record id are
  keccak256 of the key.
- **Worker** (`apps/backend/chain-records.js`), in processes with the `engine`
  role, when `CHAIN_RECORDS_ENABLED=1` and the key and addresses are set:
  sends due rows oldest first with viem, waits for the receipt, stores the
  transaction hash, block and token id; retries with backoff (10 s doubling to
  one hour) and marks a row `failed` after 20 attempts. Recording never blocks
  trading. Low operator balance is logged and reported.
- **Read API (public).** `GET /chain/status`, `GET /chain/challenges/:id/records`
  (the whole evaluation chain) and the certificate metadata. `GET /certificates`
  and certificate verification include the matching on-chain certificate.
  The dashboard challenge panel lists the records with Arbiscan links.

## Consequences

- Records are tamper-evident, not trustless: the Openfund server remains the
  source of truth for prices (Open Oracle) and fills; the chain makes later
  silent changes visible.
- Every trade of a challenge or trial account is public and permanent,
  linked to the trader's wallet through the certificate holder.
- Each position event is one transaction paid by the recorder; a recorder
  needs Arbitrum Sepolia ETH, topped up from faucets.
- A retired test network loses its explorer history; `chain_records` keeps
  every payload and hash so the history can be re-recorded elsewhere.
- Deployment, recorder keys and enabling are owner steps:
  [CHAIN_RECORDS.md](../operations/CHAIN_RECORDS.md).
- Tests: Foundry `ChainRecords.t.sol` (CI), backend `test/chain-records.test.mjs`.
