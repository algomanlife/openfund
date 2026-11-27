# Platform reference

Infrastructure, repository layout, test map and security controls, moved verbatim from the
README on 2026-11-21. Architecture overview: [ARCHITECTURE.md](ARCHITECTURE.md).

## Architecture notes

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
  (`openfund_directus`, [database roles](../security/DATABASE_ROLES.md)): it
  can read but never write challenge, trading, payment and other financial
  tables. The role is merged but **not yet deployed**; until the owner
  switches the production CMS credential, finding OF-2026-11-12 stays live in
  production.
- More: [Architecture](ARCHITECTURE.md) · [Regional runtime](../decisions/0033-regional-authority-and-synchronization.md) · [Trade Radar](../integrations/HYPERLIQUID_RADAR.md) · [Gains](../integrations/GAINS.md) · [Certificates](../decisions/0039-certificate-event-attestations.md)

## Infrastructure

| Element | Setup |
| --- | --- |
| **GitHub** | Canonical repository; protected `main` with required checks; releases and tags |
| **Render** | `openfund` (Node web service, API + SPA), `openfund-cms` (Directus image with a persistent media disk), `openfund-db` (PostgreSQL 17), all in Frankfurt. Commit auto-deploy is off |
| **IRAN region** | Liara runtime image and desired-state manifest (`infra/liara-iran-runtime`, ADR 0033): same release, own database, signed synchronization. Deployed on Liara (web and worker, v0.6.5); synchronization **not enabled** |
| **Domains** | GLOBAL: `openfi.cloud` (canonical) and `openfund.cloud`, with `www.` aliases. IRAN: `openfi.live` (canonical) with `www.openfi.live`, `iran.openfi.cloud` and `iran.openfund.cloud` aliases ([ADR 0043](../decisions/0043-canonical-domains-geo-routing-and-locale.md)) |
| **Deployment** | A maintainer publishes a release; the release workflow deploys the exact tagged commit after environment approval and checks `/version` on both domains |
| **Build** | `node scripts/release/render-build.mjs` builds the frontend; migrations run at start-up and are additive and idempotent |
| **Health** | `/health` (API), `/server/ping` (CMS), `/version` (exact version and commit) |
| **Backups** | Render PostgreSQL backups plus manual `pg_dump` before risky changes; Directus media on its disk ([Backup and restore](../backstage/BACKUP_RESTORE.md)) |
| **Rollback** | Redeploy the previous official release; additive migrations keep older code compatible ([Rollback](../deployment/ROLLBACK.md)) |

[Render runbook](../deployment/RENDER.md) · [Environment variables](../deployment/ENVIRONMENT.md)

## Repository structure

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
| `react/` | Generated current web build output, not a second authored frontend |

## Test and acceptance map

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
[Test sources](../../e2e) · [Backend test sources](../../apps/backend/test) ·
[CI definition](../../.github/workflows/ci.yml) ·
[Capacity report](../reviews/capacity-2026-11-13/REPORT.md).

## Security controls

| Control | Implementation |
| --- | --- |
| Wallet sign-in | SIWE (EIP-4361) on Arbitrum One only: domain and URI binding, a single-use nonce bound to the address, a time window, ECDSA recovery and an EIP-1271 fallback |
| Sessions | Random 256-bit id stored hashed; HttpOnly, `SameSite=Lax`, `Secure` in production; checked on every request; expired rows swept hourly |
| Authorization | Every account, order, position and withdrawal is scoped to the session's user on the server; the admin API is disabled until a token is configured and needs a named operator for decisions |
| Payments | The chain verifier decides; provider callbacks are signed hints only; each transaction is single-use; partial payments and excess are recorded as ledger evidence or refund liabilities |
| Trading and evaluation | Server-authoritative engine with decimal arithmetic, frozen rule snapshots and fresh-mark requirements; stale marks never decide a pass or fail |
| Browser | Strict CSP with hashed inline scripts, `frame-ancestors`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS in production |
| Database | Separate owner/migration, runtime, Directus and read-only PostgreSQL roles with a version-controlled, table-by-table policy and a drift check ([database roles](../security/DATABASE_ROLES.md)) |
| CMS | Directus 11.17.4 with verified compensating controls (cache off, SSRF deny list, image/PDF-only uploads, WebSockets off); the 12.x upgrade waits for a licence |
| Rate limits | Per visitor IP (Cloudflare-verified `CF-Connecting-IP`; the Iran edge's keyed client IP); counters shared and persistent in PostgreSQL (`rate_limit_hits`), surviving restarts and holding across instances |
| Supply chain | gitleaks; blocking production-dependency audit; Dependabot; dependency review; CodeQL; plus [security automation](../security/SECURITY-AUTOMATION.md): actionlint, zizmor, Semgrep (new findings), Trivy (lockfiles, configuration, edge image), ZAP baseline, OSV-Scanner and a CycloneDX SBOM on every release |

Open security risks: OF-2026-11-11 (Directus advisories, High, mitigated and
blocked by a licence decision), and OF-2026-11-12 and OF-2026-11-20, which
have remediation and deployment states recorded individually in the report.
Earlier unreleased/deployment notes are historical; a green check or merged fix
does not establish production acceptance. Payment acceptance is assessed separately. See
the [remediation report](../security/SECURITY-REMEDIATION-2026-11.md#outstanding-blockers).
Report vulnerabilities privately: [SECURITY.md](../../SECURITY.md).
