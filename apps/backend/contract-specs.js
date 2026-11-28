/* Openfund contract specifications (ADR 0064): what one lot is, per market.
 *
 * Openfund runs its own simulation engine and its own price service, so the
 * lot is an Openfund definition, not a venue's. The engine is linear in the
 * base asset (instruments.js, contract size 1); a lot is a fixed number of
 * base units. Every order is still settled in base units: lots only state the
 * size. The same rules run in the browser (apps/web-react/public/legacy/
 * position-sizing.js); test/contract-specs.test.mjs keeps the two identical.
 *
 *   forex (USD quote)   1 lot = 100,000 units of the base currency
 *   metals              XAU 100 oz · XAG 5,000 oz · XPT 50 oz · XPD 100 oz
 *   energy              WTI and Brent 1,000 barrels · natural gas 10,000 MMBtu
 *   copper              25,000 lb
 *   other commodities   1 unit
 *   indices             1 index unit
 *   stocks              100 shares (a round lot)
 *   crypto              1 coin for prices quoted with up to 4 decimals;
 *                       10^(d - 4) coins for prices quoted with d > 4
 *                       decimals (low-priced tokens), so a lot stays a
 *                       meaningful size
 *
 * Minimum and step: 0.01 lot, raised to the smallest lot step whose size is
 * on the market's quantity grid (sizePrecision). No upper lot limit beyond
 * the engine's own size and margin limits. Only USD-quoted markets: the
 * engine values positions in USD and refuses other quote currencies.
 * Pure string/BigInt decimals; no dependencies. */

export const CONTRACT_SPEC_MODEL = 'openfund_contract_specs_v1'

const COMMODITIES = Object.freeze({
  XAU: ['100', 'troy oz'], GOLD: ['100', 'troy oz'],
  XAG: ['5000', 'troy oz'], SILVER: ['5000', 'troy oz'],
  XPT: ['50', 'troy oz'], PLATINUM: ['50', 'troy oz'],
  XPD: ['100', 'troy oz'], PALLADIUM: ['100', 'troy oz'],
  WTI: ['1000', 'barrels'], USOIL: ['1000', 'barrels'], CL: ['1000', 'barrels'], OIL: ['1000', 'barrels'],
  BRENT: ['1000', 'barrels'], UKOIL: ['1000', 'barrels'], BRN: ['1000', 'barrels'],
  NG: ['10000', 'MMBtu'], NATGAS: ['10000', 'MMBtu'], XNG: ['10000', 'MMBtu'],
  HG: ['25000', 'lb'], COPPER: ['25000', 'lb'], XCU: ['25000', 'lb'],
})

/* ---------- exact decimals ---------- */
const RE = /^(\d+)(?:\.(\d+))?$/
function parse(value) {
  const s = typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) && value >= 0 ? plain(value) : ''
  const m = RE.exec(s)
  if (!m) return null
  const frac = m[2] || ''
  return { n: BigInt(m[1] + frac), s: frac.length }
}
function plain(x) {
  const t = String(x)
  if (!/e/i.test(t)) return t
  const [mant, expS] = t.toLowerCase().split('e')
  const exp = Number(expS), [i, f = ''] = mant.split('.'), digits = i + f, point = i.length + exp
  if (point <= 0) return '0.' + '0'.repeat(-point) + digits
  if (point >= digits.length) return digits + '0'.repeat(point - digits.length)
  return digits.slice(0, point) + '.' + digits.slice(point)
}
const pow10 = k => 10n ** BigInt(k)
function text(d) {
  const str = d.n.toString().padStart(d.s + 1, '0')
  const out = d.s ? str.slice(0, -d.s) + '.' + str.slice(-d.s) : str
  return d.s ? out.replace(/\.?0+$/, '') : out
}
const mul = (a, b) => ({ n: a.n * b.n, s: a.s + b.s })
function cmp(a, b) {
  const s = Math.max(a.s, b.s), x = a.n * pow10(s - a.s), y = b.n * pow10(s - b.s)
  return x < y ? -1 : x > y ? 1 : 0
}
/* is `a` an integer multiple of `b` (b > 0) */
function multipleOf(a, b) {
  const s = Math.max(a.s, b.s)
  return (a.n * pow10(s - a.s)) % (b.n * pow10(s - b.s)) === 0n
}
const isPos = d => !!d && d.n > 0n

