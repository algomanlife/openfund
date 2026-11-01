# Dual terminals audit — 2026-11-02

## Repository evidence (completed before application edits)

- Base: `origin/main`, `61c70fe` (PR #20). Remote fetched before worktree creation.
- Worktree: `openfund/dual-terminals`; branch `codex/dual-terminals-portfolio-journal`.
- Existing worktrees (`landing-pages`, `Openfund_Landing_FA`) preserved; initially clean.
- PRs #13–20 integrate server simulation, trading math, journal-core, dashboard, bilingual rulebook/transparency, product gateway/markets and production CMS. `git for-each-ref --no-merged origin/main` returns no remote feature branches. No open PRs in the inspected latest 20 PRs.
- Root AGENTS/README, package manifests/locks, migration/schema, architecture/ADR, content/permissions/coverage docs and shared adapters inspected. No root workspace manager, Render blueprint, application Dockerfile or application CI workflow exists. Vendor Vela CI is upstream-only. Do not claim established Render standards that are absent.
- React 19/Vite/hash routing progressively embeds legacy runtime. `dist/` is source-critical. Public header is composed from landing markup; remains separate.

## Implementation matrix

| Subsystem | Observed current behavior / confirmed gap | Integration plan |
| --- | --- | --- |
| Prop | Single `/terminal`, server Engine + local guest simulation | Separate Prop route, preserve server Engine, explicitly label simulation |
| Perpetual | Gains metadata, marks, candles, public WS; wallet/SIWE | Separate read-only market terminal; no simulated balances or execution |
| Header | Independent legacy terminal/portfolio markup, placeholder More | One React terminal shell with exact product primary menus, secondary Journal |
| Dashboards | Portfolio tab is dashboard, no product context | Independent product dashboard routes, server account vs authenticated wallet |
| Portfolio | journal-core overview, calendar, buckets, paginated trades/details | Reuse backend and core, add account scope, orders, filters, export, safe states |
| Journal | Notes/tags only in trade dialog; Journal tab duplicates history | Persist independent daily/reflection entries + owned trade links, tags/classification/search/import/export |
| LuxAlgo | Core only vendored, upstream commit matches HEAD `834e7b6` | Keep MIT notices; compare full app separately (GAP_MATRIX.md) |
| Backend | Express + SIWE cookies + ownership checks | Reuse session boundary; validated product endpoints and async error handling |
| PostgreSQL | Users/challenges/demo accounts/orders/positions/ledger; trade_notes | Add notebook table only (distinct from trades/annotations), no duplicated financial tables |
| CMS | Published ui_messages/pages + normalized translation tables; public reads | Reuse pages/ui_messages and add normalized terminal editorial sections for sorted content/media/support |
| Authentication | Wallet connection distinct from SIWE session, one primary wallet/user | Derive Perpetual account reference from session wallet, never client wallet |
| Gains | No used position/history/indexing/transaction API or execution path | Expose capability truth, empty financial views; retain SDK execution disabled |
| Engine | Free demo account per user; owned trading writes, independent loop | Preserve arithmetic; account selection limited to actual supported account |
| Routing | `/terminal`, `/portfolio`, locale-prefixed public pages | Product + locale hash routes; compatibility redirects; independent pages |
| Localization | Legacy event/global dictionaries; Persian/English | Locale URL authoritative, shared React labels; LTR numeric values in RTL |
| Runtime teardown | Legacy Terminal/Portfolio navigation schedules full document reload | Contain Prop legacy runtime in same-origin workspace frame, shell navigation remains client-side |
| Data accuracy | `Portfolio.overview` reads `account.acc_realized` although account query returns `realized_pnl` (NaN serializes null) | Correct read to existing authoritative column, no engine calculation changes |
| Data isolation | allPositions/history scope user but not selected account; notes accept arbitrary pipe-containing key | Explicit owned free-demo account scope and validate existing owned trade key |
| Precision | PG numeric strings converted to numbers for analytics/display | Preserve NUMERIC writes/engine Decimal and document analytical display precision |
| Error handling | Several async Express 4 portfolio handlers unwrapped; frontend silently ignores failed loads | Wrap new handlers; visible error/retry and abort stale requests |
| Unsupported pages | No ranking, payout, certificate or reward backend | Fully routed pages with explicit unavailable status, no fake workflow |

## Constraints

No production merge/deploy. Do not reset shared databases. Local verification will use an isolated PostgreSQL database/backend port, reusing the existing Directus instance only for additive editorial setup. No imported broker fills may modify authoritative Openfund trades. Notebook import is metadata-only. Historical equity is realized-only; no invented mark-to-market series or evaluation eligibility.


## User correction applied after the initial audit

The second supplied specification explicitly superseded separate terminal interfaces. Fetch and AGENTS were checked again; main remained `61c70fee6936670ed82f7c3698ba08ea63f8e776`. Final architecture is **one shared terminal UI with independent product adapters and routes**, no headings/banners/outer padding on the trade tab, and professional customer copy. See ADR 0002 and DELIVERY.md for final implementation, verified official Gains wallet reads, and remaining backend dependencies. The initial matrix above records the pre-implementation state; it is not the final feature status.
