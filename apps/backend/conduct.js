/**
 * Openfund conduct enforcement (rules snapshot v3) — the engine-level side of
 * owner decisions D1–D8. Pure rule logic lives in model-rules.js; this module
 * reads the authoritative records (positions, ledger, strikes, calendar) and
 * returns hard-breach violations, pre-trade refusals and the funded auto-close
 * signal. It only acts on snapshots that carry the rule (older snapshots are
 * never given new obligations).
 *
 * Calendar: news rules use operator-imported events from a licensed source,
 * and only inside verified coverage (economic_calendar_coverage). Outside
 * coverage a news rule is never enforced from incomplete data; plans whose
 * terms depend on it are not sold while coverage is missing (salesReadiness).
 */
import { D, positionMetrics } from './trading-math.js'
import {
  activeNews, appliesTo, autoCloseWindow, inAutoCloseWindow, inWeekend, inactivity, marketCurrencies,
  newsWindow, openLoss, profitableDayPeriods, tradeIdeaLimitPct, tradeIdeas, tradingDay,
} from './model-rules.js'

const HOUR = 3_600_000
/** coverage must reach this far ahead for news-dependent plans to be sold */
export const COVERAGE_AHEAD_DAYS = 7

/** Funded simulated stage: Instant (no evaluation) or an approved funded-demo account. */
export const isFundedStage = rules => !!rules && !rules.free && (!!rules.funded || Number(rules.phases ?? -1) === 0)

/** Is [from, to] fully inside one verified coverage import? */
export async function calendarCovered(q, from, to) {
  const { rows } = await q.query(
    `SELECT 1 FROM economic_calendar_coverage WHERE covers_from <= $1 AND covers_to >= $2 LIMIT 1`,
    [new Date(from).toISOString(), new Date(to).toISOString()])
  return rows.length > 0
}
export async function restrictedEvents(q, from, to) {
  const { rows } = await q.query(
    `SELECT id, currency, kind, starts_at, ends_at, true AS restricted FROM economic_events
      WHERE restricted AND starts_at <= $2 AND coalesce(ends_at, starts_at) >= $1 ORDER BY starts_at`,
    [new Date(from).toISOString(), new Date(to).toISOString()])
  return rows
}

/** Root positions (partial-close slices folded in) with their net: realized when closed, floating when open. */
export async function positionNets(q, accountId, md, since = null, { closedOnly = false } = {}) {
  const { rows } = await q.query(
    `SELECT r.*, coalesce((SELECT sum(ch.realized_pnl) FROM trading_positions ch WHERE ch.parent_position_id = r.id), 0) AS child_realized
       FROM trading_positions r
      WHERE r.account_id = $1 AND r.parent_position_id IS NULL AND ($2::timestamptz IS NULL OR r.opened_at >= $2)
        AND (NOT $3::boolean OR r.status <> 'open')
      ORDER BY r.opened_at`, [accountId, since, closedOnly])
  return rows.map(p => {
    const open = p.status === 'open'
    const realized = D(p.realized_pnl || 0).plus(D(p.child_realized || 0))
    let net = realized
    if (open) {
      const m = positionMetrics(p, md)
      if (m.net === null || m.net === undefined) return { id: p.id, market: p.market, side: p.side, opened_at: p.opened_at, closed_at: null, net: null, open: true }
      net = realized.plus(D(m.net))
    }
    return { id: p.id, market: p.market, side: p.side, opened_at: p.opened_at, closed_at: open ? null : p.closed_at, net: net.toString(), open }
  })
}

/** UTC+3 daily realized net (closes, liquidations, fees) since `since`. */
export async function dailyRealized(q, accountId, since) {
  const { rows } = await q.query(
    `SELECT to_char(ts AT TIME ZONE 'UTC' + interval '3 hours', 'YYYY-MM-DD') AS day, sum(amount)::text AS net
       FROM trading_ledger WHERE account_id = $1 AND event IN ('close', 'liquidation', 'open_fee')
        AND ($2::timestamptz IS NULL OR ts >= $2) GROUP BY 1 ORDER BY 1`, [accountId, since])
  return rows
}

export class ConductService {
  constructor(pool, { now = () => Date.now() } = {}) { this.pool = pool; this.now = now }

