# Gains Network integration

Openfund uses Gains public interfaces for market data and wallet-scoped Arbitrum reads. The vendored `@gainsnetwork/sdk` source is preserved for inspection; it does not enable transaction execution. [Perpetual Trading](../trading/PERPETUAL.md) defines product scope.

## Market data

The maintained adapter is [gains-adapter.js](../../packages/openfund-gains-adapter/src/gains-adapter.js), mirrored in `dist/` for script loading. The backend separately consumes server-owned marks in [market-data.js](../../apps/backend/market-data.js).

| Interface | Use and limits |
| --- | --- |
| `https://api.gains.trade/v1/arbitrum/markets` | Symbols, groups, precision, leverage bounds, funding/open-interest metadata; market counts are dynamic |
| `/v1/arbitrum/prices` | Mark/index values and source timestamps; not executable bid/ask depth |
| `/v1/arbitrum/markets/{SYMBOL-DASHED}/candles` | OHLC candles for adapter-supported 1m, 5m, 15m, 30m, 1h, 4h and 1d; weekly bars are not assumed |
| `wss://api.gains.trade/v1/arbitrum/ws` | Prices subscription, ping/pong, reconnect and sequence-gap resubscription |

`createVelaProvider()` exposes the provider's bars, symbols, metadata and subscription contracts. Source timestamps and staleness are preserved. Open-interest/funding metadata can be displayed when available; depth, executed tape and footprint volume are not supplied by this oracle price feed. The separate current Trading API supplies [Gains VOB and executed trades](GAINS_DEPTH.md), now integrated into the shared panel. Never invent missing values.

## Wallet reads

