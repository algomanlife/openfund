# Gains Network Perpetual — integration readiness report

- **Date:** 2026-11-20
- **Repository:** `algomanlife/openfund`. `main` = `0320cf70fa42f0309764f26fc86604f90f2c498e` (= v0.8.0).
- **Branch:** `agent/claude/gains-readiness` ([PR #169](https://github.com/algomanlife/openfund/pull/169)). The head SHA is recorded in the PR.
- **Nature:** engineering assessment and evidence. **This is not legal advice and not an activation decision.**

> **Verdict in one line.** The read-only Gains integration and an isolated UI simulation are ready for review. **The owner's requested Gains trading product is not implemented, and live trading is not authorized.** Activation is blocked by unresolved legal, eligibility, security and operational approvals (section 10).

## 1. Requested end-state vs what exists

The **requested end-state** is a Gains-powered Perpetual trading terminal on Arbitrum One:

- one wallet identity and one SIWE session shared with Prop;
- Gains is the authority for positions;
- Prop and Perpetual records never mix.

| Area | Status | Evidence |
| --- | --- | --- |
| Shared wallet authentication (SIWE, Arbitrum One only) | **Implemented, verified locally** | `useOpenfundSession.tsx`; `e2e/test-perpetual-readiness.cjs` (session kept across product switch and refresh; revoked on wallet change and disconnect) |
| Prop/Perpetual isolation | **Implemented, verified locally** | `products.js` scoping; `test/products.test.mjs`; import-graph and record-provenance tests in `test/gains-scenarios.test.mjs` |
| Gains market data (REST/WS, Vela chart) | **Implemented** (on `main`) | `packages/openfund-gains-adapter`; 496 pairs and 446 price marks loaded from the live API on 2026-11-20 (local server log) |
| Gains account and position reads | **Implemented; hardened in PR #169** | `gains-portfolio.js`; 24 backend scenario tests; live empty-address read OK |
| Provider freshness and provenance | **Implemented in PR #169** | `freshness`, `provenance`, fixed error codes; UI live/stale/inconsistent/outdated/unavailable states |
| Supported Arbitrum markets | **Display only.** Metadata comes from Gains; counts change over time | Not a trading capability |
| Terminal UI | **Read-only for Perpetual.** Submit, close, SL/TP and cancel are disabled | Readiness suite; production adapter is `readOnly: true, canTrade: false` |
| Order submission, close, modify, cancel | **Not implemented** | — |
| Collateral approval / allowance | **Not implemented** | — |
| Official pre-trade fees, price impact, liquidation | **Not implemented** (never approximated) | — |
| Order lifecycle tracking and reconciliation | **Not implemented**; specified in the [RFC](../../architecture/PERPETUAL_EXECUTION_RFC.md) section 8 | — |
| Eligibility enforcement (age, jurisdiction, sanctions) | **Not implemented** | Section 4 |
| Risk acknowledgement flow | **Not implemented** | RFC section 9 |
| Signing model for trades | **Not decided** | RFC section 4 |
| Contract/API compatibility for writes | **Not verified.** No ABI, address or write call exists in the repository | Section 5 |
| Release / deployment | v0.8.0 published 2026-11-20 15:23Z. GLOBAL Web/API runs 0.8.0 at `0320cf70` (`/version`, 18:14Z). PR #169 is **not** released or deployed | `docs/status/status.json` |

The vendored `@gainsnetwork/sdk` covers calculations and types. Its presence does not mean transaction execution exists.

## 2. Provider compatibility evidence

| Item | Finding | Confidence |
| --- | --- | --- |
| Network | Arbitrum One (42161) for all reads. The Trading API also documents Arbitrum Sepolia | Reads verified live; testnet documented, not used |
| Read interfaces | `backend-arbitrum.gains.trade/open-trades/{addr}` and `/trading-variables`; `backend-global.gains.trade/api/personal-trading-history/{addr}` and `/stats` | Verified live (empty address), 2026-11-20 |
| Deprecations | Old history endpoints removed 2025-12-01. `trading-variables.allTrades` removed 2025-10-27. Openfund uses neither | Docs |
| Account state | Trade (`tradeType` 0/1/2 = market/limit/stop), `collateralIndex` with decimals, price at 1e10, leverage at 1e3, `tradeInfo.contractsVersion` | Matches vendored SDK `backend.types.ts` and live shapes |
| Lifecycle states (Trading API) | `prepared`, `pending`, `filled`, `rejected`, `timed_out`, `expired`. Market orders time out after about 60 seconds | Docs only |
| Fees, funding, liquidation | Trading API position fields; SDK `getLiquidationPrice` | Docs only; not used |
| State observation | Trading API orders/fills (REST and WebSocket); contract events; backend endpoints | Docs only |
| Version changes | `contractsVersion` per trade. v10/v10.2 migration guides exist | A future write path must fail closed on an unknown version |
| Unsupported in Openfund | Every write, allowance, delegate, agent and testnet path | By design |

## 3. Terms of Service assessment (confirmed provider statements)

Source: [Gains Terms of Service](https://gains.trade/terms-of-service), "Last updated November 1, 2023". The operator is Ingenium Labs Foundation (Panama). Parts of the page were read through a summary and are marked †. Counsel must read the full current text.

| Topic | Provider statement | Openfund interpretation (not legal advice) |
| --- | --- | --- |
| Minimum age and capacity | Users must be "older than eighteen years of age" and "of sound mind" (section 5.1) | Openfund's gate must be at least 18 **and** at least the local age of majority. Counsel decides |
| US persons | US use is prohibited "regardless of the user's IP address"; VPN concealment is prohibited | IP or locale cannot prove eligibility. A self-attestation alone may be insufficient. Counsel decides |
| Sanctions | Panama, UN, US Treasury SDN and Foreign Sanctions Evaders lists, and the EU (section 5.4). No circumvention (section 4.2) | Screening policy needed |
| Other jurisdictions | Docs: stocks and indices are blocked in the US and OFAC regions per asset category. No complete country list | Openfund's restricted list must be set by counsel |
| Third-party interfaces | Not prohibited. The Trading API docs list bots, terminals and integrations as use cases. No permission or registration requirement is stated | Integrator obligations are **unconfirmed**. Ask Gains |
| API usage | Rate limits are published as testnet launch values. Data-use and redistribution terms are not stated | Ask Gains |
| Licensing | Protocol "available under a free open-source license" (no name given). Marks CC BY-SA 4.0 (section 3.2) | Check `@gainsnetwork/*` and `@gainstrade/api` licences before vendoring |
| Privacy | No separate privacy policy found. Section 3.3 allows collection with "no obligation of confidentiality" | Openfund's own privacy policy must cover what Openfund collects |
| Risk | Possible total loss (section 6.7(c)); oracle prices "may not be accurate" (section 1.4); regulatory risk † | Basis for RFC section 9 disclosures |
| Custody | Gains does not store or control tokens or keys (section 1.3); users keep their own keys (section 6.7(b)) | Consistent with a non-custodial interface |
| Governing law | Panama; arbitration in Panama † | Relevant to dispute handling |
| Testnet | Arbitrum Sepolia for the Trading API. "Practice Mode" runs on testnet and skips regional checks | Do not treat testnet as an eligibility workaround |

The ToS predates the Trading API (2023 vs 2025–2026 docs), so they may not align.

## 4. Compliance assessment (Openfund as a non-custodial interface)

Every row is **unresolved**. Each needs qualified counsel. Decision rule: **a failed or unresolved mandatory requirement prevents activation.**

| # | Requirement | Question for counsel | Mandatory | Decision | Owner |
| --- | --- | --- | --- | --- | --- |
| C1 | Regulatory authorization | Does offering a leveraged-derivatives interface, even non-custodially, require a licence or registration in the jurisdictions Openfund targets (GLOBAL and IRAN regions)? | Yes | **Not approved — blocks** | Legal counsel (to be appointed by `algomanlife`) |
| C2 | Provider permission | Do Gains' terms permit a third-party interface? What obligations apply (referrer, branding, disclosures)? | Yes | **Not approved — blocks** | Owner (`algomanlife`) with Gains |
| C3 | Eligibility verification | What verification is required (self-attestation, KYC, screening)? IP and locale are never proof | Yes | **Not approved — blocks** | Legal counsel |
| C4 | Minimum age | At least 18 (Gains) and the local age of majority. How is it enforced? | Yes | **Not approved — blocks** | Legal counsel |
| C5 | Restricted jurisdictions and sanctions | Restricted list, screening provider, re-screening cadence | Yes | **Not approved — blocks** | Legal counsel + engineering |
| C6 | User changes location | When to re-check; what happens to open positions (reads stay available; new writes are blocked) | Yes | **Not approved — blocks** | Legal counsel |
| C7 | Privacy and personal data | Lawful basis, minimization, data-subject rights, cross-region transfer | Yes | **Not approved — blocks** | Legal counsel |
| C8 | Record retention | Which non-financial intent and attestation records to keep, and for how long | Yes | **Not approved — blocks** | Legal counsel + engineering |
| C9 | Risk disclosures | Approved wording in five locales; acknowledgement before the first trade | Yes | **Not approved — blocks** | Legal counsel + content owner |
| C10 | Marketing restrictions | Leverage advertising rules; no "funded" or "Prop" claims for Perpetual | Yes | **Not approved — blocks** | Legal counsel + marketing |
| C11 | Support and disputes | Who handles failed or contested trades; on-chain finality vs Openfund responsibility | Yes | **Not approved — blocks** | Owner + support lead |

Locale and language never gate eligibility in the code: `ProductGate` serves both products in every locale. Any future restriction must not be bypassable by changing language.

## 5. Security threat model

Severity applies to a **future execution path** unless marked "now". Today Perpetual has no write path.

| ID | Threat | Severity | Mitigation required | Current status |
| --- | --- | --- | --- | --- |
| T1 | Wallet-address substitution: the client asks for another wallet's records | High | The server derives the wallet from the session; a client `account` must match | **Mitigated now** (404 tested live) |
| T2 | Stale session follows a different wallet | High | Logout on wallet change; ordered auth queue | **Mitigated now** (browser-tested) |
| T3 | Cross-product financial writes (Gains into the Prop ledger or evaluation) | Critical | No import path; no shared mutable provider | **Mitigated now** (import-graph test) |
| T4 | Malformed or hostile provider responses (schema change, injection in `tx`) | High | Fail closed (502); hash validation; no HTML from upstream | **Mitigated now** (scenario tests) |
| T5 | Stale or cached data shown as current | High | Freshness labels; original fetch time; outdated state | **Mitigated now** |
| T6 | Incorrect success indicator (shown "filled" before the provider confirms) | Critical | Distinct submitted/pending/filled; reconcile with provider | Specified (RFC section 8); simulation-tested presentation only |
| T7 | Silent change of transaction intent (UI shows X, wallet signs Y) | Critical | Display the decoded call and amounts from the same object that is signed; independent review | Not built |
| T8 | Untrusted contract configuration (address or ABI from a remote or editable source) | Critical | Addresses pinned in reviewed source, verified against official docs and on-chain bytecode; no CMS or env override | Not built |
| T9 | Hidden delegated authority (agent or backend signer) | Critical | No backend signer. An agent model only with a device-held key and user revocation | Not built; RFC recommends user-signed transactions |
| T10 | Unlimited allowance abuse | High | Exact-amount approvals by default; show spender; revoke guidance | Not built |
| T11 | Automatic signatures or chain switches | High | Every signature and chain switch is user-initiated | **Mitigated now** (no write path; SIWE is user-initiated) |
| T12 | Compromised dependency (wallet SDK, Gains SDK) | High | Lockfiles, Dependabot, OSV/Trivy, SBOM; review any new execution package | Partial. OF-2026-11-04 is open (transitive `zod`, `decode-uri-component`) |
| T13 | RPC faults or reorgs misreporting status | Medium | Reconcile by hash and provider; finality depth | Not built |
| T14 | Provider outage during an open position | Medium | Clear "unavailable" state; never imply closure | **Mitigated now** for reads |
| T15 | Third-party CORS or edge failures in the browser | Low | Offline layout tests; explicit unavailable states | **Mitigated now** (matrix offline) |
| T16 | Simulation mistaken for real trading | High | Test-only injection; no product flag; visible banner; `sim:` ids | **Mitigated now** (simulation suite) |

## 6. Test evidence (PASS / FAIL / BLOCKED / NOT TESTED)

All results are local runs on this branch against an isolated server (port 18180) and a disposable database, unless marked CI.

| Check | Result | Evidence |
| --- | --- | --- |
| Backend Gains scenarios and isolation (`node --test test/gains-portfolio.test.mjs test/gains-scenarios.test.mjs`) | **PASS** 24/24 | Precision, decimals, missing TP/SL, unknown types, malformed data, timeouts, stale/inconsistent timestamps, partial closes, transaction validation, import graph |
| Backend suite (`npm run test:all`) | **PASS** | Includes product isolation (`products.test`) and all Prop engine/evaluation suites |
| Backend SIWE production-origin variant | **BLOCKED locally** | Needs CI's `ALLOWED_DOMAINS`; covered by CI |
| Web unit suites (`npm run test:web`), typecheck | **PASS** | 14 suites |
| Content registry and i18n | **PASS** | |
| Browser: Perpetual readiness (`test:browser:perpetual`) | **PASS** 61/61 | Session across products, refresh, wallet change/disconnect, freshness states, read-only trade controls, five locales × three viewports, axe |
| Browser: Perpetual UI simulation (`test:browser:perpetual-simulation`) | **PASS** 23/23 | Market selection, parameters, validation, confirmation, rejected, pending, filled, unconfirmed, cancel, close, provider outage and recovery, session expiry, no writes |
| Responsive matrix (offline) | **PASS** shard 1/3: 4478/4478; reduced matrix: 568/568 | Shards 2–3 run in CI |
| Accessibility (axe, signed-in Perpetual) | **PASS** with 3 **known pre-existing** findings in shared components | `.rk-account-summary` label mismatch; PnL-calendar day labels; journal "All" contrast 4.25:1. Owner: frontend |
| Dependency scan (OSV, three lockfiles) | **FAIL (pre-existing, accepted risk)** | 4 advisories, all OF-2026-11-04 (wallet SDK transitive); lockfiles unchanged |
| Static analysis (Semgrep `p/javascript`, `p/nodejsscan`, `p/github-actions`) | **PASS** for new code | Pre-existing warnings only (`products.js`, `ci.yml` lines 567–664) |
| Secret scan (gitleaks, every commit) | **PASS** | |
| CodeQL | **NOT TESTED locally** | Repository default setup on the PR |
| Provider contract (live, non-blocking) `check:gains-account-live` | **PASS** | Fresh; collaterals DAI/WETH/USDC/GNS |
| Fault injection | **PASS** for provider faults (scenarios and browser) | RPC faults **NOT TESTED** (no RPC use exists) |
| Browser security suite (`test:browser:security`) | **NOT TESTED locally** | Runs in CI |
| Release gates (`docs:check`, status self-tests, `test:release`) | **PASS** | Full `release:build --candidate` needs Directus: CI |
| Write-path tests (approval, submission, reconciliation) | **NOT TESTED** | Nothing to test; not built |

## 7. CI defects on PR #169 and fixes

| Check | Root cause | Fix |
| --- | --- | --- |
| Responsive matrix (3 shards) | The static-host matrix still let the browser call live `api.gains.trade`. One response without CORS headers was logged as a critical console error | `e2e/helpers/market-fixtures.cjs` serves documented Gains fixtures and aborts other external origins. Live availability is checked separately and non-blocking (Upstream watch: `check:gains-live`, `check:gains-account-live`) |
| Release package gates | `status.json` recorded v0.7.0 after v0.8.0 was published. The status self-tests hard-coded v0.7.0 | v0.8.0 recorded from the Release, tag and manifest evidence. GLOBAL Web/API verified separately via `/version`. Self-tests follow the recorded release |

## 8. Operational readiness (for a future execution release)

| Area | Today | Required before activation | Owner |
| --- | --- | --- | --- |
| Provider availability monitoring | Weekly non-blocking live checks; UI states | Continuous synthetic checks of reads and Trading API health; alerting | Operations |
| Network / RPC outage detection | None (no RPC use) | RPC health and finality monitoring; fallback provider policy | Operations + engineering |
| Application error reporting | Server logs (no wallet in error messages) | Client error reporting with redaction; per-flow error rates | Engineering |
| Incident escalation | General runbooks | Execution incident runbook; kill switch owner; Gains contact | Owner + operations |
| Rollback | Revert PR; previous immutable release | Server-side kill switch that blocks new writes without redeploying | Engineering |
| Secret management | Blueprint `sync: false`; no execution secrets | Execution must not add signing secrets | Security |
| Dependency updates | Dependabot, OSV/Trivy, SBOM | Pinned, reviewed execution SDK; licence review | Engineering + security |
| Regional deployment | GLOBAL (Render) and IRAN (Liara) | Eligibility per region, decided by counsel; IRAN regional runtime implications (C1, C5) | Owner + legal |
| Feature flags | None needed (no execution code) | Default-off, server-enforced, audited activation | Engineering |
| Data consistency | Gains is authoritative; no Perpetual ledger | Intent log reconciliation job | Engineering |
| Recovery | Reads recover automatically | Procedures for stuck or timed-out orders (reclaim guidance) | Support + engineering |
| User support | General support queue | Trade-support playbook; dispute policy (C11) | Support lead |

## 9. Code changes completed (PR #169)

- Read adapter hardening: provenance, freshness, error codes, fail-closed decoding.
- Perpetual context flags.
- Product identity labels; source and freshness bar.
- Accessibility: tabs, target size.
- Locale strings.
- Deterministic backend scenarios.
- Readiness and simulation browser suites.
- Offline responsive matrix.
- Non-blocking live account check.
- Release record reconciliation.
- ADR 0047; execution RFC; this report.

**No execution code, contract address, allowance, delegate or signer was added.**

## 10. Production blockers and required approvals

| Blocker | Owner | Status |
| --- | --- | --- |
| C1–C11 compliance decisions | Legal counsel; the owner (`algomanlife`) appoints and accepts | Open |
| Gains integrator terms and permissions (C2) | Owner (`algomanlife`) | Open |
| Signing-model decision (RFC section 4) | Security architecture reviewer | Open |
| Execution implementation (RFC sections 7–8) | Engineering | Not started (needs the decisions above) |
| Independent security review and smart-contract integration audit (threats T6–T10, T12–T13) | External reviewer | Open |
| Testnet validation on Arbitrum Sepolia | Engineering | Not started |
| Operational readiness (section 8) | Operations | Open |
| Written management activation, recorded in an ADR and `status.json` | Owner (`algomanlife`) | Not given |

Named individuals for legal, security and operations do not exist in the repository. The owner must assign them. This report does not invent them.

## 11. Final verdict

| Question | Verdict |
| --- | --- |
| Is the read-only Gains integration ready for code review? | **Yes, subject to PR #169 CI.** Shared wallet and session, isolation, and accurately labelled Gains reads are verified locally |
| Is the full UI lifecycle exercised in isolation? | **Yes**, as a labelled test-only simulation. It is not a trading capability |
| Is the owner's requested Gains trading product delivered? | **No.** The execution path, eligibility, disclosures and reconciliation do not exist |
| Is live leveraged trading authorized? | **No.** Every compliance item is unresolved, and no security audit or management activation exists |

Passing CI authorizes nothing: no deployment, release or activation.