  /** Which conduct-dependent capabilities are ready right now (sales gate). */
  async readiness(q = this.pool) {
    const t = this.now()
    return { newsCalendar: await calendarCovered(q, t - HOUR, t + COVERAGE_AHEAD_DAYS * 86_400_000) }
  }

  /** Reasons a plan configuration cannot be sold now ([] = sellable). */
  async salesBlockers(configuration, q = this.pool) {
    const k = configuration?.conduct || {}
    const out = []
    if (k.news) {
      const r = await this.readiness(q)
      if (!r.newsCalendar) out.push('news_calendar_unavailable')
    }
    return out
  }

  /**
   * Refuse an order that would itself break a conduct rule (protects the
   * trader from an immediate breach). Returns a reason or null.
   */
  async preTradeBlock(q, { rules, market, now = this.now() }) {
    if (!rules || Number(rules.rulesVersion) < 3) return null
    const k = rules.conduct || {}
    const funded = isFundedStage(rules)
    if (appliesTo(k.holding, { funded })) {
      if (k.holding.mode === 'prohibit_weekend' && inWeekend(now)) return 'weekend_trading_prohibited'
      if (k.holding.mode === 'auto_close_daily' && inAutoCloseWindow(now)) return 'holding_window_closing'
    }
    if (appliesTo(k.news, { funded }) && k.news.mode === 'prohibit') {
      if (!marketCurrencies(market).length) return null
      if (!await calendarCovered(q, now - HOUR, now + HOUR)) return 'news_calendar_unavailable'
      const events = await restrictedEvents(q, now - 6 * HOUR, now + 6 * HOUR)
      if (activeNews(events, market, now, k.news.windowMin).length) return 'news_window_prohibited'
    }
    return null
  }

  /** Funded daily auto-close due now? */
  autoCloseDue(rules, now = this.now()) {
    const k = rules?.conduct || {}
    return Number(rules?.rulesVersion) >= 3 && appliesTo(k.holding, { funded: isFundedStage(rules) })
      && k.holding.mode === 'auto_close_daily' && inAutoCloseWindow(now)
  }

