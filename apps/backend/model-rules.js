/**
 * Openfund model conduct rules (rules snapshot version 3) — pure functions.
 *
 * Owner decisions of 2026-11-13 (D1–D8) adopt the current reference models
 * as the baseline: Standard (2-step), One-step and Instant, with Openfund's
 * own leverage ceilings. Everything here is deterministic and side-effect
 * free; apps/backend/conduct.js reads the records and applies the results.
 * Openfund interpretations of reference wording are marked INTERPRETATION.
 *
 * Time conventions
 *  - Openfund trading day: UTC+3 calendar day (published rule of record).
 *  - Market week: the forex week. "Friday close" and the daily holding
 *    window follow the reference schedule: 21:00 UTC in the summer period
 *    (from the first Sunday of March) and 22:00 UTC in the winter period
 *    (from the first Sunday of November). The daily funded auto-close runs
 *    in the 15 minutes before that hour.
 */
import { D } from './trading-math.js'

export const DAY_MS = 86_400_000
const MIN_MS = 60_000
const UTC3_MS = 3 * 3_600_000

/* ------------------------------------------------------------------ */
/* calendar helpers                                                    */
/* ------------------------------------------------------------------ */

/** First Sunday (UTC) of month `m` (0-based) in year `y`, at 00:00 UTC. */
function firstSunday(y, m) {
  const d = new Date(Date.UTC(y, m, 1))
  return Date.UTC(y, m, 1 + ((7 - d.getUTCDay()) % 7))
}
/** Summer period: first Sunday of March (inclusive) to first Sunday of November (exclusive). */
export function isSummerPeriod(ts) {
  const y = new Date(ts).getUTCFullYear()
  return ts >= firstSunday(y, 2) && ts < firstSunday(y, 10)
}
/** UTC hour of the daily market close for the period containing `ts`. */
export const closeHourUtc = ts => (isSummerPeriod(ts) ? 21 : 22)

/** Daily funded auto-close window [start, end) for the UTC day of `ts`. */
export function autoCloseWindow(ts) {
  const d = new Date(ts)
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), closeHourUtc(ts))
  return { start: end - 15 * MIN_MS, end }
}
export function inAutoCloseWindow(ts) {
  const w = autoCloseWindow(ts)
  return ts >= w.start && ts < w.end
}

/** True from Friday market close until Sunday market open (forex week). */
export function inWeekend(ts) {
  const d = new Date(ts)
  const day = d.getUTCDay()               /* 0 Sun … 5 Fri, 6 Sat */
  const close = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), closeHourUtc(ts))
  if (day === 6) return true
  if (day === 5) return ts >= close
  if (day === 0) return ts < close
  return false
}

/** Openfund trading day (UTC+3) of a timestamp, 'YYYY-MM-DD'. */
export const tradingDay = ts => new Date(new Date(ts).getTime() + UTC3_MS).toISOString().slice(0, 10)
/** Start (UTC ms) of the Openfund trading day after the one containing `ts`. */
export function nextTradingDayStart(ts) {
  const day = tradingDay(ts)
  return Date.parse(`${day}T00:00:00Z`) - UTC3_MS + DAY_MS
}

/* ------------------------------------------------------------------ */
/* market currencies (news exposure)                                   */
/* ------------------------------------------------------------------ */
const FIAT = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY', 'CNH', 'SEK', 'NOK', 'DKK', 'SGD', 'HKD', 'MXN', 'ZAR', 'TRY', 'PLN', 'KRW', 'INR', 'BRL'])
/**
 * Currencies whose high-impact events affect a market. INTERPRETATION: every
 * fiat leg of the symbol (EUR/USD → EUR, USD; BTC/USD → USD; XAU/USD → USD;
 * an index or stock quoted in USD → USD).
 */
export function marketCurrencies(market) {
  return String(market || '').toUpperCase().split(/[/\-_:]/).filter(p => FIAT.has(p))
}

/* ------------------------------------------------------------------ */
/* news windows                                                        */
/* ------------------------------------------------------------------ */
/**
 * Restricted window of an event: [start − w, end + w]. A release has no
 * duration (end = start); a speech runs to its scheduled end.
 */
export function newsWindow(event, windowMin) {
  const start = new Date(event.starts_at ?? event.startsAt).getTime()
  const end = new Date(event.ends_at ?? event.endsAt ?? start).getTime()
  return { from: start - windowMin * MIN_MS, to: Math.max(start, end) + windowMin * MIN_MS, start }
}
/** Restricted events affecting `market` whose window contains `ts`. */
export function activeNews(events, market, ts, windowMin) {
  const cur = new Set(marketCurrencies(market))
  return events.filter(e => (e.restricted ?? true) && cur.has(String(e.currency).toUpperCase())
    && (({ from, to }) => ts >= from && ts <= to)(newsWindow(e, windowMin)))
}

