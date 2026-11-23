/* Challenge plan validation shared by the website catalog
 * (apps/web-react/src/data/challengePlans.ts assertPlansValid), the backend
 * plan administration (apps/backend/admin-console.js) and Backstage.
 * One rule set, so a plan the owner publishes from Backstage is exactly as
 * valid as a plan in the bundled catalog. Pure functions, no dependencies.
 *
 * Input shape: the public plan (ChallengePlan in challengePlans.ts):
 *   { slug, name: { fa, en }, accountSizesUsd, priceUsd, phases, phase1TargetPct,
 *     phase2TargetPct, dailyLossPct, maxTotalLossPct, profitSplitPct, drawdownMode,
 *     trailingLockAtProfitPct, free, firstPayoutDays, rewardCycles, catalogVersion,
 *     dailyLossVariantPriceUsd } */

/** Every problem found, as stable codes with the plan slug; [] when valid. */
export function planProblems(p) {
  const out = []
  const slug = p?.slug || '(?)'
  const add = message => out.push(`plan ${slug}: ${message}`)
  if (!p || typeof p !== 'object') return ['plan (?): not an object']
  if (!p.slug || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(p.slug)) add('invalid slug')
  if (!p.name?.fa || !p.name?.en) add('missing identity')
  const sizes = Array.isArray(p.accountSizesUsd) ? p.accountSizesUsd : []
  if (!sizes.length) add('no account sizes')
  for (const size of sizes) {
    if (!(Number.isFinite(size) && size > 0)) add(`invalid account size ${size}`)
    if (!(p.priceUsd?.[size] >= 0)) add(`missing price for ${size}`)
  }
  if (![0, 1, 2].includes(p.phases)) add('phases must be 0, 1 or 2')
  if (p.phases >= 1 && p.phase1TargetPct == null) add('missing phase-1 target')
  if (p.phases === 2 && p.phase2TargetPct == null) add('two phases need two targets')
  if (p.phases === 0 && (p.phase1TargetPct != null || p.phase2TargetPct != null)) add('instant plan carries targets')
  if (!(p.dailyLossPct > 0) || !(p.maxTotalLossPct > 0)) add('loss limits must be positive')
  if (p.dailyLossPct > 0 && p.maxTotalLossPct > 0 && p.dailyLossPct > p.maxTotalLossPct) add('daily loss exceeds total loss')
  if (!p.free && (!(p.profitSplitPct > 0) || p.profitSplitPct > 100)) add('invalid profit split')
  if (p.drawdownMode === 'trailing' && p.trailingLockAtProfitPct == null) add('trailing drawdown needs a lock point')
  if (p.free !== (p.slug === 'free-trial')) add('free flag mismatch')
  const cycles = Array.isArray(p.rewardCycles) ? p.rewardCycles : []
  if (p.free && (p.firstPayoutDays != null || p.profitSplitPct > 0 || cycles.length)) add('trial must not promise rewards')
  /* catalog v3 terms only: rows published before v3 stay valid */
  if (!p.free && p.catalogVersion >= 3 && !cycles.length) add('a paid plan needs at least one reward cycle')
  for (const c of cycles) {
    if (!['weekly', 'biweekly', 'on_demand'].includes(c?.key)) add(`unknown reward cycle ${c?.key}`)
    if (!(c?.splitPct > 0 && c.splitPct <= 100)) add(`invalid ${c?.key} split`)
    if ((c?.firstAfterDays == null) !== (c?.key === 'on_demand')) add(`${c?.key} timing mismatch`)
  }
  if (p.dailyLossVariantPriceUsd) for (const size of sizes) {
    if (!(p.dailyLossVariantPriceUsd[size] > 0)) add(`variant price missing for ${size}`)
  }
  return out
}

/** Throws on the first problem (the website's module-load guard). */
export function assertPlanValid(plan) {
  const problems = planProblems(plan)
  if (problems.length) throw new Error(problems[0])
}

const num = v => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)

/** The public plan shape from a backend row (`challenge_plans`: slug, a
 *  "fa — en" name and the configuration JSONB). */
