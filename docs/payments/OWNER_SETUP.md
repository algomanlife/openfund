# DePay checkout — owner setup runbook

Status: **code ready on branch `agent/claude/depay-checkout-activation`; production
purchases stay off until the owner completes the steps below.** No real payment
has been made. Every value marked *owner* cannot come from the repository.

## What blocked purchases (evidence, 2026-11-13)

| # | Blocker | Evidence | Fixed by |
| --- | --- | --- | --- |
| 1 | DePay's dynamic configuration URL points at `/api/payments/depay/config`; Openfund only served `/purchases/depay/configuration` | Render request logs: three `POST /api/payments/depay/config` → **404**, user agent `DHC (2.4.0; Integrate)` (DePay), 10:47 UTC, when the official widget was opened on `https://openfi.cloud`. DePay then answered the widget with HTTP 500 → "Unable to load payment configuration!" | Code: `/api/payments/depay/{config,configuration,callback,events}` now run the same signed handlers (`DEPAY_PATHS` in `apps/backend/purchases.js`) |
| 2 | No settlement chain is configured | Render (read-only, values not printed): `PURCHASE_PAYMENT_CHAINS`, `PURCHASE_RPC_URLS`, `PURCHASE_PAYMENT_RECEIVER`, `PURCHASE_PAYMENT_TOKEN`, `PURCHASE_RPC_URL`, `PURCHASE_ROUTER_ADDRESSES` not declared. `GET /purchases/plans` → `paymentsEnabled:false`. Every DePay endpoint returns 404 while this is true, so the Pay button is hidden | Owner: step 2 |
| 3 | `PURCHASE_PAYMENT_DECIMALS=18` with chain `42161` | Arbitrum USDC has 6 decimals (on-chain `decimals()`); with the legacy variables a mismatch rejects every payment (`payment_misconfigured`) | Owner: delete it (step 2.4). Ignored once `PURCHASE_PAYMENT_CHAINS` is set |
| 4 | Smart-contract wallets (Safe, ERC-4337, Coinbase Smart Wallet) were rejected | `analyzePayment()` required `tx.to` to be the token or router (`unapproved_contract`) | Code: DePay-attested payments may come through a wallet contract; only Transfer logs from an approved DePay router or the DePay-reported payer count |
| 5 | A disabled checkout was silent | Nothing in the logs said why `paymentsEnabled` was false | Code: `[payments] readiness` lines at startup, `[depay] … rejected` warnings |

## Verified public addresses

Sources: Circle's official USDC list (developers.circle.com/stablecoins/usdc-contract-addresses),
on-chain `symbol()/name()/decimals()` via public RPC, the DePayRouterV3 README
(github.com/DePayFi/depay-evm-router), and the exact DePay widget bundle Openfund
serves (`depay-widgets-13.0.45.js`, which contains the same router addresses).
Each router address has 10,956 bytes of deployed code on its chain.

