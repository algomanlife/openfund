# Openfund status

<!-- Generated from docs/status/status.json by `node scripts/docs/status.mjs`; edit the JSON, not this page. -->

Canonical, per-environment status. Last updated **2026-11-18**. Source states come from Git; every
runtime state names the time it was verified and its evidence. Older snapshots elsewhere in the
documentation are historical unless they match this page.

## Release

- **Latest official release:** [v0.6.5](https://github.com/algomanlife/openfund/releases/tag/v0.6.5) — commit `a87804a69b27cafa3063807f33f1f7d9d93470dc`, published 2026-11-17.
- **Next release:** version not yet allocated — pending owner decision; candidate `defe8f0ff6d5d2462d22fb003c13931e9fb5926e`. The release planner requires at least 0.7.0 after v0.6.5 because #135 is a feat change; a dispatch requesting 0.6.6 was refused before any tag was created (run 44237555538). ([evidence](https://github.com/algomanlife/openfund/actions/runs/44237555538))

## Services

| Environment | Service | Role | Version | Commit | Official | Verified | Evidence | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| GLOBAL — Render | `openfund` | Web/API | 0.6.5 | `a87804a` | yes | 2026-11-18 07:40 UTC | [evidence](https://openfi.cloud/version) | — |
| GLOBAL — Render | `openfund-backstage` | Backstage | — | `cd057fa` | no | 2026-11-18 07:40 UTC | [evidence](https://dashboard.render.com/web/srv-dbsum1u7bikc73chqlfg) | Unreleased commit from a dashboard auto-deploy; its /health predates commit identity, so the commit comes from Render's deploy record. |
| GLOBAL — Render | `openfund-cms` | Directus CMS | directus/directus:11.17.4 | — | — | 2026-11-18 07:40 UTC | [evidence](https://cms.openfi.cloud/server/health) | Independent image identity; health verified, image digest not re-verified on this date. |
| IRAN — Liara | `openfund-iran` | Web/API | 0.6.5 | `a87804a` | no | 2026-11-18 07:40 UTC | [evidence](https://openfi.live/version) | Built without RELEASE_OFFICIAL (reports official: false). Runs OPENFUND_ROLES=http, so it holds no market data (execution suspended_no_authoritative_marks). |
| IRAN — Liara | `openfund-iran-worker` | Worker | — | — | — | 2026-11-18 07:40 UTC | Liara API GET /v1/projects/openfund-iran-worker | Running (Liara status ACTIVE, defaultSubdomain false). Its commit is not independently attributable: the worker exposes no public route and Liara's release listing was unavailable through the API on this date. |

Local / Test: Disposable PostgreSQL 17 databases and test servers on non-8080 ports; never authoritative for production state.

## Features

Each region is recorded separately. *Deployed* means the code runs there; *Enabled* that the runtime turns it on; *Verified* that it was observed working; *Accepted* that the owner accepted it in production.

| Feature | Source | Release | Region | Deployed | Enabled | Verified | Accepted | Detail | Remaining blocker | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Challenge purchases (DePay and manual transfer) | merged | v0.6.5 | GLOBAL | yes | yes | no | no | paymentsEnabled true; DePay on ethereum, arbitrum, base, polygon, optimism, solana, bsc; 7 manual-transfer chains. No genuine production purchase is recorded. | A real low-value owner purchase (docs/deployment/LAUNCH_PARITY_RUNBOOK.md section 13). | [evidence](https://openfi.cloud/purchases/plans) (2026-11-18) |
|  |  |  | IRAN | yes | no | no | no | Purchases are refused in IRAN by policy (paymentsEnabled false, no plans offered). | Policy: not offered in IRAN. | [evidence](https://openfi.live/purchases/plans) (2026-11-18) |
| Coupons and zero-payment purchases | merged | v0.6.5 | GLOBAL | yes | yes | no | no | Engine live with purchases. Backstage one-step creation and checkout coupon persistence are in PR #141 (not merged). | PR #141 review; then an owner checkout with a real coupon. | [evidence](https://github.com/algomanlife/openfund/pull/141) (2026-11-18) |
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
