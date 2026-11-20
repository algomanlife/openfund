# RFC — Gains-powered Openfund Perpetual: execution architecture review

- **Status:** Draft for independent review. Nothing in this RFC is implemented or authorized.
- **Date:** 2026-11-20
- **Scope:** requirements and architecture options only. This RFC does not implement or activate leveraged order submission, token approvals, collateral transfers or delegated signing.
- **Related:** [ADR 0047](../decisions/0047-perpetual-gains-read-only-readiness.md) (read-only boundary), [Gains integration](../integrations/GAINS.md), [Perpetual](../trading/PERPETUAL.md), [Wallet identity](../wallet/IDENTITY.md).

## 1. Product intent

The owner's intended architecture:

- One wallet identity and one Openfund SIWE session.
- Two independent products:
  - **Prop** runs on Openfund's simulated evaluation engine.
  - **Perpetual** lets the user trade on Gains Network on Arbitrum One.
- Gains, not Openfund, is authoritative for real Perpetual positions, orders and collateral.
- Switching products never creates another identity.
- Prop balances, evaluation rules and positions never mix with Perpetual records.

**What exists today is a read-only Gains account view (PR #169 and earlier). It is not this product.** Section 3 lists the gap.

## 2. Sources and confidence

The Gains facts below come from official documentation read on 2026-11-20. Gains labels parts of it beta, and it may change. **Documented** means stated by Gains; Openfund has not independently verified it. Openfund has not called any Gains write interface, testnet or mainnet.

| Topic | Official page |
| --- | --- |
| Trading API overview (beta; Arbitrum mainnet and Arbitrum Sepolia) | https://docs.gains.trade/developer/trading-api/overview |
| Trading API authentication (agents, EIP-712) | https://docs.gains.trade/developer/trading-api/authentication |
| Trading API orders, positions, lifecycle states | https://docs.gains.trade/developer/trading-api/orders |
| Trading API errors and rate limits | https://docs.gains.trade/developer/trading-api/errors |
| Direct contract integration | https://docs.gains.trade/developer/integrators/trading-contracts |
| Delegated trading (on-chain delegate) | https://docs.gains.trade/developer/integrators/delegated-trading |
| Liquidation price guide (SDK) | https://docs.gains.trade/developer/integrators/guides/calculating-liquidation-price |
| Contract addresses (Arbitrum mainnet) | https://docs.gains.trade/what-is-gains-network/contract-addresses/arbitrum-mainnet |
| Eligibility and restricted regions | https://docs.gains.trade/help/eligibility-and-restricted-regions |

Contract addresses and ABIs are deliberately not copied into this RFC. An implementation must take them from the official source at build time, and the security review must verify them.

## 3. Existing read model vs requested product

| Capability | Today (verified in repository) | Requested product | Gap |
| --- | --- | --- | --- |
| Identity | One SIWE session (Arbitrum One) shared by both products | Same | None |
| Account data | Read-only: open trades, pending orders, history, stats; provenance and freshness | Same, plus live updates after the user's own actions | Post-action reconciliation |
| Market data | Gains prices/candles (REST/WS), Vela chart | Same, plus execution-relevant quotes | Fees, spread and price impact before submit |
| Open / close / modify / cancel | Not implemented; UI controls disabled | Required | Entire execution path |
| Collateral approval | Not implemented | Required for ERC-20 collateral | Allowance policy and UI |
| Liquidation price, fees, uPnL | Not shown (never approximated) | Required for informed trading | Official SDK or Trading API values |
| Eligibility | Not implemented; locale is not residency evidence | Required before any write | Policy, controls, legal review |
| Risk disclosure | Read-only notices | Required, product-specific | Content and acknowledgement flow |
| Signing | Only SIWE login messages | Transaction or agent signatures | Signing model (section 5) |

The vendored `@gainsnetwork/sdk` is documented for calculations and types (for example `getLiquidationPrice`). Gains documents execution helpers under different packages: `@gainsnetwork/trading-sdk` for contract builds and `@gainstrade/api` for the Trading API. Openfund vendors neither. **Do not treat the vendored SDK as a supported execution integration.**

## 4. Official integration options

| | A. Trading API (agent) | B. Direct contract calls, user-signed | C. Hand-off to the Gains app |
| --- | --- | --- | --- |
| Status | Documented beta; mainnet production rate limits not yet published | Documented integrator guide | No integration needed |
| Who signs each trade | An authorized **agent** key signs requests and broadcasts the prepared transaction | The user's wallet signs every transaction | The user, in the Gains app |
| Setup | User signs an EIP-712 authorization, sends a `setTradingDelegate` transaction, and approves collateral for the Diamond | User approves collateral for the Diamond | None in Openfund |
| Custody | Gains states it never holds funds or keys | None | None |
| Agent risk | The on-chain delegation is documented as "not a granular permission system". Scope limits are enforced off-chain. The delegate can also call `withdrawPositivePnl` (paid to the trader) | Not applicable | Not applicable |
| Openfund key handling | Someone must hold the agent key. A server-held agent is a **backend signer**, which this repository forbids | None | None |
| UX | No wallet prompt per trade | A wallet prompt per trade | Leaves Openfund |
| Testnet | Arbitrum Sepolia documented | Testnet Diamond address documented | Not applicable |

**Recommendation for review:** evaluate **B** (user-signed transactions) as the baseline. It keeps the user's wallet as the only trading authority and needs no Openfund signer. Consider **A** only if the security review approves a design where the agent key never leaves the user's device and authorization and revocation are fully user-controlled. **C** is the zero-risk fallback if eligibility or legal review cannot be completed.

## 5. Identity, session and authority boundaries

- **SIWE proves identity only.** It never authorizes a trade. Every write is authorized by a wallet signature (B), or by an agent the user explicitly authorized and can revoke (A).
- **The connected wallet must match the session wallet.** Before any write prompt, the client checks:
  - the connected wallet equals the session wallet;
  - the chain is Arbitrum One (42161);
  - the target contract matches the verified configuration.

  A wallet or chain change aborts any prepared action.
- **No backend signer, no private keys and no custody,** in any option.
- **No chain switching without the user's action.** A wrong network blocks writes; it is never silently changed.
- **Prop authority never touches Perpetual.** The Prop engine, ledger and evaluation must not accept, mirror or score Perpetual activity. There is no shared mutable trading provider (ADR 0047).

## 6. State ownership

| State | Owner | Openfund role |
| --- | --- | --- |
| Positions, orders, collateral, fills, PnL, liquidation | Gains contracts and backend | Read and display with provenance; never store as financial records |
| Allowances and balances | The ERC-20 contracts | Read the allowance before prompting; never infer balances |
| Transaction status | Arbitrum One | Track by hash; show pending until the provider confirms |
| User intent log (optional) | Openfund | Non-financial audit record (what the user requested and when), for support and reconciliation; never a source of truth for exposure |
| Journal notes | Openfund | Existing private, product-scoped journal |

## 7. Supported operations (requirements level)

A first execution scope should be the smallest useful set: market open, market close (full and partial), TP/SL update, and limit/stop order create and cancel. Leverage and collateral changes need separate review.

Each operation must:

1. Validate inputs against current Gains market metadata (leverage bounds, minimum size, market open), from a fresh source.
2. Show fees, spread or price impact, slippage, and liquidation price **from official calculations**. If a value is unavailable, block the action instead of approximating.
3. Show exactly what will be signed: contract, function, amounts and collateral token.
4. Require an explicit confirmation on a dialog that names Gains, Arbitrum One and the risk.
5. Submit only after the eligibility gate (section 10) passes for this session.
6. Track the result until a terminal provider state and reconcile (section 8).

## 8. Errors, cancellation and reconciliation

- **Lifecycle states (documented):** `prepared`, `pending`, `filled`, `rejected`, `timed_out`, `expired`.
  - Market orders time out after about 60 seconds on-chain.
  - Rejections carry reasons such as `SLIPPAGE`, `EXPOSURE_LIMITS`, `PRICE_IMPACT` and `MAX_LEVERAGE`.
- **The UI never shows success early.** "Submitted" (transaction broadcast) is distinct from "filled" (provider confirmed). A wallet rejection is a neutral user choice.
- **Timeouts:** the user is told the order did not execute and is offered the documented reclaim path (`cancelOrderAfterTimeout`, or `DELETE /orders/{id}` for the Trading API). Nothing is retried automatically.
- **Idempotency:** a client-generated intent id prevents double submission across refreshes, tab duplication and reconnects.
- **Reconciliation:** after every terminal state, and on reload, the account view re-reads open trades and history and compares them with the intent. A mismatch is surfaced, never hidden.
- **Wallet or session change mid-flow:** abort the local flow. A transaction already broadcast continues on-chain and is reconciled for its own wallet only.
- **Provider unavailable or stale data:** writes are blocked. Reads follow the existing stale/outdated labels.

## 9. User-facing risk information

At minimum, before the first trade and in the order dialog:

- Leveraged perpetuals can lose the entire collateral quickly. Liquidation is automatic.
- Trades execute on Gains Network on Arbitrum One, not on Openfund. Openfund does not hold funds and cannot reverse transactions.
- Fees: opening/closing, borrowing/funding and network gas.
- Oracle-priced execution can differ from the displayed price; slippage limits apply.
- Smart-contract, oracle and network risks.
- Collateral approval lets the Gains contract move the approved token amount.
- **Perpetual is not Prop.** It has no evaluation, no simulated balance and no funded-account relationship.

Counsel must review the wording. It must not be machine-translated into any locale.

## 10. Eligibility requirements

- A **minimum age** set by legal review: at least the age of majority in the user's jurisdiction. Gains' eligibility page states no age.
- **Gains restrictions:** the terms exclude the US and its territories, US persons, sanctioned persons, and VPN use to hide a US location. Some asset categories have further regional checks.
- **Sanctions** screening policy defined by legal review.
- **An IP address, locale or wallet connection is not proof of eligibility.** No workaround for restrictions.
- The integrator's enforcement responsibilities are **not stated** in the Gains docs. Openfund must confirm them with Gains and counsel before launch.
- Attestations and checks are recorded per user and product, without storing more personal data than the policy requires.

## 11. Independent review requirements

| Review | Must cover |
| --- | --- |
| Security architecture | Signing model (section 4); no backend signer; allowance policy (exact amount vs unlimited); contract/ABI verification and pinning; chain and wallet guards; phishing-resistant confirmation UI |
| Smart-contract integration audit | Call construction, slippage and price parameters, referrer parameter, revert handling, the `contractsVersion` compatibility check |
| Application security | Auth/session boundaries, CSRF, injection in the prepared-transaction display, logging (no keys or full addresses where avoidable) |
| Legal / compliance | Eligibility policy, risk disclosures, integrator terms with Gains, marketing claims, data retention |
| Operations | Monitoring, incident runbook, kill switch, rate-limit budget |
| Owner / management | Written activation decision, recorded in an ADR and `docs/status/status.json` |

## 12. Provider dependencies and failure scenarios

| Scenario | Required behavior |
| --- | --- |
| Gains backend or Trading API down | Writes blocked; reads labelled unavailable or outdated |
| Price or metadata stale | Writes blocked; stale labels shown |
| Contract upgrade or `contractsVersion` change | Writes blocked until the new version is reviewed (fail closed on unknown version) |
| Arbitrum RPC degraded or reorg | Pending state persists; reconcile by hash and provider records |
| Market order timeout | Explicit "not executed", reclaim path offered |
| Rate limits (mainnet values unpublished) | Back off; never retry writes automatically |
| User's wallet changes chain or account mid-flow | Abort; reconcile any broadcast transaction for its own wallet |
| CORS or edge failures in the browser | Same as provider down; layout tests stay offline (fixtures) |
| Eligibility service unavailable | Writes blocked (fail closed) |

## 13. Phased plan (each phase needs the previous phase's approvals)

0. **Read-only view.** Done; PR #169 hardens it.
1. **Reviews:** legal, eligibility and security reviews of this RFC. No code.
2. **Testnet prototype** on Arbitrum Sepolia, behind a development-only build flag that cannot be enabled in production builds. Uses test tokens only and the chosen signing model, with full lifecycle and reconciliation tests.
3. **Independent security audit** of the prototype. Fix and re-audit.
4. **Mainnet limited release** after management activation: allow-listed users, low limits, kill switch, monitoring.
5. **General availability** after the limited-release review.

## 14. Open questions

1. Who enforces Gains' restricted-region and US-person rules for third-party interfaces, and under which terms?
2. Is there an integrator or front-end agreement, referral or builder-fee policy, and what does it require of Openfund?
3. When will the Trading API be production (non-beta), and what are its mainnet rate limits?
4. Which execution package does Gains support for user-signed transactions (`@gainsnetwork/trading-sdk`?), and what are its licensing and versioning?
5. Which official source should Openfund use for pre-trade fees, price impact and liquidation (SDK or Trading API fields)?
