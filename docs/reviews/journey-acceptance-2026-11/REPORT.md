# Journey acceptance report — 2026-11-20

Workstream H of the launch-readiness mandate: repeatable browser acceptance of
the existing user journeys, with disposable test data only. This report records
what each journey is covered by, what passed, what failed and what is blocked
outside the repository. It is evidence for one date and one branch
(`agent/claude/journey-acceptance`). For current behavior, see
[Feature Status](../../product/FEATURE_STATUS.md).

## Test environment

- A local backend (`apps/backend/server.js`) built from this branch with
  `SIM_TEST_MODE=1`. It ran against a new database
  (`openfund_journey_test`) created, migrated and seeded for this run. The
  user database and port 8080 were not used.
- Chromium (Playwright) with generated disposable EIP-6963 signers through the
  shared harness `e2e/helpers/wallet-ui.cjs`. No real wallet, chain write or
  payment.
- Test-mode seams only: `/internal/confirm-order` (challenge provisioning
  without a chain), `/internal/inject-price` (deterministic marks) and
  `/internal/test-clock` (conduct clock from PR #160, pinned to a weekday
  open-market instant).

## New and newly wired suites

| Suite | Command | Where it runs | Local result |
| --- | --- | --- | --- |
| `e2e/test-journey-acceptance.cjs` | `npm run test:browser:journeys` | CI backend job and Release package gates | 34/34 passed, twice; about 27 s |
| `e2e/test-security-browser.cjs` (already present but not run by CI) | `npm run test:browser:security` | CI backend job | 12/12 passed |

`test-journey-acceptance.cjs` covers the gaps the inventory found:

- **J1 onboarding and session.** The SIWE message names Arbitrum One
  (`Chain ID: 42161`). The session restores after a reload without a second
  signature and survives site → terminal navigation. An expired server session
  is reported as signed out (`/auth/me` returns 401 and the header offers
  Sign in). A new signature recovers the session.
- **J2 daily-loss breach.** A one-phase account loses 200 against the 3 %
  limit (150). The engine fails the challenge and records
  `daily_loss_breach` without `maximum_loss_breach`. The dashboard shows the
  failed state and the violation, and a later order is refused.
- **J3 maximum-loss breach.** A loss of 800 against the 12 % limit (600)
  fails the challenge with `maximum_loss_breach` recorded.
- **J4 notifications.** The `challenge_failed` notification reaches
  `/notifications` through the relay and shows in `/en/prop/inbox`.
- **J5 minimum trading days.** A Standard phase 1 reaches the 8 % target on
  day 1 and stays `started` at 1/3 days, and the dashboard shows
  `min trading days: 1/3`. At two days it still does not pass. The third
  trading day passes phase 1 and starts phase 2. Trading days are distinct
  UTC+3 fill days from database time, not the conduct clock, so the suite
  moves this disposable account's own earlier fills back by one and two days.
- **J6 checkout.** `fa`, `ar` (RTL) and `en` (LTR) at 390 px and 1280 px show
  the server catalog price with no horizontal overflow. A pending order link
  (`/fa/checkout?order=…`) recovers the order state, also after a refresh, and
  never creates a second order. No payment is made.

## Application bug found and fixed

The SPA fallback served `index.html` with `res.sendFile(absolutePath)`. Express
`send` refuses any path that contains a dot-directory segment, so every deep
route (for example `/en/prop/dashboard`) returned
`404 {"error":"Not Found"}` when the server ran from a checkout under a dot
directory, such as `.claude/worktrees/…`. It now uses
`sendFile('index.html', { root })`, which applies the dot-file guard to the
served name only. CI checkouts were not affected. The change has no effect on
financial semantics, evaluation rules, payment settlement or wallet-auth
policy.

The shared wallet helper's connect step clicked `.rk-chip-connect` in strict
mode. That failed on pages with two Connect chips (site header and terminal),
so it now clicks the first.

## Journey coverage inventory

Status: **Passed** = covered by a suite that a required check runs;
**Passed (not CI)** = suite exists and passed locally or historically, but no
CI job runs it; **Gap** = no automated browser coverage;
**Blocked** = needs an external owner action or real-network evidence.

### Onboarding and wallet

| Journey | Coverage | Status |
| --- | --- | --- |
| First load, language selection | `test-website-refresh`, `test-locale-matrix`, `test-ui-polish` | Passed |
| Region choice (Iran runtime, `?region=global`) | `test-iran-isolation` (needs an IRAN runtime); geographic routing is owner-gated | Passed (not CI); routing Blocked |
| SIWE sign-in on Arbitrum One 42161 | `test-wallet-connect`, `test-journey-acceptance` J1 | Passed |
| Session restore after reload | `test-wallet-connect`, J1 | Passed |
| Wallet switch | `test-security-browser` B3, `test-terminal-risk-workspace` | Passed |
| Disconnect / logout | `test-wallet-connect`, `test-security-browser` B4 | Passed |
| Expired session | J1 | Passed (new) |
| Error recovery (declined connect/switch/sign, backend failure) | `test-wallet-connect`, `test-ui-polish` tail | Passed |
| Site ↔ terminal navigation | `test-responsive-navigation`, J1 | Passed |
| Real extension, hardware or WalletConnect mobile wallet | none (needs a device and a WalletConnect project id) | Blocked |