/**
 * Funded-stage news profit deduction (Standard / One-step): profit of a
 * closed trade opened or closed inside a restricted window is not counted,
 * unless the trade was opened at least `exemptHours` before the event.
 * Returns the deducted positive profit per position id.
 */
export function newsDeductions(positions, events, { windowMin, exemptHours }) {
  const out = []
  for (const p of positions) {
    const net = D(p.net)
    if (!p.closed_at || !net.gt(0)) continue
    const opened = new Date(p.opened_at).getTime(), closed = new Date(p.closed_at).getTime()
    const hit = events.find(e => {
      if (!(e.restricted ?? true) || !marketCurrencies(p.market).includes(String(e.currency).toUpperCase())) return false
      const w = newsWindow(e, windowMin)
      const touches = (opened >= w.from && opened <= w.to) || (closed >= w.from && closed <= w.to)
      return touches && !(exemptHours != null && opened <= w.start - exemptHours * 3_600_000)
    })
    if (hit) out.push({ positionId: p.id, amount: net.toFixed(2), eventId: hit.id ?? null })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* trade ideas                                                         */
/* ------------------------------------------------------------------ */
/**
 * Group positions into trade ideas. A trade idea is
 *  - one trade;
 *  - trades on the same instrument and direction that are open at the
 *    same time;
 *  - new trades in the same instrument and direction opened within
 *    `reentryMin` minutes after a losing trade of the idea was closed.
 * INTERPRETATION: the re-entry rule is applied to the same instrument and
 * direction for every model. The idea's loss is the sum of the losses of
 * its losing trades (closed net plus floating) — a winning trade never
 * offsets a losing one.
 *
 * positions: [{ id, market, side, opened_at, closed_at|null, net }]
 * returns [{ key, market, side, members:[ids], loss: Decimal≥0, profit: Decimal≥0, open: bool }]
 */
export function tradeIdeas(positions, { reentryMin = 10 } = {}) {
  const groups = new Map()
  for (const p of [...positions].sort((a, b) => new Date(a.opened_at) - new Date(b.opened_at) || String(a.id).localeCompare(String(b.id)))) {
    const k = `${p.market}|${p.side}`
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(p)
  }
  const ideas = []
  for (const list of groups.values()) {
    let cur = null
    for (const p of list) {
      const t = new Date(p.opened_at).getTime()
      const joins = cur && (t <= cur.activeUntil || (cur.lastLosingClose != null && t - cur.lastLosingClose <= reentryMin * MIN_MS))
      if (!joins) { cur = { key: String(p.id), market: p.market, side: p.side, members: [], loss: D(0), profit: D(0), open: false, activeUntil: -Infinity, lastLosingClose: null }; ideas.push(cur) }
      const net = D(p.net)
      cur.members.push(p.id)
      if (net.lt(0)) cur.loss = cur.loss.plus(net.negated()); else cur.profit = cur.profit.plus(net)
      const closed = p.closed_at ? new Date(p.closed_at).getTime() : null
      if (closed == null) { cur.open = true; cur.activeUntil = Infinity }
      else {
        cur.activeUntil = Math.max(cur.activeUntil, closed)
        if (net.lt(0)) cur.lastLosingClose = Math.max(cur.lastLosingClose ?? -Infinity, closed)
      }
    }
  }
  return ideas.map(({ activeUntil, lastLosingClose, ...i }) => i)
}

/** Instant trade-idea loss limit (%): 3% below USD 50,000, 2% from 50,000. */
export function tradeIdeaLimitPct(rule, accountSize) {
  if (!rule) return null
  return Number(accountSize) < Number(rule.thresholdUsd) ? rule.belowPct : rule.atOrAbovePct
}

/* ------------------------------------------------------------------ */
/* account-level checks                                                */
/* ------------------------------------------------------------------ */
/** Sum of floating losses of losing open positions (≥ 0). */
export function openLoss(openPositions) {
  return openPositions.reduce((s, p) => (D(p.net).lt(0) ? s.plus(D(p.net).negated()) : s), D(0))
}

/**
 * Inactivity: breached when no trade has been fully closed for `days`
 * calendar days. The clock starts at the account start when nothing has
 * been closed yet, otherwise at the start of the trading day after the
 * last full close. Open positions do not reset it.
 */
export function inactivity({ days, startedAt, lastFullCloseAt, now }) {
  if (!days) return { breached: false }
  const anchor = lastFullCloseAt ? nextTradingDayStart(new Date(lastFullCloseAt).getTime()) : new Date(startedAt).getTime()
  const deadline = anchor + days * DAY_MS
  return { breached: now >= deadline, anchor: new Date(anchor).toISOString(), deadline: new Date(deadline).toISOString() }
}

/** Trading days whose net realized profit ≥ minPct % of the account size. */
export function profitableDays(dailyNet, accountSize, minPct) {
  const min = D(accountSize).times(D(minPct)).div(100)
  return dailyNet.filter(d => D(d.net).gte(min) && D(d.net).gt(0)).length
}

/**
 * Instant rolling profitable-day requirement: from the first trade (or the
 * last processed reward), every completed `windowDays` period must contain
 * `days` qualifying days. Returns the first failing completed period.
 * dailyNet: [{ day:'YYYY-MM-DD', net }] (UTC+3 days, realized net).
 */
export function profitableDayPeriods({ rule, accountSize, anchorAt, dailyNet, now }) {
  if (!rule || !anchorAt) return { breached: false }
  const anchor = new Date(anchorAt).getTime()
  const min = D(accountSize).times(D(rule.minPct)).div(100)
  for (let from = anchor; from + rule.windowDays * DAY_MS <= now; from += rule.windowDays * DAY_MS) {
    const to = from + rule.windowDays * DAY_MS
    const fromDay = tradingDay(from), toDay = tradingDay(to - 1)
    const count = dailyNet.filter(d => d.day >= fromDay && d.day <= toDay && D(d.net).gte(min) && D(d.net).gt(0)).length
    if (count < rule.days) return { breached: true, period: { from: new Date(from).toISOString(), to: new Date(to).toISOString() }, count, required: rule.days }
  }
  return { breached: false }
}

/** Reward split after strikes: 1 warning; 2 → half; 3 → 20%; 4 → breach. */
export function strikeAdjustedSplit(splitPct, strikes) {
  if (strikes >= 4) return 0
  if (strikes === 3) return Math.min(20, splitPct)
  if (strikes === 2) return splitPct / 2
  return splitPct
}

/* ------------------------------------------------------------------ */
/* rules snapshot v3 (model policy)                                    */
/* ------------------------------------------------------------------ */
const num = v => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)

/** Validate and copy the catalog's model policy (frozen into the snapshot). */
export function normalizeModelPolicy(c = {}) {
  const cycles = Array.isArray(c.rewardCycles) ? c.rewardCycles.map(r => ({
    key: String(r.key), splitPct: num(r.splitPct), firstAfterDays: num(r.firstAfterDays), everyDays: num(r.everyDays),
    consistencyPct: num(r.consistencyPct), profitableDays: num(r.profitableDays), profitableDayPct: num(r.profitableDayPct),
    strikeLossPct: num(r.strikeLossPct),
  })).filter(r => ['weekly', 'biweekly', 'on_demand'].includes(r.key) && r.splitPct > 0) : []
  const k = c.conduct || {}
  return {
    model: typeof c.model === 'string' ? c.model : null,
    rewardCycles: cycles,
    inactivityDays: num(c.inactivityDays),
    conduct: {
      maxOpenRiskPct: num(k.maxOpenRiskPct),
      tradeIdea: k.tradeIdea ? { thresholdUsd: num(k.tradeIdea.thresholdUsd), belowPct: num(k.tradeIdea.belowPct), atOrAbovePct: num(k.tradeIdea.atOrAbovePct), reentryMin: num(k.tradeIdea.reentryMin) ?? 10 } : null,
      profitableDayRule: k.profitableDayRule ? { days: num(k.profitableDayRule.days), windowDays: num(k.profitableDayRule.windowDays), minPct: num(k.profitableDayRule.minPct) } : null,
      news: k.news ? { mode: k.news.mode === 'prohibit' ? 'prohibit' : 'deduct', stage: k.news.stage === 'all' ? 'all' : 'funded', windowMin: num(k.news.windowMin), exemptHours: num(k.news.exemptHours) } : null,
      holding: k.holding ? { mode: k.holding.mode === 'prohibit_weekend' ? 'prohibit_weekend' : 'auto_close_daily', stage: k.holding.stage === 'all' ? 'all' : 'funded' } : null,
    },
  }
}

/** Does a conduct rule apply on this account stage? (funded = Instant or funded-demo) */
export const appliesTo = (rule, { funded }) => !!rule && (rule.stage === 'all' || funded)
