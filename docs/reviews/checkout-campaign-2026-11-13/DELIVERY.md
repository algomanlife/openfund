# Checkout, campaign, chart and trading completion — local evidence (2026-11-13)

Branch `agent/claude/checkout-campaign-chart-trading`;
[ADR 0028](../../decisions/0028-manual-payment-treasury-networks-campaign-chart-english-lotage.md).
Everything below is **local verification** of a production Vite build served
by the backend at `localhost:8191` on a disposable PostgreSQL database
(`SIM_TEST_MODE`). Nothing was deployed and no real payment was made.

Local payment configuration for the run: the seven owner-approved settlement
chains with the treasury receivers and USDC contracts, read through public RPC
endpoints (production uses the dedicated `PURCHASE_RPC_URLS`). DePay keys were
not configured, so the DePay button is hidden in these captures.

## Captures (unedited Chromium, JPEG)

| File | What it shows |
|---|---|
| [checkout-manual-evm-en.jpg](checkout-manual-evm-en.jpg) | Manual Payment on an EVM network: network/token selector, server amount, treasury address with copy and explorer link, sign-in-wallet rule, Awaiting Payment |
| [checkout-manual-solana-fa.jpg](checkout-manual-solana-fa.jpg) | Persian checkout, Solana: Solana treasury, Solscan link, order memo; a well-formed but nonexistent signature stays Verification Pending (no receipt) |
| [transparency-treasury-fa.jpg](transparency-treasury-fa.jpg) | Treasury wallets by network: seven live on-chain reads, native + USDC with on-chain decimals (BNB Smart Chain USDC = 18) |
| [home-fa-1440.jpg](home-fa-1440.jpg), [home-fa-390.jpg](home-fa-390.jpg) | Home Prop card: existing button plus the new quick Buy Challenge button (Home content served from the repository seed through a Playwright route; Directus was not running) |
| [wallet-card-en.jpg](wallet-card-en.jpg) | Connected-wallet card: Buy Challenge under "Ready to choose a challenge" |
| [campaign-en-1440.jpg](campaign-en-1440.jpg), [campaign-fa-390.jpg](campaign-fa-390.jpg) | Campaign landing, English desktop and Persian phone (first 3,000 px) |
| [sltp-created-long.jpg](sltp-created-long.jpg), [sltp-created-short.jpg](sltp-created-short.jpg) | SL/TP created on the chart for positions opened without them (from `e2e/test-terminal-risk-workspace.cjs`); English chart layer; Entry Price column; Lotage unavailable for BTC/USD |

The campaign page's own images are listed with provenance in
[the screenshot manifest](../../assets/screenshots/manifest.json).

## Browser checks run

- `e2e/test-terminal-risk-workspace.cjs`: 86/86 (adds LONG and SHORT: TP
  created alone, wrong-side SL refused with no write, SL created, both shown).
- `e2e/test-chart-indicators.mjs`: 17/17. `e2e/test-wallet-connect.cjs`: 32/32.
- Local probe (Playwright, disposable signer): 28/28 — Home and wallet-card
  CTAs (client-side, no new signature), manual checkout in both languages,
  campaign RTL/LTR at 1440/820/390 px with SEO tags, other locales redirect,
  transparency cards, no uncaught page errors.
- Chart-layer language probe: no Persian text in `#chart-host` or any Vela
  node in the Persian terminal; quick trade keeps `dir=rtl lang=fa`.

Not run here: `e2e/test-purchase-flow.cjs` needs a running Directus (the
challenge builder loads plans from it); `e2e/test-depay-checkout.cjs` needs its
own DePay key setup.