export function planFromConfiguration(slug, name, c = {}) {
  /* split on the em dash and trim (no backtracking regex on input) */
  const [fa, en] = String(name || '').slice(0, 200).split('—').map(part => part.trim())
  const sizes = Array.isArray(c.accountSizesUsd) ? c.accountSizesUsd.map(Number) : []
  return {
    slug, name: { fa: fa || '', en: en || fa || '' }, accountSizesUsd: sizes,
    priceUsd: Object.fromEntries(Object.entries(c.priceUsd || {}).map(([k, v]) => [Number(k), Number(v)])),
    phases: num(c.phases) ?? 1, phase1TargetPct: num(c.phase1TargetPct), phase2TargetPct: num(c.phase2TargetPct),
    dailyLossPct: num(c.dailyLossPct) ?? 0, maxTotalLossPct: num(c.maxTotalLossPct) ?? 0,
    profitSplitPct: num(c.profitSplitPct) ?? 0, drawdownMode: c.drawdownMode === 'trailing' ? 'trailing' : 'static',
    trailingLockAtProfitPct: num(c.trailingLockAtProfitPct), free: c.free === true || slug === 'free-trial',
    firstPayoutDays: num(c.firstPayoutDays), rewardCycles: Array.isArray(c.rewardCycles) ? c.rewardCycles : [],
    catalogVersion: num(c.catalogVersion) ?? 1,
    dailyLossVariantPriceUsd: c.dailyLossVariantPriceUsd && typeof c.dailyLossVariantPriceUsd === 'object'
      ? Object.fromEntries(Object.entries(c.dailyLossVariantPriceUsd).map(([k, v]) => [Number(k), Number(v)])) : null,
  }
}

/** Field-by-field difference between two configurations (published → draft),
 *  for the Backstage diff preview. Keys sorted; values JSON-compared. */
export function configurationDiff(before = {}, after = {}) {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].sort()
  return keys
    .filter(k => k !== 'catalogVersion' && JSON.stringify(before?.[k] ?? null) !== JSON.stringify(after?.[k] ?? null))
    .map(k => ({ field: k, before: before?.[k] ?? null, after: after?.[k] ?? null }))
}

/* ---------- Labs (limited drops, ADR 0055) ----------
 * A drop is a plan whose configuration carries a `lab` block. Displayed rules
 * must equal enforced rules, so a rule the evaluation engine does not enforce
 * is refused here instead of being published and silently ignored. */

/** Configuration keys a plan may not use until the engine enforces them. */
export const UNENFORCED_RULES = Object.freeze({
  trailingEodLockPct: 'an end-of-day trailing maximum loss',
  maxPayoutCount: 'a cap on the total number of payouts',
  minTradingDayProfitPct: 'a minimum daily profit for a day to count as a trading day',
})
const DRAWDOWN_MODES = ['static', 'trailing']
const isoDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v))
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi

/** Problems with rules the engine cannot enforce, and with a lab block. */
export function configurationProblems(slug, c = {}) {
  const out = []
  const add = message => out.push(`plan ${slug || '(?)'}: ${message}`)
  for (const [key, label] of Object.entries(UNENFORCED_RULES))
    if (c?.[key] !== undefined && c[key] !== null) add(`${label} (${key}) is not enforced by the evaluation engine; remove it`)
  if (c?.drawdownMode != null && !DRAWDOWN_MODES.includes(c.drawdownMode)) add(`drawdown mode ${c.drawdownMode} is not enforced by the evaluation engine`)
  if (c?.lab == null) return out
  const lab = c.lab
  if (typeof lab !== 'object' || Array.isArray(lab)) { add('lab must be an object'); return out }
  if (!int(lab.number, 1, 9999)) add('lab number must be a whole number from 1 to 9999')
  if (!int(lab.inventory, 1, 100000)) add('lab inventory must be a whole number from 1 to 100000')
  if (!int(lab.perWalletCap, 1, 5)) add('lab per-wallet cap must be 1 to 5')
  if (!isoDate(lab.saleStartsAt)) add('lab sale start must be an ISO date-time')
  if (lab.saleEndsAt != null && (!isoDate(lab.saleEndsAt) || Date.parse(lab.saleEndsAt) <= Date.parse(lab.saleStartsAt))) add('lab sale end must be an ISO date-time after the start')
  if (c.free) add('a lab drop cannot be free')
  const unknown = Object.keys(lab).filter(k => !['number', 'inventory', 'perWalletCap', 'saleStartsAt', 'saleEndsAt'].includes(k))
  if (unknown.length) add(`unknown lab fields: ${unknown.join(', ')}`)
  return out
}

/** A drop's state from its sale window, inventory and sales. */
export function labStatus(lab, { sold = 0, active = true, now = Date.now() } = {}) {
  if (!active) return 'closed'
  if (now < Date.parse(lab.saleStartsAt)) return 'coming_soon'
  if (sold >= lab.inventory) return 'sold_out'
  if (lab.saleEndsAt && now >= Date.parse(lab.saleEndsAt)) return 'closed'
  return 'open'
}