### Prop evaluation

| Journey | Coverage | Status |
| --- | --- | --- |
| Challenge display and selection, rules | `test-purchase-flow`, `test-website-refresh`, `test-locale-matrix` | Passed |
| Account creation via authorized test fixtures | `test-challenge-lifecycle`, `test-controlled-challenges`, `test-coupon-checkout` | Passed |
| Open and close simulated positions | `test-terminal-completion`, `test-challenge-lifecycle` | Passed |
| SL/TP updates | `test-terminal-risk-workspace` | Passed |
| Trading days | J5 | Passed (new) |
| Daily loss and maximum loss | J2, J3 | Passed (new) |
| Pass | `test-challenge-lifecycle` (one-phase), `test-controlled-challenges` (two-step) | Passed |
| Fail | J2, J3 | Passed (new) |
| Manual review (approve) | `test-controlled-challenges`, `test-backstage` | Passed |
| Manual review (reject) | backend tests only | Gap (post-launch) |
| Funded-demo progression and simulated payout | `test-controlled-challenges`, `test-payout-operations` | Passed |
| Dashboard and notifications | `test-challenge-lifecycle`, J4 | Passed |

### Terminal and portfolio

| Journey | Coverage | Status |
| --- | --- | --- |
| Symbol, candles, indicators | `test-chart-indicators`, `test-terminal-layout` | Passed |
| Drawings and timeframe persistence per wallet | `test-terminal-risk-workspace` | Passed |
| Markers, orders and positions | `test-terminal-risk-workspace`, `test-terminal-completion` | Passed |
| Portfolio and journal | `test-terminal-completion` | Passed |
| Refresh recovery | `test-terminal-risk-workspace`, `test-terminal-completion` | Passed |
| Chart protection | `test-chart-protection` | Passed (not CI) |

### Backstage operations

| Journey | Coverage | Status |
| --- | --- | --- |
| User lookup, trader status (suspension) | `test-backstage`, `test-backstage-operations` | Passed |
| Challenge inspection, evaluation review | `test-backstage` | Passed |
| Support inbox, notifications, audit log | `test-backstage-operations` | Passed |
| Content preview and editing | `test-backstage-content` (needs a disposable Directus with an editor token) | Passed (not CI) |

### Payment UI (mocked evidence only)

| Journey | Coverage | Status |
| --- | --- | --- |
| Checkout responsiveness | J6 (390/1280 px), `test-locale-matrix` | Passed (new) |
| Localized states (fa, ar RTL; en LTR) | J6, `test-coupon-checkout` (fa/en) | Passed (new) |
| Order recovery after refresh | `test-depay-checkout`, J6 | Passed |
| DePay widget, signed callbacks, mock chain | `test-depay-checkout` | Passed |
| Real-money payment and activation | none, by design | Blocked (owner authorization) |

## Failed

Nothing failed in the final local runs. The first run failed at wallet connect
because of the dot-directory 404 above. That was an application defect, not a
test defect, and it is fixed in this branch.

## Externally blocked

- **Real-money acceptance:** a real payment, its on-chain verification and
  challenge activation on a deployed environment need owner authorization.
  The 2026-11-18 DePay incident is still open.
- **Real wallets:** extension, hardware and WalletConnect mobile acceptance
  need devices and a configured `VITE_WALLETCONNECT_PROJECT_ID`.
- **Deployed acceptance:** these suites run against a local runtime. Running
  them against a deployed release needs an approved deploy and test accounts.
- **Live execution:** Gains and Perpetual on-chain execution stay disabled
  until supported testnet contracts, simulation and security review exist.
- **Geographic routing** (IR → `openfi.live`) stays behind the owner gates in
  ADR 0043.

## Reproduce

```bash
createdb openfund_journey_test
DATABASE_URL=postgres://localhost:5432/openfund_journey_test npm --prefix apps/backend run migrate
DATABASE_URL=postgres://localhost:5432/openfund_journey_test npm --prefix apps/backend run seed-plans
npm run build:web
DATABASE_URL=postgres://localhost:5432/openfund_journey_test SIM_TEST_MODE=1 PORT=8471 \
  ALLOWED_DOMAINS=localhost:5173,localhost:8471 CORS_ORIGINS=http://localhost:5173,http://localhost:8471 \
  PURCHASE_PAYMENT_RECEIVER=0x000000000000000000000000000000000000c1a1 ADMIN_API_TOKEN=local-test-token \
  node apps/backend/server.js &
TEST_FRONTEND_URL=http://localhost:8471 DATABASE_URL=postgres://localhost:5432/openfund_journey_test npm run test:browser:journeys
BASE_URL=http://localhost:8471 npm run test:browser:security
```
