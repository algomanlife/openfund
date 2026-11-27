# ADR 0061 — The Openfund leverage ceilings are final for every Prop account

- Status: Accepted by the owner (2026-11-27).
- Amends: [ADR 0025](0025-prop-leverage-sizing-and-economic-calendar.md) (Prop
  leverage ceilings) and owner decision D6 (rules snapshot v3).

## Context

ADR 0025 introduced per-category Prop ceilings in
`apps/backend/prop-leverage.js`: BTC/USD and ETH/USD 20×, other crypto 15×,
forex, stocks, indices and commodities 50×. Decision D6 (rules snapshot v3)
then set every published plan's `referenceLeverageX` to `null`, so new
challenges use only those ceilings and the market's own limit. Challenges whose
frozen rules snapshot is older than v3 kept the retired 5× plan cap, and part
of the public copy (the Rulebook, the FAQ, a learning-path note, the challenge
catalog and the product rules) still described a 5× "reference leverage" or
promised that older challenges keep their own limit.

The owner decided on 2026-11-27 that these ceilings are the final leverage
policy for every Prop account (challenges and trial accounts) and that the
website and the Rulebook must say exactly that everywhere.

## Decision

1. The ceilings in `apps/backend/prop-leverage.js` are final: BTC/USD and
   ETH/USD 20×, other crypto 15×, forex, stocks, indices and commodities 50×.
   A lower limit of the market itself still applies.
2. `planLeverageCap(rules)` returns a plan cap only for rules snapshots of
   version 3 or later. The 5× cap recorded by older snapshots is released; the
   engine (`#accountView` and order validation) no longer applies it. Frozen
   snapshots are not rewritten, so their history stays intact.
3. A plan published at rules version 3 or later may still set a stricter
   `referenceLeverageX`; it can only lower the ceiling. Every plan in the
   current catalog sets `null`.
4. Every public statement of a 5× plan or reference leverage, and the promise
   that older challenges keep their own limit, is replaced by the ceiling table
   in five locales. Published CMS copy that still equals the retired default is
   shown as the new default (`apps/web-react/src/cms/retiredCopy.ts`).

## Consequences

- A challenge sold before rules v3 can now open positions above 5×, up to the
  ceiling of the market. Purchases are not yet operational in a released
  build, so no paying customer's terms change; existing open positions and
  pending orders are not modified.
- The browser ticket already reads the engine's `plan_leverage` value, so the
  slider maximum follows automatically.
- Tests: `apps/backend/test/prop-leverage.test.mjs` (planLeverageCap) and
  `apps/backend/test/conduct.test.mjs` C12.
