# Unified trading audit

Baseline: `da4bfed223de3ffadd13d86be38680a15421a8db`, latest fetched main on 2026-11-02. Dedicated branch: `feat/unified-trading-dashboard-engine`.

## Preparation

Read root agent instructions, README, roadmap, documentation index, architecture, product contracts, capability register, milestones, identity, Prop engine, Gains adapter, schema, journal and CI. Reviewed latest 12 merged PR summaries and changed files, especially #22 (product isolation), #23 (Render), #24 (trading), #25 (documentation), #26/#27 (Pine) and #28 (dormant Protocol). Preserve their boundaries. No additional screenshot reference was attached with the task.

## Baseline inventory

| Capability | Classification | Executable evidence / finding |
| --- | --- | --- |
| SIWE and owned sessions | Working and verified | Existing PostgreSQL suite: 22 identity checks pass |
| One-time 100k funding | Working and verified | Existing trading suite; unique user/type and atomic ledger funding |
| Free Trial USD denomination | Partially implemented | Existing accounts use virtual DAI; new trials need virtual USD, legacy accounting must remain intact |
| Permanent trial disablement | Missing | No account-level zero-equity stop or irreversible state |
| Market/limit/stop, long/short, SL/TP, cancellation, partial/full close | Working and verified | Baseline PostgreSQL trading, portfolio and audit suites pass; reported total failure not reproduced locally |
| Pending stop gap execution | Present but broken | Both limits and stops fill at requested target, including favorable stale stop targets after a gap |
| Price ordering | Partially implemented | Sequence gaps resync; older REST/WS timestamps can still overwrite newer quotes |
| Decimal monetary settlement | Working and verified | Engine uses Decimal / PostgreSQL NUMERIC; legacy analytics convert to Number |
| Instrument contracts | Partially implemented | USD-normalized linear simulation; asset-specific fee/spread tiers, no exchange lot or FX conversion model |
| Backend preview | Missing | Browser estimates; no authoritative preview endpoint |
| Unified account cards | Missing | Separate single-product summaries; challenge records not cards |
| Book and Trades | Present but broken | TradingPages CSS hides tabs and renderBook replaces ladder with a market list |
| Genuine conventional book/tape | Missing | Must verify official sources; never derive volume from marks |
| Portfolio analytics, calendar, trade notes | Working and verified | Existing PostgreSQL portfolio tests; date filter currently uses opening time |
| Journal notes, tags, search, metadata import | Working and verified | Existing product tests; persistent scoped metadata |
| Complete journal navigation and preferences | Partially implemented | Notes/calendar only, no dedicated module navigation or server preferences |
| Perpetual read integration | Partially implemented | Wallet reads exist; no authoritative balance or net analytics when provider omits fields |
| Vela / three original Pine indicators | Partially implemented | Preserved PR #27 baseline; reference conformance and deployed acceptance remain external gates |
| Render | Partially implemented | Three-resource Blueprint; deployed acceptance not established |

## Root causes and policy

The backend order path already works against controlled marks. Live trading depends on a fresh server quote (five seconds) and authenticated active account; errors must remain visible. A missing quote is not permission to invent execution. Book/Trades removal is an explicit shared-workspace CSS/render override. Analytics filter positions by opening date, which excludes trades closed inside the selected range if opened earlier.

User confirmed: maintain individual position liquidation at 10% of initial margin, and independently permanently disable only Free Trial equity at or below zero after authoritative settlement. No Challenge limits, time/trade limits or replenishment. Insufficient margin is rejection only. Disabled history and journals remain readable.
