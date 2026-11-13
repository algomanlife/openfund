# Openfund Treasury and economy data sources

Every public economy figure has exactly one source. Figures are never typed in by hand and never estimated.

## Treasury snapshots

- **Address:** `TREASURY_WALLET_ADDRESS`, a public address in backend configuration. It is not hardcoded and no key material exists in the system. While it is unset, the report shows `Not configured`.
- **Balances:** read on-chain at a single block (`getBalance` for the native asset, `balanceOf` for each ERC-20 in `TREASURY_ASSETS`).
- **USD value:** only from the Chainlink aggregator configured for the asset (`latestRoundData`). An asset is left unpriced (`priceError`) if its answer is non-positive, older than `TREASURY_PRICE_MAX_AGE_MINUTES`, unreadable, or has no feed. Unpriced assets are excluded from the USD total, and the snapshot is marked `fully_priced=false`. Values are computed in exact integer arithmetic and floored to cents.
- **Schedule:** every `TREASURY_REFRESH_MINUTES`, clamped to 60–120 with a default of 90. The backend checks every five minutes and reads only when the last good snapshot is due.
- **Failure handling:** a failed read is stored as `status='error'`. The report keeps serving the last good snapshot labelled `stale`. A snapshot is also stale when it is older than twice the interval.
- **History:** the last good snapshot of each day.
- **Flows:** inflows are confirmed challenge payments whose on-chain receiver is the treasury address. Outflows are transfers recorded with a reference: paid withdrawals, ambassador payouts, completed live settlements, paid expenses and refunds. Flows are not inferred from general chain traffic.

## Treasury wallets by network

`GET /economy/treasury/networks` (public, rate limited) lists every configured
settlement chain's treasury receiver (`PURCHASE_PAYMENT_CHAINS`, see
[Owner setup](../payments/OWNER_SETUP.md#treasury-receivers)) with its native
balance and settlement-token balance, read on-chain through the payment RPC
endpoints (`PURCHASE_RPC_URLS`). Decimals and symbols are read from the chain
(ERC-20 `decimals()`/`symbol()`, SPL token accounts). Balances are shown per
network only — never summed, priced or presented as revenue, profit, payout
liquidity or reserves. Each network is cached for five minutes and refreshed
single-flight; a failed read keeps the last good balances flagged
`stale` with their `readAt`, or reports `error` with no number. A network
without an RPC endpoint reports `rpc_not_configured`. The transparency page
renders this as "Openfund Treasury wallets" (`TreasuryWallets.tsx`); the
snapshot below remains the source of the financial position.

## Financial position

Three figures are reported separately and never merged:

| Figure | Definition |
|---|---|
| Gross Treasury Balance | USD total of the latest good, priced snapshot |
| Outstanding Financial Obligations | Approved unpaid trader rewards + positive unpaid ambassador commission balances + unsettled live profit shares + verified unpaid expenses + open recorded liabilities |
| Available Allocatable Capital | Gross − obligations − (operational + risk + other reserves) − max(active allocations, open live margin) |

Each obligation comes from a single table (`withdrawal_requests`, `referral_commissions`, `settlement_records`, `verified_expenses`, `financial_obligations`). Open-trade margin is drawn from its allocation, so only the part above the allocation is added. Nothing is subtracted twice.

The position is `verified` only when the snapshot exists, is fresh, is fully priced, and both operational and risk reserves have been set explicitly. Otherwise it is `Unknown / Not verified`, the missing inputs are listed, and Live Market Access cannot allocate.

## Report sections and definitions

| Section | Source and definition |
|---|---|
| Sales | `purchase_orders` with `status='paid'`, a state set only by verified payment. Net revenue is gross minus refunds and chargebacks from `payment_adjustments`. Payment success rate is paid ÷ (paid + expired + cancelled). |
| Challenges | `openfund_challenges`, read only. Final pass means the final stage (stage = number of phases) has `status='passed'`. Funded means instant (stage 0) or a final pass. Stage pass rates are passed ÷ (passed + failed + expired). |
| Payouts | `withdrawal_requests`: `approved` is an obligation, `paid` is a transfer recorded with a reference. Explorer links are listed with date and amount only. |
| Expenses | `verified_expenses` with `status='verified'`. Each record needs a source (`provider_api`, `invoice`, `receipt`, `contract`) and an invoice reference. Non-USD records need an FX reference. A record must be verified by a different operator than the one who recorded it. Estimates from server usage are never recorded as invoices. |

None of the Render, database, CMS or market-data providers is currently connected through a billing API. Their costs enter as verified invoice records.

## Privacy

Only aggregates are published. The report never contains user ids, user wallet addresses, per-trader outcomes, or links between a wallet and a failed challenge. The cache is five minutes.