  /**
   * Hard-breach violations for one challenge (inside the engine's
   * transaction, account row locked). Records strikes as a side effect.
   */
  async violations(c, { challenge, acc, rules, md, now = this.now() }) {
    if (!rules || Number(rules.rulesVersion) < 3) return []
    const out = []
    const k = rules.conduct || {}
    const funded = isFundedStage(rules)
    const size = D(challenge.account_size_usd)

    /* D3 inactivity — open positions do not count */
    if (rules.inactivityDays) {
      const last = (await c.query(
        `SELECT max(closed_at) AS t FROM trading_positions WHERE account_id=$1 AND parent_position_id IS NULL AND status IN ('closed','liquidated')`, [acc.id])).rows[0].t
      const r = inactivity({ days: rules.inactivityDays, startedAt: challenge.started_at, lastFullCloseAt: last, now })
      if (r.breached) out.push({ rule: 'inactivity_breach', detail: { days: rules.inactivityDays, since: r.anchor, deadline: r.deadline } })
    }

    const positions = await positionNets(c, acc.id, md, challenge.started_at)
    const open = positions.filter(p => p.open)
    const stale = open.some(p => p.net === null)

    /* D4 max open risk (floating losses only; winners never offset) */
    if (k.maxOpenRiskPct && funded && !stale) {
      const limit = size.times(D(k.maxOpenRiskPct)).div(100)
      const loss = openLoss(open)
      if (loss.gte(limit)) out.push({ rule: 'open_risk_breach', detail: { openLoss: loss.toFixed(2), limit: limit.toFixed(2) } })
    }

    /* D4 trade-idea loss limit (Instant) and the strike system (on-demand) */
    const ideas = stale ? null : tradeIdeas(positions, { reentryMin: k.tradeIdea?.reentryMin ?? 10 })
    if (ideas && k.tradeIdea && funded) {
      const pct = tradeIdeaLimitPct(k.tradeIdea, challenge.account_size_usd)
      const limit = size.times(D(pct)).div(100)
      const hit = ideas.find(i => i.loss.gte(limit))
      if (hit) out.push({ rule: 'trade_idea_breach', detail: { idea: hit.key, market: hit.market, loss: hit.loss.toFixed(2), limit: limit.toFixed(2), limitPct: pct } })
    }
    const cycle = (rules.rewardCycles || []).find(x => x.key === challenge.reward_cycle)
    if (ideas && funded && cycle?.strikeLossPct) {
      const limit = size.times(D(cycle.strikeLossPct)).div(100)
      const known = new Set((await c.query('SELECT idea_key FROM challenge_strikes WHERE challenge_id=$1', [challenge.id])).rows.map(r => r.idea_key))
      let count = known.size
      for (const i of ideas.filter(i => i.loss.gte(limit) && !known.has(i.key))) {
        count += 1
        await c.query(`INSERT INTO challenge_strikes (challenge_id, idea_key, strike_no, loss_usd, detail) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
          [challenge.id, i.key, count, i.loss.toFixed(2), JSON.stringify({ market: i.market, side: i.side, members: i.members })])
        await c.query('INSERT INTO challenge_events (challenge_id, kind, detail) VALUES ($1,$2,$3)',
          [challenge.id, 'strike', JSON.stringify({ strike: count, idea: i.key, loss: i.loss.toFixed(2), limit: limit.toFixed(2) })])
      }
      if (count >= 4) out.push({ rule: 'strike_breach', detail: { strikes: count } })
    }

    /* D2/D4 Instant rolling profitable days */
    if (k.profitableDayRule && funded) {
      const first = positions[0]?.opened_at ?? null
      const paid = (await c.query(`SELECT max(reviewed_at) AS t FROM withdrawal_requests WHERE challenge_id=$1 AND kind='reward' AND status='paid'`, [challenge.id])).rows[0].t
      const anchor = first ? (paid && new Date(paid) > new Date(first) ? paid : first) : null
      if (anchor) {
        const daily = await dailyRealized(c, acc.id, anchor)
        const r = profitableDayPeriods({ rule: k.profitableDayRule, accountSize: challenge.account_size_usd, anchorAt: anchor, dailyNet: daily, now })
        if (r.breached) out.push({ rule: 'profitable_days_breach', detail: r })
      }
    }

    /* D8 weekend holding (prohibit) */
    if (appliesTo(k.holding, { funded }) && k.holding.mode === 'prohibit_weekend' && open.length && inWeekend(now)) {
      out.push({ rule: 'weekend_holding_breach', detail: { openPositions: open.length, at: new Date(now).toISOString() } })
    }

    /* D8 news (prohibit): open / close / hold inside a restricted window */
    if (appliesTo(k.news, { funded }) && k.news.mode === 'prohibit') {
      const from = Math.min(now - 2 * 86_400_000, ...positions.map(p => new Date(p.opened_at).getTime()).filter(Number.isFinite))
      if (await calendarCovered(c, Math.max(from, new Date(challenge.started_at).getTime()), now)) {
        const events = await restrictedEvents(c, Math.max(from, new Date(challenge.started_at).getTime()) - HOUR, now + HOUR)
        for (const p of positions) {
          const opened = new Date(p.opened_at).getTime(), closed = p.closed_at ? new Date(p.closed_at).getTime() : null
          const hit = events.find(e => {
            if (!marketCurrencies(p.market).includes(e.currency)) return false
            const w = newsWindow(e, k.news.windowMin)
            const held = opened <= w.to && (closed == null ? now >= w.from : closed >= w.from)
            return held && Math.min(now, w.to) >= w.from
          })
          if (hit) { out.push({ rule: 'news_breach', detail: { position: p.id, market: p.market, event: hit.id, currency: hit.currency } }); break }
        }
      } else if (open.length) {
        await c.query(`INSERT INTO challenge_events (challenge_id, kind, detail)
          SELECT $1, 'news_unverified', $2 WHERE NOT EXISTS (SELECT 1 FROM challenge_events WHERE challenge_id=$1 AND kind='news_unverified' AND ts > now() - interval '1 hour')`,
          [challenge.id, JSON.stringify({ at: new Date(now).toISOString(), day: tradingDay(now) })])
      }
    }
    return out
  }
}

export { autoCloseWindow }

/* ------------------------------------------------------------------ */
/* operator calendar import (service token + named actor)              */
/* ------------------------------------------------------------------ */
import { Router } from 'express'
import { adminAuth, adminActor } from './admin.js'

const fail = (status, error) => Object.assign(new Error(error), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const isoTime = v => { const t = Date.parse(v); return typeof v === 'string' && Number.isFinite(t) ? t : null }
export const MAX_IMPORT_EVENTS = 5000
export const MAX_COVERAGE_DAYS = 62

/**
 * Validate one import: the operator states the period the source export
 * fully covers; every event must lie inside it. Pure (throws 400s).
 */
export function validateCalendarImport(body) {
  if (!body || typeof body !== 'object') throw fail(400, 'invalid_body')
  const source = typeof body.source === 'string' ? body.source.trim() : ''
  if (source.length < 2 || source.length > 80) throw fail(400, 'invalid_source')
  const from = isoTime(body.coversFrom), to = isoTime(body.coversTo)
  if (from == null || to == null || to <= from || to - from > MAX_COVERAGE_DAYS * 86_400_000) throw fail(400, 'invalid_coverage')
  if (!Array.isArray(body.events) || body.events.length > MAX_IMPORT_EVENTS) throw fail(400, 'invalid_events')
  const seen = new Set()
  const events = body.events.map((e, i) => {
    const start = isoTime(e?.startsAt), end = e?.endsAt == null ? null : isoTime(e.endsAt)
    const ok = e && typeof e.externalId === 'string' && e.externalId.length >= 1 && e.externalId.length <= 120
      && typeof e.title === 'string' && e.title.trim().length >= 1 && e.title.length <= 200
      && /^[A-Z]{3}$/.test(e.currency) && ['release', 'speech'].includes(e.kind) && ['high', 'medium', 'low'].includes(e.impact)
      && start != null && start >= from && start <= to && (e.endsAt == null || (end != null && end >= start && end - start <= 6 * HOUR))
      && (e.kind === 'speech' || e.endsAt == null || end === start)
    if (!ok) throw Object.assign(fail(400, 'invalid_event'), { index: i })
    if (seen.has(e.externalId)) throw Object.assign(fail(400, 'duplicate_event'), { index: i })
    seen.add(e.externalId)
    /* only high-impact events tagged restricted carry trading restrictions */
    return { externalId: e.externalId, title: e.title.trim(), currency: e.currency, kind: e.kind, impact: e.impact,
      restricted: e.impact === 'high' && e.restricted === true, startsAt: new Date(start).toISOString(), endsAt: end == null ? null : new Date(end).toISOString() }
  })
  return { source, coversFrom: new Date(from).toISOString(), coversTo: new Date(to).toISOString(), events }
}

export function calendarAdminRoutes({ pool, conduct = new ConductService(pool) }) {
  const router = Router()
  router.use(adminAuth)
  router.get('/status', wrap(async (req, res) => {
    const coverage = (await pool.query('SELECT id, source, covers_from, covers_to, event_count, actor, imported_at FROM economic_calendar_coverage ORDER BY covers_to DESC LIMIT 20')).rows
    res.set('Cache-Control', 'no-store').json({ readiness: await conduct.readiness(), coverage })
  }))
  router.post('/import', wrap(async (req, res) => {
    const actor = adminActor(req)
    const imp = validateCalendarImport(req.body)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const e of imp.events) {
        await client.query(
          `INSERT INTO economic_events (source, external_id, title, currency, kind, impact, restricted, starts_at, ends_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (source, external_id) DO UPDATE SET title=EXCLUDED.title, currency=EXCLUDED.currency, kind=EXCLUDED.kind,
             impact=EXCLUDED.impact, restricted=EXCLUDED.restricted, starts_at=EXCLUDED.starts_at, ends_at=EXCLUDED.ends_at, imported_at=now()`,
          [imp.source, e.externalId, e.title, e.currency, e.kind, e.impact, e.restricted, e.startsAt, e.endsAt])
      }
      const { rows: [cov] } = await client.query(
        `INSERT INTO economic_calendar_coverage (source, covers_from, covers_to, event_count, actor) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [imp.source, imp.coversFrom, imp.coversTo, imp.events.length, actor])
      await client.query('COMMIT')
      res.json({ ok: true, coverage: cov, restricted: imp.events.filter(e => e.restricted).length })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))
  router.use((err, req, res, next) => {
    if (!err?.status || err.status >= 500) return next(err)
    res.status(err.status).json({ error: err.message, ...(err.index != null ? { index: err.index } : {}) })
  })
  return router
}
