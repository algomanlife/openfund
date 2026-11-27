import { decimal, mul, ln, abs, format } from './decimal.ts';
/**
 * Cross-provider equivalence for the Openfund pricing service.
 *
 * A rule joins a Gains crypto market to at most one Hyperliquid main-dex perp
 * and at most one GMX oracle token on one network. Ticker similarity alone is
 * never accepted: every member needs
 *   1. a structural identity (Gains base and USD quote, Hyperliquid default-dex
 *      USD oracle, GMX network-scoped token address with a unique symbol), and
 *   2. price confirmation: a live observation whose unit-normalized price is
 *      within `maxDeviation` (log distance) of the Gains price taken in the
 *      same discovery window.
 * Members that fail either check stay source-scoped. Forex, stocks, indices
 * and commodities are never joined (no structurally verified counterpart).
 * Stablecoins are excluded: their USD price is the quantity under test.
 */
export const STABLECOINS = Object.freeze(new Set(['USDC', 'USDT', 'DAI', 'USDE', 'FDUSD', 'TUSD', 'USDC.E', 'USDS', 'PYUSD', 'FRAX', 'LUSD', 'GHO', 'USD1', 'RLUSD']));
/** Hyperliquid lists some low-priced assets per 1,000 units (kPEPE = 1,000 PEPE). */
const HL_THOUSANDS = /^k([A-Z0-9]+)$/;

const upper = value => typeof value === 'string' ? value.trim().toUpperCase() : '';
const isCrypto = market => /crypto/i.test(String(market.assetClass ?? market.raw?.group ?? market.raw?.category ?? ''));
const distance = (a, b) => abs(ln(a) - ln(b));
const positive = value => { try { const n = decimal(String(value)); return n > 0n ? n : null; } catch { return null; } };

/**
 * @param {{gains: object[], hyperliquid?: object[], gmx?: object[]}} inventories adapter inventories
 * @param {{gains: Map<string,string>, hyperliquid?: Map<string,string>, gmx?: Map<string,string>}} prices latest raw price per sourceMarketId
 * @param {{gmxNetwork?: string, maxDeviation?: string, exclude?: string[], at?: number}} options
 * @returns {{rules: object[], rejected: object[]}}
 */
export function buildEquivalences(inventories, prices, { gmxNetwork = 'arbitrum', maxDeviation = '0.1', exclude = [], at = Date.now() } = {}) {
  const limit = decimal(maxDeviation), excluded = new Set(exclude.map(upper)), rules = [], rejected = [];
  // Hyperliquid main-dex perps by unit; a unit listed twice is ambiguous and never joined.
  const hl = new Map(), hlCount = new Map();
  for (const m of inventories.hyperliquid ?? []) {
    if (m.dex !== '' || !m.identityVerified || m.delisted || m.instrumentType !== 'PERPETUAL_UNDERLYING' || m.quoteAsset !== 'USD') continue;
    const coin = String(m.coin ?? '');
    const thousand = HL_THOUSANDS.exec(coin);
    const unit = thousand ? thousand[1] : upper(coin);
    hlCount.set(unit, (hlCount.get(unit) ?? 0) + 1);
    hl.set(unit, { market: m, multiplier: thousand ? '0.001' : '1' });
  }
  // GMX oracle tokens on one network by symbol; duplicated symbols are ambiguous.
  const gmx = new Map(), gmxCount = new Map();
  for (const m of inventories.gmx ?? []) {
    if (m.network !== gmxNetwork || m.instrumentType !== 'TOKEN_REFERENCE' || !m.identityVerified || m.quoteAsset !== 'USD' || !m.unit) continue;
    const unit = upper(m.symbol);
    gmxCount.set(unit, (gmxCount.get(unit) ?? 0) + 1);
    gmx.set(unit, m);
  }
  const seenBase = new Map();
  for (const g of inventories.gains ?? []) if (isCrypto(g) && g.quoteAsset === 'USD' && g.identityVerified) seenBase.set(upper(g.baseAsset), (seenBase.get(upper(g.baseAsset)) ?? 0) + 1);

  for (const g of inventories.gains ?? []) {
    const base = upper(g.baseAsset);
    if (!isCrypto(g) || g.quoteAsset !== 'USD' || !g.identityVerified || !base || excluded.has(base) || STABLECOINS.has(base)) continue;
    if (seenBase.get(base) > 1) { rejected.push({ market: g.sourceMarketId, source: 'gains', reason: 'gains_base_not_unique' }); continue; }
    const reference = positive(prices.gains?.get(g.sourceMarketId));
    if (!reference) { rejected.push({ market: g.sourceMarketId, source: 'gains', reason: 'no_reference_price' }); continue; }
    const members = [{ source: 'gains', sourceMarketId: g.sourceMarketId }], evidence = [`gains:${g.sourceMarketId} base ${base}/USD (catalog)`];
    const candidate = (source, sourceMarketId, raw, multiplier, sourceUnit, why) => {
      const p = positive(raw);
      if (!p) { rejected.push({ market: g.sourceMarketId, source, sourceMarketId, reason: 'no_candidate_price' }); return; }
      const normalized = multiplier === '1' ? p : mul(p, decimal(multiplier));
      const d = distance(normalized, reference);
      if (d > limit) { rejected.push({ market: g.sourceMarketId, source, sourceMarketId, reason: 'price_unconfirmed', distance: format(d) }); return; }
      members.push({ source, sourceMarketId, ...(multiplier === '1' ? {} : { priceMultiplier: multiplier }), ...(sourceUnit ? { sourceUnit } : {}) });
      evidence.push(`${source}:${sourceMarketId} ${why}; price within ${format(d)} log distance of Gains at ${new Date(at).toISOString()}`);
    };
    const h = hl.get(base);
    if (h && hlCount.get(base) === 1) candidate('hyperliquid', h.market.sourceMarketId, prices.hyperliquid?.get(h.market.sourceMarketId), h.multiplier,
      h.market.unit, h.multiplier === '1' ? 'default-dex USD perp oracle' : 'default-dex USD perp oracle quoted per 1,000 units');
    else if (h) rejected.push({ market: g.sourceMarketId, source: 'hyperliquid', reason: 'ambiguous_unit' });
    const x = gmx.get(base);
    if (x && gmxCount.get(base) === 1) candidate('gmx', x.sourceMarketId, prices.gmx?.get(x.sourceMarketId), '1', x.unit, `${gmxNetwork} oracle token ${x.unit} (unique symbol)`);
    else if (x) rejected.push({ market: g.sourceMarketId, source: 'gmx', reason: 'ambiguous_symbol' });
    if (members.length > 1) rules.push({ canonicalId: g.sourceMarketId, quoteAsset: 'USD', unit: g.unit ?? g.baseAsset, members,
      evidence: `Openfund service equivalence (structural identity + price confirmation ≤ ${maxDeviation}): ${evidence.join(' | ')}` });
  }
  return { rules, rejected };
}
