# Openfund status

<!-- Generated from docs/status/status.json by `node scripts/docs/status.mjs`; edit the JSON, not this page. -->

Canonical, per-environment status. Last updated **2026-11-18**. Source states come from Git; every
runtime state names the time it was verified and its evidence. Older snapshots elsewhere in the
documentation are historical unless they match this page.

## Release

- **Latest official release:** [v0.7.0](https://github.com/algomanlife/openfund/releases/tag/v0.7.0) — commit `34ef7ec719d2bb0e5b20d10e6112a8ccc33261a0`, published 2026-11-18.
- **Next release:** version not yet allocated — in development; candidate `null`. Openfund Pay payment rebuild (ADR 0046) is implemented on branch agent/claude/openfund-pay and awaits review; it is a feat change, so the release planner will allocate at least 0.8.0. Not released, not deployed. ([evidence](https://github.com/algomanlife/openfund/tree/agent/claude/openfund-pay))

## Services

| Environment | Service | Role | Version | Commit | Official | Verified | Evidence | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GLOBAL — Render | `openfund` | Web/API | 0.7.0 | `34ef7ec` | yes | 2026-11-18 14:30 UTC | [evidence](https://openfi.cloud/version) | — |
| GLOBAL — Render | `openfund-backstage` | Backstage | — | `cd057fa` | no | 2026-11-18 07:40 UTC | [evidence](https://dashboard.render.com/web/srv-dbsum1u7bikc73chqlfg) | Unreleased commit from a dashboard auto-deploy; its /health predates commit identity, so the commit comes from Render's deploy record. |
| GLOBAL — Render | `openfund-cms` | Directus CMS | directus/directus:11.17.4 | — | — | 2026-11-18 07:40 UTC | [evidence](https://cms.openfi.cloud/server/health) | Independent image identity; health verified, image digest not re-verified on this date. |
| IRAN — Liara | `openfund-iran` | Web/API | 0.6.5 | `a87804a` | no | 2026-11-18 14:30 UTC | [evidence](https://openfi.live/version) | Built without RELEASE_OFFICIAL (reports official: false). Runs OPENFUND_ROLES=http, so it holds no market data (execution suspended_no_authoritative_marks). |
| IRAN — Liara | `openfund-iran-worker` | Worker | — | — | — | 2026-11-18 07:40 UTC | Liara API GET /v1/projects/openfund-iran-worker | Running (Liara status ACTIVE, defaultSubdomain false). Its commit is not independently attributable: the worker exposes no public route and Liara's release listing was unavailable through the API on this date. |

Local / Test: Disposable PostgreSQL 17 databases and test servers on non-8080 ports; never authoritative for production state.

## Features

Each region is recorded separately. *Deployed* means the code runs there; *Enabled* that the runtime turns it on; *Verified* that it was observed working; *Accepted* that the owner accepted it in production.

| Feature | Source | Release | Region | Deployed | Enabled | Verified | Accepted | Detail | Remaining blocker | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Challenge purchases (DePay and manual transfer) | merged | v0.7.0 | GLOBAL | yes | yes | no | no | paymentsEnabled true; DePay on ethereum, arbitrum, base, polygon, optimism, solana, bsc; 7 manual-transfer chains. Two genuine owner purchases with coupons on 2026-11-18 did NOT activate a challenge: DePay Arbitrum tx 0x8806874d…4444fe settled 10.638 USDC to the treasury for a 10.80 order (rejected insufficient_amount, shown as Verification Pending); the ~$10 manual transfer was not found on Arbitrum, Base, Optimism, Polygon, BNB Chain or Solana (Ethereum not scanned). Root cause report: docs/payments/INCIDENT_2026-11-18.md. | Openfund Pay (ADR 0046) released and deployed, the two 2026-11-18 cases reconciled by an operator, then the real-network acceptance checklist (docs/payments/ACTIVATION.md). | [evidence](https://openfi.cloud/purchases/plans) (2026-11-18) |
|  |  |  | IRAN | yes | no | no | no | Purchases are refused in IRAN by policy (paymentsEnabled false, no plans offered). | Policy: not offered in IRAN. | [evidence](https://openfi.live/purchases/plans) (2026-11-18) |
| Openfund Pay (direct wallet payment, partial/excess ledger, treasury watcher, refunds) | implemented | — | GLOBAL | no | no | no | no | Implemented on branch agent/claude/openfund-pay with deterministic tests (mocked chain data, real PostgreSQL). Not merged, released or deployed; no real-network test performed. | Review and merge, official release, deployment, owner-authorized real-network acceptance. | [evidence](https://github.com/algomanlife/openfund/tree/agent/claude/openfund-pay) (2026-11-18) |
|  |  |  | IRAN | no | no | no | no | Purchases stay refused in IRAN by policy; the watcher runs only with the GLOBAL payment-recovery role. | Policy: not offered in IRAN. | [evidence](https://openfi.live/purchases/plans) (2026-11-18) |
| Coupons and zero-payment purchases | merged | v0.6.5 | GLOBAL | yes | yes | no | no | Engine live with purchases. Backstage one-step creation and checkout coupon persistence are merged to main (#141), not released or deployed. | Next release deployed; then an owner checkout with a real coupon. | [evidence](https://github.com/algomanlife/openfund/pull/141) (2026-11-18) |
|  |  |  | IRAN | yes | no | no | no | No purchases in IRAN. | Policy: not offered in IRAN. | [evidence](https://openfi.live/purchases/plans) (2026-11-18) |
| Paper trading engine and market data | merged | v0.6.5 | GLOBAL | yes | yes | yes | no | Engine running; execution available_for_fresh_markets. | — | [evidence](https://openfi.cloud/ready) (2026-11-18) |
|  |  |  | IRAN | yes | no | no | no | Web has no market-data role, so execution is suspended_no_authoritative_marks. Fixed on main (#135), not released. | Next release deployed to Liara with OPENFUND_ROLES=http,market-data. | [evidence](https://openfi.live/ready) (2026-11-18) |
| Live order execution on Gains | merged | v0.6.5 | GLOBAL | yes | no | no | no | Control plane only: executionAdapter none, settlementAdapter none, capacity unknown (capital_not_verified). | Approved signer/custody design, supported testnet contracts, simulation, security review and management activation. | [evidence](https://openfi.cloud/live/status) (2026-11-18) |
|  |  |  | IRAN | yes | no | no | no | Not enabled. | Same as GLOBAL. | [evidence](https://openfi.live/ready) (2026-11-18) |
| Backstage operations console | merged | v0.6.5 | GLOBAL | yes | yes | no | no | Serves unreleased commit cd057fa (contains the v0.6.5 console). | Deploy the next official release so Backstage runs the release commit and reports it. | [evidence](https://backstage.openfi.cloud/health) (2026-11-18) |
|  |  |  | IRAN | no | no | no | no | Backstage runs only in GLOBAL; it shows IRAN status read-only. | — | [evidence](../../docs/backstage/README.md) (2026-11-18) |
| Regional synchronization (ADR 0033) and cross-region forwarding (ADR 0044) | merged | v0.6.5 | GLOBAL | yes | no | no | no | Sync not enabled; ADR 0044 is proposed, not implemented. | Out of scope for the current release; requires the owner's activation decision. | [evidence](../../docs/deployment/LIARA_IRAN_RUNTIME.md) (2026-11-18) |
|  |  |  | IRAN | yes | no | no | no | Sync not enabled. | Same as GLOBAL. | [evidence](../../docs/deployment/LIARA_IRAN_RUNTIME.md) (2026-11-18) |
| Open Trade desktop installers | merged | — | GLOBAL | no | no | no | no | 0.0.2 installers built and acceptance-tested in CI; unsigned and not published. | Code signing and the owner's publication decision. | [evidence](https://github.com/algomanlife/openfund/actions/runs/43611941782) (2026-11-15) |
|  |  |  | IRAN | no | no | no | no | Not applicable (desktop distribution is not regional). | — | [evidence](../../docs/product/FEATURE_STATUS.md) (2026-11-15) |

## Awaiting owner acceptance

- Challenge purchases (DePay and manual transfer) (GLOBAL)
- Coupons and zero-payment purchases (GLOBAL)
- Paper trading engine and market data (GLOBAL)
- Backstage operations console (GLOBAL)

## Updating this page

1. Re-verify the runtime fact (for example `node scripts/release/regions-status.mjs`, `GET /version`, `/ready`, `/purchases/plans`).
2. Edit `docs/status/status.json`, including `verifiedAt` and `evidence`.
3. Run `node scripts/docs/status.mjs`, then `npm run docs:check`.
