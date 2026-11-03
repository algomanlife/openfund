# Milestones and acceptance gates

Reviewed against merged main `561e7f3`, 2026-11-03 19:52 UTC; official v0.2.0 publication run 41705345213 succeeded and includes PR #40/#41. The dirty website candidate is excluded; no current port 8080 runtime is verified here. No completion dates are promised. **Completed**, **In Progress**, **Planned** and **Blocked** describe only the scope in each row. A phase may contain completed foundations and unfinished release gates.

| ID / phase | Description | Status | Dependencies | Acceptance criteria | Evidence / specification |
| --- | --- | --- | --- | --- | --- |
| F1 · Platform Foundation | Repository app/package boundaries, React frontend and Node API | Completed | Existing source and per-app lockfiles | Routes and same-origin build work; ownership documented; app remains runnable | [Architecture](../architecture/ARCHITECTURE.md), [router](../../apps/web-react/src/main.tsx) |
| F2 · Platform Foundation | Vela chart and Gains market feeds | Completed | Upstream Vela, supported Gains APIs | Real candles/marks, symbol/theme lifecycle, freshness and attribution retained | [Vela](../integrations/VELA.md), [Gains](../integrations/GAINS.md) |
| F3 · Platform Foundation | Three original Pine indicators, local libraries and shared chart interaction repairs | In Progress | F2, official Pine addon, genuine provider data | Original algorithms/inputs, catalog order, actual output, repeated interval/symbol changes, reload and both-product browser evidence; reference conformance and deployment outstanding | [Pine architecture](../trading/PINE_SCRIPT.md), [delivery](../reviews/vela-pine/DELIVERY.md) |
| T1 · Trading Core | Persistent virtual account and simulated order lifecycle | Completed | F1, F2, PostgreSQL | Idempotent funding/orders, margin validation, SL/TP/cancel/partial close/liquidation and auditable settlement | [Prop](../trading/PROP.md), [engine](../../apps/backend/engine.js) |
| T2 · Trading Core | Shared valuation and observed risk metrics | Completed | T1, fresh server marks | Decimal money math; both fees in round trips; stale values unknown; drawdown measurement basis explicit | [ADR 0003](../decisions/0003-trading-valuation-and-product-wallets.md) |
| T3 · Trading Core | Assigned challenge evaluation and commercial risk enforcement | Planned | Approved rules, account assignment, T1/T2 | Versioned rules, deterministic breach/pass decisions, replayable evidence and owned challenge lifecycle | [Product plan](PRODUCT.md) |
| X1 · Product Experience | Product routes, isolated portfolios and private journals | Completed | F1, SIWE sessions, native Gains reads | Cross-product/wallet isolation, owned notes and exports, explicit missing data, shared terminal presentation | [Product contracts](../architecture/PRODUCT_TERMINALS.md) |
| X2 · Product Experience | Published CMS content and multilingual public pages | Completed | Directus schema, permission policies | Published-only reads, language/theme/navigation behavior, static fallback; sample reporting labelled | [CMS coverage](../backstage/CONTENT_COVERAGE.md) |
| X3 · Product Experience | Real wallet/device and accessibility acceptance | In Progress | X1, injected/remote wallet configuration, external devices | Actual extension, hardware and WalletConnect rejection/reconnect/network tests; keyboard/RTL/mobile evidence | [Identity](../wallet/IDENTITY.md), [testing](../development/TESTING.md) |
| X4a · Product Experience | Gated purchases, profile/history/invoices and withdrawal requests | Completed within implementation scope | Catalog, SIWE, additive schema | Server-priced/idempotent orders, atomic challenge records and owned history; requests are not payouts | [ADR 0009](../decisions/0009-challenge-purchases-and-payment-verification.md), PR #41, official v0.2.0 |
| X4b · Product Experience | Live payment and DePay acceptance | Blocked | Approved receiver/token/network policy, real-chain and widget verification | Proven economic amount, network compatibility, finality/reorg and receipt reconciliation; retain disabled defaults | [ADR 0009](../decisions/0009-challenge-purchases-and-payment-verification.md) |
| X4c · Product Experience | Funded workflows, payout settlement and genuine reporting | Planned | T3, legal/product facts and operational controls | Approved funded/reward/payout policy, operator authority, settlement and production reporting provenance | [Strategy](../product/STRATEGY.md) |
| I1 · Production Infrastructure | Render/PostgreSQL/Directus configuration and CI | Completed | F1, single engine ownership | Exactly three resources; additive migrations; web/backend/browser/Blueprint/security checks configured | [Blueprint](../../render.yaml), [CI](../../.github/workflows/ci.yml) |
| I2 · Production Infrastructure | Deployed release acceptance and recovery | In Progress | I1, authorized Render access and secrets | Authenticated Blueprint validation, successful apply, HTTPS/CMS/session/SSE checks and backup/restore exercise | [Render](../deployment/RENDER.md), [rollback](../deployment/ROLLBACK.md) |
| I3 · Production Infrastructure | Operating observability and security assurance | Planned | I2, operational requirements | Defined alerts for stale feeds/engine/DB/auth; retention and incident ownership; dependency triage and threat review | [Security](../security/SECURITY.md), [engineering](ENGINEERING.md) |
| A1 · Advanced Trading | Extended order workflows and deeper analytics | Planned | T1/T2/X1, scoped product requirements | Defined order semantics, missing-data rules, performance/reconciliation tests and usable reports | [Engineering](ENGINEERING.md) |
| A2 · Advanced Trading | Gains transaction execution | Blocked | Approved supported contracts/network, simulation and security review | Explicit wallet confirmation, fee/collateral checks, receipt/revert handling and indexed reconciliation | [Perpetual](../trading/PERPETUAL.md) |
| A3 · Advanced Trading | Gains VOB and executed-trade reads | Completed within read scope | Public Gains resources | Verified source/units/freshness; footprint remains unavailable without supporting data | [Gains depth](../integrations/GAINS_DEPTH.md) |
| P1a · Openfund Protocol | Dormant Solidity source and provenance foundation | Completed within source scope | Preserved upstream licensing/source | Integrated source, configuration and compile/test foundation; no active execution route | `packages/openfund-protocol/`, [Protocol](PROTOCOL.md) |
| P1b · Openfund Protocol | Operational venue-adapter and risk contracts | Planned | A2 lessons, approved design and supported venues | Authority, venue capabilities, risk, failure semantics and validated adapters | [Protocol](PROTOCOL.md) |
| P2 · Openfund Protocol | Liquidity aggregation and intelligent routing | Planned | P1a/P1b, validated venue adapters and comparable quotes | Reproducible route selection, stale-quote/failure handling, transaction security and settlement evidence | [Protocol](PROTOCOL.md) |
| E1 · Ecosystem Expansion | Additional integrations and developer services | Planned | Stable product/execution APIs, I2/I3 | Versioned supported interfaces, authorization/rate limits, provider contracts and operational acceptance | [Product](PRODUCT.md) |
| E2 · Ecosystem Expansion | Coordinated scaling and advanced platform capabilities | Planned | Load evidence, engine coordination design, I3 | Single mutation authority under failure, capacity targets, recovery and consistency tests | [Engineering](ENGINEERING.md) |
| D1 · Distribution | Desktop installers | Planned | Owner-verified builds, signing and update/rollback policy | Real Windows/macOS/Linux artifacts and secure destinations before enabling cards | [Product](PRODUCT.md) |
| D2 · Distribution | Mobile applications | Planned | Actual iOS/Android apps and verified store listings | Approved store identities and tested release destinations; current cards remain Coming Soon | [Product](PRODUCT.md) |
| C1 · Public community | Owner-verified Telegram destination | Blocked | Owner URL configuration | Non-navigating unavailable state until configured; bilingual secure link and terminal exclusion acceptance | [Feature Status](../product/FEATURE_STATUS.md) |

