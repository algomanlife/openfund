# ADR 0028 — Manual payment, treasury by network, campaign landing, English chart layer, SL/TP creation and Lotage

- **Status:** Accepted (implementation on branch `agent/claude/checkout-campaign-chart-trading`; not deployed)
- **Date:** 2026-11-13

## Context

Seven product requests share one branch: a manual payment method next to
DePay, the Openfund Treasury per network on the transparency page, a fa/en
sales-campaign landing, an English-only Vela chart layer, creating SL/TP on
the chart for positions opened without them, an enabled Lotage sizing mode,
and two landing CTAs into the checkout. Each one had to reuse the existing
architecture: one order and verifier, one settlement configuration, one
terminal, one checkout and the existing position-update service.

## Decision

### Manual payment (same order, same verifier)

- The checkout offers **Pay with DePay** and **Manual Payment** on the same
  server order. The manual instructions are derived from the settlement
  configuration DePay already uses (`PURCHASE_PAYMENT_CHAINS`: receiver =
  the Openfund treasury on that chain, settlement token, decimals). Nothing
  about the treasury addresses is hard-coded in code.
- `POST /purchases/verify` (existing) is the only manual entry point. The
  submitted transaction id is a pointer; `verifyAndConfirm` and the chain
  verifiers prove the token, receiver, amount (exact base units from the
  order's server price), success, finality, block time and single use.
- **Correlation.** An EVM manual payment must be signed by the customer's
  sign-in wallet (unchanged rule). A Solana manual payment cannot be tied to
  the EVM sign-in wallet, so it must carry the order id in an SPL Memo
  (`memo_missing` otherwise); without it anyone could claim a stranger's
  transfer to the treasury.
- A retryable verdict moves the order to `payment_detected`, shown as
  **Verification Pending**; the existing recovery sweep keeps checking. The
  route is rate limited (10/min per client and path).
- Two concurrency gaps were closed: a second order racing for the same
  transaction now gets `tx_already_used` (UNIQUE violation mapped) instead of
  a retryable provisioning error, and a different transaction for an
  already-paid order is refused (`order_already_paid`) instead of being
  reported as a replay.
- Customer statuses are a display mapping of the existing order state machine
  plus the latest attempt (`checkoutStatus.ts`); no new order state exists.

### Treasury by network

`GET /economy/treasury/networks` reads, for every configured settlement
chain, the native balance and the settlement token balance of that chain's
receiver through the same dedicated RPC endpoints (`PURCHASE_RPC_URLS`).
Decimals and symbols come from the chain. Balances are never summed or
priced, and are labelled as not revenue, profit, payout liquidity or
reserves. Each network is cached for five minutes, refreshed single-flight
and isolated: a failed network keeps its last good read flagged stale with
its read time, or shows an error without a number.

### Campaign landing

`/fa/campaign` (RTL) and `/en/campaign` (LTR) only; other locales redirect to
`/en/campaign`. Prices come from `/purchases/plans`, rules from the plan
catalog, images are genuine captures of the current build. Every purchase
CTA goes to the one checkout route. UTM parameters (safe charset only) are
carried to the checkout and emitted as `openfund:campaign` events; no
personal data is collected.

### Vela chart layer: English only, LTR always

The bridge always mounts Vela with locale `en` (its `setLocale` keeps
English); no other Vela locale is registered; `#chart-host` is `dir="ltr"
lang="en"`; host strings painted inside the chart (Settings → Trading,
execution marks, position labels, chart notices) are English; and the
terminal's static translator no longer rewrites Vela tooltips, menus or
dialogs. Openfund controls placed over the chart (quick trade) are marked
`data-openfund-ui` and keep the terminal language. No calculation, data,
footprint, order or engine code changed.

### SL/TP created on the chart

On a tradable account a position without SL/TP gets a zero-height
`of-position` box (no zones). Both levels are editable; a missing level's
handle sits on the entry at the box's right end and creates the level when
dragged off the entry (with both missing, the drag direction picks SL or TP).
`riskEdit({ allowCreate })` keeps each level on its own side, at the
market's price precision, and treats a level that rounds back onto the entry
as not created. The dropped price goes through the existing `modifyRisk`
service, serialized per position; only the confirmed position is redrawn.

### Lotage

Gains has no lot concept (position size = collateral × leverage; size in
base-asset units). Lotage is an Openfund convention applied only where one
industry unit exists and the engine prices in USD: USD-quoted forex
(100,000 base units), XAU/USD 100 troy oz, XAG/USD 5,000 troy oz, WTI/USD
1,000 barrels; minimum and step 0.01 lot. Crypto, stocks, indices, other
commodities and non-USD quotes show an explained "unavailable". Lots →
quantity → the canonical collateral (rounded up to cents) — the same path as
the quantity mode; the order contract and the engine are unchanged.

## Consequences

- No new environment variable, service, table or migration. The optional
  public `tokenSymbol` field in `PURCHASE_PAYMENT_CHAINS` labels the
  settlement token.
- Lotage conventions and the Solana memo requirement are product decisions
  recorded here for owner approval ([Lotage](../trading/LOTAGE.md),
  [Manual payment](../payments/MANUAL_PAYMENT.md)).
- Exchange withdrawals cannot pay an order manually (EVM: wrong sender;
  Solana: usually no memo); DePay remains the path for those payers.
