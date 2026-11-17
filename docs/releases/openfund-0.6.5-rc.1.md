# Openfund v0.6.5-rc.1 — draft release notes (superseded)

> Superseded by the official [v0.6.5](openfund-0.6.5.md) release notes.

Target release candidate. These notes record the Backstage payout work for
review. The full Backstage milestone and release acceptance are still open.

## Backstage payout operations

The owner can inspect an individual reward payout, including the account,
recorded eligibility amount, share, approved wallet, network, token, evidence
and decision history. English and Persian keep wallet and hash values
left-to-right. Backstage can submit an external Arbitrum One DAI transfer hash
for backend verification when the settlement control is enabled.

The backend verifies a finalized transfer of the recorded amount from the
configured treasury sender to the approved recipient. It records the hash,
payout outcome and financial audit together through the existing settlement
workflow. The dedicated endpoint checks authoritative GLOBAL ownership.
Backstage requires an owner session, CSRF protection and password confirmation.
Controlled simulated payouts continue to use their existing action.

## API and deployment

- `GET /admin/withdrawals/:id/reward` returns owner-only reward details.
- `POST /admin/withdrawals/:id/settle-reward` verifies settlement evidence for
  a reward payout. The existing review endpoint retains its contract.
- The Backstage control defaults to disabled. Enable
  `BACKSTAGE_REAL_SETTLEMENT` only after owner security acceptance and after
  the corresponding backend is available.
- This change adds no database migration or runtime dependency.

## Verification and remaining acceptance

Local Backstage, web, backend, and regional suites passed against isolated
fixtures. The browser accepted approved payout inspection and rejected
unverified evidence. Backend tests covered finalized evidence, recipient
mismatches, duplicate submissions and fenced accounts. The browser also
completed an independent controlled simulated payout. No real transfer was
made. See the [operator guide](../backstage/OPERATIONS_GUIDE.md) for activation
and operation.

Commercial coupons, native support and contact workflows, dedicated risk,
detailed finance and partner management, notifications, unified audit and
global search remain open. An approved source commit, verified package and
prerelease publication are pending.