[Roadmap overview](../../ROADMAP.md) · [Feature Status](../product/FEATURE_STATUS.md)

## Unified account integration milestone

**In Progress:** one owned account directory, permanent zero-equity trial stop, instrument-validated simulation, restored Gains VOB/Trades and all thirteen journal navigation sections. Dependencies: existing PostgreSQL/Engine/SIWE/portfolio and public Gains resources. Acceptance: concurrent account/risk tests, deterministic cross-market settlement, account isolation, executable browser scenarios, screenshots and current CI. Evidence and external limits: [delivery](../reviews/unified-trading/DELIVERY.md). No commercial Challenge or on-chain execution claims.

## Terminal presentation acceptance

**Completed within local frontend scope:** compact shared header, flat dark-green surfaces, fixed Persian/English column geometry and visible order controls without document/form scrolling at 1920 × 1080, 1440 × 900, 1366 × 768 and 1280 × 720. Depends on the existing shared terminal; changes no execution or deployment capability. [Evidence and responsive limits](../reviews/terminal-ui/DELIVERY.md).

## Unified release acceptance

**Completed within publication scope:** one version and manifest for React/API, checksummed artifacts and main-only publication; v0.2.0 at `561e7f3` is published. **In Progress for local/deployed acceptance:** downloaded-archive startup/identity must be verified separately; production environment, deployed revision and demonstrated rollback remain prerequisites. Do not collapse publication into runtime or deployment acceptance. [Recovery report](../reviews/final-integration/DELIVERY.md) · [Release runbook](../deployment/RELEASES.md).

