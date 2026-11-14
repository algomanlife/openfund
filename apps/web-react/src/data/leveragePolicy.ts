/* Openfund Prop leverage ceilings (owner decision D6) — display copy.
   apps/backend/prop-leverage.js is authoritative and rejects any order above
   these ceilings (or a lower market limit); test/product-rules.test.mjs keeps
   this table equal to it. Challenges sold before rules snapshot v3 keep the
   5× plan cap recorded in their own snapshot. */
export const PROP_LEVERAGE_CEILINGS = {
  btcEth: 20,
  crypto: 15,
  forex: 50,
  stocks: 50,
  indices: 50,
  commodities: 50,
} as const
