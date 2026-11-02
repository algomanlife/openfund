# Unified accounts and Free Trial lifecycle

The Dashboard is one account directory, reachable through either product's existing dashboard route. Each owned Free Trial, Challenge record and Gains wallet context has an individual card. Cards expose identity, source, status, known financial fields and account links. Unsupported balances, phases and protocol metrics remain unknown. A Challenge catalog record is not an activated trading account.

## Identity and persistence

`GET /accounts` uses the authenticated SIWE wallet. PostgreSQL's unique normalized wallet identity and `UNIQUE(user_id,account_type)` on `demo_accounts` enforce one trial. Provisioning and the initial funding ledger row share a transaction. Reauthentication returns the existing row, including disabled rows. There is no reset, replenishment or replacement endpoint.

New accounts receive **100,000 virtual USD**. Existing virtual-DAI accounts and their historical ledgers retain their original denomination; changing old balances or pretending historical conversion is deliberately avoided. Current UI uses the account's denomination. Both are simulations, never real funded accounts or token balances.

## Risk specification v1

The user supplied the zero-equity policy on 2026-11-02:

- Preserve position maintenance liquidation at 10% of initial margin, including executable exit spread and closing fees. This is individual position risk, not account termination.
- Permanently terminate only a Free Trial whose authoritative equity is **at or below zero**. No additional loss limit, daily limit, duration limit, trade-count limit, expiration, profit target, consistency requirement or Challenge phase applies.
- Reject insufficient margin without changing account lifecycle.
- Lock the account, calculate full-precision equity, settle its remaining positions at fresh authoritative marks, cancel pending orders, record risk events and persist `permanently_disabled` in one transaction.
- Missing marks defer settlement rather than inventing prices. New execution also rejects unavailable prices.
- A database trigger rejects updates/deletion of a permanently disabled trial. A second trigger serializes journal, trade-note and preference writes against termination, making its historical views read-only.

The externally visible durable states are `active`, existing administrative `suspended`/`closed`, and `permanently_disabled`. `liquidating` is recorded during the atomic stop transaction, with an audit event. There is no separately configured warning threshold; no numerical warning or additional drawdown rule is invented. The zero-equity rule is a versioned policy in the existing engine, separate from configurable `SIM_MAINT_PCT`. Changing the trial policy requires an approved version change; it is not a browser setting.

Account mutations, the monitoring loop and close settlement check the trial stop. Concurrent requests lock the same PostgreSQL account row. An individual liquidation that leaves positive equity does not terminate the account. Negative gap losses remain in the ledger; no hidden zero-floor credit replenishes a losing account.

## Product and account boundaries

The `account` query parameter persists in hash-route links and product API calls. Every scope is resolved from session ownership. Challenge journal metadata uses its owned challenge ID; financial APIs reject unactivated Challenge execution. Perpetual retains wallet-native Gains reads and disabled on-chain execution. The All accounts journal view groups records by account; it does not sum unknown balances or incompatible collateral units.

## API additions

| API | Contract |
| --- | --- |
| `GET /accounts` | Owned directory; explicit nulls and source/read-only fields |
| `POST /trading/preview` | Validated simulation estimate: entry, quantity, notional, margin, fees, available margin, liquidation, SL/TP; execution may differ |
| `GET /products/:product/context?account=…` | Owned product/account context; Challenge financial state unavailable |
| `GET/PUT /products/:product/preferences?account=…` | Per-account range, layout and hidden metric cards |
| `GET /products/:product/journal?classification=…&account=…` | Existing notes with module classification, search and dates |

Existing order, close, protection and cancellation endpoints retain their API shape. Opening orders require an `Idempotency-Key`; the terminal supplies one and retries must reuse it. Missing identities reject before execution instead of permitting undeduplicated submissions. Financial writes stay in Engine; Directus remains editorial. No Render resources or production routes were added.

[Trading calculations](PROP.md) · [Journal definitions](JOURNAL_METRICS.md) · [Audit](../reviews/unified-trading/AUDIT.md)