[gains-portfolio.js](../../apps/backend/gains-portfolio.js) derives the wallet from SIWE, reads official Arbitrum open trades, trading variables and personal history/statistics, and normalizes fixed-point values with collateral metadata. [Product contracts](../architecture/PRODUCT_TERMINALS.md#verified-read-sources) list exact paths, cache policy and error behavior.

The backend returns explicit upstream errors and unsupported-value states. Gains events remain distinct from Prop simulation and Openfund journal metadata. Unavailable accrued fees, borrowing/funding and net unrealized PnL are not approximated.

## Read model contract

Each `/products/perpetual/gains` snapshot states its origin. [ADR 0047](../decisions/0047-perpetual-gains-read-only-readiness.md) records the decision.

| Field | Source | Notes |
| --- | --- | --- |
| `positions`, `orders` | `backend-arbitrum.gains.trade/open-trades/{wallet}` | `tradeType` 0/1/2 → `orderType` market/limit/stop (SDK `TradeType`); other values fail as `gains_schema_changed`. Unset TP/SL → `null` |
| `collaterals`, pair names | `backend-arbitrum.gains.trade/trading-variables` | Decimals from `collateralConfig.decimals`; `lastRefreshed` becomes the freshness timestamp |
| `history`, `pagination` | `backend-global.gains.trade/api/personal-trading-history/{wallet}` | Native events; partial closes stay separate; malformed `tx` becomes `null` and is never linked |
| `stats` | `.../personal-trading-history/{wallet}/stats` | Passed through; `updatedAt` becomes the freshness timestamp |
| `network`, `capabilities` | Openfund constant | `42161` Arbitrum One; `readOnly: true`, `canTrade: false`, `execution: "disabled"` |
| `freshness` | Openfund reader | `fresh`, `stale` (cached read older than 60 s or upstream older than 5 min) or `inconsistent` (upstream more than 60 s in the future), with per-source fetch and upstream times |

Errors are fixed codes: `502 gains_unavailable`, `502 gains_read_failed`, `502 gains_schema_changed` and `504 gains_timeout`. The server never substitutes an empty account. The UI may keep the last snapshot after a failed refresh only when it is labelled outdated and shows its fetch time.

Deterministic fixtures for every readiness scenario are in [gains-scenarios.mjs](../../apps/backend/test/fixtures/gains-scenarios.mjs). They are used only by tests.

## Provider compatibility assessment

Reviewed against the official documentation on 2026-11-20. Gains documentation is not a permanent guarantee; re-check before any release that depends on it.

| Topic | Finding | Source |
| --- | --- | --- |
| Read interfaces in use | Open trades by address; trading variables; personal trading history and stats (`chainId=42161`). All return HTTP 200 for the empty address, and the shapes match the adapter (re-inspected 2026-11-20) | [open trades](https://docs.gains.trade/developer/api-reference/endpoint/core-open-trades-by-address), [history migration](https://docs.gains.trade/developer/integrators/guides/history-endpoints-migration), [endpoint refactor](https://docs.gains.trade/developer/integrators/guides/backend-endpoint-refactor) |
| Deprecations | The old `/personal-trading-history/:address` endpoints were removed on 2025-12-01; Openfund already uses `backend-global`. `trading-variables.allTrades` was removed on 2025-10-27; Openfund reads `/open-trades/{address}` instead | Same pages |
| Trading API | A beta REST + WebSocket API at `api.gains.trade/v1/arbitrum`, including an account-positions read. It is not used by Openfund. Writes use on-chain-authorised agents with EIP-712 request signatures; read-only API keys are issued by a master-wallet signature | [Trading API overview](https://docs.gains.trade/developer/trading-api/overview), [errors and limits](https://docs.gains.trade/developer/trading-api/errors) |
| Rate limits | Trading API launch values: 600 requests/min per IP, 300/min per agent or key, 60 writes/min per agent. The docs label these testnet values. The backend read endpoints publish no numbers. Openfund caches account reads for 20 s and metadata for 60 s | Errors page |
| Testnet | Gains documents a Trading API testnet on Arbitrum Sepolia (`api-testnet.gains.trade/v1/arbitrum-sepolia`). Openfund has not verified or used it, and has no testnet contracts, addresses or ABIs. The deterministic local mock is the test environment | Trading API overview |
| Contracts | The Arbitrum diamond address and the v10 migration guides are published. Openfund holds no contract address, ABI or transaction-building code, and reports `tradeInfo.contractsVersion` only as data | [Arbitrum contract addresses](https://docs.gains.trade/what-is-gains-network/contract-addresses/arbitrum-mainnet) |
| Eligibility | The Gains terms exclude use from the US and its territories, by US persons and by sanctioned persons, including use through a VPN. Some asset categories have further regional checks. No age requirement is stated there | [Eligibility and restricted regions](https://docs.gains.trade/help/eligibility-and-restricted-regions) |

## Eligibility and compliance gate

These conditions must hold before any live-trading proposal. None of them is implemented as an enablement switch:

- A written eligibility policy, independently reviewed, covering minimum age, the provider's geographic restrictions, and applicable financial and sanctions rules.
- An IP address, locale or wallet connection is never treated as proof of eligibility or residency. No workaround for jurisdiction or eligibility restrictions.
- Clear product-risk disclosures for leveraged perpetuals, reviewed by counsel.
- Production execution capability defaults to disabled. Enabling it needs separate legal, security and management approval, recorded in an ADR and in [status](../status/status.json).

## Execution gate

No order submission, token approval, collateral transfer, delegated signer, private-key handling or transaction building exists in the repository. The production adapter is `readOnly: true, canTrade: false`, and no feature flag changes that. Future work must verify official network support, addresses/ABIs, collateral/fee policy, transaction simulation, user approval, receipts, reverts and indexed-state reconciliation. Testnet availability must be established separately; a wallet supporting a chain does not prove Gains contracts exist there.

The [Perpetual execution RFC](../architecture/PERPETUAL_EXECUTION_RFC.md) compares the official integration options and states the requirements for independent review. A future live-execution proposal must close every item below. Each is open today:

| Required item | Owner | Status |
| --- | --- | --- |
| Eligibility policy (above), independently reviewed | Legal / compliance | Not started |
| Product-risk disclosures | Legal | Not started |
| Signing model (user-signed transactions or Trading API agent), with no Openfund custody and no backend signer | Security architecture | Not started |
| Verified contract addresses and ABIs for the current Gains version | Engineering + security review | Not started |
| Testnet validation (the documented Arbitrum Sepolia Trading API, confirmed independently) | Engineering | Not started |
| Transaction simulation, fee/collateral validation, allowance policy, receipt/revert handling and indexed-state reconciliation | Engineering | Not started |
| Independent security review of the execution path | External reviewer | Not started |
| Management activation and production authorization | Owner | Not started |

Current repository integration is evidenced by source and historical read checks, with branch validation recorded in [delivery](../reviews/repository-transformation/DELIVERY.md). API availability and counts are not permanent guarantees. The [protocol roadmap](../roadmap/PROTOCOL.md) does not change this boundary.
