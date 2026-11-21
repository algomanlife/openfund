<div align="center">

<img src="docs/assets/brand/mark-mint.svg" alt="Openfund logo" width="88" />

# Openfund

**A clearer way forward**

A prop trading firm and trading technology platform under active development:
simulated evaluations, funded-demo programs, trading workspaces and transparent operations.

[**openfi.cloud**](https://openfi.cloud) · [**openfi.live**](https://openfi.live) · [Documentation](docs/README.md) · [Roadmap](ROADMAP.md) · [Changelog](CHANGELOG.md)

[![Latest release](https://img.shields.io/github/v/release/algomanlife/openfund?label=release&color=82e7bd&labelColor=060808)](https://github.com/algomanlife/openfund/releases/latest)
[![CI](https://github.com/algomanlife/openfund/actions/workflows/ci.yml/badge.svg)](https://github.com/algomanlife/openfund/actions/workflows/ci.yml)
[![Security scans](https://github.com/algomanlife/openfund/actions/workflows/security.yml/badge.svg)](https://github.com/algomanlife/openfund/actions/workflows/security.yml)
[![License status](https://img.shields.io/badge/license-not%20selected-C6FF52?labelColor=060808)](#license)

</div>

## Project overview

Openfund combines challenge programs, a shared Web Terminal, Open Trade desktop,
market analytics and an owner operations console. Prop evaluation and funded-demo
trades are simulated. Rewards require the applicable eligibility checks and human
review. Live Gains order execution remains disabled; a live price feed or a
wallet connection does not mean orders are executed on chain.

The repository is public for inspection. First-party code has no published
reuse license; third-party components retain their individual licenses.
See [License](#license).

## Project status

<!-- status:summary -->

**Current status** (verified 2026-11-21; canonical: [docs/status](docs/status/README.md)):

- Latest official release: **v0.8.0** (`0320cf7`, 2026-11-20).
- GLOBAL (Render) Web/API runs v0.8.0 `0320cf7`; IRAN (Liara) web runs v0.6.5 `a87804a` (built as unofficial).
- Purchases: enabled in GLOBAL, disabled in IRAN; owner purchase acceptance open (see the purchases row in docs/status).
- Live execution: disabled (Approved signer/custody design, supported testnet contracts, simulation, security review and management activation).
- Desktop: 0.0.3 candidate merged (#171); internal unsigned builds, UI acceptance and integrity checks passed on all four CI targets. macOS x64 installer upload failed with a GitHub timeout; signed/public release and real-wallet acceptance remain pending.

<!-- /status:summary -->

The generated summary reflects the canonical register. Service observations retain
their own dates there; they were not re-probed during this documentation update.
A successful build, merged PR, official release, deployment and owner acceptance
are separate milestones.

| Source change after v0.8.0 | What is actually available in source |
| --- | --- |
| [Gains readiness #169](https://github.com/algomanlife/openfund/pull/169) | Wallet-scoped read-only account data, freshness states and UI lifecycle simulation; no live transaction execution |
| [Pine optimization #170](https://github.com/algomanlife/openfund/pull/170) | Open Algo dashboard removal, less work for disabled overlays, PAC previous-period fixes and SMC higher-timeframe lookahead fixes |
| [Open Trade #171](https://github.com/algomanlife/openfund/pull/171) | 0.0.3 candidate: one wallet session across Prop and read-only Perpetual, locale support and signing pipeline |

On the reviewed main commit `adbdeabd64b2ba69379411db607be12d35339426`,
[CI](https://github.com/algomanlife/openfund/actions/runs/44880940041),
[security scans](https://github.com/algomanlife/openfund/actions/runs/44880940096)
and [Unified release](https://github.com/algomanlife/openfund/actions/runs/44880940191)
passed. The [desktop workflow](https://github.com/algomanlife/openfund/actions/runs/44880940066)
failed at the macOS x64 installer upload after build, UI acceptance, packaging
and integrity checks passed. The other three desktop targets passed. This is
not a signed or published 0.0.3 release.

## Product ecosystem

| Surface | Purpose | Entry point / documentation |
| --- | --- | --- |
| Website | Challenges, markets, rulebook, economy, governance, learning, roadmap and certificate verification | [Global](https://openfi.cloud) · [Iran](https://openfi.live) |
| Web Terminal | Shared Prop/Perpetual UI: Vela charts, orders, positions, portfolio, journal and account tools; product data stays isolated | `/:locale/prop/trade` · [Product contracts](docs/architecture/PRODUCT_TERMINALS.md) |
| Open Trade desktop | Electron workspace with one, two, three or four charts, watchlist, order ticket and positions strip | [0.0.3 candidate](docs/releases/open-trade-0.0.3.md) · [Owner setup](docs/releases/OPEN_TRADE_0.0.3_OWNER_SETUP.md) |
| Trade Radar and Heatmap | Read-only Hyperliquid market analytics; separate from trading and account decisions | [Radar](docs/integrations/HYPERLIQUID_RADAR.md) |
| Certificates | Purchase, completion and payout records with serial/QR verification | [Certificate contract](docs/decisions/0039-certificate-event-attestations.md) |
| Backstage | English/Persian owner workspace: challenges, payments, coupons, payouts, support, partner records, finance, audit and content tools | [Console](https://backstage.openfi.cloud) · [Operations guide](docs/backstage/OPERATIONS_GUIDE.md) |
| Directus | Editorial content and published catalog management; financial records remain backend-controlled | [CMS docs](docs/backstage/README.md) |

Open Trade 0.0.3 still needs real WalletConnect acceptance with a configured Reown
Project ID, reviewed desktop-only Arabic/Russian/Chinese strings, signing,
clean-machine installation checks and publication. Desktop-only untranslated
strings fall back to English with a notice.
See the [delivery checklist](docs/reviews/open-trade-0.0.3/DELIVERY.md).

## Openfund Backstage — Business Operations Console

Backstage provides owner-only operational tools over the existing backend.
Directus manages editorial content. Their interfaces and permissions are
separate. For coverage and remaining acceptance, see the
[operations guide](docs/backstage/OPERATIONS_GUIDE.md) and
[status register](docs/status/README.md).

## Feature status

The [feature register](docs/product/FEATURE_STATUS.md) describes capability
coverage; the [status register](docs/status/README.md) records release,
deployment, enablement, verification and acceptance by region. Read-only Gains
integration and simulated lifecycle tests do not enable live execution.

## Product gallery

These are genuine, already-recorded repository captures, not newly captured
production screenshots. The refreshed selection below is dated **2026-11-20**.
The typography captures use a local build and disposable database; the terminal
capture shows Gains still loading. Mobile layout captures use a static build
with the backend and CMS unavailable. They demonstrate presentation, not
payment, trading or production acceptance. Per-image routes, sessions,
timestamps and hashes are in the [manifest](docs/assets/screenshots/manifest.json).

| Persian challenges — Dastkhat | Arabic challenges — Dastkhat Arabic |
| --- | --- |
| ![Persian challenges page rendered with Dastkhat](docs/assets/screenshots/typography/typography-site-fa.png) | ![Arabic challenges page rendered with Dastkhat Arabic](docs/assets/screenshots/typography/typography-site-ar.png) |

| Persian Web Terminal — market connection loading | Backstage — Persian sign-in |
| --- | --- |
| ![Persian terminal typography with market connection loading](docs/assets/screenshots/typography/typography-terminal-fa.png) | ![Backstage Persian sign-in using Dastkhat, before authentication](docs/assets/screenshots/typography/typography-backstage-fa.png) |

| Mobile terminal — Persian | Mobile navigation — English |
| --- | --- |
| <img src="docs/assets/screenshots/responsive-matrix/2026-11-20/after/prop-trade-fa-dark-390.png" alt="Persian mobile terminal layout, backend unavailable" width="280" /> | <img src="docs/assets/screenshots/responsive-matrix/2026-11-20/after/markets-en-light-375-drawer.png" alt="English mobile navigation drawer in light theme" width="280" /> |

Earlier homepage, Radar, Heatmap, certificate and Open Trade 0.0.2 captures
remain in the [historical gallery](docs/assets/screenshots/readme/v065/).
They do not represent a packaged 0.0.3 build.

## Business model

### Payments and business operations

**Openfund Pay is included in v0.8.0.** It implements direct wallet payment,
manual transfer, partial-payment accounting, multi-transaction orders, excess
payment/refund liabilities, treasury monitoring and Backstage investigation.
Its release does not establish real-network acceptance. The two genuine
2026-11-18 payment incidents and the acceptance checklist remain explicit
operational follow-up.

- [Openfund Pay architecture](docs/payments/OPENFUND_PAY.md)
- [Activation and real-network acceptance](docs/payments/ACTIVATION.md)
- [Payment incident](docs/payments/INCIDENT_2026-11-18.md)
- [Order lifecycle](docs/payments/ORDER_LIFECYCLE.md)
- [Verification](docs/payments/VERIFICATION.md)

Sign-in uses **Arbitrum One only** (SIWE, chain 42161). Payment networks are
configured separately. The server prices orders, verifies on-chain evidence
and provisions accounts; a client callback alone cannot mark an order paid.
Available plans, fees and enabled methods come from the current published
catalog and runtime configuration, rather than a copied price table here.

Approved business rules live in [ECONOMY.md](ECONOMY.md),
[Treasury](docs/economy/TREASURY.md) and
[Partner programs](docs/economy/PARTNER_PROGRAMS.md). Governance scope is in
[GOVERNANCE.md](GOVERNANCE.md). These documents describe policy; program
activation and owner acceptance belong in the status register. No revenue,
user count, partnership or regulatory approval is implied.

## Economy and governance

Challenge sales, trader rewards, partner commissions and treasury allocation
are separate accounting flows. Policies and eligibility come from
[ECONOMY.md](ECONOMY.md), [partner rules](docs/economy/PARTNER_PROGRAMS.md)
and [treasury policy](docs/economy/TREASURY.md). The community governance
model delegates non-financial domains; company management controls financial
decisions. See [GOVERNANCE.md](GOVERNANCE.md).

## Languages and regions

The web interface supports Persian (`fa`, RTL), English (`en`), Arabic
(`ar`, RTL), Russian (`ru`) and Simplified Chinese (`zh-CN`).
Explicit locale URLs and saved choices take precedence over trusted
country-based defaults. Choosing a language does not choose a region.
See [domain and locale policy](docs/decisions/0043-canonical-domains-geo-routing-and-locale.md).

| Script | Current UI font | License / source |
| --- | --- | --- |
| Persian | Dastkhat | SIL OFL 1.1; self-hosted |
| Arabic | Dastkhat Arabic | SIL OFL 1.1; self-hosted |
| Latin and Cyrillic | Ubuntu | Ubuntu Font Licence 1.0 |
| Chinese | System CJK fonts | Platform-provided |

Dastkhat files are pinned by upstream commit and SHA-256 in
[SOURCE.json](apps/web-react/public/assets/fonts/dastkhat/SOURCE.json);
[OFL and notices](apps/web-react/public/assets/fonts/dastkhat/).
Irancell is not the current UI typeface. Legacy font files remain tracked in
public assets, `dist/`, the brand archive and investor-pack typography.
Their presence and unresolved redistribution rights are recorded in
[Licensing](docs/legal/LICENSING.md); they are not presented as an active
brand dependency. This documentation update does not remove binaries or
change application styles.

## Technical architecture

| Boundary | Source / responsibility |
| --- | --- |
| Website and terminal | `apps/web-react/`: one React/Vite application with product contexts |
| API and engine | `apps/backend/`: Node.js 26, Express 5, PostgreSQL 17, decimal arithmetic, SIWE, evaluation and payment verification |
| Owner console | `apps/backstage/`: independently operated owner interface; credentials remain server-side |
| Desktop | `apps/open-trade/`: Electron workspace; independent version and release workflow |
| Chart integration | `packages/openfund-charts/`, Vela 0.10.6, Vela Pine addon 0.3.4 and PineTS 0.13.1 |
| Market data | Gains REST/WebSocket; Hyperliquid read-only analytics and footprint data |
| Editorial service | Directus 11.17.4; separate from financial authority |
| Compatibility assets | `dist/` is a tracked, source-critical deliverable; `react/` is generated by the web build |
| Dormant protocol | `packages/openfund-protocol/`; no enabled venue routing |

The root package orchestrates tools; applications have their own dependencies
and lockfiles. Render and Liara operate independently. Source supports regional
authority and synchronization; enabled runtime behavior must be checked in the
[per-environment register](docs/status/README.md).
See [Architecture](docs/architecture/ARCHITECTURE.md),
[Render](docs/deployment/RENDER.md) and
[Environment variables](docs/deployment/ENVIRONMENT.md).

## Technology stack

React/TypeScript and Vite power the web interface; RainbowKit, wagmi and viem
provide wallet integration. Node.js 26, Express and PostgreSQL support the API.
Electron powers desktop, Vela/PineTS provide charts and indicators, and Directus
11.17.4 supplies editorial content. Exact dependencies are pinned in app
lockfiles and the [upstream registry](docs/integrations/UPSTREAM_REGISTRY.md).

## Infrastructure

GLOBAL runs on Render and IRAN on Liara, with independent release deployment
and regional data authority. The Render Blueprint remains in `render.yaml`.
CMS and Backstage are separate services; web/API identity and health are
observed through their documented endpoints.
[Render runbook](docs/deployment/RENDER.md) ·
[Iran runbook](docs/deployment/LIARA_IRAN_RUNTIME.md) ·
[Rollback](docs/deployment/ROLLBACK.md).

## Development workflow

Requires Node.js 26 and a local PostgreSQL database.

```bash
npm ci
npm ci --include=dev --prefix apps/web-react
npm ci --prefix apps/backend
createdb openfund_dev
export DATABASE_URL=postgresql://localhost:5432/openfund_dev
npm run migrate --prefix apps/backend
npm run seed-plans --prefix apps/backend
npm run build:web
PORT=8180 npm run dev:backend
```

For frontend hot reload, run
`VITE_BACKEND_URL=http://localhost:8180 npm run dev:web` in another terminal.
Desktop setup: `npm ci --prefix apps/open-trade`, then
`npm run dev --prefix apps/open-trade`.

Relevant checks:

```bash
npm run typecheck
npm run test:web
npm run test:charts
npm run test:release
npm run validate:blueprint
npm run docs:check
```

Backend and browser integration suites need an isolated disposable test
database and test runtime. Follow [Testing](docs/development/TESTING.md)
and [Local development](docs/development/LOCAL_DEVELOPMENT.md);
never run test suites against the user's database.

## Versioning and releases

Platform releases use `vMAJOR.MINOR.PATCH`; desktop releases use independent
`open-trade-vX.Y.Z` tags. Merging does not publish or deploy. Official runtime
identity comes from `/version`, with the exact source SHA and official flag.
See [Releases](https://github.com/algomanlife/openfund/releases),
[release runbook](docs/deployment/RELEASES.md) and
[desktop candidate](docs/releases/open-trade-0.0.3.md).

## Security

Security controls include wallet/session ownership checks, server-authoritative
trading and payment decisions, CSP, secret scanning, dependency checks and
browser regression suites. The November assessment is a project
self-assessment, not an independent audit. Findings and their individual
remediation/deployment evidence are in the
[remediation report](docs/security/SECURITY-REMEDIATION-2026-11.md).
Report vulnerabilities privately through [SECURITY.md](SECURITY.md).

## License

**No first-party project license has been selected or published.** There is
no root `LICENSE` granting general reuse rights. Public source visibility
does not make the Openfund application open source or grant a general
commercial redistribution license. This statement does not override rights
or obligations under any third-party license.

| Material | Applicable terms / current limitation |
| --- | --- |
| Openfund-owned application, packages, docs and brand assets | No published first-party reuse license; owner decision pending |
| Vela | Apache-2.0 and upstream NOTICE; retain attribution |
| PineTS and Vela Pine addon | AGPL-3.0-only; corresponding-source and combined-work scope must be addressed |
| Gains SDK, LuxAlgo journal core, drkxbt Radar/Heatmap sources | MIT; retain their copyright and license notices |
| Dastkhat / Dastkhat Arabic | SIL OFL 1.1 with upstream notices |
| Ubuntu | Ubuntu Font Licence 1.0 |
| MetaMask SDK | ConsenSys license; inspect its commercial-use conditions |
| Directus 11.17.4 | BSL 1.1; operated as a separate service |
| Dormant Openfund Protocol import | GPL-2.0; per-file terms remain authoritative |
| Pine indicator sources | Unresolved provenance; `smc-v1.pine` retains CC BY-NC-SA 4.0; not covered by a blanket open-source claim |
| Legacy Irancell-derived files | No redistribution permission recorded; replacement of the UI font does not license remaining copies |

The [licensing inventory](docs/legal/LICENSING.md),
[decision record](docs/legal/LICENSE_DECISION.md) and
[third-party notices](THIRD_PARTY_NOTICES.md) separate these scopes.
Finalizing a first-party license requires the owner's choice and copyright
holder, while upstream licenses and unresolved asset rights remain separate.
No dependency or indicator is relicensed by this README.

## Roadmap

The [one-year product roadmap](ROADMAP.md#one-year-product-roadmap) covers
funded operations, platform completion and scaling. The
[milestone register](docs/roadmap/MILESTONES.md) holds dependencies and
acceptance criteria; roadmap targets are not delivered capabilities.

## Documentation map

| Topic | Start here |
| --- | --- |
| Product | [Feature register](docs/product/FEATURE_STATUS.md) · [Status](docs/status/README.md) · [Milestones](docs/roadmap/MILESTONES.md) |
| Roadmap | [ROADMAP.md](ROADMAP.md) · [One-year product roadmap](ROADMAP.md#one-year-product-roadmap) |
| Trading | [Trading docs](docs/trading/) · [Indicators](indicators/README.md) · [Controlled challenges](docs/payments/CONTROLLED_CHALLENGES.md) |
| Operations | [Backstage guide](docs/backstage/OPERATIONS_GUIDE.md) · [Launch parity](docs/deployment/LAUNCH_PARITY_RUNBOOK.md) |
| Engineering | [Docs index](docs/README.md) · [Testing](docs/development/TESTING.md) · [ADRs](docs/decisions/) |
| Community | [Contributing](CONTRIBUTING.md) · [Support](SUPPORT.md) · [Code of conduct](CODE_OF_CONDUCT.md) |

## Contributing and security

Branch from main, keep changes scoped, preserve upstream notices and use the
pull request template. Required checks and review apply before merge.
Contribution licensing remains an owner decision until first-party terms are
published. See [repository governance](docs/development/REPOSITORY_GOVERNANCE.md)
and [AGENTS.md](AGENTS.md).
