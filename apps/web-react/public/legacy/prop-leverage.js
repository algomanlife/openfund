/* ============================================================
   Openfund — Prop-only maximum leverage policy (browser copy)

   Mirrors apps/backend/prop-leverage.js; the backend is authoritative
   and rejects any order above the same ceiling. A parity test
   (apps/backend/test/prop-leverage.test.mjs) keeps the tables equal.
   Only the Prop terminal reads this module; Perpetual is unaffected.
   ============================================================ */
(function (global) {
  'use strict';
  const POLICY = Object.freeze({
    version: 1,
    majors: Object.freeze({ 'BTC/USD': 20, 'ETH/USD': 20 }),
    groups: Object.freeze({ crypto: 15, forex: 50, stocks: 50, indices: 50, commodities: 50 }),
  });
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function category(meta, market) {
    if (!meta) return null;
    const group = String(meta.group || '').toLowerCase();
    if (!own(POLICY.groups, group)) return null;
    const symbol = String(market != null ? market : (meta.symbol != null ? meta.symbol : ''));
    if (group === 'crypto' && own(POLICY.majors, symbol) &&
        String(meta.symbol != null ? meta.symbol : symbol) === symbol && symbol.split('/')[0] === String(meta.base))
      return symbol.split('/')[0].toLowerCase();
    return group;
  }
  function cap(meta, market) {
    const c = category(meta, market);
    if (c == null) return null;
    if (c === 'btc' || c === 'eth') return POLICY.majors[String(market != null ? market : meta.symbol)];
    return POLICY.groups[c];
  }
  /* strictest of: market limit, Prop policy ceiling, optional plan limit */
  function maxLeverage(meta, market, planLimit) {
    const limits = [Number((meta && meta.maxLeverage) || 100), cap(meta, market)];
    if (planLimit != null && Number.isFinite(Number(planLimit)) && Number(planLimit) > 0) limits.push(Number(planLimit));
    return Math.floor(Math.min.apply(null, limits.filter(v => v != null && Number.isFinite(v) && v > 0)));
  }
  global.OpenfundPropLeverage = { POLICY, category, cap, maxLeverage };
})(typeof window !== 'undefined' ? window : globalThis);
