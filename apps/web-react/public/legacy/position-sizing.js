/* ============================================================
   Openfund — Prop position-sizing conversions (pure, browser)

   The Prop engine's canonical order is { margin (collateral), leverage }
   and it derives quantity = margin × leverage / entry, rounded DOWN to the
   instrument's quantity precision (apps/backend/engine.js). Every sizing
   mode in the ticket resolves to that same canonical collateral value;
   there is no second execution path.

   Arithmetic is exact decimal on BigInt (no binary floating point).

   Lots: a lot is defined only by an approved contract specification
   (contract size, lot min/max/step). The verified Gains market metadata
   carries no lot fields and the engine's instrument model is linear with
   contract size 1, so no instrument has an approved lot specification yet.
   lotSpec() therefore returns `available: false` until an approved entry is
   added to APPROVED_LOT_SPECS (or provided as approved contract metadata);
   nothing here guesses a lot size.
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

  /* ---------- lots (approved contract specifications only) ---------- */
  /* market symbol → { contractSize, baseUnit, lotMin, lotMax, lotStep, source }.
     Intentionally empty: no approved contract specification exists yet. */
  const APPROVED_LOT_SPECS = Object.freeze({});
  function lotSpec(meta, market) {
    const own = Object.prototype.hasOwnProperty;
    const approved = own.call(APPROVED_LOT_SPECS, market) ? APPROVED_LOT_SPECS[market]
      : (meta && meta.contractSpec && meta.contractSpec.approved === true ? meta.contractSpec : null);
    const valid = approved && isPos(parse(String(approved.contractSize))) && isPos(parse(String(approved.lotStep))) &&
      isPos(parse(String(approved.lotMin)));
    if (!valid) return { available: false, reason: 'no_approved_contract_spec' };
    return { available: true, contractSize: String(approved.contractSize), baseUnit: approved.baseUnit || (meta && meta.base) || '',
      lotMin: String(approved.lotMin), lotMax: approved.lotMax != null ? String(approved.lotMax) : null,
      lotStep: String(approved.lotStep), source: approved.source || 'approved' };
  }
  /** quantity = lots × contractSize (requires an available spec; lots on the step grid) */
  function quantityFromLots(lots, spec) {
    if (!spec || !spec.available) return { ok: false, reason: 'no_approved_contract_spec' };
    const l = parse(lots), step = parse(spec.lotStep), min = parse(spec.lotMin), max = spec.lotMax ? parse(spec.lotMax) : null;
    if (!isPos(l)) return { ok: false, reason: 'invalid_lots' };
    if (cmp(l, min) < 0) return { ok: false, reason: 'below_lot_min' };
    if (max && cmp(l, max) > 0) return { ok: false, reason: 'above_lot_max' };
    const steps = div(l, step, 0, 'down');
    if (cmp(mul(steps, step), l) !== 0) return { ok: false, reason: 'off_lot_step' };
    return { ok: true, quantity: text(mul(l, parse(spec.contractSize))) };
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
    lotSpec, quantityFromLots, lotsFromQuantity, APPROVED_LOT_SPECS
  };
})(typeof window !== 'undefined' ? window : globalThis);
