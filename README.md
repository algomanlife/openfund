<div align="center">

<img src="docs/assets/brand/mark-mint.svg" alt="Openfund logo" width="88" />

# Openfund

**A clearer way forward**

An open-development prop trading firm and trading technology platform for
trading evaluations, funded programs, trader rewards and financial transparency.

[**openfi.cloud**](https://openfi.cloud) · [**openfund.cloud**](https://openfund.cloud) · [Documentation](docs/README.md) · [Roadmap](ROADMAP.md) · [Changelog](CHANGELOG.md)

[![Latest release](https://img.shields.io/github/v/release/algomanlife/openfund?label=release&color=82e7bd&labelColor=060808)](https://github.com/algomanlife/openfund/releases/latest)
[![Deployed version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fopenfi.cloud%2Fversion&query=%24.version&label=deployed&color=82e7bd&labelColor=060808)](https://openfi.cloud/version)
[![CI](https://github.com/algomanlife/openfund/actions/workflows/ci.yml/badge.svg)](https://github.com/algomanlife/openfund/actions/workflows/ci.yml)
![License: decision pending](https://img.shields.io/badge/license-decision%20pending-C6FF52?labelColor=060808)

<br />

<img src="docs/assets/screenshots/readme/v065/home-en-desktop.jpg" alt="Openfund home: All Markets One Trading Platform, with Prop Trading Challenges and Leveraged Perpetual Trading" width="880" />

</div>

---

**Contents** · [Overview](#project-overview) · [Products](#product-ecosystem) · [Backstage](#openfund-backstage--business-operations-console) · [Gallery](#product-gallery) · [Feature status](#feature-status) · [Business model](#business-model) · [Architecture](#technical-architecture) · [Technology](#technology-stack) · [Development](#development-workflow) · [Releases](#versioning-and-releases) · [License](#license) · [Contributing](#contributing-and-security)

## Project overview

Openfund develops challenge and funded programs alongside the Web Terminal,
Open Trade desktop and market analytics. Evaluation and funded-demo trades are
simulated. Trader rewards follow the applicable terms and require human review.
Real-market allocation depends on verified free capital, controls and explicit
authorization.

- **Prop trading evaluation.** Traders choose a challenge, trade a simulated
  account under published rules, and the server — never the browser —
  evaluates every rule from a frozen snapshot.
- **One professional terminal.** Prop and Perpetual share a single terminal:
  Vela charts with Pine indicators, order panel with risk preview, positions,
  portfolio and a trade journal.
- **Read-only market intelligence.** Trade Radar follows public Hyperliquid
  whale activity; the Market Heatmap maps perpetual markets by volume or open
  interest. Neither touches orders or accounts.
- **Desktop.** Open Trade is a lightweight desktop workspace built around the
  chart — a focused workflow, not a cut-down web terminal.
- **Transparency.** Rules, prices, the revenue model, partner commissions and
  governance limits are published; economic figures come only from
  operational records. The repository is public so all of this can be checked.

Openfund is early-stage. Nothing here claims revenue, user numbers, funding,
partnerships or regulatory approval.

The [one-year roadmap](ROADMAP.md#one-year-product-roadmap) covers funded operations,
partner growth, platform expansion and operational scaling.

## Product ecosystem

| | What it is | Where |
| --- | --- | --- |
| **Website** | Product gateway, challenges, markets, rulebook, economy, governance, learning, certificates verification, roadmap — in Persian (RTL), English, Arabic (RTL), Russian and Simplified Chinese | [openfi.cloud](https://openfi.cloud) |
| **Web Terminal** | The complete workspace: trading, charts, portfolio, journal, accounts, leaderboard, certificates, purchases, Trade Radar and Heatmap | `/:locale/prop/trade` |
| **Open Trade (desktop)** | Lightweight Electron workspace: one to four independent Vela charts, compact watchlist, floating order ticket, positions strip, keyboard shortcuts | [Release preparation](docs/releases/open-trade-0.0.2.md) |
| **Certificates** | Purchase, completion and payout certificates issued from recorded events, verifiable by serial or QR in either region | `/:locale/certificate-verification` |
| **Backstage** | Independent, bilingual owner workspace for Prop business operations | [backstage.openfi.cloud](https://backstage.openfi.cloud) |

## Openfund Backstage — Business Operations Console

[Openfund Backstage](https://backstage.openfi.cloud) is the owner console for
the [main platform](https://openfi.cloud). It provides English and Persian
workspaces for trader and challenge inspection, final-pass review, payment
investigation, controlled test coupons, payout review and correspondence,
support intake, partner applications, financial position and system status.

The website serves buyers and traders, the terminal handles trading, and
Directus manages editorial content. Backstage runs independently on Render
and uses the existing Openfund backend for business records and decisions.
The service authenticates a single provisioned owner, keeps its backend
credential server-side and asks the owner to re-enter their password for
privileged decisions.

The launch-completion branch (in review, not deployed) adds commercial
coupon administration, trader support replies with a trader Inbox and in-app
notifications, partner review and commissions, finance records (expenses,
reserves, obligations), a unified audit trail, a read-only live risk board,
global search and a Content workspace for editing website copy in Directus.
External email delivery is not built. See the
[operator guide](docs/backstage/OPERATIONS_GUIDE.md) and
[feature status](docs/product/FEATURE_STATUS.md) for current coverage.

| English overview | Persian overview |
| --- | --- |
| ![Backstage English overview](docs/assets/screenshots/backstage-operations/backstage-overview-en.png) | ![Backstage Persian overview](docs/assets/screenshots/backstage-operations/backstage-overview-fa.png) |


Additional local captures show [challenge inspection](docs/assets/screenshots/backstage-operations/backstage-challenge.png),
[controlled coupons](docs/assets/screenshots/backstage-operations/backstage-controlled-coupons.png),
[payout details](docs/assets/screenshots/backstage-operations/backstage-payout.png),
[support intake](docs/assets/screenshots/backstage-operations/backstage-support-intake.png)
and [financial position](docs/assets/screenshots/backstage-operations/backstage-financial-position.png).
Launch-completion captures (local, not deployed) show the
[coupon wizard result](docs/assets/screenshots/launch-completion/backstage-coupons.png),
the [audit trail](docs/assets/screenshots/launch-completion/backstage-audit.png),
the [Content workspace](docs/assets/screenshots/launch-completion/backstage-content-en.png)
and the [trader Inbox](docs/assets/screenshots/launch-completion/trader-inbox-en.png).

## Product gallery

Genuine captures. Website and terminal: local test runtime of the v0.6.5
candidate with live public market data and published CMS content (no
personal wallet). Desktop: Open Trade 0.0.2. Provenance for every image is in
the [screenshot manifest](docs/assets/screenshots/manifest.json).

| Trading terminal | Trade Radar — aggregated whale positioning |
| --- | --- |
| ![Prop terminal: BTC/USD Vela chart, order book and order panel](docs/assets/screenshots/readme/v065/terminal-en-desktop.jpg) | ![Trade Radar: long and short traders, values and weighted entries per coin from top Hyperliquid leaderboard wallets](docs/assets/screenshots/readme/v065/radar-en-desktop.jpg) |

| Market Heatmap | Open Trade desktop — four charts |
| --- | --- |
| ![Market Heatmap: Hyperliquid perpetuals sized by 24h volume and coloured by 24h change](docs/assets/screenshots/readme/v065/heatmap-en-desktop.jpg) | ![Open Trade 0.0.2 with four independent Vela charts and a floating order ticket](docs/assets/screenshots/readme/v065/open-trade-four-charts.jpg) |

| Applications | Certificate verification | Completion certificate (test record) |
| --- | --- | --- |
| ![Applications page comparing the Web Terminal and Open Trade](docs/assets/screenshots/readme/v065/applications-en-desktop.jpg) | ![Certificate verification page with lookup, three-step guide and templates](docs/assets/screenshots/readme/v065/verification-en-desktop.jpg) | <img src="docs/assets/screenshots/readme/v065/certificate-completion-fa.jpg" alt="Persian completion certificate issued to a disposable test wallet in an isolated database" width="300" /> |

| Home — light theme | Roadmap (Persian) | Mobile (Persian) |
| --- | --- | --- |
| ![Light theme homepage](docs/assets/screenshots/readme/v065/home-en-light.jpg) | ![Persian roadmap timeline](docs/assets/screenshots/readme/v065/roadmap-fa-desktop.jpg) | <img src="docs/assets/screenshots/readme/v065/home-fa-mobile.jpg" alt="Persian homepage on a 390 px phone" width="200" /> |

More: [challenges, checkout, dashboard and economy pages](docs/assets/screenshots/readme/) from production v0.4.4.

## Feature status

From the [feature register](docs/product/FEATURE_STATUS.md). "Production" means
served at [`/version`](https://openfi.cloud/version); a merged change is not
production until `/version` reports it.

| Status | Capabilities |
| --- | --- |
| **Production** | Prop simulation (Free Trial, Standard, One-phase, Instant); shared terminal; Perpetual read-only market data and wallet-scoped positions; dashboard, portfolio, journal, invoices; server challenge evaluation; CMS; transparency, revenue-model and live-market pages |
| **Implemented, not deployed** (v0.6.5 candidate, [PR #122](https://github.com/algomanlife/openfund/pull/122)) | Trade Radar and Market Heatmap; certificate designs and verification page; terminal Persian terminology and footer; homepage and site-wide redesign; Applications and Roadmap pages |
| **Implemented, not active** | Checkout and purchases (payments disabled until configured); Hybrid Governance v1.0 (no council seated); Ambassador and Coach programs; Iran regional runtime and synchronization ([ADR 0033](docs/decisions/0033-regional-authority-and-synchronization.md)) |
| **Beta** | Open Trade 0.0.2 — built and acceptance-tested for macOS, Windows and Linux; unsigned; publication awaiting owner approval |
| **Blocked** | Gains transaction execution (needs supported contracts, simulation and security review); live DePay acceptance; public-domain wallet sign-in until the SIWE allowlist fix is deployed and verified |
| **Planned** | Mobile apps; protocol routing; advanced order workflows — see the [roadmap](ROADMAP.md) |

Controlled challenge acceptance uses two owner-issued test entitlements in an
isolated runtime. See the [operator procedures](docs/payments/CONTROLLED_CHALLENGES.md).

## Business model

The approved model is recorded in [ECONOMY.md](ECONOMY.md) and summarised in
[Business model](docs/economy/BUSINESS_MODEL.md). No revenue, profitability or
growth figures have been published, and none are implied here.

**Challenge sales.** Openfund sells one-time evaluation fees for simulated
challenge accounts. Prices come from the plan catalog in the CMS; the server,
never the browser, prices every order. Current published catalog
([live](https://openfi.cloud/purchases/plans)):

| Model | Structure | Account sizes | Evaluation fee |
| --- | --- | --- | --- |
| Free Trial | Practice account | 5k – 100k | Free |
| Standard | Two-phase evaluation (8% + 5% targets, 10% max loss) | 5k – 100k | $44 – $652 |
| One-phase | Single target, one rule set | 5k – 100k | $74 – $666 |
| Instant | Funded from day one | 5k – 200k | $60 – $888 |

**Purchase lifecycle.** Order (server price, optional coupon) → payment through
DePay on any configured network → on-chain verification → atomic provisioning
of exactly one challenge account and one invoice. Every state change is
recorded. See [Order lifecycle](docs/payments/ORDER_LIFECYCLE.md).

**Revenue recognition principles.** Net collected revenue is gross sales minus
coupon discounts minus refunds, recognised from the verified settlement amount
on chain. Internal 100% test coupons are excluded from revenue and reported
separately. Ambassador commissions are an acquisition cost, recorded as
obligations.

**Costs.** Ambassador commissions, coach compensation (once live trading
exists), trader rewards under published plan rules, refunds and infrastructure
(Render, PostgreSQL, Directus, RPC providers).

## Economy and governance

| Program | Approved rule | Status |
| --- | --- | --- |
| **Brand Ambassador (IB)** | 10% of the referred customer's **first** eligible confirmed purchase, on the net amount after discounts, recognised at verified payment. Eligibility: 50,000+ followers on Instagram or YouTube plus an active second platform; approval by company management | Implemented, not production-active |
| **Verified Trading Coach** | 10% of distributable **realised** net profit from eligible live trades, after trading and execution costs; never on simulated or unrealised PnL | Implemented, inactive until live trading exists |
| Customer referral discount (20%) | **Proposed**, not approved, not active | — |
| Real-capital profit-sharing tiers | **Pending decision** | — |

**Governance.** Hybrid Governance v1.0: *community-governed development,
company-managed treasury*. A ten-seat Community Council holds binding
authority over delegated, non-financial domains through proposals and votes.
Company management keeps exclusive control of the treasury and every financial
decision. It is not a DAO: there is no governance token, and votes are recorded
off-chain. Role-based administration separates content editors, commerce
administrators and operators.

[ECONOMY.md](ECONOMY.md) · [GOVERNANCE.md](GOVERNANCE.md) · [Partner programs](docs/economy/PARTNER_PROGRAMS.md) · [Treasury](docs/economy/TREASURY.md)

## Technical architecture

One reviewed source serves two independently operated regions. Each region
runs the API and web app from the same origin, so session cookies stay
first-party.

```mermaid
flowchart TB
  subgraph Client["Browser / Open Trade desktop"]
    Web["React app<br/>website + terminal"]
    Wallet["Wallet (SIWE)"]
  end
  subgraph Global["GLOBAL — Render (Frankfurt), live"]
    API["Node.js API + SPA<br/>engine · evaluation · purchases<br/>certificates · radar cache"]
    CMS["Directus 11.17.4"]
    DB[("PostgreSQL 17")]
  end
  subgraph Iran["IRAN — Liara, prepared, not deployed"]
    APIIR["Same release<br/>regional runtime"]
    DBIR[("PostgreSQL")]
  end
  Gains["Gains Network<br/>markets, prices, VOB"]
  HL["Hyperliquid public API<br/>(read-only analytics)"]
  Pay["DePay + payment chains"]

  Web -->|REST, SSE| API
  Wallet -->|signature| API
  API --> DB
  CMS --> DB
  API -->|market data| Gains
  API -->|one shared cache + socket| HL
  API -->|verify payments| Pay
  APIIR --> DBIR
  API <-.->|"signed, ordered sync<br/>one home region per account"| APIIR
```

- **Trading engine boundary.** Orders, positions, PnL and evaluation are
  decided only by the backend engine; analytics modules (Radar, Heatmap) are
  GET-only and isolated from it.
- **Regions.** Every trading account has exactly one home region enforced by
  the database; the other region holds a read model through signed
  synchronization. Liara is prepared and documented but not deployed.
- **Content versus data.** Directus holds editorial content, the plan catalog
  and coupons; market data comes from Gains (and Hyperliquid for read-only
  analytics); prices, orders and payments are decided only by the backend.
- More: [Architecture](docs/architecture/ARCHITECTURE.md) · [Regional runtime](docs/decisions/0033-regional-authority-and-synchronization.md) · [Trade Radar](docs/integrations/HYPERLIQUID_RADAR.md) · [Gains](docs/integrations/GAINS.md) · [Certificates](docs/decisions/0033-certificate-event-attestations.md)

## Technology stack

Versions verified against the lockfiles and CI configuration.

| Layer | Technology |
| --- | --- |
| Web | React 19.3, TypeScript 7.0, Vite 8.3, React Router 7 |
| Wallet | RainbowKit 2, wagmi 2, viem 2, Sign-In with Ethereum (Arbitrum One) |
| Charts and data | Vela 0.10.6, Vela Pine addon 0.3.4, PineTS 0.13.1; Gains Network API; Hyperliquid public API |
| Backend | Node.js 26, Express 5.3, `pg`, decimal.js, viem, `ws` |
| Data | PostgreSQL 17; Directus 11.17.4 |
| Desktop | Electron 45.3, electron-builder (DMG, NSIS, AppImage, deb) |
| Payments | DePay (signed configuration, callbacks, events); on-chain verification |
| Quality | Node test runner, Playwright browser suites, CodeQL, gitleaks, dependency review |
| Delivery | GitHub Actions; Render Blueprint (`render.yaml`); Liara runtime image (`infra/liara-iran-runtime`) |

Design system: shared tokens and primitives in
[`design-system.css`](apps/web-react/src/styles/design-system.css)
([guide](docs/design/DESIGN_SYSTEM.md)).

## Infrastructure

| Element | Setup |
| --- | --- |
| **GitHub** | Canonical repository; protected `main` with required checks; releases and tags |
| **Render** | `openfund` (Node web service, API + SPA), `openfund-cms` (Directus image with a persistent media disk), `openfund-db` (PostgreSQL 17), all in Frankfurt. Commit auto-deploy is off |
| **IRAN region** | Liara runtime image and desired-state manifest (`infra/liara-iran-runtime`, ADR 0033): same release, own database, signed synchronization. Prepared and CI-built; **not deployed** |
| **Domains** | `openfi.cloud` and `openfund.cloud` serve the same service |
| **Deployment** | A maintainer publishes a release; the release workflow deploys the exact tagged commit after environment approval and checks `/version` on both domains |
| **Build** | `node scripts/release/render-build.mjs` builds the frontend; migrations run at start-up and are additive and idempotent |
| **Health** | `/health` (API), `/server/ping` (CMS), `/version` (exact version and commit) |
| **Backups** | Render PostgreSQL backups plus manual `pg_dump` before risky changes; Directus media on its disk ([Backup and restore](docs/backstage/BACKUP_RESTORE.md)) |
| **Rollback** | Redeploy the previous official release; additive migrations keep older code compatible ([Rollback](docs/deployment/ROLLBACK.md)) |

[Render runbook](docs/deployment/RENDER.md) · [Environment variables](docs/deployment/ENVIRONMENT.md)

## Development workflow

Requires Node.js 26 and a local PostgreSQL.

```bash
npm ci
npm ci --include=dev --prefix apps/web-react
npm ci --prefix apps/backend
createdb openfund_dev
export DATABASE_URL=postgresql://localhost:5432/openfund_dev
npm run migrate --prefix apps/backend
npm run seed-plans --prefix apps/backend
npm run build:web                 # the backend serves react/
PORT=8180 npm run dev:backend     # http://localhost:8180
```

For hot reload, run `VITE_BACKEND_URL=http://localhost:8180 npm run dev:web`
in a second terminal. Desktop: `npm ci --prefix apps/open-trade && npm run dev --prefix apps/open-trade`.

**Tests.** `npm run typecheck`, `npm run test:web`, `npm run test:release`,
`npm run validate:blueprint`, `npm run docs:check`; backend suites need a
disposable database: `TEST_BACKEND_URL=… DATABASE_URL=postgres://…/openfund_test npm run test:backend`.
Never point tests at a database you care about.
[Testing guide](docs/development/TESTING.md) · [Local development](docs/development/LOCAL_DEVELOPMENT.md) · [Engineering reference](docs/development/ENGINEERING_REFERENCE.md)

## Versioning and releases

| | Versioning | Where |
| --- | --- | --- |
| **Web platform** | `vMAJOR.MINOR.PATCH` tags allocated from Conventional Commits; an owner-approved manual dispatch may choose the patch inside a newly allocated line (e.g. v0.6.5) | [Releases](https://github.com/algomanlife/openfund/releases) · [runbook](docs/deployment/RELEASES.md) |
| **Open Trade desktop** | Independent version (0.0.2); pre-release tags `open-trade-vX.Y.Z` | [0.0.2 preparation](docs/releases/open-trade-0.0.2.md) |

`/version` returns the deployed version, the exact commit and whether the build
is an official release. Render and Liara deploy independently from the same
tagged commit; merging does not deploy either.

```bash
curl -s https://openfi.cloud/version
```

## Roadmap

The [roadmap](ROADMAP.md) lists seven phases ordered by dependency, each tied
to milestones with acceptance criteria in the
[milestone register](docs/roadmap/MILESTONES.md). The website Roadmap page
mirrors it. The owner's product roadmap will be added there; no dates or
completion percentages are published before then.

## License

**No first-party license has been chosen yet.** Openfund's own code is
therefore all rights reserved: the repository is public for transparency, but
that does not grant a right to copy, modify or redistribute it. The options,
their consequences and the blockers are prepared for the owner in the
[license decision](docs/legal/LICENSE_DECISION.md).

Third-party components keep their own terms (full list in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)):

| Component | License | Note |
| --- | --- | --- |
| Vela | Apache-2.0 + NOTICE | Visible "Vela" attribution on chart screens |
| PineTS, Vela Pine addon | AGPL-3.0-only | Shipped in the web bundle; source-offer obligations under review ([report](docs/legal/PINETS.md)) |
| drkxbt/whales, drkxbt/charts | MIT | Logic adapted for Trade Radar and Heatmap ([provenance](third_party/drkxbt-whales/PROVENANCE.md)) |
| LuxAlgo journal-core, Gains SDK | MIT | Vendored with notices |
| MetaMask SDK | ConsenSys licence | Notice shipped; commercial-use terms under review |
| Directus | BSL 1.1 (11.17.4) | Separate service, not redistributed |
| Openfund Protocol (dormant) | GPL-2.0 | Not built or shipped |
| Irancell-derived fonts, Pine indicators | **Unresolved** | Provenance needed before any license decision |

[Licensing report](docs/legal/LICENSING.md) · [Dependency licenses](docs/legal/DEPENDENCY_LICENSES.md)

## Contributing and security

Contributions are welcome — start with [CONTRIBUTING.md](CONTRIBUTING.md):

1. Branch from `main` (`feature/…`, `fix/…`; agents use `agent/<name>/<task>`).
2. Use Conventional Commits; keep changes scoped; update docs, the feature
   register and the changelog with the code.
3. Run the checks above; open a pull request using the template — it lists
   tests, risks and screenshots, and CI enforces it.
4. Required checks must pass; merging does not deploy.

Until a license is chosen, the terms for accepting contributions are also an
open owner decision; the maintainer may ask you to confirm you have the right
to submit your work ([CONTRIBUTING.md](CONTRIBUTING.md)).

| | |
| --- | --- |
| Security vulnerabilities | Report **privately** via [SECURITY.md](SECURITY.md) — never in a public issue |
| Questions | [SUPPORT.md](SUPPORT.md) |
| Conduct | [Code of conduct](CODE_OF_CONDUCT.md) |
| Review and release authority | [Repository governance](docs/development/REPOSITORY_GOVERNANCE.md) |
| Coding agents | [AGENTS.md](AGENTS.md) |

<div align="center">

<img src="docs/assets/brand/mark.svg" alt="Openfund mark" width="32" />

[openfi.cloud](https://openfi.cloud) · [openfund.cloud](https://openfund.cloud) · [Releases](https://github.com/algomanlife/openfund/releases) · [Changelog](CHANGELOG.md)

</div>
