/* ============================================================
   Openfund — Prop position-sizing conversions (pure, browser)

   The Prop engine's canonical order is { margin (collateral), leverage }
   and it derives quantity = margin × leverage / entry, rounded DOWN to the
   instrument's quantity precision (apps/backend/engine.js). Every sizing
   mode in the ticket resolves to that same canonical collateral value;
   there is no second execution path.

   Arithmetic is exact decimal on BigInt (no binary floating point).

   Lotage: Openfund defines what one lot is (ADR 0064), because Openfund
   runs its own engine and price service. The rules below are identical to
   apps/backend/contract-specs.js, which the engine uses to turn a lots order
   into its exact base-asset quantity (the backend test
   contract-specs.test.mjs compares the two):
     forex (USD quote)  1 lot = 100,000 units of the base currency
     metals             XAU 100 oz · XAG 5,000 oz · XPT 50 oz · XPD 100 oz
     energy             WTI and Brent 1,000 barrels · natural gas 10,000 MMBtu
     copper             25,000 lb · other commodities 1 unit
     indices            1 index unit · stocks 100 shares (a round lot)
     crypto             1 coin; 10^(d − 4) coins for prices quoted with d > 4
                        decimals (low-priced tokens)
   Minimum and step 0.01 lot, raised to the smallest step on the market's
   quantity grid. USD-quoted markets only (the engine values positions in USD).
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- exact decimals ---------- */
  const RE = /^(\d+)(?:\.(\d+))?$/;
  function parse(v) {
    const s = typeof v === 'string' ? v.trim() : (typeof v === 'number' && Number.isFinite(v) ? numText(v) : '');
    const m = RE.exec(s);
    if (!m) return null;
    const frac = m[2] || '';
    return { n: BigInt(m[1] + frac), s: frac.length };
  }
  /* shortest exact text of a finite JS number (no exponent) */
  function numText(x) {
    if (x < 0) return '';
    let t = String(x);
    if (!/e/i.test(t)) return t;
    const [mant, expS] = t.toLowerCase().split('e');
    const exp = Number(expS), [i, f = ''] = mant.split('.');
    const digits = i + f;
    const point = i.length + exp;
    if (point <= 0) return '0.' + '0'.repeat(-point) + digits;
    if (point >= digits.length) return digits + '0'.repeat(point - digits.length);
    return digits.slice(0, point) + '.' + digits.slice(point);
  }
  const pow10 = k => 10n ** BigInt(k);
  function text(d, places) {
    const neg = d.n < 0n, abs = neg ? -d.n : d.n;
    let str = abs.toString().padStart(d.s + 1, '0');
    let out = d.s ? str.slice(0, -d.s) + '.' + str.slice(-d.s) : str;
    if (places == null && d.s) out = out.replace(/\.?0+$/, '');
    return (neg ? '-' : '') + out;
  }
  function mul(a, b) { return { n: a.n * b.n, s: a.s + b.s }; }
  /* a / b rounded to `places` decimals: mode 'down' | 'up' (away from zero) */
  function div(a, b, places, mode) {
    if (b.n === 0n) return null;
    const num = a.n * pow10(places + b.s), den = b.n * pow10(a.s);
    let q = num / den;
    if (mode === 'up' && num % den !== 0n) q += 1n;
    return { n: q, s: places };
  }
  function round(a, places, mode) {
    if (a.s <= places) return { n: a.n * pow10(places - a.s), s: places };
    return div(a, { n: 1n, s: 0 }, places, mode);
  }
  function cmp(a, b) {
    const s = Math.max(a.s, b.s);
    const x = a.n * pow10(s - a.s), y = b.n * pow10(s - b.s);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  const isPos = d => d && d.n > 0n;

  /* ---------- canonical conversions (mirror the engine) ---------- */
  /** quantity the engine derives from collateral: margin × lev / price, ROUND_DOWN */
  function quantityFromCollateral({ collateral, leverage, price, quantityPrecision }) {
    const c = parse(collateral), l = parse(String(leverage)), p = parse(price);
    if (!isPos(c) || !isPos(l) || !isPos(p)) return null;
    const places = Number.isInteger(quantityPrecision) ? quantityPrecision : 10;
    return text(div(mul(c, l), p, places, 'down'), places);
  }
  /** collateral (USD, cents) that covers `quantity` at `price` and `leverage`:
      quantity × price / leverage rounded UP to 0.01 so the canonical order is
      never smaller than the requested size before the engine's own rounding. */
  function collateralFromQuantity({ quantity, leverage, price }) {
    const q = parse(quantity), l = parse(String(leverage)), p = parse(price);
    if (!isPos(q) || !isPos(l) || !isPos(p)) return null;
    return text(div(mul(q, p), l, 2, 'up'), 2);
  }
  function notional({ collateral, leverage }) {
    const c = parse(collateral), l = parse(String(leverage));
    if (!c || !isPos(l)) return null;
    return text(mul(c, l));
  }
  /** a quantity is valid only on the instrument's precision grid */
  function quantityOnGrid(quantity, quantityPrecision) {
    const q = parse(quantity);
    if (!q) return false;
    return cmp(round(q, quantityPrecision, 'down'), q) === 0;
  }

  /* ---------- lots (mirror of apps/backend/contract-specs.js) ---------- */
  const COMMODITIES = Object.freeze({
    XAU: ['100', 'troy oz'], GOLD: ['100', 'troy oz'],
    XAG: ['5000', 'troy oz'], SILVER: ['5000', 'troy oz'],
    XPT: ['50', 'troy oz'], PLATINUM: ['50', 'troy oz'],
    XPD: ['100', 'troy oz'], PALLADIUM: ['100', 'troy oz'],
    WTI: ['1000', 'barrels'], USOIL: ['1000', 'barrels'], CL: ['1000', 'barrels'], OIL: ['1000', 'barrels'],
    BRENT: ['1000', 'barrels'], UKOIL: ['1000', 'barrels'], BRN: ['1000', 'barrels'],
    NG: ['10000', 'MMBtu'], NATGAS: ['10000', 'MMBtu'], XNG: ['10000', 'MMBtu'],
    HG: ['25000', 'lb'], COPPER: ['25000', 'lb'], XCU: ['25000', 'lb'],
  });
  function multipleOf(a, b) {
    const s = Math.max(a.s, b.s);
    return (a.n * pow10(s - a.s)) % (b.n * pow10(s - b.s)) === 0n;
  }
  function groupOf(meta) { return String((meta && meta.group) || '').toLowerCase().replace(/-.*$/, ''); }
  function precisionOf(meta) {
    const p = !meta || meta.sizePrecision == null ? 10 : Number(meta.sizePrecision);
    return Number.isInteger(p) && p >= 0 && p <= 10 ? p : 10;
  }
  function baseContract(meta, market) {
    const group = groupOf(meta);
    const base = String((meta && meta.base) || String(market || '').split('/')[0] || '').toUpperCase();
    if (group === 'forex') return { contractSize: '100000', unit: base, source: 'openfund:fx_standard_lot' };
    if (group === 'commodities') {
      const known = COMMODITIES[base];
      return known ? { contractSize: known[0], unit: known[1], source: 'openfund:commodity_' + base.toLowerCase() }
        : { contractSize: '1', unit: base, source: 'openfund:commodity_unit' };
    }
    if (group === 'indices') return { contractSize: '1', unit: base, source: 'openfund:index_unit' };
    if (group === 'stocks') return { contractSize: '100', unit: base, source: 'openfund:round_lot' };
    if (group === 'crypto') {
      const decimals = Number(meta && meta.pricePrecision);
      const k = Number.isInteger(decimals) && decimals > 4 ? Math.min(decimals - 4, 9) : 0;
      return { contractSize: '1' + '0'.repeat(k), unit: base, source: k ? 'openfund:crypto_scaled' : 'openfund:crypto_coin' };
    }
    return null;
  }
  /** the lot definition for a market: { available, contractSize, unit, baseUnit, lotMin, lotStep, lotMax, quantityPrecision, source } or { available: false, reason } */
  function lotSpec(meta, market) {
    if (!meta || typeof meta !== 'object') return { available: false, reason: 'unknown_market' };
    const quote = String(meta.quote || String(market || '').split('/')[1] || 'USD').toUpperCase();
    if (quote !== 'USD') return { available: false, reason: 'non_usd_quote' };
    const base = baseContract(meta, market);
    if (!base) return { available: false, reason: 'unsupported_instrument' };
    const precision = precisionOf(meta);
    const contract = parse(base.contractSize), grid = { n: 1n, s: precision };
    let step = { n: 1n, s: 2 };
    for (let i = 0; i < 12 && !multipleOf(mul(step, contract), grid); i++) step = step.s > 0 ? { n: 1n, s: step.s - 1 } : { n: step.n * 10n, s: 0 };
    return { available: true, contractSize: base.contractSize, unit: base.unit, baseUnit: base.unit, lotMin: text(step), lotStep: text(step), lotMax: null,
      quantityPrecision: precision, source: base.source };
  }
  /** quantity = lots × contractSize (requires an available spec; lots on the step grid) */
  function quantityFromLots(lots, spec) {
    if (!spec || !spec.available) return { ok: false, reason: (spec && spec.reason) || 'lots_unavailable' };
    const l = parse(lots), step = parse(spec.lotStep), min = parse(spec.lotMin), max = spec.lotMax ? parse(spec.lotMax) : null;
    if (!isPos(l)) return { ok: false, reason: 'invalid_lots' };
    if (cmp(l, min) < 0) return { ok: false, reason: 'below_lot_min' };
    if (max && cmp(l, max) > 0) return { ok: false, reason: 'above_lot_max' };
    const steps = div(l, step, 0, 'down');
    if (cmp(mul(steps, step), l) !== 0) return { ok: false, reason: 'off_lot_step' };
    return { ok: true, quantity: text(mul(l, parse(spec.contractSize))) };
  }
  /** the largest number of lots on the lot grid not above `quantity` (for budget buttons) */
  function lotsFloor(quantity, spec) {
    if (!spec || !spec.available) return null;
    const q = parse(quantity), step = parse(spec.lotStep);
    if (!q || !isPos(step)) return null;
    const steps = div(q, mul(step, parse(spec.contractSize)), 0, 'down');
    return text(mul(steps, step));
  }
  /** lots = quantity / contractSize (display; rounded down to the lot step's decimals) */
  function lotsFromQuantity(quantity, spec) {
    if (!spec || !spec.available) return null;
    const q = parse(quantity);
    if (!q) return null;
    const places = (spec.lotStep.split('.')[1] || '').length + 4;
    return text(div(q, parse(spec.contractSize), places, 'down'));
  }

  global.OpenfundPositionSizing = {
    parse: s => { const d = parse(s); return d ? text(d) : null; },
    quantityFromCollateral, collateralFromQuantity, notional, quantityOnGrid,
    lotSpec, quantityFromLots, lotsFromQuantity, lotsFloor
  };
})(typeof window !== 'undefined' ? window : globalThis);
