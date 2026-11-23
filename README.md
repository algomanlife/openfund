<div align="center">

<img src="docs/assets/graphics/hero.svg" width="100%" alt="Openfund — A clearer way forward: Prop Trading, Perpetual Trading, shared terminal and planned Protocol" />

# Openfund

**A clearer way forward** — an open-development prop trading firm and trading technology platform.

[![Latest release](https://img.shields.io/github/v/release/algomanlife/openfund?label=release&color=82e7bd&labelColor=060808)](https://github.com/algomanlife/openfund/releases/latest)
[![Deployed version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fopenfi.cloud%2Fversion&query=%24.version&label=deployed&color=82e7bd&labelColor=060808)](https://openfi.cloud/version)
[![CI](https://github.com/algomanlife/openfund/actions/workflows/ci.yml/badge.svg)](https://github.com/algomanlife/openfund/actions/workflows/ci.yml)
[![Security scans](https://github.com/algomanlife/openfund/actions/workflows/security.yml/badge.svg)](https://github.com/algomanlife/openfund/actions/workflows/security.yml)
[![Languages](https://img.shields.io/badge/languages-fa%20%C2%B7%20ar%20%C2%B7%20en%20%C2%B7%20ru%20%C2%B7%20zh--CN-82e7bd?labelColor=060808)](#regions)
[![Regions](https://img.shields.io/badge/regions-GLOBAL%20%C2%B7%20IRAN-82e7bd?labelColor=060808)](#regions)
![License: decision pending](https://img.shields.io/badge/license-decision%20pending-C6FF52?labelColor=060808)

[**Website**](https://openfi.cloud) · [Iran site](https://openfi.live) · [Documentation](docs/README.md) · [Live status](docs/status/README.md) · [Roadmap](ROADMAP.md) · [Changelog](CHANGELOG.md) · [Security](SECURITY.md)

</div>

<a name="overview"></a>

## <img src="docs/assets/readme/icons/compass.svg" width="30" height="30" alt="compass icon" /> Project overview

Openfund is an open-development prop trading firm and trading technology
platform: simulated trading evaluations, funded programs, trader rewards and
published financial transparency, built in a public repository so every rule
can be checked. Start with the [documentation index](docs/README.md).

<!-- stats -->

<img src="docs/assets/readme/stats.svg" width="100%" alt="Openfund at a glance: latest release, products, capability groups, languages, regions, apps and packages" />

<!-- /stats -->

- **Prop trading evaluation.** Traders buy a challenge, trade a simulated
  account under published rules, and the server — never the browser —
  evaluates every rule from a frozen snapshot.
- **One professional terminal.** Prop and Perpetual share one workspace: Vela
  charts with Openfund Pine indicators, order panel with risk preview,
  positions, portfolio and a trade journal.
- **Read-only market intelligence.** Trade Radar, the Market Heatmap and Hybrid
  Footprint read public market data and never touch orders or accounts.
- **Transparency.** Rules, prices, the revenue model, partner commissions and
  governance limits are published; economic figures come only from
  operational records.

Openfund is early-stage. Nothing here claims revenue, user numbers, funding,
partnerships or regulatory approval.

**Jump to**

<!-- toc -->

<table>
<tr><td><a href="#overview"><img src="docs/assets/readme/icons/compass.svg" width="18" height="18" alt="compass icon" />&nbsp;Project overview</a></td><td><a href="#ecosystem"><img src="docs/assets/readme/icons/apps.svg" width="18" height="18" alt="apps icon" />&nbsp;Product ecosystem</a></td><td><a href="#features"><img src="docs/assets/readme/icons/sparkles.svg" width="18" height="18" alt="sparkles icon" />&nbsp;Features</a></td></tr>
<tr><td><a href="#regions"><img src="docs/assets/readme/icons/globe.svg" width="18" height="18" alt="globe icon" />&nbsp;Languages and regions</a></td><td><a href="#status"><img src="docs/assets/readme/icons/pulse.svg" width="18" height="18" alt="pulse icon" />&nbsp;Feature status</a></td><td><a href="#gallery"><img src="docs/assets/readme/icons/photo.svg" width="18" height="18" alt="photo icon" />&nbsp;Product gallery</a></td></tr>
<tr><td><a href="#business"><img src="docs/assets/readme/icons/coins.svg" width="18" height="18" alt="coins icon" />&nbsp;Business model</a></td><td><a href="#architecture"><img src="docs/assets/readme/icons/topology.svg" width="18" height="18" alt="topology icon" />&nbsp;Technical architecture</a></td><td><a href="#structure"><img src="docs/assets/readme/icons/folder.svg" width="18" height="18" alt="folder icon" />&nbsp;Repository structure</a></td></tr>
<tr><td><a href="#stack"><img src="docs/assets/readme/icons/layers.svg" width="18" height="18" alt="layers icon" />&nbsp;Technology stack</a></td><td><a href="#development"><img src="docs/assets/readme/icons/terminal.svg" width="18" height="18" alt="terminal icon" />&nbsp;Development workflow</a></td><td><a href="#releases"><img src="docs/assets/readme/icons/tag.svg" width="18" height="18" alt="tag icon" />&nbsp;Versioning and releases</a></td></tr>
<tr><td><a href="#roadmap"><img src="docs/assets/readme/icons/route.svg" width="18" height="18" alt="route icon" />&nbsp;Roadmap</a></td><td><a href="#security"><img src="docs/assets/readme/icons/shield.svg" width="18" height="18" alt="shield icon" />&nbsp;Security</a></td><td><a href="#docs"><img src="docs/assets/readme/icons/book.svg" width="18" height="18" alt="book icon" />&nbsp;Documentation map</a></td></tr>
<tr><td><a href="#license"><img src="docs/assets/readme/icons/license.svg" width="18" height="18" alt="license icon" />&nbsp;License</a></td><td><a href="#retired"><img src="docs/assets/readme/icons/archive.svg" width="18" height="18" alt="archive icon" />&nbsp;Retired and no longer used</a></td><td><a href="#contributing"><img src="docs/assets/readme/icons/users.svg" width="18" height="18" alt="users icon" />&nbsp;Contributing</a></td></tr>
</table>

<!-- /toc -->

<a name="ecosystem"></a>

## <img src="docs/assets/readme/icons/apps.svg" width="30" height="30" alt="apps icon" /> Product ecosystem

Every product shares one wallet identity and one backend, while Prop and
Perpetual keep separate accounts, orders and financial records. Each card
links to the document that owns its detail; the full walk-through is the
[platform tour](docs/product/PLATFORM_TOUR.md).

<!-- products -->

<p align="center">
<img src="docs/assets/graphics/ecosystem.svg" width="100%" alt="Openfund ecosystem: discovery and identity, Prop and Perpetual products, shared terminal and planned Protocol" />
</p>

<p align="center">
<a href="https://openfi.cloud"><img src="docs/assets/readme/products/website.svg" width="49%" alt="Website — Challenges, markets, rulebook, economy, governance and learning in five languages." /></a>
<a href="docs/trading/TERMINAL.md"><img src="docs/assets/readme/products/terminal.svg" width="49%" alt="Web Terminal — One trading workspace for Prop and Perpetual with separate accounts and records." /></a>
<a href="docs/integrations/HYPERLIQUID_RADAR.md"><img src="docs/assets/readme/products/intelligence.svg" width="49%" alt="Market intelligence — Trade Radar, Market Heatmap and Hybrid Footprint built on public market data." /></a>
<a href="docs/website/WEBSITE_EXPANSION.md"><img src="docs/assets/readme/products/tools.svg" width="49%" alt="Tools Center — Ten browser-side calculators for sizing, risk, funding and journal review." /></a>
<a href="apps/open-trade/README.md"><img src="docs/assets/readme/products/open-trade.svg" width="49%" alt="Open Trade — Lightweight Electron desktop workspace with one to four independent Vela charts." /></a>
<a href="docs/backstage/OPERATIONS_GUIDE.md"><img src="docs/assets/readme/products/backstage.svg" width="49%" alt="Backstage — Bilingual owner console for Prop business operations and website content." /></a>
<a href="docs/product/PLATFORM_TOUR.md"><img src="docs/assets/readme/products/certificates.svg" width="49%" alt="Certificates — Purchase, completion and payout certificates derived from recorded evidence." /></a>
<a href="packages/openfund-protocol/PROVENANCE.md"><img src="docs/assets/readme/products/protocol.svg" width="49%" alt="Openfund Protocol — Planned venue aggregation and routing; today a dormant imported code base." /></a>
</p>

<!-- /products -->

<a name="features"></a>

## <img src="docs/assets/readme/icons/sparkles.svg" width="30" height="30" alt="sparkles icon" /> Features

What a trader, a learner and the owner can do today, grouped by area. The
complete capability list is in [capabilities](docs/product/CAPABILITIES.md) and
per-capability evidence is in the feature register below.

<!-- features -->

<table>
<tr><td width="50%" valign="top"><img src="docs/assets/readme/icons/candles.svg" width="26" height="26" alt="candles icon" />&nbsp;<b><a href="docs/trading/TERMINAL.md">Trading workspace</a></b><ul><li>Dashboard, accounts, balances and challenge progress</li><li>Market, limit and stop orders with risk preview</li><li>Chart protection: SL/TP handles and P/L zones</li><li>Collateral, quantity and lot sizing conventions</li></ul></td><td width="50%" valign="top"><img src="docs/assets/readme/icons/notebook.svg" width="26" height="26" alt="notebook icon" />&nbsp;<b><a href="docs/trading/JOURNAL_METRICS.md">Journal and analytics</a></b><ul><li>Daily journal, notebook, playbooks and missed trades</li><li>Net PnL, win rate, profit factor, drawdown</li><li>Edge Score v2 and calendar performance</li><li>Account-scoped notes with safe import</li></ul></td></tr>
<tr><td width="50%" valign="top"><img src="docs/assets/readme/icons/layers.svg" width="26" height="26" alt="layers icon" />&nbsp;<b><a href="docs/trading/INDICATORS.md">Charts and Pine indicators</a></b><ul><li>Vela charts with the official Pine addon</li><li>Open Algo V5, Price Action Concepts, Smart Money Concepts</li><li>Original Pine sources run in a worker</li><li>Settings scoped by product and wallet</li></ul></td><td width="50%" valign="top"><img src="docs/assets/readme/icons/footprint.svg" width="26" height="26" alt="footprint icon" />&nbsp;<b><a href="docs/integrations/FOOTPRINT.md">Hybrid Footprint</a></b><ul><li>Bid/ask ladder and profiles</li><li>Volume and delta profiles, absolute delta</li><li>POC, value area and imbalances</li><li>Gains candles stay unchanged</li></ul></td></tr>
<tr><td width="50%" valign="top"><img src="docs/assets/readme/icons/radar.svg" width="26" height="26" alt="radar icon" />&nbsp;<b><a href="docs/integrations/HYPERLIQUID_RADAR.md">Trade Radar</a></b><ul><li>Live large-trade tape from $10K to $1M</li><li>Leaderboards and long/short positioning</li><li>Whale positions and wallet profiles</li><li>Stale data is marked, never hidden</li></ul></td><td width="50%" valign="top"><img src="docs/assets/readme/icons/heatmap.svg" width="26" height="26" alt="heatmap icon" />&nbsp;<b><a href="docs/integrations/HYPERLIQUID_RADAR.md">Market Heatmap</a></b><ul><li>Area by 24h volume or open interest</li><li>Color by 24h change or hourly funding</li><li>Drill-down, search and proportional +N tiles</li><li>Jump from a tile into the chart</li></ul></td></tr>
<tr><td width="50%" valign="top"><img src="docs/assets/readme/icons/calculator.svg" width="26" height="26" alt="calculator icon" />&nbsp;<b><a href="docs/website/WEBSITE_EXPANSION.md">Tools Center</a></b><ul><li>Position size, leverage/margin, liquidation</li><li>Perp PnL, funding rate, risk/reward</li><li>Risk of ruin, prop drawdown, consistency rule</li><li>Journal analyzer in the browser</li></ul></td><td width="50%" valign="top"><img src="docs/assets/readme/icons/school.svg" width="26" height="26" alt="school icon" />&nbsp;<b><a href="docs/website/WEBSITE_EXPANSION.md">Learning center</a></b><ul><li>Learning paths and lessons</li><li>Searchable glossary</li><li>FAQ hub, rulebook and whitepaper</li><li>Tools link to the matching lessons</li></ul></td></tr>
<tr><td width="50%" valign="top"><img src="docs/assets/readme/icons/wallet.svg" width="26" height="26" alt="wallet icon" />&nbsp;<b><a href="docs/wallet/IDENTITY.md">Wallet identity</a></b><ul><li>Sign-In with Ethereum on Arbitrum One</li><li>Server-side HttpOnly sessions</li><li>Every record scoped to its owner</li><li>Product switch clears the previous view</li></ul></td><td width="50%" valign="top"><img src="docs/assets/readme/icons/bolt.svg" width="26" height="26" alt="bolt icon" />&nbsp;<b><a href="docs/payments/ORDER_LIFECYCLE.md">Payments</a></b><ul><li>Pay with Wallet and manual transfer</li><li>On-chain verification of token, amount and finality</li><li>Ledger with partial payments and refunds</li><li>Exactly-once challenge activation</li></ul></td></tr>
<tr><td width="50%" valign="top"><img src="docs/assets/readme/icons/compass.svg" width="26" height="26" alt="compass icon" />&nbsp;<b><a href="docs/decisions/0052-site-search.md">Site search</a></b><ul><li>Command palette with Ctrl/⌘+K and /, in five locales</li><li>Persian and Arabic normalization, typo tolerance and synonyms</li><li>Published content only, one index per region</li><li>Anonymous search analytics in Backstage</li></ul></td><td width="50%" valign="top"><img src="docs/assets/readme/icons/route.svg" width="26" height="26" alt="route icon" />&nbsp;<b><a href="docs/decisions/0051-migration-to-openfund.md">Migration to Openfund</a></b><ul><li>Proof of payouts reviewed with KYC</li><li>Single-use pass: normal price, funded-stage start</li><li>Private, encrypted evidence storage with retention</li><li>Editable firm list and rules</li></ul></td></tr>
<tr><td width="50%" valign="top"><img src="docs/assets/readme/icons/award.svg" width="26" height="26" alt="award icon" />&nbsp;<b><a href="docs/decisions/0050-openfund-premium-league.md">Openfund Premium League</a></b><ul><li>30-day demo competition with daily, maximum-loss and consistency rules</li><li>Email-verified registration, one entry per wallet</li><li>Frozen standings, owner-gated awards and review signals</li><li>Original prize artwork and rank badges</li></ul></td><td width="50%" valign="top"><img src="docs/assets/readme/icons/sliders.svg" width="26" height="26" alt="sliders icon" />&nbsp;<b><a href="docs/backstage/OPERATIONS_GUIDE.md">Backstage operations</a></b><ul><li>Final-pass review and suspension decisions</li><li>Payment investigation, coupons, payouts</li><li>Partners, finance, risk board and audit</li><li>Owner re-authentication for privileged actions</li></ul></td></tr>
<tr><td width="50%" valign="top"><img src="docs/assets/readme/icons/edit.svg" width="26" height="26" alt="edit icon" />&nbsp;<b><a href="docs/backstage/UNIVERSAL_VISUAL_EDITING.md">Editorial CMS</a></b><ul><li>Directus owns public editorial copy</li><li>Visual editing mapped to collection and field</li><li>Draft previews stay inside the editor</li><li>Financial collections are never editable</li></ul></td></tr>
</table>

<!-- /features -->

<a name="regions"></a>

## <img src="docs/assets/readme/icons/globe.svg" width="30" height="30" alt="globe icon" /> Languages and regions

One reviewed source serves two independently operated regions in five
interface languages. Every page lives under an explicit locale path
(`/fa/home`, `/zh-CN/markets`, …) with `hreflang` alternates. The country
signal never decides authorization, payments or account access
([ADR 0043](docs/decisions/0043-canonical-domains-geo-routing-and-locale.md)).

<!-- regions -->

<img src="docs/assets/readme/regions.svg" width="100%" alt="Five interface languages and two operating regions" />

**Which language a visitor sees**

1. A locale in the URL always wins.
2. Otherwise the language the visitor picked in the menu.
3. Otherwise a first-visit default from the visitor's verified country.
4. Otherwise English. Choosing a language never changes the region.

<!-- /regions -->

<a name="status"></a>

## <img src="docs/assets/readme/icons/pulse.svg" width="30" height="30" alt="pulse icon" /> Feature status

Runtime state per region is generated from
[docs/status/status.json](docs/status/status.json); the
[feature register](docs/product/FEATURE_STATUS.md) holds per-capability
evidence. A merge is not production until `/version` reports it.

<!-- status:summary -->

**Current status** (verified 2026-11-21; canonical: [docs/status](docs/status/README.md)):

- Latest official release: **v0.8.0** (`0320cf7`, 2026-11-20).
- GLOBAL (Render) Web/API runs v0.8.0 `0320cf7`; IRAN (Liara) web runs v0.6.5 `a87804a` (built as unofficial).
- Purchases: enabled in GLOBAL, disabled in IRAN; owner purchase acceptance open (see the purchases row in docs/status).
- Live execution: disabled (Approved signer/custody design, supported testnet contracts, simulation, security review and management activation).
- Desktop: Open Trade 0.0.4 published as the GitHub pre-release open-trade-v0.0.4 (unsigned experimental beta): macOS arm64 and x64 .dmg, Windows x64 .exe, Linux x64 AppImage and .deb from Open Trade desktop run 44895436607 on main 935d06f. All five files downloaded on 2026-11-21; each SHA-256 recomputed and matched GitHub's asset digest, sizes match. The attached SHA256SUMS.txt lists only the Windows installer. Not signed or notarized; not executed on a clean machine in this verification.

<!-- /status:summary -->

Full per-region table: [docs/status](docs/status/README.md).

<a name="gallery"></a>

## <img src="docs/assets/readme/icons/photo.svg" width="30" height="30" alt="photo icon" /> Product gallery

Genuine captures of the website, terminal, market intelligence, Backstage,
desktop and mobile layouts. Every image has recorded provenance.

<!-- gallery -->

| Website — Persian (Dastkhat) | Website — Arabic (Dastkhat Arabic) |
| --- | --- |
| ![Persian challenges page rendered in Dastkhat (local build, recorded 2026-11-20)](docs/assets/screenshots/typography/typography-site-fa.png) | ![Arabic challenges page: Arabic letters in Dastkhat Arabic, digits and Latin in Ubuntu (local build, recorded 2026-11-20)](docs/assets/screenshots/typography/typography-site-ar.png) |

| Web Terminal — English | Web Terminal — Persian |
| --- | --- |
| ![English Prop trading workspace (anonymous, recorded 2026-11-03)](docs/assets/screenshots/refinement-terminal-prop-en-dark.png) | ![Persian terminal in Dastkhat while the market connection loads (local build, recorded 2026-11-20)](docs/assets/screenshots/typography/typography-terminal-fa.png) |

| Market intelligence — Market Heatmap | Market intelligence — Trade Radar |
| --- | --- |
| ![Perpetual-market Heatmap with proportional +N tiles (recorded 2026-11-18)](docs/assets/screenshots/heatmap-radar/heatmap-en-1440.png) | ![Trade Radar table using deterministic intercepted tape for UI evidence, not live trades (recorded 2026-11-18)](docs/assets/screenshots/heatmap-radar/radar-en-1440.png) |

| Backstage — English overview | Backstage — Persian sign-in |
| --- | --- |
| ![Backstage English overview from the local browser acceptance run (recorded 2026-11-16)](docs/assets/screenshots/backstage-operations/backstage-overview-en.png) | ![Backstage Persian sign-in in Dastkhat, before authentication (recorded 2026-11-20)](docs/assets/screenshots/typography/typography-backstage-fa.png) |

| Desktop and order flow — Open Trade — four charts | Desktop and order flow — Hybrid Footprint |
| --- | --- |
| ![Open Trade 0.0.2 with four independent Vela charts (macOS, recorded 2026-11-15)](docs/assets/screenshots/open-trade-0.0.2/four-charts.png) | ![Footprint Bid/Ask Ladder beside unchanged Gains candles (repository capture)](docs/assets/screenshots/footprint/style-bidAskLadder-1440.png) |

| Mobile — Persian terminal | Mobile — English navigation |
| --- | --- |
| <img src="docs/assets/screenshots/responsive-matrix/2026-11-20/after/prop-trade-fa-dark-390.png" alt="Persian mobile terminal at 390 px, backend unavailable (recorded 2026-11-20)" width="260" /> | <img src="docs/assets/screenshots/responsive-matrix/2026-11-20/after/markets-en-light-375-drawer.png" alt="English mobile navigation drawer in light theme (recorded 2026-11-20)" width="260" /> |

Curated from [docs/assets/gallery/gallery.json](docs/assets/gallery/gallery.json); provenance per image in the
[screenshot manifest](docs/assets/screenshots/manifest.json); older capture sets are [archived](docs/reviews/_archive/readme-galleries/README.md).

<!-- /gallery -->

<a name="business"></a>

## <img src="docs/assets/readme/icons/coins.svg" width="30" height="30" alt="coins icon" /> Business model

Openfund sells one-time evaluation fees for simulated challenge accounts.
Prices come from the CMS plan catalog and the server prices every order;
current fees are published in the [plan catalog](https://openfi.cloud/purchases/plans).
A paid order activates exactly one challenge account after on-chain
verification of token, receiver, sender, amount and finality.

<!-- business -->

<img src="docs/assets/readme/lifecycle.svg" width="100%" alt="Challenge lifecycle: Choose a plan, Pay on-chain, Simulated evaluation, Pass and certify, Funded rewards" />

| Revenue | Costs |
| --- | --- |
| One-time evaluation fees for simulated challenge accounts | Trader rewards under published plan rules |
|  | Ambassador commissions |
|  | Coach compensation once live trading exists |
|  | Refunds and infrastructure |

<!-- /business -->

Treasury and funded-reward policies are versioned, and frozen terms are never
silently rewritten. No revenue, profitability or growth figures have been
published. The approved model is [ECONOMY.md](ECONOMY.md); pricing tables,
lifecycles, reward splits, treasury allocation and partner programs are in
[business model in detail](docs/economy/BUSINESS_DETAIL.md) and the
[business overview](docs/economy/BUSINESS_MODEL.md).

<a name="architecture"></a>

## <img src="docs/assets/readme/icons/topology.svg" width="30" height="30" alt="topology icon" /> Technical architecture

One reviewed source serves two independently operated regions; each runs the
API and web app from one origin so session cookies stay first-party.

```mermaid
flowchart TB
  subgraph Client["Browser / Open Trade desktop"]
    Web["React app · website + terminal"]
    Wallet["Wallet (SIWE)"]
  end
  subgraph Global["GLOBAL — Render"]
    API["Node.js API + SPA · engine · evaluation · purchases"]
    CMS["Directus"]
    DB[("PostgreSQL")]
    BS["Backstage · owner console"]
  end
  subgraph Iran["IRAN — Liara"]
    APIIR["Same release · regional runtime"]
    DBIR[("PostgreSQL")]
  end
  Gains["Gains Network · markets and prices"]
  HL["Hyperliquid public API · read-only analytics"]
  Web -->|REST, SSE| API
  Wallet -->|signature| API
  BS -->|server-side credential| API
  API --> DB
  CMS --> DB
  API --> Gains
  API --> HL
  APIIR --> DBIR
  API <-.->|"signed sync · one home region per account"| APIIR
```

| Principle | What it means |
| --- | --- |
| Server authority | Orders, positions, PnL, evaluation and payments are decided only by the backend |
| Read-only analytics | Radar, Heatmap and Footprint cannot mutate accounts, trading or payments |
| Content isolation | Directus never writes financial tables |
| One origin per region | API and SPA share an origin; cookies stay first-party |

Details: [architecture](docs/architecture/ARCHITECTURE.md) ·
[infrastructure, test map and security controls](docs/architecture/PLATFORM_REFERENCE.md) ·
[flows](docs/architecture/FLOWS.md).

<a name="structure"></a>

## <img src="docs/assets/readme/icons/folder.svg" width="30" height="30" alt="folder icon" /> Repository structure

A map of every application, package and top-level directory. CI fails when a
directory is added or removed without updating this map. Engineering detail
for each part is in the [engineering reference](docs/development/ENGINEERING_REFERENCE.md).

<!-- structure -->

<img src="docs/assets/readme/structure.svg" width="100%" alt="Repository structure by group: applications, packages, content and assets, delivery and tooling, upstream" />

<details>
<summary>Repository map as a table</summary>

| | Path | Responsibility |
| --- | --- | --- |
| <img src="docs/assets/readme/icons/apps.svg" width="18" height="18" alt="apps icon" /> | `apps/web-react/` | Website, shared Web Terminal, wallet UI, tools, CMS adapters, locales |
| <img src="docs/assets/readme/icons/apps.svg" width="18" height="18" alt="apps icon" /> | `apps/backend/` | API, sessions, Prop engine and evaluation, payments, rewards, migrations |
| <img src="docs/assets/readme/icons/apps.svg" width="18" height="18" alt="apps icon" /> | `apps/open-trade/` | Open Trade Electron desktop app, packaging and acceptance |
| <img src="docs/assets/readme/icons/apps.svg" width="18" height="18" alt="apps icon" /> | `apps/backstage/` | Owner operations console plus Directus schema utilities |
| <img src="docs/assets/readme/icons/apps.svg" width="18" height="18" alt="apps icon" /> | `apps/terminal/` | Ownership boundary for the terminal (no separate service) |
| <img src="docs/assets/readme/icons/apps.svg" width="18" height="18" alt="apps icon" /> | `apps/web/` | Ownership boundary for the public web (not deployed alone) |
| <img src="docs/assets/readme/icons/package.svg" width="18" height="18" alt="package icon" /> | `packages/openfund-charts/` | Vela bridge and Pine indicator integration |
| <img src="docs/assets/readme/icons/package.svg" width="18" height="18" alt="package icon" /> | `packages/openfund-gains-adapter/` | Gains market, candle and stream provider |
| <img src="docs/assets/readme/icons/package.svg" width="18" height="18" alt="package icon" /> | `packages/openfund-footprint/` | Order-flow aggregation and chart plugin |
| <img src="docs/assets/readme/icons/package.svg" width="18" height="18" alt="package icon" /> | `packages/cms-client/` | Typed contract between the app and Directus |
| <img src="docs/assets/readme/icons/package.svg" width="18" height="18" alt="package icon" /> | `packages/openfund-ui/` | Planned shared component library |
| <img src="docs/assets/readme/icons/package.svg" width="18" height="18" alt="package icon" /> | `packages/plan-validation/` | Challenge plan rules shared by the site and the backend |
| <img src="docs/assets/readme/icons/package.svg" width="18" height="18" alt="package icon" /> | `packages/site-search/` | Search normalization, matching and query masking shared by the site and the backend |
| <img src="docs/assets/readme/icons/package.svg" width="18" height="18" alt="package icon" /> | `packages/openfund-protocol/` | Dormant protocol source and provenance |
| <img src="docs/assets/readme/icons/book.svg" width="18" height="18" alt="book icon" /> | `docs/` | Documentation, ADRs, status, README data and assets |
| <img src="docs/assets/readme/icons/book.svg" width="18" height="18" alt="book icon" /> | `brand/` | Brand book, logos, imagery and typography reference |
| <img src="docs/assets/readme/icons/book.svg" width="18" height="18" alt="book icon" /> | `indicators/` | Three Openfund Pine indicators and two libraries |
| <img src="docs/assets/readme/icons/book.svg" width="18" height="18" alt="book icon" /> | `dist/` | Tracked source-critical compatibility assets |
| <img src="docs/assets/readme/icons/gear.svg" width="18" height="18" alt="gear icon" /> | `.github/` | CI, release and security workflows, templates |
| <img src="docs/assets/readme/icons/gear.svg" width="18" height="18" alt="gear icon" /> | `scripts/` | Docs gates, CI, release, upstream and ops tooling |
| <img src="docs/assets/readme/icons/gear.svg" width="18" height="18" alt="gear icon" /> | `e2e/` | Browser journeys and acceptance tests |
| <img src="docs/assets/readme/icons/gear.svg" width="18" height="18" alt="gear icon" /> | `infra/` | Render, Liara, Cloudflare and Postgres infrastructure |
| <img src="docs/assets/readme/icons/gear.svg" width="18" height="18" alt="gear icon" /> | `infrastructure/` | Directus deployment configuration |
| <img src="docs/assets/readme/icons/gear.svg" width="18" height="18" alt="gear icon" /> | `src/` | Legacy wallet entry kept for the classic build |
| <img src="docs/assets/readme/icons/link.svg" width="18" height="18" alt="link icon" /> | `vendor/` | Vendored Vela and Gains SDK, preserved verbatim |
| <img src="docs/assets/readme/icons/link.svg" width="18" height="18" alt="link icon" /> | `third_party/` | Adapted MIT sources with provenance and notices |

</details>

<!-- /structure -->

<a name="stack"></a>

## <img src="docs/assets/readme/icons/layers.svg" width="30" height="30" alt="layers icon" /> Technology stack

Typography uses exactly two faces: **Ubuntu** (general/Latin) and
**Dastkhat** (the only Persian/Arabic face), self-hosted with one shared
`@font-face` file. Pinned versions are in the lockfiles and the
[tech stack](docs/architecture/TECH_STACK.md); the typography policy and
tokens are in the [design system](docs/design/DESIGN_SYSTEM.md#typography-and-font-tokens).

<!-- stack -->

<p align="center">
<img src="docs/assets/graphics/technology.svg" width="100%" alt="Openfund technology layers" />
</p>

| Layer | Technology |
| --- | --- |
| **Web** | <img src="https://img.shields.io/badge/React-19.3.1-61DAFB?style=for-the-badge&logo=react&logoColor=white&labelColor=0c1412" alt="React 19.3.1" /> <img src="https://img.shields.io/badge/TypeScript-7.0.2-3178C6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=0c1412" alt="TypeScript 7.0.2" /> <img src="https://img.shields.io/badge/Vite-8.3.8-646CFF?style=for-the-badge&logo=vite&logoColor=white&labelColor=0c1412" alt="Vite 8.3.8" /> <img src="https://img.shields.io/badge/React%20Router-7.1.0-CA4245?style=for-the-badge&logo=reactrouter&logoColor=white&labelColor=0c1412" alt="React Router 7.1.0" /> |
| **Wallet** | <img src="https://img.shields.io/badge/RainbowKit-2.2.11-7B3FE4?style=for-the-badge&logo=rainbow&logoColor=white&labelColor=0c1412" alt="RainbowKit 2.2.11" /> <img src="https://img.shields.io/badge/wagmi-2.19.5-1C1B1B?style=for-the-badge&logo=ethereum&logoColor=white&labelColor=0c1412" alt="wagmi 2.19.5" /> <img src="https://img.shields.io/badge/viem-2.57.20-FFC517?style=for-the-badge&logo=ethereum&logoColor=white&labelColor=0c1412" alt="viem 2.57.20" /> <img src="https://img.shields.io/badge/Arbitrum%20One-SIWE-28A0F0?style=for-the-badge&logo=arbitrum&logoColor=white&labelColor=0c1412" alt="Arbitrum One SIWE" /> |
| **Charts and data** | <img src="https://img.shields.io/badge/Vela-0.10.6-82E7BD?style=for-the-badge&logo=tradingview&logoColor=white&labelColor=0c1412" alt="Vela 0.10.6" /> <img src="https://img.shields.io/badge/Vela%20Pine%20addon-0.3.4-82E7BD?style=for-the-badge&logo=tradingview&logoColor=white&labelColor=0c1412" alt="Vela Pine addon 0.3.4" /> <img src="https://img.shields.io/badge/PineTS-0.13.1-82E7BD?style=for-the-badge&logo=tradingview&logoColor=white&labelColor=0c1412" alt="PineTS 0.13.1" /> <img src="https://img.shields.io/badge/Gains%20Network-API-82E7BD?style=for-the-badge&logo=ethereum&logoColor=white&labelColor=0c1412" alt="Gains Network API" /> <img src="https://img.shields.io/badge/Hyperliquid-public%20API-82E7BD?style=for-the-badge&logo=liquibase&logoColor=white&labelColor=0c1412" alt="Hyperliquid public API" /> |
| **Backend** | <img src="https://img.shields.io/badge/Node.js-26-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white&labelColor=0c1412" alt="Node.js 26" /> <img src="https://img.shields.io/badge/Express-5.3.0-FFFFFF?style=for-the-badge&logo=express&logoColor=white&labelColor=0c1412" alt="Express 5.3.0" /> <img src="https://img.shields.io/badge/pg-8.13.1-4169E1?style=for-the-badge&logo=postgresql&logoColor=white&labelColor=0c1412" alt="pg 8.13.1" /> <img src="https://img.shields.io/badge/decimal.js-10.6.0-F7DF1E?style=for-the-badge&logo=javascript&logoColor=white&labelColor=0c1412" alt="decimal.js 10.6.0" /> <img src="https://img.shields.io/badge/ws-8.23.0-FFFFFF?style=for-the-badge&logo=socketdotio&logoColor=white&labelColor=0c1412" alt="ws 8.23.0" /> |
| **Data** | <img src="https://img.shields.io/badge/PostgreSQL-17-4169E1?style=for-the-badge&logo=postgresql&logoColor=white&labelColor=0c1412" alt="PostgreSQL 17" /> <img src="https://img.shields.io/badge/Directus-11.17.4-6644FF?style=for-the-badge&logo=directus&logoColor=white&labelColor=0c1412" alt="Directus 11.17.4" /> |
| **Desktop** | <img src="https://img.shields.io/badge/Electron-45.3.2-47848F?style=for-the-badge&logo=electron&logoColor=white&labelColor=0c1412" alt="Electron 45.3.2" /> <img src="https://img.shields.io/badge/electron--builder-26.18.0-47848F?style=for-the-badge&logo=electron&logoColor=white&labelColor=0c1412" alt="electron-builder 26.18.0" /> |
| **Delivery** | <img src="https://img.shields.io/badge/GitHub%20Actions-CI-2088FF?style=for-the-badge&logo=githubactions&logoColor=white&labelColor=0c1412" alt="GitHub Actions CI" /> <img src="https://img.shields.io/badge/Render-GLOBAL-46E3B7?style=for-the-badge&logo=render&logoColor=white&labelColor=0c1412" alt="Render GLOBAL" /> <img src="https://img.shields.io/badge/Liara-IRAN-2496ED?style=for-the-badge&logo=docker&logoColor=white&labelColor=0c1412" alt="Liara IRAN" /> <img src="https://img.shields.io/badge/Cloudflare-edge-F38020?style=for-the-badge&logo=cloudflare&logoColor=white&labelColor=0c1412" alt="Cloudflare edge" /> |
| **Typography** | <img src="https://img.shields.io/badge/Ubuntu-Latin-E95420?style=for-the-badge&logo=ubuntu&logoColor=white&labelColor=0c1412" alt="Ubuntu Latin" /> <img src="https://img.shields.io/badge/Dastkhat-Persian%2FArabic-82E7BD?style=for-the-badge&logo=googlefonts&logoColor=white&labelColor=0c1412" alt="Dastkhat Persian/Arabic" /> |

Versions are read from the package manifests when the README is generated.

<!-- /stack -->

<a name="development"></a>

## <img src="docs/assets/readme/icons/terminal.svg" width="30" height="30" alt="terminal icon" /> Development workflow

Requires Node.js 26 and a local PostgreSQL.

```bash
npm ci && npm ci --include=dev --prefix apps/web-react && npm ci --prefix apps/backend
createdb openfund_dev && export DATABASE_URL=postgresql://localhost:5432/openfund_dev
npm run migrate --prefix apps/backend && npm run seed-plans --prefix apps/backend
npm run build:web && PORT=8180 npm run dev:backend   # http://localhost:8180
```

| Command | What it checks |
| --- | --- |
| `npm run typecheck` | TypeScript across the web app |
| `npm run test:web` | Web unit and component tests |
| `npm run docs:check` | README contract, status, retired registry, fonts, language, links, Markdown and Mermaid |
| `npm run docs:write` | Regenerates README headings, blocks and graphics from `docs/readme/*.json` |

Backend suites need a disposable database. Guides:
[testing](docs/development/TESTING.md) ·
[local development](docs/development/LOCAL_DEVELOPMENT.md) ·
[engineering reference](docs/development/ENGINEERING_REFERENCE.md).

<a name="releases"></a>

## <img src="docs/assets/readme/icons/tag.svg" width="30" height="30" alt="tag icon" /> Versioning and releases

The current official platform release is **v0.8.0**; **v0.9.0** (typography
consolidation, retired-file removal and repository restructure) is prepared
for the owner to publish through the release workflow.
Tags are `vMAJOR.MINOR.PATCH`, allocated from Conventional Commits; Open Trade
has its own `open-trade-vX.Y.Z` line. `/version` returns the deployed version,
commit and whether the build is official; merging deploys nothing.

[Release runbook](docs/deployment/RELEASES.md) ·
[Changelog](CHANGELOG.md) ·
[All releases](https://github.com/algomanlife/openfund/releases)

<a name="roadmap"></a>

## <img src="docs/assets/readme/icons/route.svg" width="30" height="30" alt="route icon" /> Roadmap

The roadmap is organized as seven phases. A phase advances only on evidence:
deployment needs deployed proof, commercial services need verified product and
legal facts, and protocol routing needs validated execution paths. Phase
summary: [ROADMAP.md](ROADMAP.md); milestones and acceptance gates:
[milestones](docs/roadmap/MILESTONES.md).

<!-- roadmap -->

<img src="docs/assets/readme/roadmap.svg" width="100%" alt="Roadmap phases and their states" />

| Phase | State | Scope |
| --- | --- | --- |
| 01 Platform foundation | delivered | Application, charting and market feeds |
| 02 Trading core | in progress | Simulation delivered; commercial evaluation open |
| 03 Product experience | in progress | Core views delivered; wallet acceptance open |
| 04 Production infrastructure | in progress | Config and CI delivered; deployed acceptance open |
| 05 Advanced trading | planned | Execution and authentic depth have gates |
| 06 Openfund Protocol | planned | Venue adapters, aggregation and routing |
| 07 Ecosystem expansion | planned | Integrations, developer services, scaling |

<!-- /roadmap -->

<a name="security"></a>

## <img src="docs/assets/readme/icons/shield.svg" width="30" height="30" alt="shield icon" /> Security

| Control | Implementation |
| --- | --- |
| Identity | Sign-In with Ethereum on Arbitrum One |
| Sessions | Server-side, HttpOnly cookies |
| Authorization | Every record scoped to its owner on the server |
| Payments | The chain verifier decides; the browser never does |
| Browser | Strict Content Security Policy |
| Scanning | Semgrep, Trivy, OSV-Scanner, OWASP ZAP baseline, gitleaks and dependency review in CI |

The November 2026 [self-assessment](docs/security/SECURITY-AUDIT-2026-11.md) was
written by the project's coding agent and is not an independent audit; open
findings and their states are in the
[remediation report](docs/security/SECURITY-REMEDIATION-2026-11.md).
Report vulnerabilities privately through [SECURITY.md](SECURITY.md).

<a name="docs"></a>

## <img src="docs/assets/readme/icons/book.svg" width="30" height="30" alt="book icon" /> Documentation map

Every area of the [documentation index](docs/README.md), generated from it so
new documents appear here automatically.

<!-- docs-map -->

| | Area | Start with |
| --- | --- | --- |
| <img src="docs/assets/readme/icons/apps.svg" width="20" height="20" alt="apps icon" /> | [Product and Business](docs/README.md#product-and-business) | [Platform tour](docs/product/PLATFORM_TOUR.md) · [Overview](docs/product/OVERVIEW.md) · [Vision](docs/product/VISION.md) · +5 more |
| <img src="docs/assets/readme/icons/topology.svg" width="20" height="20" alt="topology icon" /> | [Architecture](docs/README.md#architecture) | [System](docs/architecture/ARCHITECTURE.md) · [Platform reference: infrastructure, repository map, tests, security controls](docs/architecture/PLATFORM_REFERENCE.md) · [Flows](docs/architecture/FLOWS.md) · +4 more |
| <img src="docs/assets/readme/icons/browser.svg" width="20" height="20" alt="browser icon" /> | [Website](docs/README.md#website) | [Content architecture and ownership](docs/website/CONTENT_ARCHITECTURE.md) · [Product rules and launch blockers](docs/product/PRODUCT_RULES.md) · [Website expansion spec](docs/website/WEBSITE_EXPANSION.md) · +4 more |
| <img src="docs/assets/readme/icons/candles.svg" width="20" height="20" alt="candles icon" /> | [Trading](docs/README.md#trading) | [Unified accounts and Free Trial](docs/trading/UNIFIED_ACCOUNTS.md) · [Journal metrics](docs/trading/JOURNAL_METRICS.md) · [Prop Trading](docs/trading/PROP.md) · +7 more |
| <img src="docs/assets/readme/icons/coins.svg" width="20" height="20" alt="coins icon" /> | [Governance and Economy](docs/README.md#governance-and-economy) | [GOVERNANCE.md](GOVERNANCE.md) · [ECONOMY.md](ECONOMY.md) · [Operating governance: decisions, approvals and access](docs/governance/OPERATING_GOVERNANCE.md) · +4 more |
| <img src="docs/assets/readme/icons/wallet.svg" width="20" height="20" alt="wallet icon" /> | [Wallet and Identity](docs/README.md#wallet-and-identity) | [Wallet, networks and sessions](docs/wallet/IDENTITY.md) · [Authentication technical reference](docs/architecture/WALLET_AUTHENTICATION.md) |
| <img src="docs/assets/readme/icons/coins.svg" width="20" height="20" alt="coins icon" /> | [Economy and partner programs](docs/README.md#economy-and-partner-programs) | [Economy overview](docs/economy/README.md) · [Business model and operations overview](docs/economy/BUSINESS_MODEL.md) · [Business model in detail](docs/economy/BUSINESS_DETAIL.md) · +4 more |
| <img src="docs/assets/readme/icons/bolt.svg" width="20" height="20" alt="bolt icon" /> | [Payments](docs/README.md#payments) | [Payment verification and recovery](docs/payments/VERIFICATION.md) · [Payment activation checklist](docs/payments/ACTIVATION.md) · [SIWE and DePay domain check](docs/payments/DOMAIN_READINESS.md) · +7 more |
| <img src="docs/assets/readme/icons/package.svg" width="20" height="20" alt="package icon" /> | [Protocol (dormant)](docs/README.md#protocol-dormant) | [Overview](docs/protocol/OVERVIEW.md) · [Architecture](docs/protocol/ARCHITECTURE.md) · [Development](docs/protocol/DEVELOPMENT.md) · +1 more |
| <img src="docs/assets/readme/icons/link.svg" width="20" height="20" alt="link icon" /> | [Integrations](docs/README.md#integrations) | [Gains VOB and Trades](docs/integrations/GAINS_DEPTH.md) · [Trade Radar and Heatmap](docs/integrations/HYPERLIQUID_RADAR.md) · [Gains Network](docs/integrations/GAINS.md) · +19 more |
| <img src="docs/assets/readme/icons/server.svg" width="20" height="20" alt="server icon" /> | [Deployment](docs/README.md#deployment) | [Unified releases](docs/deployment/RELEASES.md) · [Release and deployment checklists](docs/deployment/CHECKLISTS.md) · [Operations and monitoring](docs/operations/README.md) · +7 more |
| <img src="docs/assets/readme/icons/terminal.svg" width="20" height="20" alt="terminal icon" /> | [Development](docs/README.md#development) | [Local setup](docs/development/LOCAL_DEVELOPMENT.md) · [Developer portal source](docs/developer-portal/README.md) · [Testing and CI](docs/development/TESTING.md) · +11 more |
| <img src="docs/assets/readme/icons/shield.svg" width="20" height="20" alt="shield icon" /> | [Security](docs/README.md#security) | [Reporting policy](SECURITY.md) · [Architecture and release gates](docs/security/SECURITY.md) · [November 2026 assessment](docs/security/SECURITY-AUDIT-2026-11.md) · +3 more |
| <img src="docs/assets/readme/icons/scale.svg" width="20" height="20" alt="scale icon" /> | [Legal](docs/README.md#legal) | [Licensing audit and compatibility report](docs/legal/LICENSING.md) · [Production dependency licenses](docs/legal/DEPENDENCY_LICENSES.md) · [PineTS (AGPL) report](docs/legal/PINETS.md) · +1 more |
| <img src="docs/assets/readme/icons/route.svg" width="20" height="20" alt="route icon" /> | [Roadmap](docs/README.md#roadmap) | [Seven-phase overview](ROADMAP.md) · [Product](docs/roadmap/PRODUCT.md) · [Engineering](docs/roadmap/ENGINEERING.md) · +2 more |
| <img src="docs/assets/readme/icons/topology.svg" width="20" height="20" alt="topology icon" /> | [Architecture Decisions](docs/README.md#architecture-decisions) | [ADR index](docs/decisions/README.md) · [Purchases, invoices and withdrawal requests](docs/decisions/0009-challenge-purchases-and-payment-verification.md) · [Gateway routing](docs/decisions/0001-product-gateway-routing.md) · +3 more |
| <img src="docs/assets/readme/icons/brush.svg" width="20" height="20" alt="brush icon" /> | [Brand, evidence and historical material](docs/README.md#brand-evidence-and-historical-material) | [Brand assets](docs/assets/brand/README.md) · [Screenshot gallery and provenance](docs/assets/screenshots/README.md) · [Asset inventory](docs/assets/README.md) · +4 more |
| <img src="docs/assets/readme/icons/archive.svg" width="20" height="20" alt="archive icon" /> | [Historical records](docs/README.md#historical-records) | [reviews and audit index](docs/reviews/README.md) · [archive](docs/reviews/_archive/README.md) · [2026-11-03 website audit](docs/reviews/website-refresh/AUDIT.md) |

<!-- /docs-map -->

<a name="license"></a>

## <img src="docs/assets/readme/icons/license.svg" width="30" height="30" alt="license icon" /> License

No first-party license has been chosen: Openfund's own code is all rights
reserved, and the repository being public grants no reuse license. The owner's
options and remaining blockers are in the
[license decision](docs/legal/LICENSE_DECISION.md) and the
[licensing report](docs/legal/LICENSING.md). Third-party components keep their
own terms:

<!-- license:summary -->

| Component | License |
| --- | --- |
| Vela charting library | Apache-2.0 + NOTICE |
| Vela Pine addon | AGPL-3.0-only |
| PineTS | AGPL-3.0-only |
| MetaMask SDK | ConsenSys proprietary license |
| LuxAlgo trade journal and journal-core | MIT |
| Trade Radar logic adapted from drkxbt/whales | MIT |
| Heatmap treemap layout adapted from drkxbt/charts | MIT |
| Gains Network SDK | MIT |
| DePay Payment Widget | MIT |
| Openfund Protocol | GPL-2.0 |
| Dastkhat, Dastkhat Arabic and Dastkhat FaNum fonts | SIL Open Font License 1.1 |
| Ubuntu font | Ubuntu Font Licence 1.0 |
| Simple Icons | CC0-1.0 |
| TradingView logo | Brand-owner terms |
| Interactive day/night toggle design | MIT |
| Public service brand assets | Brand-owner terms |
| npm packages | Per package |
| Directus | BSL 1.1 for the pinned 11.17.4 image |

Generated from [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), the authoritative list with license texts.

<!-- /license:summary -->

<a name="retired"></a>

## <img src="docs/assets/readme/icons/archive.svg" width="30" height="30" alt="archive icon" /> Retired and no longer used

<!-- retired:summary -->

| Item | Status | Replacement |
| --- | --- | --- |
| Irancell font files (`irancell-*.ttf`) and their byte-identical copies `openfund-1.ttf`–`openfund-5.ttf` | retired | Dastkhat v1.210 — [typography policy](docs/design/DESIGN_SYSTEM.md#typography-and-font-tokens) |
| Renamed Irancell derivatives "Openfund Persian" (`openfund-persian-*-v4.woff2`), Backstage `/persian.woff2`, certificate face `OpenfundCertificateFa` | retired | Dastkhat v1.210 (`/assets/fonts/dastkhat/`); certificate face `Dastkhat Certificate` |
| Standalone Vazirmatn copies (`Vazirmatn.ttf`, `Vazirmatn-LICENSE.txt`, Google Fonts `family=Vazirmatn`, `typeface="Vazirmatn"`) | retired | Dastkhat v1.210, which is based on Vazirmatn (SIL OFL 1.1) and credits it |
| Superseded platform releases v0.6.5 and v0.7.0 as the README's current release | retired | The latest official release recorded in [docs/status/status.json](docs/status/status.json) |
| Dated README galleries ("Recent … captures — YYYY-MM-DD", "Full product gallery — recorded v0.6.5", the v0.4.4 capture set in `docs/assets/screenshots/readme/`) | retired | One curated gallery generated from [docs/assets/gallery/gallery.json](docs/assets/gallery/gallery.json); the old sets are in [docs/reviews/_archive/readme-galleries/](docs/reviews/_archive/readme-galleries/README.md) |
| Superseded release review snapshots (`docs/reviews/v0.4.1`, `v0.6.5`, `release-0.6.5`, `release-0.6.6`) | retired | Kept as history under [docs/reviews/_archive/](docs/reviews/_archive/README.md); current state lives in [docs/status](docs/status/README.md) |
| Vanilla JS/CSS legacy layer (`apps/web-react/public/legacy/`) and the tracked `dist/` snapshot | legacy-only pending removal | React application (`apps/web-react/src/`); `dist/` stays source-critical until AGENTS.md says otherwise |
| Openfund Protocol (dormant import of mux-protocol, `packages/openfund-protocol/`) | dormant | None — not retired; not built, shipped or operated ([provenance](packages/openfund-protocol/PROVENANCE.md)) |

Generated from [docs/development/RETIRED.json](docs/development/RETIRED.json); details and reference counts in [RETIRED.md](docs/development/RETIRED.md).

<!-- /retired:summary -->

<a name="contributing"></a>

## <img src="docs/assets/readme/icons/users.svg" width="30" height="30" alt="users icon" /> Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md): branch from `main`, use
Conventional Commits and open a pull request using the template; required
checks must pass and merging does not deploy. Coding agents follow
[AGENTS.md](AGENTS.md).

**Every merge keeps the repository current.** A pull request that changes a
product, feature, app, package, dependency, screenshot, release or status
updates the matching file in `docs/readme/` (or `docs/status/status.json`,
`gallery.json`, `CHANGELOG.md`) and runs `npm run docs:write` in the same
pull request. CI rejects a README that is out of sync with its data, drops
below its minimums, or misses a directory, and the docs-impact gate rejects a
code change that updates no record. The full rule is the
[README structure contract](docs/development/README_STRUCTURE.md).

Questions: [SUPPORT.md](SUPPORT.md) · [Code of conduct](CODE_OF_CONDUCT.md) ·
[Repository governance](docs/development/REPOSITORY_GOVERNANCE.md).
