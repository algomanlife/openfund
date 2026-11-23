# 0054 — Trading objectives page and the funded-trader agreement

- **Status:** Accepted (2026-11-23)
- **Scope:** website (trading objectives page, profile), backend engine, schema
- **Item:** batch 3, L

## Context

Traders need one page that explains every challenge objective with the real
numbers of the plan and account size they are considering, without copying
the rulebook. Funded accounts also need an explicit, verifiable acceptance of
the funded-trader terms before the first trade. Openfund does not run KYC:
the wallet that owns the account is the identity, and rewards go only to it.

## Decision

1. **Page.** `/:locale/trading-objectives` reads the published plan catalog
   (`GET /purchases/plans`) and shows a tab for each paid plan, an account
   size selector and one card per objective: profit target, daily loss,
   maximum or trailing loss, minimum trading days, consistency, profit split,
   payout cycle, conduct and fee refund. Dollar amounts are computed from the
   catalog's percentages and the selected size; nothing is hard-coded. Every
   card links to its rulebook section. A progression shows the plan's stages,
   followed by worked pass and fail scenarios, the other paths (migration,
   tournament), a FAQ and a buy link carrying the plan and size to checkout.
   The catalog now also publishes `referenceLeverageX` and `payoutCapPct`.
2. **Visuals.** Each card has a small original SVG schematic, which is decorative (the
   card text carries the numbers). Motion is transform and opacity only, runs
   only while the element is on screen and the tab is visible, and stops
   under reduced motion.
3. **Agreement.** A funded account (stage 0, not a free trial or tournament
   account) created on or after `FUNDED_AGREEMENT_FROM` must sign a fixed
   message naming the terms version (`2026-11`), the account, the wallet and
   the issue time before its first order. The engine refuses orders with
   `409 funded_agreement_required` until then. The signature is verified with
   EIP-191, or EIP-1271 for contract wallets, within 15 minutes of issue, and
   stored append-only in `funded_agreements` with an event and an audit row.
   Endpoints: `GET /funded/agreements`, `POST /funded/agreements/:id/message`
   and `POST /funded/agreements/:id`. The profile shows a signing card for
   accounts that need it.
4. **Rollout.** `FUNDED_AGREEMENT_FROM` is unset by default, so no account
   that is already trading is blocked retroactively. The owner sets the date
   once the funded-trader terms are published.

## Consequences

- The page stays correct when plans change in Backstage, because it reads
  the same catalog checkout uses.
- Funded orders gain one indexed lookup when the cutoff is set.
- A signature cannot be replayed for another account or wallet, and the
  record cannot be edited or deleted.