## UI polish acceptance

**In Progress:** UI-01 through UI-04 form one compatible release batch. Acceptance
requires responsive bilingual/theme/wallet checks, existing integrated release
gates, review, one immutable official version and downloaded-archive verification
through port 8080. [Evidence](../reviews/ui-polish/DELIVERY.md).

## Persian gateway acceptance

**In Progress:** isolated frontend landing redesign based on official v0.1.1.
Acceptance requires all eight requested viewport sizes, keyboard/touch disclosures,
reduced motion, locale/product navigation, existing wallet controls, CI and review.
Proposed Perpetual concepts do not establish routing or zero-spread execution.
[Scope and evidence](../reviews/landing-motion/DELIVERY.md).

## Fresh delivery snapshot — 2026-11-03

| Capability | Status | Evidence / remaining acceptance |
| --- | --- | --- |
| Website / localization / public service presentation | Completed within candidate scope | Existing React/legacy system; [fresh audit](../reviews/website-refresh/AUDIT.md); bilingual and responsive browser acceptance recorded with delivery |
| Wallet sessions, profile editing, catalog, purchases, invoices | Completed within merged implementation scope | PR #41 `561e7f3`; receiver/widget gates retained; included in official v0.2.0; live payment acceptance remains blocked |
| Production DePay / live-chain payment acceptance | Blocked | Approved destination and real-chain/widget acceptance required |
| Withdrawal requests | Completed within merged implementation scope | Requests for later operator review; no review interface or payout execution |
| Challenge evaluation / payout processing | Planned | Operational rules, risk enforcement and settlement acceptance remain |
| Terminal / Vela / Gains / Portfolio / Journal | Completed within implemented scope | Shared workspace, simulation and read-only Gains; external conformance and real wallet/device gates remain |
| Desktop installers / mobile apps | Planned | Five honest Coming Soon cards; no verified installer/store listing |
| Unified GitHub release packaging | Completed within publication scope | v0.2.0 manifest/tag `561e7f3`, run 41705345213 success; current port 8080 startup not verified here |
| Production deployment | Blocked | No live Render service/configuration verified |

This snapshot supersedes older compound milestone wording where it conflates
implementation with production acceptance. Prior acceptance evidence remains
historical; no previous release is rewritten.