| DePay id | Chain id | USDC (Circle, 6 decimals) | DePayRouterV3 |
| --- | --- | --- | --- |
| `ethereum` | 1 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | `0x365f7B56D2fB16C8Af89D7d33b420E4e013461e8` |
| `arbitrum` | 42161 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | `0x328FE8bbd30487BB7b5A8eEb909f892E9E229271` |
| `base` | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `0x48825133EF08327535D0b24d73779E82BE6Ea4d9` |
| `optimism` | 10 | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` | `0x558302715e3011Be6695605c11A65526D2ba2245` |
| `polygon` | 137 | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | `0xe04b08Dfc6CaA0F4Ec523a3Ae283Ece7efE00019` |
| `avalanche` | 43114 | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | `0x39E7C98BF4ac3E4C394dD600397f5f7Ee3779BE8` |
| `solana` | 501 (internal) | mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | — (no EVM router) |

BNB Smart Chain is **not** in Circle's list: its "USDC" (`0x8AC7…580d`) is a
Binance-pegged token with **18** decimals. Do not add `bsc` unless management
explicitly approves that token.

## Step 1 — decide the owner values

| Value | Source | Rule |
| --- | --- | --- |
| Receiver address per chain (*owner*) | The company treasury wallet | A wallet the company controls **on that exact chain**. A Safe exists only on chains where it was deployed: a Safe address on Arbitrum is not automatically yours on Base. A hardware-wallet EOA works on every EVM chain. Solana needs a separate Solana address |
| RPC URL per chain (*owner*, secret) | Alchemy / Infura / QuickNode dashboard → app → HTTPS endpoint for that network | Mainnet, HTTPS, the right network (the server checks the chain id and refuses a mismatch) |
| Which chains | Management | Start with `arbitrum` + `base`; add others later by adding one entry each |

## Step 2 — Render (Dashboard → `openfund` → Environment)

1. Open <https://dashboard.render.com>, workspace **openfund**, service **openfund**, left menu **Environment**.
2. Click **+ Add Environment Variable**. Key `PURCHASE_PAYMENT_CHAINS`, value (one line; replace both `<RECEIVER…>`):

   `[{"blockchain":"arbitrum","token":"0xaf88d065e77c8cC2239327C5EDb3A432268e5831","receiver":"<RECEIVER_ON_ARBITRUM>","routers":["0x328FE8bbd30487BB7b5A8eEb909f892E9E229271"]},{"blockchain":"base","token":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","receiver":"<RECEIVER_ON_BASE>","routers":["0x48825133EF08327535D0b24d73779E82BE6Ea4d9"]}]` <!-- gitleaks:allow: public USDC and router contract addresses -->

   Further chains use the same shape with the table above, for example
   `{"blockchain":"ethereum","token":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","receiver":"<R>","routers":["0x365f7B56D2fB16C8Af89D7d33b420E4e013461e8"]}` <!-- gitleaks:allow: public contract addresses -->
   or `{"blockchain":"solana","token":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","receiver":"<SOLANA_ADDRESS>"}`. <!-- gitleaks:allow: public USDC mint -->
3. **+ Add Environment Variable**: key `PURCHASE_RPC_URLS` (secret), value:

   ```json
   {"arbitrum":"https://<ARBITRUM_MAINNET_RPC>","base":"https://<BASE_MAINNET_RPC>"}
   ```

   One key per chain listed in step 2 (`ethereum`, `optimism`, `polygon`, `avalanche`, `solana` as needed).
4. Find `PURCHASE_PAYMENT_DECIMALS` (currently `18`) → trash icon → delete. `PURCHASE_PAYMENT_CHAIN` may stay (ignored).
5. Leave `PURCHASE_PAYMENT_MIN_CONFIRMATIONS` empty (production default: 12 blocks per chain).
6. Keep `DEPAY_VERIFY_PUBLIC_KEY`, `DEPAY_CONFIG_PRIVATE_KEY`, `VITE_DEPAY_INTEGRATION_ID` (already set and well-formed: PEM public key, 2048-bit PEM private key, integration id `a42b60b9-ab0a-422e-ad3c-a5580d8ba64d`; the two keys are different key pairs, as required).
7. Optional, for mobile wallets: `VITE_WALLETCONNECT_PROJECT_ID` = Project ID from <https://cloud.reown.com> → your project (add `openfi.cloud` and `openfund.cloud` to its allowed domains). Without it only browser-extension wallets can sign in.
8. Do **not** set `VITE_DEPAY_WIDGET_URL`, `VITE_DEPAY_WIDGET_INTEGRITY`, `CSP_EXTRA_SCRIPT_SRC` or `CSP_EXTRA_FRAME_SRC` (the widget is vendored).
9. Click **Save, rebuild, and deploy** after the code PR is merged (or **Save only**, then deploy the merged commit from **Manual Deploy → Deploy latest commit**).

## Step 3 — DePay (app.depay.com → Integrations → integration `a42b60b9-…`)

| Setting | Value |
| --- | --- |
| Integration type | Payment Widget |
| Configuration | Dynamic |
| Dynamic configuration endpoint | `https://openfi.cloud/purchases/depay/configuration` (the currently stored `https://openfi.cloud/api/payments/depay/config` also works after this branch is deployed) |
| Your public key (for dynamic configuration) | The public half of Render's `DEPAY_CONFIG_PRIVATE_KEY`. Derive it on a trusted machine: `openssl rsa -in depay_config_private.pem -pubout` |
| Callback URL | `https://openfi.cloud/purchases/depay/callback` |
| Include sent token information | On |
| Events URL | `https://openfi.cloud/purchases/depay/events` |
| Restrict domains | `openfi.cloud` and `openfund.cloud` (each subdomain such as `www.` separately, only if used) |
| DePay public key (shown on the integration) | Must equal Render `DEPAY_VERIFY_PUBLIC_KEY` |
| Accepted tokens / denomination | Not used: the dynamic configuration returns the accepted chains, tokens, receivers and the server price per order |

## Step 4 — verify (no payment needed)

1. `https://openfi.cloud/version` shows the merged commit.
2. Render → **Logs**: `[payments] readiness: paymentsEnabled=true depayEndpoints=true depayConfiguration=true` and `[payments] chain arbitrum: ready` (one line per chain). Any `[payments] …` warning names the missing field.
3. `https://openfi.cloud/purchases/plans` shows `"paymentsEnabled":true` and the configured `chains`.
4. Sign in, open `/en/checkout`, choose a challenge, enter an email, accept, **Pay with DePay**. The widget must list the payment options. If it says "Unable to load payment configuration", read the log: `[depay] configuration request rejected: invalid x-signature` means `DEPAY_VERIFY_PUBLIC_KEY` is not DePay's key; no `[depay]` line at all means the dashboard endpoint URL is wrong; a 4xx from DePay in the browser means the domain restriction.

## Step 5 — first real payment (owner-approved, low value)

Use a temporary test plan/coupon so the net price is about 1–2 USD, pay once on a
non-Arbitrum chain through the widget, then record order id, transaction id,
`payments.route`, the invoice number and the challenge id in
[ACTIVATION.md](ACTIVATION.md). Until then real-network acceptance is open.

Rollback: delete `PURCHASE_PAYMENT_CHAINS` (purchases stop immediately; paid
orders, invoices and challenges are untouched).

## Treasury receivers

The approved Openfund treasury addresses (public, owner-provided 2026-11-13)
are the `receiver` values of `PURCHASE_PAYMENT_CHAINS` — the single place they
are configured. DePay settlement, the manual-payment instructions
([Manual payment](MANUAL_PAYMENT.md)) and the per-network treasury balances on
the transparency page all read them from there; no code hard-codes them.

| Networks | Receiver |
|---|---|
| EVM: Ethereum, Arbitrum, Base, Polygon, Optimism, BNB Smart Chain | `0x2BB7c512Bb3bADfCC543D5E5309d98872b10E6B9` <!-- gitleaks:allow: public treasury address --> |
| Solana | `9U7cmxeHzLYBRh5gWxgzsteP8hTfZSQMfoHKSN6SQSpM` <!-- gitleaks:allow: public treasury address --> |

Each chain entry may add the public display field `"tokenSymbol": "USDC"`
(shown in the manual instructions; verification always checks the contract or
mint itself). Every listed chain needs its dedicated endpoint in
`PURCHASE_RPC_URLS` — the same endpoints read the treasury balances. Changing
the receivers in production is an owner action in the Render dashboard.
