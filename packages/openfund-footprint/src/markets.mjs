/*
 * Footprint symbol mapping — Gains chart market → Hyperliquid trade market.
 *
 * Gains stays the source of the market list, price and candles. This table only
 * names the Hyperliquid market whose EXECUTED TRADES feed the footprint for a
 * Gains market. A candidate is never trusted on name similarity: `verifyMarket`
 * checks it against the live Hyperliquid `meta` universe (existence, dex,
 * size precision, delisting) and the observed price orientation/basis before
 * it is reported as supported. Anything unverified is `unsupported`.
 *
 * Contract semantics recorded per market (checked 2026-11-12 against
 * `metaAndAssetCtxs` and Gains `/prices`; see docs/integrations/FOOTPRINT.md):
 *   - quote: Hyperliquid perps are USDC-margined and quoted in USD terms.
 *   - unit: what one unit of `sz` means. Footprint volume is reported in these
 *     base units, never converted into Gains collateral or notional.
 *   - orientation: `direct` = same quote direction as the Gains pair. All
 *     candidates are direct (USD/JPY on Hyperliquid quotes JPY per USD, ~159.8).
 */

/** Hyperliquid perp price rule: at most 5 significant figures and at most
 *  (MAX_DECIMALS - szDecimals) decimals; integer prices are always allowed. */
export const PERP_MAX_DECIMALS = 6;

export const CANDIDATE_MARKETS = Object.freeze([
  { gains: 'BTC/USD', coin: 'BTC', dex: '', unit: 'BTC', kind: 'crypto', orientation: 'direct' },
  { gains: 'ETH/USD', coin: 'ETH', dex: '', unit: 'ETH', kind: 'crypto', orientation: 'direct' },
  { gains: 'SOL/USD', coin: 'SOL', dex: '', unit: 'SOL', kind: 'crypto', orientation: 'direct' },
  { gains: 'XAU/USD', coin: 'xyz:GOLD', dex: 'xyz', unit: 'troy oz (GOLD)', kind: 'metal', orientation: 'direct' },
  { gains: 'XAG/USD', coin: 'xyz:SILVER', dex: 'xyz', unit: 'troy oz (SILVER)', kind: 'metal', orientation: 'direct' },
  { gains: 'EUR/USD', coin: 'xyz:EUR', dex: 'xyz', unit: 'EUR', kind: 'forex', orientation: 'direct' },
  { gains: 'GBP/USD', coin: 'xyz:GBP', dex: 'xyz', unit: 'GBP', kind: 'forex', orientation: 'direct' },
  { gains: 'USD/JPY', coin: 'xyz:JPY', dex: 'xyz', unit: 'USD (JPY-quoted)', kind: 'forex', orientation: 'direct' },
].map(Object.freeze));

const byGains = new Map(CANDIDATE_MARKETS.map(m => [m.gains, m]));
const byCoin = new Map(CANDIDATE_MARKETS.map(m => [m.coin, m]));

export function candidateFor(gainsSymbol) {
  return byGains.get(String(gainsSymbol || '').replace(/^gains:/, '')) || null;
}

export function candidateByCoin(coin) {
  return byCoin.get(coin) || null;
}

/** Number of decimals Hyperliquid allows for a price at this size precision. */
export function priceDecimals(szDecimals) {
  return Math.max(0, PERP_MAX_DECIMALS - Number(szDecimals || 0));
}

/**
 * The smallest price increment actually valid at `price` (5 significant figures,
 * capped by the decimal rule). Used as the base row height: a footprint row can
 * never be finer than a real tick at that price.
 */
export function tickAt(price, szDecimals) {
  const p = Math.abs(Number(price));
  if (!(p > 0)) return null;
  /* 5 significant figures — but integer prices are always valid, so the tick
     never exceeds 1 (BTC above 100,000 still ticks in whole dollars). */
  const sigTick = Math.min(1, 10 ** (Math.floor(Math.log10(p)) - 4));
  const decTick = 10 ** -priceDecimals(szDecimals);
  return Math.max(sigTick, decTick);
}

/**
 * Verify one candidate against a Hyperliquid `meta` universe (array of
 * {name, szDecimals, isDelisted?}) for its dex. Returns a status record; never
 * throws. `basis` (optional) is the measured calibration for the market.
 */
export function verifyMarket(candidate, universe, basis) {
  const out = { gains: candidate.gains, coin: candidate.coin, dex: candidate.dex || 'main', unit: candidate.unit, status: 'unsupported', reasons: [] };
  const entry = Array.isArray(universe) ? universe.find(u => u && u.name === candidate.coin) : null;
  if (!entry) { out.reasons.push('market_not_listed'); return out; }
  if (entry.isDelisted) { out.reasons.push('market_delisted'); return out; }
  if (!Number.isInteger(entry.szDecimals)) { out.reasons.push('missing_size_precision'); return out; }
  out.szDecimals = entry.szDecimals;
  out.priceDecimals = priceDecimals(entry.szDecimals);
  if (candidate.orientation !== 'direct') { out.reasons.push('orientation_unverified'); return out; }
  if (!basis || !(basis.n > 0)) { out.reasons.push('basis_not_measured'); return out; }
  /* A real same-instrument pair trades within a few hundred bps; anything wider
     means a different contract (wrong unit, inverted quote, other underlying). */
  if (Math.abs(basis.medianBps) > 300) { out.reasons.push('basis_incompatible'); return out; }
  out.status = 'supported';
  return out;
}