function groupOf(meta) { return String(meta?.group || '').toLowerCase().replace(/-.*$/, '') }
function quantityPrecision(meta) {
  const p = meta?.sizePrecision == null ? 10 : Number(meta.sizePrecision)
  return Number.isInteger(p) && p >= 0 && p <= 10 ? p : 10
}

/** contract size and unit for a market, or the reason none applies */
function baseContract(meta, market) {
  const group = groupOf(meta)
  const base = String(meta?.base || String(market || '').split('/')[0] || '').toUpperCase()
  if (group === 'forex') return { contractSize: '100000', unit: base, source: 'openfund:fx_standard_lot' }
  if (group === 'commodities') {
    const known = COMMODITIES[base]
    return known ? { contractSize: known[0], unit: known[1], source: `openfund:commodity_${base.toLowerCase()}` }
      : { contractSize: '1', unit: base, source: 'openfund:commodity_unit' }
  }
  if (group === 'indices') return { contractSize: '1', unit: base, source: 'openfund:index_unit' }
  if (group === 'stocks') return { contractSize: '100', unit: base, source: 'openfund:round_lot' }
  if (group === 'crypto') {
    const decimals = Number(meta?.pricePrecision)
    const k = Number.isInteger(decimals) && decimals > 4 ? Math.min(decimals - 4, 9) : 0
    return { contractSize: '1' + '0'.repeat(k), unit: base, source: k ? 'openfund:crypto_scaled' : 'openfund:crypto_coin' }
  }
  return null
}

/**
 * The lot definition for a market's catalog metadata.
 * @returns {{available: true, contractSize: string, unit: string, lotMin: string, lotStep: string, lotMax: null, quantityPrecision: number, source: string} | {available: false, reason: string}}
 */
export function contractSpec(meta, market) {
  if (!meta || typeof meta !== 'object') return { available: false, reason: 'unknown_market' }
  const quote = String(meta.quote || String(market || '').split('/')[1] || 'USD').toUpperCase()
  if (quote !== 'USD') return { available: false, reason: 'non_usd_quote' }
  const base = baseContract(meta, market)
  if (!base) return { available: false, reason: 'unsupported_instrument' }
  const precision = quantityPrecision(meta)
  const contract = parse(base.contractSize), grid = { n: 1n, s: precision }
  /* the smallest lot step from 0.01, 0.1, 1, 10 … whose size is on the quantity grid */
  let step = { n: 1n, s: 2 }
  for (let i = 0; i < 12 && !multipleOf(mul(step, contract), grid); i++) step = step.s > 0 ? { n: 1n, s: step.s - 1 } : { n: step.n * 10n, s: 0 }
  return { available: true, contractSize: base.contractSize, unit: base.unit, lotMin: text(step), lotStep: text(step), lotMax: null,
    quantityPrecision: precision, source: base.source }
}

/** quantity = lots × contract size, with the lot checked against the spec */
export function quantityFromLots(lots, spec) {
  if (!spec?.available) return { ok: false, reason: spec?.reason || 'lots_unavailable' }
  const l = parse(lots)
  if (!isPos(l)) return { ok: false, reason: 'invalid_lots' }
  if (cmp(l, parse(spec.lotMin)) < 0) return { ok: false, reason: 'below_lot_min' }
  if (spec.lotMax && cmp(l, parse(spec.lotMax)) > 0) return { ok: false, reason: 'above_lot_max' }
  if (!multipleOf(l, parse(spec.lotStep))) return { ok: false, reason: 'off_lot_step' }
  return { ok: true, quantity: text(mul(l, parse(spec.contractSize))) }
}

/** lots = quantity / contract size, for display (exact; trailing zeros dropped) */
export function lotsFromQuantity(quantity, spec) {
  if (!spec?.available) return null
  const q = parse(quantity), c = parse(spec.contractSize)
  if (!q || !isPos(c)) return null
  /* contract sizes are integers: divide by shifting the decimal point when a power of ten */
  const places = 12, num = q.n * pow10(places + c.s), den = c.n * pow10(q.s)
  return text({ n: num / den, s: places })
}

export const _test = { parse, text, multipleOf }
