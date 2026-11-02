# Openfund integrated fixes — delivery 2026-11-02

English preservation of the original Persian delivery report for PR #24. This is historical evidence from that implementation, not a fresh validation run for the repository transformation.

## Git baseline and scope

Work began from `origin/main` at `1aaa806`, including PR #23 and Home commit `48f68bc`. The official remote, PRs #13–#23, architecture, AGENTS, tests and Blueprint were inspected. The supplied parent directory was not a Git repository; older `dual-terminals` and `landing-pages` checkouts were preserved. Changes used the isolated `integration-audit` worktree on `codex/trading-wallet-integration-audit`.

This delivery covered local code fixes and verification. It did not deploy production, validate an actual wallet extension, or send Prop orders to Gains or a chain.

## Confirmed problems and corrections

| Problem | Cause | Correction |
| --- | --- | --- |
| Extra Home navigation | Existing `nav=false` option was not enabled | Reused Layout; internal page navigation retained |
| Perpetual entry opened Prop | CTA targeted old `/terminal` route | Direct locale/product route |
| Incomplete account path | Arbitrum Sepolia-only SIWE and missing product links | Sepolia for Prop, Arbitrum One for Perpetual; both dashboard links |
| Previous-wallet private data | Async responses and unordered cookie changes | Address matching, immediate clearing, ordered verify/logout and disconnect revocation |
| Concurrent nonce reuse | Separate read/consume steps | Conditional atomic consumption plus URI/time/chain checks |
| Shared idempotency response leak | Unowned lookup | Owner-scoped keys, historical reads preserved, different payload rejected |
| Insufficient-fee orders accepted | Margin-only validation | Opening fee, equity/open loss and trigger-time revalidation |
| PnL mismatch and lost price precision | Browser recomputation and two-decimal prices | Shared server Decimal policy; server position values rendered |
| Overstated net analytics | Opening fee absent from round trip | Both fees included; historical ledger unchanged |
| No partial close | Full-close-only path | 25%/50%/100% controls, proportional atomic idempotent settlement |
| Fill/cancel/protection races | Inconsistent locking | Account-first locking then order/position within transactions |
| Stale prices appeared valid | Freshness missing in some reads | Unknown stale valuations; automatic execution rejects stale marks |
| Feed/timer recovery | No bootstrap retry; repeated refresh timers | Single retry/refresh lifecycle, source time and numeric checks |
| Mobile header overflow | Unwrapped network/account chips | Wrapping and width constraints |
| Missing Home backdrop | Reference to absent SVG | CSS lighting behind approved logo/copy/cards |

## Financial policy

`trading-math.js` became the shared Decimal source for Engine and Portfolio. Notional is margin × leverage; quantity is notional ÷ execution entry. Gross PnL uses quantity and mark/entry difference; exit estimates include spread and closing fee, while round trips include both fees. Balance comes from the ledger; usable margin is equity-based and opening validation is also cash-capped. Open profit does not create new collateral; unknown values do not become zero.

Prop liquidation incorporates closing fee and spread in the maintenance condition. Stop/limit trigger and close prices follow the simulation policy. Depth-driven slippage, gap guarantees and funding/borrowing are not modeled.

Partial closes create a closed slice with `parent_position_id`; the original retains remaining quantity/margin/opening fee, order/open time, protection and ownership. Settlement applies only to the closed share. Existing ledger rows remain unchanged; retries return their recorded result.

Account realized PnL includes fees. The database close-settlement field is retained separately as `close_settlement_pnl`; position records expose `net_pnl`. Closed-only analytical balance changes reconcile with initial virtual funding after all positions close.

Observed daily/max drawdown is persisted in UTC, starting with the first fresh observation of a day and exposing `since`. Missing historical marks are not reconstructed. Free Demo is not assigned a paid challenge's loss rules, so commercial limits remain null.

## Gains comparison

The npm and vendored SDK version examined was `1.8.10`, alongside official SDK, fee/spread and v10 migration documentation. Openfund remains a virtual-DAI simulation using simplified asset-class fees and configurable maintenance. It does not implement Gains borrowing/funding accumulators, skew, fee decay or multi-collateral contract settlement, and does not claim v10 parity. Perpetual uses supported wallet reads and does not invent unavailable net PnL or balances.

## Wallet, Portfolio and Terminal

One identity/session provider and one shared terminal were preserved. Prop uses Ethereum Sepolia `11155111`; Perpetual uses Arbitrum One `42161`. Network switches and signatures are requested through the wallet; no user seed/private key is requested. EIP-1271 uses the message chain.

Portfolio/dashboard requests are cancellable and refresh around five seconds for Prop and fifteen seconds for Gains, with twenty-second upstream account caching. Terminal uses SSE and server PnL/ROI/liquidation, with disconnection indicators and session revalidation. Product financial and journal state remain isolated.

## Home and Render

Home's extra links were removed using Layout. Motion uses CSS transforms, three desktop/two mobile lighting layers and reduced-motion support; no canvas, WebGL or layout animation was introduced. The original screenshot remains in [historical Git evidence](https://github.com/algomanlife/openfund/blob/2f5cf93afcbd97caa9b80e6de8a703fa707f6e16/docs/reviews/integration-audit/home-fa-desktop.png).

The three Render resources were preserved: Node `openfund`, PostgreSQL 17 `openfund-db`, Directus 11.9.1 `openfund-cms`. Same-origin `/react/`, APIs, cookies and Engine/SSE remain. No static service, Redis, worker, custom Dockerfile or production database was added.

Blueprint repairs cover devDependencies for builds, public SIWE/CMS hostnames, Directus database keys, common region and one engine instance. Already-provisioned resources in a different region require Render's migration procedure; this PR did not migrate them. Additive migrations ran twice on an isolated database; no existing database reset, ledger rewrite or production apply occurred.

## Historical verification

Environment: Node `22.23.4`, PostgreSQL `17.11`, isolated test database.

| Check | Reported result |
| --- | --- |
| TypeScript | Passed without swallowed errors |
| Frontend units | 17 passed |
| Backend SIWE/Trading/Portfolio/Products/Gains/Audit | 181 passed |
| Live Directus/Gains browser reads, generated signer | 94 checks |
| Controlled CMS/Gains browser protocol fixtures, generated wallets | 31 checks |
| Production install/build | Passed, existing chunk-size warning |
| Production-mode local smoke | 7 checks; cookie flags, not deployed TLS transport |
| Migration | Applied twice |
| Blueprint structural/semantic validation | Passed, two services and one database |

Browser suites run sequentially after backend tests because deterministic price injection shares a process. PnL assertions await a fresh SSE snapshot; position presence alone does not establish a new mark. [Machine-readable historical results](validation.json) retain the original environment/baseline.

## Limits

Actual MetaMask/Rabby extensions, remote WalletConnect, hardware wallets, live contract wallets and deployed HTTPS sessions were not validated. Generated signers produce real ECDSA/SIWE but do not establish device/network acceptance. Gains execution remained disabled. Authenticated Render CLI, Blueprint apply, production health and Render Directus were unverified. Commercial challenge enforcement, Prop funding/borrowing accumulators and drawdown before measurement start were not delivered.

Main changed areas were Engine/Market Data/Portfolio/Server/Schema, Wallet/Session, TradingBridge/shared terminal, Home/Layout, Blueprint/validator, CI, tests and documentation. Merge requires review; local changes are not a production deployment.
