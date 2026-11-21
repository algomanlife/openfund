<div align="center">

<img src="docs/assets/brand/mark-mint.svg" alt="Openfund logo" width="88" />

# Openfund

**A clearer way forward**

An open-development prop trading firm and trading technology platform for
trading evaluations, funded programs, trader rewards and financial transparency.

[**openfi.cloud**](https://openfi.cloud) (global) · [**openfi.live**](https://openfi.live) (Iran) · [Documentation](docs/README.md) · [Roadmap](ROADMAP.md) · [Changelog](CHANGELOG.md)

[![Latest release](https://img.shields.io/github/v/release/algomanlife/openfund?label=release&color=82e7bd&labelColor=060808)](https://github.com/algomanlife/openfund/releases/latest)
[![Deployed version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fopenfi.cloud%2Fversion&query=%24.version&label=deployed&color=82e7bd&labelColor=060808)](https://openfi.cloud/version)
[![CI](https://github.com/algomanlife/openfund/actions/workflows/ci.yml/badge.svg)](https://github.com/algomanlife/openfund/actions/workflows/ci.yml)
[![Security scans](https://github.com/algomanlife/openfund/actions/workflows/security.yml/badge.svg)](https://github.com/algomanlife/openfund/actions/workflows/security.yml)
![License: decision pending](https://img.shields.io/badge/license-decision%20pending-C6FF52?labelColor=060808)

<br />

<img src="docs/assets/screenshots/readme/v065/home-en-desktop.jpg" alt="Openfund home: All Markets One Trading Platform, with Prop Trading Challenges and Leveraged Perpetual Trading" width="880" />

</div>

---

**Contents** · [Workspace](#trading-workspace-and-account-tools) · [Indicators and analytics](#charts-indicators-and-market-intelligence) · [Tools and learning](#tools-center-and-learning) · [Desktop](#open-trade-desktop-application) · [Overview](#project-overview) · [Products](#product-ecosystem) · [Backstage](#openfund-backstage--business-operations-console) · [Gallery](#product-gallery) · [Feature status](#feature-status) · [Languages and regions](#languages-and-regions) · [Business model](#business-model) · [Architecture](#technical-architecture) · [Technology](#technology-stack) · [Development](#development-workflow) · [Releases](#versioning-and-releases) · [Security](#security) · [License](#license) · [Docs map](#documentation-map) · [Contributing](#contributing-and-security)

<!-- status:summary -->

**Current status** (verified 2026-11-21; canonical: [docs/status](docs/status/README.md)):

- Latest official release: **v0.8.0** (`0320cf7`, 2026-11-20).
- GLOBAL (Render) Web/API runs v0.8.0 `0320cf7`; IRAN (Liara) web runs v0.6.5 `a87804a` (built as unofficial).
- Purchases: enabled in GLOBAL, disabled in IRAN; owner purchase acceptance open (see the purchases row in docs/status).
- Live execution: disabled (Approved signer/custody design, supported testnet contracts, simulation, security review and management activation).
- Desktop: 0.0.3 candidate merged (#171); internal unsigned builds, UI acceptance and integrity checks passed on all four CI targets. macOS x64 installer upload failed with a GitHub timeout; signed/public release and real-wallet acceptance remain pending.

<!-- /status:summary -->

### Payments (current architecture and acceptance)

| Layer | v0.7.0 (released, GLOBAL) | Openfund Pay (released in **v0.8.0**; acceptance pending) |
|---|---|---|
| Methods | DePay (multi-chain, converts tokens) and manual transfer with a TXID | **Pay with Wallet** (one server-prepared ERC-20 transfer, any configured network), manual transfer (TXID optional, red sender warning); DePay off for new payments (provider shuts down 2026-12-31) |
| Verification | On-chain: token, receiver, sender, amount, finality, reorg | Same verifier; a short amount is evidence, not a rejection |
| Accounting | One payment per order; underpayment rejected | Ledger: partial payments, multi-transaction orders, excess → refund liability, exactly-once activation |
| Discovery | Only a submitted hash or a DePay callback | Treasury watcher (cursor, reorg window, RPC failover); automatic attribution only when unambiguous |
| Operations | Attempt review and reverify | Backstage Payments: overview, investigation, deposit review, refund lifecycle, method switches, alerts |
| Acceptance | **Not accepted**: 2026-11-18 real purchases failed ([incident](docs/payments/INCIDENT_2026-11-18.md)) | Deterministic tests only; real-network checklist in [ACTIVATION](docs/payments/ACTIVATION.md) |

Sign-in stays Arbitrum-only (SIWE, chain 42161); payment networks are independent.
A DePay-attested payment settles automatically only when the order owner's
wallet signed it; any other payer waits for operator review unless the owner
sets `DEPAY_ATTESTED_ANY_PAYER=true` ([security assessment](docs/security/SECURITY-AUDIT-2026-11.md), OF-2026-11-05).

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
- **Openfund chart indicators.** Three Pine Script v5 indicators lead the
  Vela indicator catalog, each independently selectable. They run in a Web
  Worker on Vela 0.10.6 with the official PineTS addon (vela-pinets 0.3.4,
  PineTS 0.13.1).
  - *Open Algo V5:* Buy/Sell signals, Smart Trail, TP/SL levels and optional
    overlays.
  - *Price Action Concepts:* structure, BOS/CHoCH, multi-timeframe order
    blocks, liquidity and previous-period levels.
  - *Smart Money Concepts:* structure, order blocks, equal highs/lows, fair
    value gaps and levels.

  Settings persist per product and wallet. Indicators are observational: they
  never place orders or affect accounts. Gains candles carry no volume, so
  volume-based values show as unavailable.
  [Sources and behaviour](indicators/README.md) ·
  [Performance and accuracy](docs/reviews/pine-optimization/README.md)
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
| **Open Trade (desktop)** | Lightweight Electron workspace: one to four independent Vela charts, compact watchlist, floating order ticket, positions strip, keyboard shortcuts | [0.0.3 candidate](docs/releases/open-trade-0.0.3.md) · [0.0.2 preparation](docs/releases/open-trade-0.0.2.md) |
| **Certificates** | Purchase, completion and payout certificates issued from recorded events, verifiable by serial or QR in either region | `/:locale/certificate-verification` |
| **Backstage** | Independent, bilingual owner workspace for Prop business operations | [backstage.openfi.cloud](https://backstage.openfi.cloud) |


## Trading workspace and account tools

The Web Terminal is the complete browser workspace. Prop and Perpetual reuse
the same chart and navigation while keeping their accounts, orders, positions
and financial records separate. Switching a product or wallet clears the
previous private view before loading the next one.

| Workspace | Capabilities | Authority and limits |
| --- | --- | --- |
| Dashboard and accounts | Account directory, balances, equity, challenge progress, account selection and observed risk | Backend-owned records; simulated Prop balances are not wallet funds |
| Trade | Market selection, chart, order form, pending orders, positions, account state and execution preview | Prop simulated execution uses fresh server marks; Perpetual writes remain disabled |
| Chart and Quick Trade | Full chart layout, compact market-order controls, shared symbol/interval/indicator/drawing state | Uses the existing validation, preview and submission path; no separate engine |
| Order and position management | Market, limit and stop workflows; pending-order cancellation, full/partial close, SL/TP changes | Each mutation checks ownership and account rules; idempotent requests prevent duplicate execution |
| Chart protection | Entry markers, profit/loss zones, creation and movement of SL/TP with chart handles | Changes display confirmed server state; rejected updates restore confirmed levels |
| Sizing | Collateral and quantity equivalents, notional, leverage, risk preview and supported lotage conventions | Lots are an Openfund display convention, not a Gains contract-size claim; unsupported markets explain why |
| Portfolio | Open/closed positions, pending/history views, filters and position details | Engine settlement records for Prop; provider-native records for Perpetual |
| Journal and analytics | Trade review, performance dashboards, calendar, private notes, playbooks and exports/imports | Notes cannot create financial results; missing provider metrics remain unknown |
| Inbox and support | Trader correspondence, payout messages, reconsideration requests and in-app notifications | Private account-owned threads; external email delivery is separate infrastructure |
| Certificates and purchases | Purchase history, invoices, challenge records, issued certificates and verification links | Derived from recorded events and evidence, not client-side success messages |

[Terminal contract](docs/trading/TERMINAL.md) ·
[Chart workspaces](docs/trading/CHART_WORKSPACES.md) ·
[Lotage](docs/trading/LOTAGE.md) ·
[Accounts](docs/trading/UNIFIED_ACCOUNTS.md).

### Journal, performance and review

The journal supports Daily Journal, Notebook, Playbooks, Progress, Missed
Trades and Prop Firms research notes. Financial history remains separate from
these editable records. The dashboard includes date ranges, instrument and
direction filters, layouts and card visibility; settings persist by product
and account. Metadata import restores account-scoped notes with duplicate and
revision protection; it does not import financial performance.

| Analysis | What it measures |
| --- | --- |
| Net PnL | Settled price result after allocated opening and closing fees |
| Trade win rate | Positive-net closed slices divided by eligible closed slices |
| Profit factor | Total positive net results divided by the absolute negative total |
| Average win/loss | Mean positive net result relative to mean negative result |
| Day win rate | Positive-net UTC close days relative to eligible close days |
| Cumulative and daily PnL | Settled net results in closing-time order |
| Balance and observed equity | Actual ledger balance records and persisted equity observations |
| Drawdown | Realized-equity decline from its peak; live risk is shown separately |
| Edge Score v2 | Weighted descriptive score using win rate, profit factor, payoff, drawdown, recovery and winning-day concentration |

Partial closes remain traceable slices with proportional quantities, margin
and opening fees. Analytics do not reconstruct missing historical marked
equity or sum incompatible collateral currencies.
[Metric definitions](docs/trading/JOURNAL_METRICS.md) ·
[Portfolio and journal](docs/trading/PORTFOLIO_JOURNAL.md).

## Charts, indicators and market intelligence

### Vela charts and Pine execution

The chart workspace uses Vela 0.10.6, the official Vela Pine addon 0.3.4 and
PineTS 0.13.1. The catalog contains the three Openfund Pine indicators ahead
of the existing 77 built-ins. Original Pine sources run in a worker; the
integration resolves two repository-local libraries and rejects unknown
imports. Chart settings are scoped by product and wallet.

| Indicator | What the trader can inspect | Current source changes |
| --- | --- | --- |
| **Open Algo V5** | Buy/Sell signals, Smart Trail, TP/SL annotations, support/resistance, supply/demand, structure, trend lines, reversals, ribbons and retest zones | SMRT Algo dashboard, its three settings and five higher-timeframe requests removed; retired saved inputs migrate; disabled overlays skip work |
| **Price Action Concepts** | Internal/swing structure, BOS/CHoCH, multi-timeframe order blocks, liquidity, equal highs/lows, previous-period levels and scanner | Completed previous-period levels replace forming-period lookahead; Trendline Liquidity crash fixed; default secondary requests reduced; invisible drawings avoid rebuilding |
| **Smart Money Concepts** | Structure, order blocks, equal highs/lows, fair value gaps, multi-timeframe levels, premium/discount zones and alerts | Higher-timeframe gaps confirm when the relevant candle closes, avoiding early historical information |

These tools are observational. An indicator signal or a drawn TP/SL label
does not submit an order or alter evaluation. Gains candles contain no traded
volume: volume-dependent outputs are unavailable rather than filled with
invented numbers. Corrected lookahead changes the affected historical
behavior; optimization is not a claim of more profitable signals.

The optimization report records reproducible benchmark conditions,
configuration snapshots and independent regression checks. Licensing of the
Pine scripts remains separate from Vela and PineTS.
[Indicator sources](indicators/README.md) ·
[Settings](docs/trading/INDICATORS.md) ·
[Runtime](docs/trading/PINE_SCRIPT.md) ·
[Optimization evidence](docs/reviews/pine-optimization/README.md) ·
[Adding indicators](docs/trading/CUSTOM_INDICATORS.md).

### Hybrid Footprint

Footprint combines **Gains chart prices** with **Hyperliquid executed-trade
order flow** at the renderer layer. It is not a claim that Hyperliquid volume
was traded on Gains. The independent footprint service cannot mutate
accounts, trading, evaluation or payments.

| Footprint surface | Display |
| --- | --- |
| Bid/Ask Ladder | Aggressor sell/buy volume at each price level |
| Bid/Ask Profile | Per-price bid/ask profile |
| Volume Profile | Executed volume distribution by price |
| Delta Profile | Difference between aggressor buy and sell volume |
| Absolute Delta | Magnitude of per-level delta |
| Candle overlay | Order-flow layer beside the unchanged Gains candles |
| Additional analysis | POC, value area, imbalances and supported cumulative/statistical views |

The collector deduplicates executed trades and aggregates exact price/size
units into minute records. History and SSE serve chart readers; gaps,
unsupported symbols and service outages stay visible. Footprint availability
depends on the feature flag, supported market mapping and fresh upstream data.
[Source separation and data model](docs/integrations/FOOTPRINT.md).

### Trade Radar

Trade Radar exposes public Hyperliquid activity through a shared backend
cache: live large-trade tape, leaderboard windows, aggregated long/short
positioning, whale positions and wallet profiles. Tape thresholds range from
$10K to $1M. Position summaries include trader counts, long/short values,
weighted entry/leverage and concentration; wallet views include provider
positions, recent fills and available performance series.

The interface supports compact tables, phone cards, wallet copy, symbol
filters, duplicate suppression and new-trade highlights without losing the
reader's scroll position. The tape covers selected busy perpetuals and
qualifying trades; leaderboard sampling is not a list of every whale.
Failed refreshes return marked stale data or an explicit unavailable state.

### Market Heatmap

The Heatmap is a **perpetual-market treemap**, with independently controlled
tile area and color. Area uses real 24-hour notional volume or open interest;
color uses 24-hour change or hourly funding with a selectable symmetric
range. It is not a liquidation map, order-book depth map or market-cap map.

Small markets group into proportional “+N” tiles. Traders can drill down,
search for a symbol, inspect tooltips, open contextual desktop details or
the mobile bottom sheet, and follow a mapped Gains market into the chart.
Stable ordering reduces unnecessary tile motion during refresh.

Both Heatmap and Radar are read-only. A shared cache, bounded concurrency,
one shared tape socket and stale fallback limit upstream load.
[Data contracts, routes and limitations](docs/integrations/HYPERLIQUID_RADAR.md).

## Tools Center and learning

Ten browser-side tools support trade planning and record review. Each has
documented inputs, formulas, assumptions, validation and limitations; none
places orders or changes an account. Editorial wording is CMS-managed while
the arithmetic remains test-covered application code.

| Tool | Purpose | Route suffix |
| --- | --- | --- |
| Position Size Calculator | Convert a chosen money risk and stop distance into position sizing, with fee allowance | `position-size` |
| Leverage and Margin Calculator | Estimate required/free margin, usage and effective leverage | `leverage-margin` |
| Liquidation Price Estimator | Explore isolated-position liquidation assumptions | `liquidation-price` |
| Perpetual Futures PnL Calculator | Compare gross/net outcomes, fees, funding and break-even exit | `perp-pnl` |
| Funding Rate Calculator | Estimate holding-period funding and annualized rate extrapolation | `funding-rate` |
| Risk/Reward Calculator | Compare stop/target distances, money risk, expectancy and break-even win rate | `risk-reward` |
| Risk of Ruin Calculator | Explore loss-risk scenarios from the supplied assumptions | `risk-of-ruin` |
| Prop Drawdown Calculator | Explore account loss-limit scenarios | `prop-drawdown` |
| Consistency Rule Calculator | Examine concentration of results under the entered consistency rule | `consistency-rule` |
| Trading Journal Analyzer | Review uploaded journal records in the browser | `journal-analyzer` |

Tools live under `/:locale/tools/:slug`; the index groups position sizing,
risk/limits and record analysis. Calculator outputs are planning estimates,
not venue quotes or proof that the account is eligible for a challenge/payout.

The learning center includes paths, lessons and a searchable glossary.
Tool pages link to relevant lessons and terms, and describe the formulas
instead of returning unexplained numbers. FAQ, Rulebook, Whitepaper,
company/contact pages and public market discovery provide the wider product
and business context.
[Tools UI and copy](apps/web-react/src/features/tools/) ·
[Calculator implementation](apps/web-react/src/data/calculators.ts) ·
[Learning sources](apps/web-react/src/features/learn/).

## Open Trade desktop application

Open Trade is an Electron application with its own version and release
pipeline. It reuses the existing Vela charting and backend account boundaries
while offering a compact desktop workspace.

| Area | Source capabilities and acceptance limits |
| --- | --- |
| Workspace | One, two, three or four independent charts; watchlist, floating ticket, positions strip, shortcuts and settings |
| Startup and server | Connection/start screen, regional backend selection and region readiness controls |
| Wallet | WalletConnect pairing and SIWE on Arbitrum One; pairing alone never authenticates |
| Product selection | Prop simulated accounts and Perpetual Gains account in one wallet session; product switch stops prior streams/polling and clears prior data |
| Gains view | Read-only positions, orders and latest history events with network, source and freshness; no approvals or live orders |
| Localization | Persian/English plus Arabic/Russian/Chinese coverage; untranslated desktop-only strings remain English with a notice until reviewed |
| Security | Session token kept out of renderer; isolated Electron boundaries, controlled IPC, canonical backend allowlist, bounded JSON responses and validated external links |
| Updates | Notification opens the official GitHub release; no automatic installation |
| Identity | Settings expose version, commit, channel, server and signing state |
| Distribution | Native macOS arm64/x64, Windows x64 and Linux x64 targets; internal unsigned builds are distinguished from signed beta/stable channels |

The 0.0.3 candidate is merged. Its latest reviewed CI passed build, UI
acceptance, internal packaging and integrity on all four targets; macOS x64
artifact upload timed out. This does not verify real WalletConnect use,
clean-machine upgrade, signed/notarized publication or performance budgets.
[Desktop README](apps/open-trade/README.md) ·
[Release notes](docs/releases/open-trade-0.0.3.md) ·
[Acceptance](apps/open-trade/ACCEPTANCE.md) ·
[Reown/signing setup](docs/releases/OPEN_TRADE_0.0.3_OWNER_SETUP.md).

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

Since release v0.6.5 (official 2026-11-17; the latest platform release is
v0.8.0 — see [current status](docs/status/README.md)), Backstage includes commercial
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


### Backstage operations coverage

| Owner workspace | Functions |
| --- | --- |
| Traders and challenges | Wallet/reference search, linked purchases/accounts/payouts, frozen rules, positions/equity, final-pass review and suspension decisions |
| Payments | Attempt inspection, retry verification, deposits, reconciliation, refunds and method controls |
| Coupons | Inactive draft creation, percent/fixed discounts, eligibility, usage/window limits, activation, disable/revoke and redemption-aware pricing locks |
| Payouts | Review, rejection reasons, correspondence, reconsideration, recipient/amount inspection and verified settlement recording |
| Partners | Separate ambassador/coach application decisions, verification evidence, commission balances and settlement references |
| Finance | Financial position, treasury refresh, expenses, reserves, obligations and distinct IB distributions |
| Risk | Read-only exposure, open positions, loss-limit distance, feed freshness and engine-loop lag |
| Support and Inbox | Departments, replies, private notes, trader-visible conversations and notification delivery/read records |
| Audit and search | Operational/financial event filters and cross-record search by wallet, reference, id or transaction hash |
| Content | Page/language selection, plain-text editing, draft/publish transitions, previews and Directus visual-mode entry |

Privileged decisions reauthenticate the owner and retain their existing
backend authorization. Recording a paid settlement requires finalized matching
receipt evidence; it does not sign or send money. Real-settlement controls are
disabled until configured and accepted.

### Editorial CMS and visual editing

Directus owns public editorial copy; market prices and financial decisions
remain outside its visual-editing scope. A confirmed Studio session maps
editable content to a collection, item and field. Draft previews stay within
the editor session; anonymous visitors read published content.

Backstage's Content workspace edits permitted plain text with placeholder
validation and links to the same visual editor. Missing editor credentials
make it read-only. Financial collections, market values and unauthorized
destinations are excluded from editing.

The recorded visual-content inventory contains 4,285 source records, 54
registered routes and 74 explicit exceptions. These are the audit's recorded
counts, not a new claim that every runtime string was recounted here.
Persian/English are required source locales; additional locales use reviewed
dictionary paths and published CMS overrides. Desktop's own localization
does not mount the web Studio session.
[Visual protocol and inventory](docs/backstage/UNIVERSAL_VISUAL_EDITING.md) ·
[Content model](docs/backstage/CONTENT_MODEL.md) ·
[Content registry](docs/backstage/CONTENT_REGISTRY.md).

## Product gallery


### Website, terminal and workflow gallery — English and Persian

The following recorded captures retain their original context. They are
historical visual evidence, not fresh acceptance of the current main commit.
Each pair is labelled by surface; the complete existing gallery remains below.

| Website — English | Website — Persian |
| --- | --- |
| ![English website homepage, recorded v0.6.5 candidate](docs/assets/screenshots/readme/v065/home-en-desktop.jpg) | ![Persian website homepage, historical v0.4.4 production capture](docs/assets/screenshots/readme/home-fa-desktop.jpg) |

| Prop terminal — English | Prop terminal — Persian |
| --- | --- |
| ![English Prop workspace, historical recorded capture](docs/assets/screenshots/refinement-terminal-prop-en-dark.png) | ![Persian Prop workspace, historical recorded capture](docs/assets/screenshots/refinement-terminal-prop-fa-dark.png) |

| Perpetual terminal — English | Perpetual terminal — Persian |
| --- | --- |
| ![English Perpetual workspace, historical recorded capture](docs/assets/screenshots/terminal-perpetual-en.png) | ![Persian Perpetual workspace, historical recorded capture](docs/assets/screenshots/terminal-perpetual-fa.png) |

| Heatmap — English | Heatmap — Persian |
| --- | --- |
| ![English market Heatmap with readable tiles, recorded 2026-11-18](docs/assets/screenshots/heatmap-radar/heatmap-en-1440.png) | ![Persian Heatmap in light theme, recorded 2026-11-18](docs/assets/screenshots/heatmap-radar/heatmap-fa-1440-light.png) |

| Trade Radar — English desktop | Trade Radar — Persian mobile |
| --- | --- |
| ![English Radar table, deterministic intercepted tape for UI evidence, not live trades](docs/assets/screenshots/heatmap-radar/radar-en-1440.png) | ![Persian mobile Radar layout, recorded UI acceptance capture](docs/assets/screenshots/heatmap-radar/radar-fa-390.png) |

Radar's 2026-11-18 table capture uses deterministic intercepted tape data;
it demonstrates layout, not real-time market activity.

| Pine indicators — catalog | Pine indicators — active chart |
| --- | --- |
| ![Original Pine indicator catalog, historical English capture](docs/assets/screenshots/pine-prop-catalog.png) | ![Original Pine indicators running in the chart, historical English capture](docs/assets/screenshots/pine-prop-active.png) |

These indicator captures predate #170. They do not prove the optimized
version's individual Open Algo/PAC/SMC outputs in both languages. Separate
current English/Persian running captures are still required.

| Footprint — English Bid/Ask Ladder | Footprint — Persian RTL |
| --- | --- |
| ![Historical Footprint Bid/Ask Ladder capture](docs/assets/screenshots/footprint/style-bidAskLadder-1440.png) | ![Historical Persian RTL Footprint capture](docs/assets/screenshots/footprint/style-fa-rtl-1440.png) |

| Footprint — Volume Profile | Footprint — Delta Profile |
| --- | --- |
| ![Historical Footprint volume profile capture](docs/assets/screenshots/footprint/style-volumeProfile-1440.png) | ![Historical Footprint delta profile capture](docs/assets/screenshots/footprint/style-deltaProfile-1440.png) |

Footprint images already exist in the repository and match the acceptance
harness's output names. Their exact source SHA, capture timestamp and live
row state were not re-verified here; fresh bilingual captures and complete
per-image manifest records remain required.

| Journal — English | Journal — Persian |
| --- | --- |
| ![English journal, historical disposable-session capture with honest empty or unavailable records](docs/assets/screenshots/refinement-auth-journal-en-dark-1440.png) | ![Persian journal, historical disposable-session capture with honest empty or unavailable records](docs/assets/screenshots/refinement-auth-journal-fa-dark-1440.png) |

| Checkout — English | Checkout — Persian |
| --- | --- |
| ![English checkout, historical local development capture](docs/assets/screenshots/final-refinement/checkout-en-dark.png) | ![Persian checkout, historical local development capture](docs/assets/screenshots/final-refinement/checkout-fa-light.png) |

| Tools Center example — English risk tool | Tools Center example — Persian position tool |
| --- | --- |
| ![English risk calculator, historical repository capture](docs/assets/screenshots/website-tool-risk-en.jpg) | ![Persian position sizing calculator, historical repository capture](docs/assets/screenshots/website-tool-position-fa.jpg) |

| Learning — English | Learning — Persian |
| --- | --- |
| ![English learning center, historical repository capture](docs/assets/screenshots/website-learn-en.jpg) | ![Persian learning center, historical repository capture](docs/assets/screenshots/website-learn-fa.jpg) |

| Desktop — English workspace | Desktop — Persian settings |
| --- | --- |
| ![English Open Trade 0.0.2 workspace, historical capture](docs/assets/screenshots/open-trade-0.0.2/four-charts.png) | ![Persian Open Trade settings, historical capture before 0.0.3](docs/assets/screenshots/open-trade/settings-fa-light.png) |

The desktop pair shows different surfaces from earlier source versions.
Current 0.0.3 English/Persian startup, product selection, chart layouts and
settings still need their own packaged-build captures.

### Current screenshot acceptance

The requested gallery is not complete until current English and Persian
captures show each important surface, including **each of the three
indicators actually computed**, live Heatmap/Radar, and Footprint rows.
Existing images above are preserved rather than silently deleted or
relabelled as new.

Fresh capture was blocked in this editing session: the shell and browser
runtimes both failed to start with a missing-runtime error. No screenshot
was fabricated. The [capture matrix](docs/assets/screenshots/readme/CAPTURE_REQUIREMENTS.md)
records the full required coverage, provenance and acceptance conditions.

### Recent typography and mobile captures — 2026-11-20

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


### Full product gallery — recorded v0.6.5 and desktop 0.0.2

Genuine captures. Website and terminal: local test runtime of the v0.6.5
candidate with live public market data and published CMS content (no
personal wallet). Desktop: Open Trade 0.0.2. Provenance for every image is in
the [screenshot manifest](docs/assets/screenshots/manifest.json).
These earlier captures remain visible for the complete product presentation;
they are not represented as screenshots of a packaged desktop 0.0.3 release.

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
| **Released since v0.6.5/v0.7.0; GLOBAL Web/API last recorded at v0.8.0, IRAN at v0.6.5** ([PR #122](https://github.com/algomanlife/openfund/pull/122), [PR #132](https://github.com/algomanlife/openfund/pull/132), [v0.7.0](docs/releases/openfund-0.7.0.md)) | Trade Radar and Market Heatmap; certificate designs and verification page; terminal Persian terminology and footer; homepage and site-wide redesign; Applications and Roadmap pages; complete Backstage operations and Content workspace; trader Inbox and in-app notifications; post-deploy SIWE gate |
| **Included in v0.8.0 after v0.7.0; runtime acceptance remains separate** | Geo-IP first-visit language for returning visitors ([#159](https://github.com/algomanlife/openfund/pull/159)); Dastkhat Persian typography across site, terminal, Backstage and Open Trade ([#161](https://github.com/algomanlife/openfund/pull/161)); deterministic Heatmap/Radar and Controlled Challenge tests with a test-mode clock ([#160](https://github.com/algomanlife/openfund/pull/160)); regional routing host-matrix tests, IPv6 Geo-IP lookup and a read-only redirect-readiness check ([#163](https://github.com/algomanlife/openfund/pull/163)); browser journey acceptance suite in CI and release gates ([#164](https://github.com/algomanlife/openfund/pull/164), [report](docs/reviews/journey-acceptance-2026-11/REPORT.md)) |
| **Implemented, not active** | Hybrid Governance v1.0 (no council seated); Ambassador and Coach programs; Iran regional runtime and synchronization ([ADR 0033](docs/decisions/0033-regional-authority-and-synchronization.md)) |
| **Desktop candidate** | Open Trade 0.0.3 — Prop and read-only Perpetual in one wallet session; internal unsigned build, UI acceptance, packaging and integrity checks passed on macOS arm64/x64, Windows x64 and Linux x64. macOS x64 artifact upload failed with a GitHub timeout; signed/public release and real-wallet acceptance remain pending. [Candidate notes](docs/releases/open-trade-0.0.3.md). Earlier 0.0.2 builds and evidence remain documented. |
| **Not accepted (real-payment defects)** | Checkout and purchases: payments are enabled in production. The owner's two real purchases on 2026-11-18 (DePay, manual) did not activate a challenge ([incident report](docs/payments/INCIDENT_2026-11-18.md)) |
| **Released in v0.8.0; real-network acceptance pending** | Openfund Pay — direct wallet payment, partial payments, refund liabilities, treasury watcher, Backstage payment operations ([ADR 0046](docs/decisions/0046-openfund-pay.md), [guide](docs/payments/OPENFUND_PAY.md)); real-network acceptance pending owner authorization |
| **Merged after v0.8.0** | Gains read-only readiness ([#169](https://github.com/algomanlife/openfund/pull/169)); Pine indicator optimization and SMRT Algo dashboard removal ([#170](https://github.com/algomanlife/openfund/pull/170)); Open Trade 0.0.3 candidate ([#171](https://github.com/algomanlife/openfund/pull/171)). These merges do not constitute an official later release. |
| **Blocked** | Gains transaction execution (needs supported contracts, simulation and security review) |
| **Planned** | Mobile apps; protocol routing; advanced order workflows — see the [roadmap](ROADMAP.md) |

Controlled challenge acceptance uses two owner-issued test entitlements in an
isolated runtime. See the [operator procedures](docs/payments/CONTROLLED_CHALLENGES.md).

## Languages and regions

Openfund ships five interface languages: Persian (`fa`, RTL), Arabic (`ar`,
RTL), English (`en`), Russian (`ru`) and Simplified Chinese (`zh-CN`). Every
page lives under an explicit locale path (`/fa/home`, `/zh-CN/markets`, …),
and the server publishes `hreflang` alternates and a sitemap for them.

**Which language a visitor sees** ([ADR 0043](docs/decisions/0043-canonical-domains-geo-routing-and-locale.md)):

1. A locale in the URL always wins.
2. Otherwise, a language the visitor explicitly picked in the language menu.
3. Otherwise, a first-visit default from the visitor's trusted country.
4. Otherwise, English.

| Visitor country | Default |
| --- | --- |
| Iran | Persian |
| The 22 Arab League members | Arabic |
| Russia | Russian |
| China | Simplified Chinese |
| Any other or unknown country | English |

The country comes only from a verified source — Cloudflare's `CF-IPCountry`
from a published Cloudflare address on GLOBAL, or a licensed local IP database
on the Iran runtime — and never decides authorization, payments or account
access. The pre-paint script sets `lang` and `dir` before the first frame, so
there is no flash of another language.

**Typography.** Persian UI text uses [Dastkhat](https://github.com/dastyar-io/dastkhat-font)
and Arabic uses Dastkhat Arabic (SIL OFL 1.1, self-hosted, pinned by commit and
SHA-256); Latin and Cyrillic use Ubuntu, Chinese uses system CJK fonts.
Prices, sizes, addresses and hashes render as isolated LTR tabular numbers.
See the [design system](docs/design/DESIGN_SYSTEM.md).
Irancell is no longer the UI typeface. Legacy binaries are still tracked;
their remaining locations and unresolved rights are recorded in the
[licensing inventory](docs/legal/LICENSING.md#current-source-clarification--2026-11-21).

**Regions.** `openfi.cloud` (alias `openfund.cloud`) is the GLOBAL site on
Render; `openfi.live` is the Iran site on Liara. Choosing a language never
changes the region. An automatic redirect of Iranian visitors to `openfi.live`
exists as a disabled rule and stays off until every gate in ADR 0043 passes
and the owner approves; `node scripts/ops/geo-redirect-readiness.mjs` reports
the gates read-only.

## Business model

The approved model is recorded in [ECONOMY.md](ECONOMY.md) and summarised in
[Business model](docs/economy/BUSINESS_MODEL.md). No revenue, profitability or
growth figures have been published, and none are implied here.

**Challenge sales.** Openfund sells one-time evaluation fees for simulated
challenge accounts. Prices come from the plan catalog in the CMS; the server,
never the browser, prices every order. The previously recorded catalog is
retained below for business context; current fees and availability must be read
from the [published catalog](https://openfi.cloud/purchases/plans), which was
not re-probed in this documentation update:

| Model | Structure | Account sizes | Evaluation fee |
| --- | --- | --- | --- |
| Free Trial | Practice account | 5k – 100k | Free |
| Standard | Two-phase evaluation (8% + 5% targets, 10% max loss) | 5k – 100k | $44 – $652 |
| One-phase | Single target, one rule set | 5k – 100k | $74 – $666 |
| Instant | Funded from day one | 5k – 200k | $60 – $888 |

**Purchase lifecycle.** Order (server price, optional coupon) → payment
(Openfund Pay in v0.8.0: direct wallet payment or manual transfer;
v0.7.0's earlier flow used DePay or manual transfer with a TXID) → on-chain verification of token,
receiver, sender, amount and finality → atomic provisioning of exactly one
challenge account and one invoice. No client message, callback or event marks
an order paid on its own. Every state change is recorded. See
[Order lifecycle](docs/payments/ORDER_LIFECYCLE.md) and
[Payment verification](docs/payments/VERIFICATION.md).

**Revenue recognition principles.** Net collected revenue is gross sales minus
coupon discounts minus refunds, recognised from the verified settlement amount
on chain. Internal 100% test coupons are excluded from revenue and reported
separately. Ambassador commissions are an acquisition cost, recorded as
obligations.

**Costs.** Ambassador commissions, coach compensation (once live trading
exists), trader rewards under published plan rules, refunds and infrastructure
(Render, PostgreSQL, Directus, RPC providers).


### Challenge and funded-account lifecycle

The business lifecycle covers plan discovery, wallet sign-in, checkout,
verified payment, account provisioning, evaluation, final review, funded-demo
activation, reward requests and settlement evidence. Each step has its own
record and acceptance boundary.

| Stage | What is recorded | Who decides |
| --- | --- | --- |
| Select a program | Model, size and server-priced order; optional coupon | Published catalog and backend pricing |
| Pay and recover an order | Attempts, transactions, partial/excess amounts, verification and refund liabilities | On-chain verifier and operator investigation |
| Activate a challenge | One challenge account and invoice for the verified order; frozen rule snapshot | Atomic backend provisioning |
| Trade and evaluate | Orders, positions, fees, equity observations, targets, loss limits, trading-day/time conditions | Server engine and evaluation rules |
| Final-pass review | Eligibility and review decision | Authorized operator; passing an earlier phase is not a final funded approval |
| Funded-demo activation | Separate account and frozen reward terms | Approved product policy and backend lifecycle |
| Request a reward | Eligibility, distributable amount, selected cycle, reservations and recipient | Reward engine and human review |
| Settle and attest | Finalized transfer evidence, audit and eligible certificate | External treasury process plus backend receipt verification |

Controlled test challenges are wallet-bound entitlements with deliberately
isolated test rules and simulated settlement. Their results do not establish
ordinary commercial purchase or payout acceptance.
[Controlled procedures](docs/payments/CONTROLLED_CHALLENGES.md) ·
[Funded delivery](docs/economy/FUNDED_DELIVERY.md).

### Funded rewards, IB participation and treasury

The versioned policy for eligible new activations uses these shares of the
**same distributable profit**, with an immutable selected cycle:

| Cycle | Trader | Attributed eligible IB | Retained by Openfund when there is no eligible IB |
| --- | ---: | ---: | ---: |
| 7 days | 75% | 25% | 25% |
| 14 days | 85% | 15% | 15% |
| 21 days | 90% | 10% | 10% |
| Monthly | 100% | 0% | 0% |

Policy activation for new sales, UTC boundaries, eligibility and historical
account treatment follow the versioned backend policy; existing frozen terms
are not silently rewritten. The eligible IB share is distinct from the
purchase-referral commission. A contingent IB allocation becomes eligible
for its own reviewed settlement after a verified trader payment; this is
not an automatic treasury transfer.

The treasury recognition journal separately allocates **59% to treasury and
41% to operations** under an approved eligible revenue base and cutoff.
Refunds/chargebacks reverse that allocation proportionally. This sales
allocation is not the trader/IB profit split and is not evidence that funds
have already moved.

| Financial view | Meaning and source |
| --- | --- |
| Sales and paying customers | Verified paid orders and aggregate purchase records |
| Treasury balances | On-chain native/token balances with timestamped reads; per-network balances are not automatically revenue |
| Trader/partner liabilities | Approved or recorded unpaid obligations, tracked separately from cash |
| Expenses | Evidence-backed invoice/receipt/contract records with independent verification |
| Gross treasury value | Latest valid priced asset snapshot |
| Allocatable capital | Gross value less obligations, reserves and allocations/open margin under the documented anti-double-counting rules |
| Public transparency | Aggregates and verified payout evidence; no private per-trader histories |

Snapshot refresh is configurable within the documented 60–120 minute window,
defaulting to 90 minutes. Failed reads retain labelled stale values; missing
prices, reserves or configuration produce unknown/unverified capital.
Company costs are entered as verified records; provider billing APIs are not
claimed to be connected.

Real-market allocation is conditional on verified free capital, risk controls
and explicit activation. The documented $500,000 threshold does not mean
live Gains execution currently exists.
[Settlement policy](docs/economy/FUNDED_SETTLEMENT.md) ·
[Treasury and allocation](docs/economy/TREASURY.md) ·
[Live-market access](docs/economy/LIVE_MARKET_ACCESS.md).

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
    Web["React app · website + terminal"]
    Wallet["Wallet (SIWE)"]
  end
  subgraph Global["GLOBAL — Render (Frankfurt), live"]
    API["Node.js API + SPA · engine · evaluation · purchases · certificates · radar cache"]
    CMS["Directus 11.17.4"]
    DB[("PostgreSQL 17")]
  end
  subgraph Iran["IRAN — Liara (v0.6.5 deployed; sync off)"]
    APIIR["Same release · regional runtime"]
    DBIR[("PostgreSQL")]
  end
  Gains["Gains Network · markets, prices, VOB"]
  HL["Hyperliquid public API · (read-only analytics)"]
  Pay["Openfund Pay and payment chains"]

  Web -->|REST, SSE| API
  Wallet -->|signature| API
  API --> DB
  CMS --> DB
  API -->|market data| Gains
  API -->|one shared cache + socket| HL
  API -->|verify payments| Pay
  APIIR --> DBIR
  API <-.->|"signed, ordered sync · one home region per account"| APIIR
```

- **Trading engine boundary.** Orders, positions, PnL and evaluation are
  decided only by the backend engine; analytics modules (Radar, Heatmap) are
  GET-only and isolated from it.
- **Regions.** Every trading account has exactly one home region enforced by
  the database; the other region holds a read model through signed
  synchronization. The Liara runtime is deployed (v0.6.5); synchronization
  between the regions is not enabled yet.
- **Content versus data.** Directus holds editorial content, the plan catalog
  and coupons; market data comes from Gains (and Hyperliquid for read-only
  analytics); prices, orders and payments are decided only by the backend.
  Directus's public and editor roles have no access to financial or identity
  collections. Directus gets its own least-privilege PostgreSQL role
  (`openfund_directus`, [database roles](docs/security/DATABASE_ROLES.md)): it
  can read but never write challenge, trading, payment and other financial
  tables. The role is merged but **not yet deployed**; until the owner
  switches the production CMS credential, finding OF-2026-11-12 stays live in
  production.
- More: [Architecture](docs/architecture/ARCHITECTURE.md) · [Regional runtime](docs/decisions/0033-regional-authority-and-synchronization.md) · [Trade Radar](docs/integrations/HYPERLIQUID_RADAR.md) · [Gains](docs/integrations/GAINS.md) · [Certificates](docs/decisions/0039-certificate-event-attestations.md)

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
| Payments | Openfund Pay (direct wallet payment, manual transfers, partial/excess ledger, treasury watcher, refunds); legacy DePay configuration/callback verification; on-chain verification |
| Quality | Node test runner, Playwright browser suites, CodeQL, gitleaks, dependency review, a blocking production-dependency audit, and security regression suites (HTTP penetration checks, financial invariants, browser session isolation) |
| Delivery | GitHub Actions; Render Blueprint (`render.yaml`); Liara runtime image (`infra/liara-iran-runtime`) |

Design system: shared tokens and primitives in
[`design-system.css`](apps/web-react/src/styles/design-system.css)
([guide](docs/design/DESIGN_SYSTEM.md)).


### Repository structure

| Path | Responsibility |
| --- | --- |
| `apps/web-react/` | Website, shared Web Terminal, wallet UI, tools, CMS adapters, locales and public assets |
| `apps/backend/` | API, auth/session ownership, Prop engine/evaluation, payments/rewards, analytics caches, authority and schema/migrations |
| `apps/open-trade/` | Electron host, desktop renderer, packaging, signing, desktop acceptance and performance tools |
| `apps/backstage/` | Owner operations application plus Directus schema/content utilities |
| `packages/openfund-charts/` | Vela bridge and Pine indicator integration |
| `packages/openfund-gains-adapter/` | Gains market/candle/stream provider |
| `packages/openfund-footprint/` | Order-flow aggregation and chart plugin sources |
| `packages/cms-client/` | Shared content contract |
| `packages/openfund-protocol/` | Dormant protocol source and provenance; no operational venue routing |
| `indicators/` | Three Pine indicators and two local libraries |
| `vendor/`, `third_party/` | Preserved upstream sources, licenses, notices and adaptation provenance |
| `brand/`, `docs/assets/` | Brand reference, approved assets, diagrams, screenshots and provenance |
| `e2e/`, `scripts/` | Browser journeys, validation, release, upstream and operational tooling |
| `infra/`, `render.yaml` | Render Blueprint and regional deployment infrastructure |
| `dist/` | Tracked source-critical compatibility assets; preserve during builds and cleanup |
| `react/` | Generated current web build output, not a second authored frontend |

## Infrastructure

| Element | Setup |
| --- | --- |
| **GitHub** | Canonical repository; protected `main` with required checks; releases and tags |
| **Render** | `openfund` (Node web service, API + SPA), `openfund-cms` (Directus image with a persistent media disk), `openfund-db` (PostgreSQL 17), all in Frankfurt. Commit auto-deploy is off |
| **IRAN region** | Liara runtime image and desired-state manifest (`infra/liara-iran-runtime`, ADR 0033): same release, own database, signed synchronization. Deployed on Liara (web and worker, v0.6.5); synchronization **not enabled** |
| **Domains** | GLOBAL: `openfi.cloud` (canonical) and `openfund.cloud`, with `www.` aliases. IRAN: `openfi.live` (canonical) with `www.openfi.live`, `iran.openfi.cloud` and `iran.openfund.cloud` aliases ([ADR 0043](docs/decisions/0043-canonical-domains-geo-routing-and-locale.md)) |
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

**Tests.** `npm run typecheck`, `npm run test:web`, `npm run test:charts`
(Pine indicators), `npm run test:release`,
`npm run validate:blueprint`, `npm run docs:check`; backend suites need a
disposable database: `TEST_BACKEND_URL=… DATABASE_URL=postgres://…/openfund_test npm run test:backend`.
The backend server under test runs with `SIM_TEST_MODE=1`, a test
`ADMIN_API_TOKEN` and the CI placeholder `PURCHASE_PAYMENT_RECEIVER` (see
`ci.yml`). Never point tests at a database you care about.

Security suites (all against local test runtimes only):

```bash
npm --prefix apps/backend run test:security   # auth hygiene + financial invariants (no server)
npm --prefix apps/backend run test:pentest    # HTTP penetration checks against TEST_BACKEND_URL
BASE_URL=http://localhost:8080 npm run test:browser:security   # browser session isolation
```

[Testing guide](docs/development/TESTING.md) · [Local development](docs/development/LOCAL_DEVELOPMENT.md) · [Engineering reference](docs/development/ENGINEERING_REFERENCE.md)


### Test and acceptance map

The repository includes unit, database, browser, security, integration,
capacity and packaged-desktop checks. A suite's existence describes coverage,
not a claim that it ran in this documentation session. Results belong to an
exact commit, configuration and environment.

| Area | Checks and evidence paths |
| --- | --- |
| Product/catalog integrity | `npm run test:web`; plan/rulebook, checkout, market/depth, content, typography, governance, chart and product-rule checks |
| Engine and evaluation | `npm run test:backend`; trading math, account locks, pending orders, partial closes, evaluation, leverage and sampled equity |
| Purchases and payments | Backend purchase/verification/manual/Openfund Pay tests; browser purchase, checkout/coupon and challenge-lifecycle suites |
| Financial invariants | Append-only accounting, payment idempotency, refunds, payout receipts, referral/IB recognition, revenue allocation and reconciliation tests |
| Wallet and product isolation | SIWE/auth tests; `test:browser:wallet`, `test:browser:security`, `test:browser:perpetual` and product-switch scenarios |
| Pine indicators | `npm run test:charts`, `npm run bench:charts`, `npm run test:browser:charts`; calculation snapshots, migration and lookahead checks |
| Footprint | `npm run test:footprint`, `npm run test:browser:footprint`; aggregation, source compatibility, styles, flag-off and outage behavior |
| Heatmap and Radar | `test:browser:heatmap-radar` for deterministic UI coverage; `test:browser:heatmap-radar:live` for external feed acceptance |
| Terminal interaction | Layout, completion, risk workspace, chart protection and unified-trading browser suites |
| Backstage/CMS | Server access-control tests; operations/content browser journeys, visual editing, drafts, publishing and forbidden financial collections |
| Certificates and payouts | Certificate, payout-operation and controlled-challenge browser/API checks |
| Localization/accessibility | `test:browser:locale`, `test:browser:responsive-matrix`, typography, routing, overflow, RTL/LTR and axe checks |
| Regional behavior | Region guards, authority, sync, proxy/client-IP, routing and Iran-isolation scenarios |
| Desktop | `npm --prefix apps/open-trade test`, `test:security`, `test:i18n`, `test:desktop`, `test:performance`, `verify:signatures` |
| Release and documentation | `test:release`, release/browser gates, archive identity, `docs:check`, Blueprint and dependency/license checks |
| Capacity and resilience | Shared-stream, equity-sampling, engine-isolation and measured capacity reports |

Fixture-backed UI tests and live-feed tests are different evidence. A
simulated order lifecycle never proves real-chain execution or treasury
settlement. Production acceptance additionally needs the correct deployed
identity and the relevant wallet/payment/device checks.
[Test sources](e2e/) · [Backend test sources](apps/backend/test/) ·
[CI definition](.github/workflows/ci.yml) ·
[Capacity report](docs/reviews/capacity-2026-11-13/REPORT.md).

## Versioning and releases

| | Versioning | Where |
| --- | --- | --- |
| **Web platform** | `vMAJOR.MINOR.PATCH` tags allocated from Conventional Commits; an owner-approved manual dispatch may choose the patch inside a newly allocated line (e.g. v0.6.5) | [Releases](https://github.com/algomanlife/openfund/releases) · [runbook](docs/deployment/RELEASES.md) |
| **Open Trade desktop** | Independent version; 0.0.3 candidate, earlier 0.0.2 builds; tags `open-trade-vX.Y.Z` | [0.0.3 candidate](docs/releases/open-trade-0.0.3.md) · [0.0.2 preparation](docs/releases/open-trade-0.0.2.md) |

`/version` returns the deployed version, the exact commit and whether the build
is an official release. Render and Liara deploy independently from the same
tagged commit; merging does not deploy either.

```bash
curl -s https://openfi.cloud/version
```

## Security

The first [security self-assessment](docs/security/SECURITY-AUDIT-2026-11.md)
(November 2026) was written by the project's coding agent. It is **not** an
independent audit. Its [penetration-test methodology and results](docs/security/PENETRATION-TEST-2026-11.md),
[test matrix](docs/security/SECURITY-TEST-MATRIX.md) and
[remediation plan](docs/security/SECURITY-REMEDIATION-PLAN.md) record what was
tested, what was fixed and what remains open. The
[remediation report](docs/security/SECURITY-REMEDIATION-2026-11.md) gives each
finding's state (fixed in code, merged, released, deployed). No production
system was tested or changed.

| Control | Implementation |
| --- | --- |
| Wallet sign-in | SIWE (EIP-4361) on Arbitrum One only: domain and URI binding, a single-use nonce bound to the address, a time window, ECDSA recovery and an EIP-1271 fallback |
| Sessions | Random 256-bit id stored hashed; HttpOnly, `SameSite=Lax`, `Secure` in production; checked on every request; expired rows swept hourly |
| Authorization | Every account, order, position and withdrawal is scoped to the session's user on the server; the admin API is disabled until a token is configured and needs a named operator for decisions |
| Payments | The chain verifier decides; provider callbacks are signed hints only; each transaction is single-use; partial payments and excess are recorded as ledger evidence or refund liabilities |
| Trading and evaluation | Server-authoritative engine with decimal arithmetic, frozen rule snapshots and fresh-mark requirements; stale marks never decide a pass or fail |
| Browser | Strict CSP with hashed inline scripts, `frame-ancestors`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS in production |
| Database | Separate owner/migration, runtime, Directus and read-only PostgreSQL roles with a version-controlled, table-by-table policy and a drift check ([database roles](docs/security/DATABASE_ROLES.md)) |
| CMS | Directus 11.17.4 with verified compensating controls (cache off, SSRF deny list, image/PDF-only uploads, WebSockets off); the 12.x upgrade waits for a licence |
| Rate limits | Per visitor IP (Cloudflare-verified `CF-Connecting-IP`; the Iran edge's keyed client IP); one API process by design |
| Supply chain | gitleaks; blocking production-dependency audit; Dependabot; dependency review; CodeQL; plus [security automation](docs/security/SECURITY-AUTOMATION.md): actionlint, zizmor, Semgrep (new findings), Trivy (lockfiles, configuration, edge image), ZAP baseline, OSV-Scanner and a CycloneDX SBOM on every release |

Open security risks: OF-2026-11-11 (Directus advisories, High, mitigated and
blocked by a licence decision), and OF-2026-11-12 and OF-2026-11-20, which
have remediation and deployment states recorded individually in the report.
Earlier unreleased/deployment notes are historical; a green check or merged fix
does not establish production acceptance. Payment acceptance is assessed separately. See
the [remediation report](docs/security/SECURITY-REMEDIATION-2026-11.md#outstanding-blockers).
Report vulnerabilities privately: [SECURITY.md](SECURITY.md).

## Roadmap

The [roadmap](ROADMAP.md) lists seven phases ordered by dependency, each tied
to milestones with acceptance criteria in the
[milestone register](docs/roadmap/MILESTONES.md). The website Roadmap page
mirrors it. The [one-year product roadmap](ROADMAP.md#one-year-product-roadmap)
is already recorded there, covering funded operations, platform expansion and
scaling. Targets and dates describe plans, not completed delivery.

## Documentation map

| Topic | Start here |
| --- | --- |
| Architecture | [Architecture](docs/architecture/ARCHITECTURE.md) · [Tech stack](docs/architecture/TECH_STACK.md) · [Decisions (ADRs)](docs/decisions/) |
| Product status | [Feature status](docs/product/FEATURE_STATUS.md) · [Current runtime status](docs/status/README.md) · [Milestones](docs/roadmap/MILESTONES.md) · [Roadmap](ROADMAP.md) |
| Trading | [Trading docs](docs/trading/) · [Controlled challenges](docs/payments/CONTROLLED_CHALLENGES.md) |
| Development | [Testing](docs/development/TESTING.md) · [CI](docs/development/CI.md) · [Pull requests](docs/development/PULL_REQUESTS.md) |
| Deployment | [Releases](docs/deployment/RELEASES.md) · [Render](docs/deployment/RENDER.md) · [Iran runtime](docs/deployment/LIARA_IRAN_RUNTIME.md) · [Launch parity](docs/deployment/LAUNCH_PARITY_RUNBOOK.md) · [Environment](docs/deployment/ENVIRONMENT.md) |
| Security | [Remediation report](docs/security/SECURITY-REMEDIATION-2026-11.md) · [Self-assessment](docs/security/SECURITY-AUDIT-2026-11.md) · [SECURITY.md](SECURITY.md) |
| Design | [Design system](docs/design/DESIGN_SYSTEM.md) · [Screenshot manifest](docs/assets/screenshots/manifest.json) |
| Community | [Contributing](CONTRIBUTING.md) · [Support](SUPPORT.md) · [Changelog](CHANGELOG.md) · [Docs index](docs/README.md) |

## License

**No first-party license has been chosen yet.** Openfund's own code is
therefore all rights reserved: the repository is public for transparency, but
that does not grant a general first-party reuse or redistribution license.
Third-party permissions and obligations remain governed by their own terms. The options,
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
| Dastkhat, Dastkhat Arabic | SIL OFL 1.1 | Persian/Arabic UI fonts, self-hosted unmodified ([source](apps/web-react/public/assets/fonts/dastkhat/SOURCE.json)) |
| Legacy Irancell-derived files (not the current UI font) | **Unresolved** | Retained copies exist in public assets, `dist/`, brand and investor-pack typography; no redistribution permission recorded. Current UI fonts are Dastkhat/Dastkhat Arabic. |
| Pine indicators (`indicators/`) | **Unresolved**: one file states CC BY-NC-SA 4.0, the others none | The owner intends to open-source them (Apache-2.0 proposed); evidence of third-party origin must be resolved first ([details](docs/legal/LICENSING.md#pine-indicator-sources)). Separate from the PineTS and Vela terms above |

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
| Security assessment | [November 2026 self-assessment](docs/security/SECURITY-AUDIT-2026-11.md) (not an independent audit) |
| Questions | [SUPPORT.md](SUPPORT.md) |
| Conduct | [Code of conduct](CODE_OF_CONDUCT.md) |
| Review and release authority | [Repository governance](docs/development/REPOSITORY_GOVERNANCE.md) |
| Coding agents | [AGENTS.md](AGENTS.md) |

<div align="center">

<img src="docs/assets/brand/mark.svg" alt="Openfund mark" width="32" />

[openfi.cloud](https://openfi.cloud) · [openfi.live](https://openfi.live) · [Releases](https://github.com/algomanlife/openfund/releases) · [Changelog](CHANGELOG.md)

</div>
