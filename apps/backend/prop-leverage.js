/**
 * Prop-only maximum leverage policy.
 *
 * The practice engine (engine.js) serves Prop accounts only; Perpetual reads
 * Gains directly and never reaches this module. The policy is a ceiling that
 * is combined with every existing limit (the market's own `maxLeverage` and a
 * challenge plan's `referenceLeverageX`): the effective maximum is always the
 * strictest of them, so this module can only lower an allowed leverage.
 *
 * Categories come from the verified Gains `/markets` metadata `group` field
 * (crypto, forex, stocks, indices, commodities). BTC and ETH are matched on
 * the exact market identity (symbol, base and crypto group), never on a
 * substring, so tokens such as BTCDEGEN/USD or ETHFI/USD keep the generic
 * crypto ceiling.
 *
 * The browser copy lives in apps/web-react/public/legacy/prop-leverage.js;
 * test/prop-leverage.test.mjs asserts both tables are identical.
 */
export const PROP_LEVERAGE_POLICY = Object.freeze({
  version: 1,
  majors: Object.freeze({ "BTC/USD": 20, "ETH/USD": 20 }),
  groups: Object.freeze({ crypto: 15, forex: 50, stocks: 50, indices: 50, commodities: 50 }),
});

/** Policy category of a market: 'btc' | 'eth' | group name | null (unknown). */
export function propLeverageCategory(meta, market) {
  if (!meta) return null;
  const group = String(meta.group || "").toLowerCase();
  if (!Object.hasOwn(PROP_LEVERAGE_POLICY.groups, group)) return null;
  const symbol = String(market ?? meta.symbol ?? "");
  if (group === "crypto" && Object.hasOwn(PROP_LEVERAGE_POLICY.majors, symbol) &&
      String(meta.symbol ?? symbol) === symbol && symbol.split("/")[0] === String(meta.base))
    return symbol.split("/")[0].toLowerCase();
  return group;
}

/** Prop policy ceiling for a market, or null when the market has no category. */
export function propLeverageCap(meta, market) {
  const category = propLeverageCategory(meta, market);
  if (category == null) return null;
  if (category === "btc" || category === "eth") return PROP_LEVERAGE_POLICY.majors[String(market ?? meta.symbol)];
  return PROP_LEVERAGE_POLICY.groups[category];
}

/**
 * Effective Prop maximum: the minimum of the market limit, the Prop policy
 * ceiling and an optional plan limit. Unknown categories are not tradeable in
 * the engine (instrumentSpec rejects them), so a null cap never widens access.
 */
export function propMaxLeverage(meta, market, planLimit = null) {
  const limits = [Number(meta?.maxLeverage || 100), propLeverageCap(meta, market)];
  if (planLimit != null && Number.isFinite(Number(planLimit)) && Number(planLimit) > 0) limits.push(Number(planLimit));
  return Math.floor(Math.min(...limits.filter((v) => v != null && Number.isFinite(v) && v > 0)));
}
