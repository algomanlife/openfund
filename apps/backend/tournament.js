/**
 * Openfund Premium League (ADR 0050): a 30-trading-day demo competition in
 * technical analysis and risk management.
 *
 * Rules are data (the `tournaments` row, editable in Backstage before the
 * start). Accounts are ordinary challenge accounts with a frozen snapshot of
 * the tournament rules, so the existing engine enforces the daily loss
 * (UTC+3 day basis) and the static maximum loss. Differences from a
 * challenge, all in data or in one engine branch:
 *  - no profit target (phases 0), so an account never "passes";
 *  - a rule breach marks the registration out_of_ranking and leaves the
 *    account open for practice (engine.js);
 *  - the time limit is the competition end: the engine then closes open
 *    positions at the mark and closes (freezes) the account.
 *
 * Ranking (computed once, frozen in tournament_standings):
 *  - ranked: registration still 'active' (no breach, not disqualified), at
 *    least one closed trade, and consistency: no single UTC+3 day's realized
 *    profit above consistency_pct of the total profit (applies when the
 *    total profit is positive);
 *  - order: final equity (to the cent) desc, then lower maximum drawdown
 *    (from server-side equity samples and the final balance), then the
 *    earlier time the final equity was reached (the last closing trade).
 *
 * Registration needs the SIWE session, a verified e-mail (one-time code via
 * email.js) and acceptance of the published terms (legal_documents with
 * doc_type 'tournament-terms' and status 'published'). One entry per wallet
 * and per e-mail. Nothing here invents counts: the public page shows the
 * real number of verified registrations.
 */
import { Router } from 'express'
import crypto from 'node:crypto'
import { adminAuth, adminActor } from './admin.js'
import { normalizeRules, ChallengeService } from './evaluation.js'
import { accountMetrics, D } from './trading-math.js'
import { issueEntitlementTx } from './entitlements.js'
import { notify } from './notifications.js'

const fail = (status, error, details) => Object.assign(new Error(error), { status, ...(details ? { details } : {}) })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG = /^[a-z0-9][a-z0-9-]{2,59}$/
const MAILBOX = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/
export const TOURNAMENT_PLAN_SLUG = 'premium-league'
export const DEFAULT_TOURNAMENT = {
  slug: 'premium-league-2027', name_fa: 'لیگ برتر اوپن‌فاند', name_en: 'Openfund Premium League',
  starts_at: '2027-01-04T00:00:00Z', trading_days: 30, account_size_usd: 125000, daily_loss_pct: 5, max_loss_pct: 10, consistency_pct: 35,
  prizes: {
    cash: { 1: 10000, 2: 7500, 3: 5000 },
    accountRanks: [4, 10], account: { planSlug: 'standard', sizeUsd: 50000, funded: false, expiresDays: 90 },
    hardware: ['PlayStation 5 Pro', 'Grand Theft Auto VI', 'EA SPORTS FC 27'],
    couponRanks: [11, 100], coupon: { percent: 35, expiresDays: 90 },
  },
}

/** Close of the Nth weekday (UTC) counted from the start day (same rule as
 *  apps/web-react/src/features/tournament/schedule.ts). */
export function tradingEnd(startIso, tradingDays) {
  const day = new Date(startIso)
  let counted = 0
  for (;;) {
    const weekday = day.getUTCDay()
    if (weekday !== 0 && weekday !== 6) counted++
    if (counted === tradingDays) break
    day.setUTCDate(day.getUTCDate() + 1)
  }
  day.setUTCHours(23, 59, 59, 999)
  return day
}
/** UTC+3 trading day of a timestamp (the engine's daily-loss day). */
const tradingDay = ts => new Date(new Date(ts).getTime() + 3 * 3_600_000).toISOString().slice(0, 10)
export const maskWallet = w => (w ? `${w.slice(0, 6)}…${w.slice(-4)}` : '')
const hashCode = (registrationId, code) => crypto.createHmac('sha256', process.env.TOURNAMENT_CODE_PEPPER || 'openfund-tournament').update(`${registrationId}:${code}`).digest('hex')

/** Idempotent: the hidden plan the tournament accounts are provisioned from
 *  (status inactive, so it is never sold) and the default competition. */
export async function ensureTournamentSeed(pool) {
  const t = DEFAULT_TOURNAMENT
  const config = { accountSizesUsd: [t.account_size_usd], priceUsd: { [t.account_size_usd]: 0 }, phases: 0, phase1TargetPct: null, phase2TargetPct: null,
    dailyLossPct: t.daily_loss_pct, maxTotalLossPct: t.max_loss_pct, drawdownMode: 'static', minTradingDays: 0, consistencyPct: t.consistency_pct,
    profitSplitPct: 0, payoutCapPct: 0, refundPolicy: 'none', catalogVersion: 3, model: 'tournament', rewardCycles: [], inactivityDays: null, conduct: {}, free: false }
  await pool.query(`INSERT INTO challenge_plans (slug, name, status, configuration) VALUES ($1, $2, 'inactive', $3) ON CONFLICT (slug) DO NOTHING`,
    [TOURNAMENT_PLAN_SLUG, `${t.name_fa} — ${t.name_en}`, JSON.stringify(config)])
  await pool.query(`INSERT INTO tournaments (slug, name_fa, name_en, status, starts_at, trading_days, ends_at, account_size_usd, daily_loss_pct, max_loss_pct, consistency_pct, prizes)
    VALUES ($1,$2,$3,'registration',$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (slug) DO NOTHING`,
    [t.slug, t.name_fa, t.name_en, t.starts_at, t.trading_days, tradingEnd(t.starts_at, t.trading_days).toISOString(),
      t.account_size_usd, t.daily_loss_pct, t.max_loss_pct, t.consistency_pct, JSON.stringify(t.prizes)])
}

export async function termsState(q, docType) {
  if ((await q.query(`SELECT to_regclass('public.legal_documents') AS t`)).rows[0].t === null) return { published: false, version: null }
  const { rows: [doc] } = await q.query(`SELECT version FROM legal_documents WHERE doc_type=$1 AND status='published' ORDER BY id DESC LIMIT 1`, [docType])
  return { published: !!doc, version: doc?.version ?? null }
}

/** Public projection of a tournament row (no personal data). */
export async function publicTournament(pool, t, { email, now = Date.now() } = {}) {
  const terms = await termsState(pool, t.terms_doc_type)
  const { rows: [counts] } = await pool.query(
    `SELECT count(*) FILTER (WHERE status <> 'pending_email' AND status <> 'withdrawn')::int AS registered FROM tournament_registrations WHERE tournament_id=$1`, [t.id])
  const before = now < Date.parse(t.starts_at)
  return {
    slug: t.slug, name: { fa: t.name_fa, en: t.name_en }, status: t.status,
    startsAt: t.starts_at, endsAt: t.ends_at, tradingDays: t.trading_days,
    rules: { accountSizeUsd: Number(t.account_size_usd), dailyLossPct: Number(t.daily_loss_pct), maxLossPct: Number(t.max_loss_pct), consistencyPct: Number(t.consistency_pct), dayBasis: 'UTC+3' },
    prizes: t.prizes,
    registration: {
      open: before && ['registration', 'draft'].includes(t.status) && t.status !== 'draft' && terms.published && email.configured,
      termsPublished: terms.published, termsVersion: terms.version, emailConfigured: email.configured, beforeStart: before,
    },
    registered: counts.registered,
  }
}

async function loadTournament(q, slug, lock = false) {
  if (!SLUG.test(String(slug || ''))) throw fail(404, 'tournament_not_found')
  const { rows: [t] } = await q.query(`SELECT * FROM tournaments WHERE slug=$1 ${lock ? 'FOR UPDATE' : ''}`, [slug])
  if (!t) throw fail(404, 'tournament_not_found')
  return t
}

/** Leaderboard rows: the latest server-side sample per account. */
export async function leaderboard(pool, t, { limit = 100 } = {}) {
  const { rows } = await pool.query(`
    SELECT r.id, r.nickname, r.wallet_address, r.status, s.equity, s.observed_at
      FROM tournament_registrations r
      JOIN LATERAL (SELECT equity, observed_at FROM tournament_snapshots x WHERE x.registration_id=r.id ORDER BY observed_at DESC LIMIT 1) s ON true
     WHERE r.tournament_id=$1 AND r.status IN ('active','out_of_ranking')
     ORDER BY (r.status='active') DESC, s.equity DESC LIMIT $2`, [t.id, limit])
  return rows.map((r, i) => ({ position: r.status === 'active' ? i + 1 : null, name: r.nickname || maskWallet(r.wallet_address),
    equity: Number(r.equity).toFixed(2), outOfRanking: r.status === 'out_of_ranking', observedAt: r.observed_at }))
}

/** Consistency and ranking inputs of one registration (live or final). */
export async function accountReport(q, t, reg) {
  const { rows: [c] } = await q.query(`SELECT c.demo_account_id, a.balance, a.status AS account_status FROM openfund_challenges c JOIN demo_accounts a ON a.id=c.demo_account_id WHERE c.id=$1`, [reg.challenge_id])
  if (!c) return null
  const start = D(t.account_size_usd)
  const closed = (await q.query(`SELECT realized_pnl, closed_at FROM trading_positions WHERE account_id=$1 AND status IN ('closed','liquidated') AND closed_at IS NOT NULL ORDER BY closed_at`, [c.demo_account_id])).rows
  const open = (await q.query(`SELECT count(*)::int n FROM trading_positions WHERE account_id=$1 AND status='open'`, [c.demo_account_id])).rows[0].n
  const days = new Map()
  for (const p of closed) days.set(tradingDay(p.closed_at), (days.get(tradingDay(p.closed_at)) ?? D(0)).plus(p.realized_pnl))
  const balance = D(c.balance)
  const total = balance.minus(start)
  const best = [...days.values()].reduce((m, v) => (v.gt(m) ? v : m), D(0))
  const share = total.gt(0) ? best.div(total) : null
  const samples = (await q.query(`SELECT equity FROM tournament_snapshots WHERE registration_id=$1 ORDER BY observed_at`, [reg.id])).rows.map(r => D(r.equity))
  let peak = start, drawdown = D(0)
  for (const e of [...samples, balance]) { if (e.gt(peak)) peak = e; if (peak.minus(e).gt(drawdown)) drawdown = peak.minus(e) }
  return { accountId: c.demo_account_id, accountClosed: c.account_status !== 'active', openPositions: open, closedTrades: closed.length, balance: balance.toFixed(2),
    totalProfit: total.toFixed(2), bestDay: best.toFixed(2), bestDayShare: share === null ? null : Number(share.toFixed(4)),
    consistencyOk: share === null || share.lte(D(t.consistency_pct).div(100)), maxDrawdown: drawdown.toFixed(2), reachedAt: closed.at(-1)?.closed_at ?? null }
}

/** The ranking rule, pure: rows with { ranked, finalEquity, maxDrawdown, reachedAt }. */
export function rankRows(rows) {
  const ranked = rows.filter(r => r.ranked).sort((a, b) => {
    const e = D(b.finalEquity).cmp(D(a.finalEquity)); if (e) return e
    const d = D(a.maxDrawdown).cmp(D(b.maxDrawdown)); if (d) return d
    return new Date(a.reachedAt ?? 8.64e15) - new Date(b.reachedAt ?? 8.64e15)
  })
  ranked.forEach((r, i) => { r.rank = i + 1 })
  return rows.map(r => ({ ...r, rank: r.ranked ? r.rank : null }))
}

/* ------------------------------------------------------------------ jobs */

/** At the start: provision every verified registration (idempotent). */
export async function provisionAtStart(pool, { now = Date.now() } = {}) {
  const { rows: due } = await pool.query(`SELECT * FROM tournaments WHERE status='registration' AND starts_at <= to_timestamp($1 / 1000.0)`, [now])
  let provisioned = 0
  for (const t of due) {
    const { rows: [plan] } = await pool.query('SELECT id, configuration FROM challenge_plans WHERE slug=$1', [TOURNAMENT_PLAN_SLUG])
    const regs = (await pool.query(`SELECT * FROM tournament_registrations WHERE tournament_id=$1 AND status='registered' AND challenge_id IS NULL`, [t.id])).rows
    for (const reg of regs) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const locked = (await client.query('SELECT * FROM tournament_registrations WHERE id=$1 FOR UPDATE', [reg.id])).rows[0]
        if (locked.status !== 'registered' || locked.challenge_id) { await client.query('ROLLBACK'); continue }
        const rules = { ...normalizeRules({ ...plan.configuration, accountSizesUsd: [Number(t.account_size_usd)], dailyLossPct: Number(t.daily_loss_pct), maxTotalLossPct: Number(t.max_loss_pct), consistencyPct: Number(t.consistency_pct) }),
          tournament: { id: t.id, slug: t.slug }, timeLimitDays: null }
        const { rows: [challenge] } = await client.query(
          `INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, stage, rules_snapshot) VALUES ($1,$2,'created',$3,1,$4) RETURNING *`,
          [locked.user_id, plan.id, t.account_size_usd, JSON.stringify(rules)])
        const service = new ChallengeService(client)
        await service.startTx(client, challenge)
        await client.query(`UPDATE openfund_challenges SET expires_at=$2 WHERE id=$1`, [challenge.id, t.ends_at])
        await client.query(`UPDATE tournament_registrations SET status='active', challenge_id=$2, updated_at=now() WHERE id=$1`, [reg.id, challenge.id])
        await ChallengeService.event(client, challenge.id, 'tournament_account_provisioned', { tournament: t.slug, registrationId: reg.id })
        await notify(client, { userId: locked.user_id, kind: 'tournament_started', payload: { tournament: t.slug, challengeId: challenge.id }, dedupeKey: `tournament_started:${reg.id}` })
        await client.query('COMMIT')
        provisioned++
      } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
    }
    await pool.query(`UPDATE tournaments SET status='live', updated_at=now() WHERE id=$1 AND status='registration'`, [t.id])
  }
  return provisioned
}

/** Server-side equity samples for the live leaderboard and drawdown. */
export async function sampleEquity(pool, marketData, { now = Date.now() } = {}) {
  const regs = (await pool.query(`SELECT r.id, r.tournament_id, c.demo_account_id FROM tournament_registrations r
      JOIN tournaments t ON t.id=r.tournament_id JOIN openfund_challenges c ON c.id=r.challenge_id
     WHERE t.status='live' AND r.status IN ('active','out_of_ranking') AND t.ends_at > to_timestamp($1 / 1000.0)`, [now])).rows
  let sampled = 0
  for (const r of regs) {
    const acc = (await pool.query('SELECT * FROM demo_accounts WHERE id=$1', [r.demo_account_id])).rows[0]
    if (!acc) continue
    const positions = (await pool.query(`SELECT * FROM trading_positions WHERE account_id=$1 AND status='open'`, [acc.id])).rows
    const view = accountMetrics(acc, positions, marketData)
    if (view.equity === null) continue /* stale marks: never record an estimate */
    await pool.query(`INSERT INTO tournament_snapshots (tournament_id, registration_id, equity, balance) VALUES ($1,$2,$3,$4)`,
      [r.tournament_id, r.id, D(view.equity).toFixed(2), D(acc.balance).toFixed(2)])
    sampled++
  }
  /* finished once the end has passed and every account is settled */
  await pool.query(`UPDATE tournaments t SET status='finished', updated_at=now() WHERE t.status='live' AND t.ends_at <= to_timestamp($1 / 1000.0)
      AND NOT EXISTS (SELECT 1 FROM tournament_registrations r JOIN openfund_challenges c ON c.id=r.challenge_id WHERE r.tournament_id=t.id AND c.status='started')`, [now])
  return sampled
}

/* ------------------------------------------------------------------ routes */

export function tournamentRoutes({ pool, requireAuth, limit, email, audit }) {
  const router = Router()
  router.get('/tournaments/:slug', limit(120), wrap(async (req, res) => {
    const t = await loadTournament(pool, req.params.slug)
    if (t.status === 'draft') throw fail(404, 'tournament_not_found')
    const body = await publicTournament(pool, t, { email })
    if (['live', 'finished'].includes(t.status)) body.leaderboard = await leaderboard(pool, t)
    if (t.status === 'finalized') {
      body.standings = (await pool.query(`SELECT s.rank, s.final_equity, r.nickname, r.wallet_address FROM tournament_standings s
        JOIN tournament_registrations r ON r.id=s.registration_id WHERE s.tournament_id=$1 AND s.ranked ORDER BY s.rank LIMIT 100`, [t.id])).rows
        .map(r => ({ rank: r.rank, name: r.nickname || maskWallet(r.wallet_address), finalEquity: Number(r.final_equity).toFixed(2) }))
    }
    res.set('Cache-Control', 'public, max-age=30').json(body)
  }))

  router.get('/tournaments/:slug/me', requireAuth, wrap(async (req, res) => {
    const t = await loadTournament(pool, req.params.slug)
    const { rows: [reg] } = await pool.query(`SELECT * FROM tournament_registrations WHERE tournament_id=$1 AND user_id=$2`, [t.id, req.user.user_id])
    if (!reg) return res.set('Cache-Control', 'no-store').json({ registered: false })
    const report = reg.challenge_id ? await accountReport(pool, t, reg) : null
    res.set('Cache-Control', 'no-store').json({ registered: reg.status !== 'pending_email', status: reg.status, emailVerified: !!reg.email_verified_at,
      nickname: reg.nickname, challengeId: reg.challenge_id, outOfRankingRule: reg.out_of_ranking_rule,
      consistency: report && { bestDayShare: report.bestDayShare, limit: Number(t.consistency_pct) / 100, ok: report.consistencyOk, totalProfit: report.totalProfit },
      closedTrades: report?.closedTrades ?? 0 })
  }))

  /* step 2: e-mail and terms; sends a one-time code */
  router.post('/tournaments/:slug/register', requireAuth, limit(10), wrap(async (req, res) => {
    const t = await loadTournament(pool, req.params.slug)
    const pub = await publicTournament(pool, t, { email })
    if (!pub.registration.beforeStart || t.status !== 'registration') throw fail(409, 'registration_closed')
    if (!pub.registration.termsPublished) throw fail(409, 'terms_not_published')
    if (!email.configured) throw fail(503, 'email_not_configured')
    const { email: address, nickname, acceptTerms, termsVersion } = req.body || {}
    const mail = String(address || '').trim().toLowerCase()
    if (!MAILBOX.test(mail) || mail.length > 254) throw fail(400, 'invalid_email')
    if (acceptTerms !== true || termsVersion !== pub.registration.termsVersion) throw fail(400, 'terms_not_accepted')
    const nick = nickname == null || nickname === '' ? null : String(nickname).trim()
    if (nick !== null && (!/^[\p{L}\p{N}][\p{L}\p{N} _.-]{2,23}$/u.test(nick) || /0x[0-9a-f]{6,}/i.test(nick))) throw fail(400, 'invalid_nickname')
    const { rows: [user] } = await pool.query('SELECT id, wallet_address FROM openfund_users WHERE id=$1', [req.user.user_id])
    const ipPrefix = String(req.ip || '').includes(':') ? String(req.ip).split(':').slice(0, 3).join(':') + '::/48' : String(req.ip || '').split('.').slice(0, 3).join('.') + '.0/24'
    const client = await pool.connect()
    let reg, code
    try {
      await client.query('BEGIN')
      const { rows: [existing] } = await client.query(`SELECT * FROM tournament_registrations WHERE tournament_id=$1 AND user_id=$2 FOR UPDATE`, [t.id, user.id])
      if (existing && existing.status !== 'pending_email') throw fail(409, 'already_registered')
      const { rows: [taken] } = await client.query(`SELECT 1 FROM tournament_registrations WHERE tournament_id=$1 AND lower(email)=$2 AND user_id<>$3`, [t.id, mail, user.id])
      if (taken) throw fail(409, 'email_already_used')
      reg = existing
        ? (await client.query(`UPDATE tournament_registrations SET email=$2, nickname=$3, terms_version=$4, terms_accepted_at=now(), registration_ip_prefix=$5, updated_at=now() WHERE id=$1 RETURNING *`,
          [existing.id, mail, nick, termsVersion, ipPrefix])).rows[0]
        : (await client.query(`INSERT INTO tournament_registrations (tournament_id, user_id, wallet_address, email, nickname, terms_version, registration_ip_prefix)
            VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [t.id, user.id, user.wallet_address, mail, nick, termsVersion, ipPrefix])).rows[0]
      const recent = (await client.query(`SELECT count(*)::int n FROM tournament_email_codes WHERE registration_id=$1 AND created_at > now() - interval '1 hour'`, [reg.id])).rows[0].n
      if (recent >= 5) throw fail(429, 'too_many_codes')
      code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
      await client.query(`INSERT INTO tournament_email_codes (registration_id, code_hash, expires_at) VALUES ($1,$2, now() + interval '15 minutes')`, [reg.id, hashCode(reg.id, code)])
      await client.query('COMMIT')
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); if (e.code === '23505') throw fail(409, 'email_already_used'); throw e } finally { client.release() }
    await email.send({ to: mail, subject: `${t.name_en} — verification code`,
      text: `Your ${t.name_en} verification code is ${code}. It expires in 15 minutes.\nکد تأیید شما برای ${t.name_fa}: ${code} (۱۵ دقیقه اعتبار دارد).\n\nIf you did not request it, ignore this message.` })
    res.status(202).json({ ok: true, step: 'code' })
  }))

  /* step 3: the code */
  router.post('/tournaments/:slug/verify', requireAuth, limit(20), wrap(async (req, res) => {
    const t = await loadTournament(pool, req.params.slug)
    const code = String(req.body?.code ?? '')
    if (!/^\d{6}$/.test(code)) throw fail(400, 'invalid_code')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: [reg] } = await client.query(`SELECT * FROM tournament_registrations WHERE tournament_id=$1 AND user_id=$2 FOR UPDATE`, [t.id, req.user.user_id])
      if (!reg) throw fail(404, 'registration_not_found')
      if (reg.status !== 'pending_email') { await client.query('COMMIT'); return res.json({ ok: true, status: reg.status }) }
      const { rows: [row] } = await client.query(`SELECT * FROM tournament_email_codes WHERE registration_id=$1 AND consumed_at IS NULL ORDER BY id DESC LIMIT 1 FOR UPDATE`, [reg.id])
      if (!row || new Date(row.expires_at) <= new Date()) throw fail(410, 'code_expired')
      if (row.attempts >= 5) throw fail(429, 'too_many_attempts')
      const good = crypto.timingSafeEqual(Buffer.from(row.code_hash, 'hex'), Buffer.from(hashCode(reg.id, code), 'hex'))
      await client.query(`UPDATE tournament_email_codes SET attempts=attempts+1, consumed_at=CASE WHEN $2 THEN now() ELSE NULL END WHERE id=$1`, [row.id, good])
      if (!good) { await client.query('COMMIT'); throw fail(400, 'invalid_code') }
      await client.query(`UPDATE tournament_registrations SET status='registered', email_verified_at=now(), updated_at=now() WHERE id=$1`, [reg.id])
      await notify(client, { userId: reg.user_id, kind: 'tournament_registered', payload: { tournament: t.slug }, dedupeKey: `tournament_registered:${reg.id}` })
      await client.query('COMMIT')
      await audit?.('tournament_registered', reg.user_id, req, { tournament: t.slug })
      res.json({ ok: true, status: 'registered' })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))

  return router
}

/* ------------------------------------------------------------------ admin */

export function tournamentAdminRoutes({ pool, audit }) {
  const router = Router()
  router.use(adminAuth)
  const record = (action, req, details) => audit?.(action, null, req, details)
  const reasonOf = v => { if (typeof v !== 'string' || v.trim().length < 3 || v.length > 1000) throw fail(400, 'reason_required'); return v.trim() }

  router.get('/', wrap(async (_req, res) => {
    const { rows } = await pool.query(`SELECT t.*, (SELECT count(*)::int FROM tournament_registrations r WHERE r.tournament_id=t.id AND r.status<>'pending_email') AS registered FROM tournaments t ORDER BY starts_at DESC`)
    res.set('Cache-Control', 'no-store').json({ tournaments: rows })
  }))

  /* configure: rules and schedule only before the start; the end is computed */
  router.post('/:slug/configure', wrap(async (req, res) => {
    const actor = adminActor(req), reason = reasonOf(req.body?.reason)
    const b = req.body || {}
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const t = await loadTournament(client, req.params.slug, true)
      if (!['draft', 'registration'].includes(t.status) || Date.parse(t.starts_at) <= Date.now()) throw fail(409, 'tournament_already_started')
      const startsAt = b.startsAt ? new Date(b.startsAt) : new Date(t.starts_at)
      const days = b.tradingDays == null ? t.trading_days : Number(b.tradingDays)
      const num = (v, def, lo, hi) => { const n = v == null ? Number(def) : Number(v); if (!Number.isFinite(n) || n <= lo || n > hi) throw fail(400, 'invalid_rule'); return n }
      if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now() || !Number.isInteger(days) || days < 1 || days > 120) throw fail(400, 'invalid_schedule')
      const prizes = b.prizes == null ? t.prizes : b.prizes
      if (!prizes || typeof prizes !== 'object' || JSON.stringify(prizes).length > 8000) throw fail(400, 'invalid_prizes')
      const status = b.status == null ? t.status : b.status
      if (!['draft', 'registration', 'cancelled'].includes(status)) throw fail(400, 'invalid_status')
      const { rows: [updated] } = await client.query(`UPDATE tournaments SET starts_at=$2, trading_days=$3, ends_at=$4, account_size_usd=$5, daily_loss_pct=$6, max_loss_pct=$7, consistency_pct=$8, prizes=$9, status=$10, updated_at=now() WHERE id=$1 RETURNING *`,
        [t.id, startsAt.toISOString(), days, tradingEnd(startsAt.toISOString(), days).toISOString(), num(b.accountSizeUsd, t.account_size_usd, 0, 1e7),
          num(b.dailyLossPct, t.daily_loss_pct, 0, 50), num(b.maxLossPct, t.max_loss_pct, 0, 90), num(b.consistencyPct, t.consistency_pct, 0, 100), JSON.stringify(prizes), status])
      await client.query('COMMIT')
      await record('tournament_configured', req, { actor, reason, slug: t.slug, before: { startsAt: t.starts_at, tradingDays: t.trading_days, status: t.status }, after: { startsAt: updated.starts_at, endsAt: updated.ends_at, status: updated.status } })
      res.json({ ok: true, tournament: updated })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))

  router.get('/:slug/registrations', wrap(async (req, res) => {
    const t = await loadTournament(pool, req.params.slug)
    const { rows } = await pool.query(`SELECT r.id, r.status, r.nickname, r.wallet_address, r.email, r.email_verified_at, r.registration_ip_prefix, r.challenge_id,
        r.out_of_ranking_rule, r.disqualified_reason, r.created_at FROM tournament_registrations r WHERE r.tournament_id=$1 ORDER BY r.created_at`, [t.id])
    if (req.query.format === 'csv') {
      const esc = v => `"${String(v ?? '').replaceAll('"', '""')}"`
      const head = ['id', 'status', 'nickname', 'wallet_address', 'email', 'email_verified_at', 'registration_ip_prefix', 'challenge_id', 'out_of_ranking_rule', 'disqualified_reason', 'created_at']
      res.set('Content-Type', 'text/csv; charset=utf-8').set('Cache-Control', 'no-store')
      return res.send([head.join(','), ...rows.map(r => head.map(h => esc(r[h] instanceof Date ? r[h].toISOString() : r[h])).join(','))].join('\n') + '\n')
    }
    res.set('Cache-Control', 'no-store').json({ registrations: rows })
  }))

  router.post('/:slug/registrations/:id/disqualify', wrap(async (req, res) => {
    const actor = adminActor(req), reason = reasonOf(req.body?.reason)
    if (!uuid.test(req.params.id)) throw fail(404, 'registration_not_found')
    const t = await loadTournament(pool, req.params.slug)
    if (t.status === 'finalized') throw fail(409, 'tournament_finalized')
    const { rows: [reg] } = await pool.query(`UPDATE tournament_registrations SET status='disqualified', disqualified_reason=$3, disqualified_by=$4, updated_at=now()
      WHERE id=$1 AND tournament_id=$2 AND status <> 'disqualified' RETURNING id, user_id`, [req.params.id, t.id, reason, actor])
    if (!reg) throw fail(409, 'already_disqualified')
    await audit?.('tournament_disqualified', reg.user_id, req, { actor, reason, registrationId: reg.id, slug: t.slug })
    res.json({ ok: true })
  }))

  /* reviewer signals only: shared network prefixes, mirrored trades, timing */
  router.get('/:slug/correlation', wrap(async (req, res) => {
    const t = await loadTournament(pool, req.params.slug)
    const sharedNetworks = (await pool.query(`SELECT registration_ip_prefix AS prefix, count(*)::int AS entries, array_agg(id) AS registrations
        FROM tournament_registrations WHERE tournament_id=$1 AND registration_ip_prefix IS NOT NULL GROUP BY registration_ip_prefix HAVING count(*) > 1 ORDER BY count(*) DESC`, [t.id])).rows
    const mirrored = (await pool.query(`
      SELECT ra.id AS a, rb.id AS b, pa.market, pa.side AS side_a, pb.side AS side_b, count(*)::int AS pairs
        FROM tournament_registrations ra JOIN openfund_challenges ca ON ca.id=ra.challenge_id JOIN trading_positions pa ON pa.account_id=ca.demo_account_id
        JOIN tournament_registrations rb ON rb.tournament_id=ra.tournament_id AND rb.id > ra.id
        JOIN openfund_challenges cb ON cb.id=rb.challenge_id JOIN trading_positions pb ON pb.account_id=cb.demo_account_id
       WHERE ra.tournament_id=$1 AND pa.market=pb.market AND abs(extract(epoch FROM pa.opened_at - pb.opened_at)) <= 60
       GROUP BY ra.id, rb.id, pa.market, pa.side, pb.side HAVING count(*) >= 3 ORDER BY count(*) DESC LIMIT 200`, [t.id])).rows
      .map(r => ({ ...r, opposite: r.side_a !== r.side_b }))
    const burst = (await pool.query(`SELECT date_trunc('minute', created_at) AS minute, count(*)::int AS registrations FROM tournament_registrations
        WHERE tournament_id=$1 GROUP BY 1 HAVING count(*) >= 5 ORDER BY 1`, [t.id])).rows
    res.set('Cache-Control', 'no-store').json({ note: 'Signals for human review only; nothing is decided automatically.', sharedNetworks, mirroredTrades: mirrored, registrationBursts: burst })
  }))

  /* owner-gated: freeze the final standings once every account is settled */
  router.post('/:slug/finalize', wrap(async (req, res) => {
    const actor = adminActor(req), reason = reasonOf(req.body?.reason)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const t = await loadTournament(client, req.params.slug, true)
      if (t.status !== 'finished') throw fail(409, t.status === 'finalized' ? 'tournament_finalized' : 'tournament_not_finished')
      const regs = (await client.query(`SELECT * FROM tournament_registrations WHERE tournament_id=$1 AND challenge_id IS NOT NULL`, [t.id])).rows
      const rows = []
      for (const reg of regs) {
        const r = await accountReport(client, t, reg)
        if (!r || r.openPositions || !r.accountClosed) throw fail(409, 'settlement_pending')
        const reasonNot = reg.status === 'disqualified' ? 'disqualified' : reg.status === 'out_of_ranking' ? `out_of_ranking:${reg.out_of_ranking_rule}`
          : r.closedTrades === 0 ? 'no_closed_trades' : !r.consistencyOk ? 'consistency' : null
        rows.push({ registrationId: reg.id, ranked: reasonNot === null, notRankedReason: reasonNot, finalEquity: r.balance, maxDrawdown: r.maxDrawdown, reachedAt: r.reachedAt, bestDayShare: r.bestDayShare, closedTrades: r.closedTrades })
      }
      for (const r of rankRows(rows)) await client.query(`INSERT INTO tournament_standings (tournament_id, registration_id, rank, ranked, not_ranked_reason, final_equity, max_drawdown_usd, reached_at, best_day_share, closed_trades)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [t.id, r.registrationId, r.rank, r.ranked, r.notRankedReason, r.finalEquity, r.maxDrawdown, r.reachedAt, r.bestDayShare, r.closedTrades])
      await client.query(`UPDATE tournaments SET status='finalized', updated_at=now() WHERE id=$1`, [t.id])
      await client.query('COMMIT')
      await record('tournament_finalized', req, { actor, reason, slug: t.slug, ranked: rows.filter(r => r.ranked).length, entries: rows.length })
      res.json({ ok: true, ranked: rows.filter(r => r.ranked).length, entries: rows.length })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))

  router.get('/:slug/standings', wrap(async (req, res) => {
    const t = await loadTournament(pool, req.params.slug)
    const { rows } = await pool.query(`SELECT s.*, r.nickname, r.wallet_address, r.email FROM tournament_standings s JOIN tournament_registrations r ON r.id=s.registration_id
      WHERE s.tournament_id=$1 ORDER BY s.ranked DESC, s.rank NULLS LAST`, [t.id])
    res.set('Cache-Control', 'no-store').json({ standings: rows })
  }))

  /* owner-gated: issue awards from the frozen standings (idempotent per award) */
  router.post('/:slug/awards/issue', wrap(async (req, res) => {
    const actor = adminActor(req), reason = reasonOf(req.body?.reason)
    const client = await pool.connect()
    let issued = 0
    try {
      await client.query('BEGIN')
      const t = await loadTournament(client, req.params.slug, true)
      if (t.status !== 'finalized') throw fail(409, 'tournament_not_finalized')
      const p = t.prizes || {}
      const standings = (await client.query(`SELECT s.*, r.user_id, r.wallet_address, r.status AS reg_status FROM tournament_standings s
        JOIN tournament_registrations r ON r.id=s.registration_id WHERE s.tournament_id=$1`, [t.id])).rows
      const add = async (s, kind, item, extra = {}) => {
        const { rowCount } = await client.query(`INSERT INTO tournament_awards (tournament_id, registration_id, rank, kind, item, amount_usd, entitlement_id, coupon_id, status, updated_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (tournament_id, registration_id, kind, item) DO NOTHING`,
          [t.id, s.registration_id, s.rank, kind, item, extra.amount ?? null, extra.entitlementId ?? null, extra.couponId ?? null, extra.status ?? 'pending', actor])
        issued += rowCount
        return rowCount
      }
      const exists = async (s, kind, item) => (await client.query(`SELECT 1 FROM tournament_awards WHERE tournament_id=$1 AND registration_id=$2 AND kind=$3 AND item=$4`, [t.id, s.registration_id, kind, item])).rowCount > 0
      for (const s of standings) {
        if (s.ranked && p.cash?.[s.rank]) await add(s, 'cash', `Cash prize (rank ${s.rank})`, { amount: p.cash[s.rank] })
        const [a1, a2] = p.accountRanks || [4, 10]
        if (s.ranked && s.rank >= a1 && s.rank <= a2) {
          const item = `${p.account.planSlug} ${p.account.sizeUsd} account`
          if (!(await exists(s, 'account', item))) {
            const e = await issueEntitlementTx(client, { userId: s.user_id, planSlug: p.account.planSlug, accountSizeUsd: p.account.sizeUsd, startStage: p.account.funded ? 0 : 1,
              source: 'tournament', reference: `${t.slug}#${s.rank}`, reason, actor, expiresDays: p.account.expiresDays ?? 90 })
            await add(s, 'account', item, { entitlementId: e.id, status: 'issued' })
          }
          for (const hw of p.hardware || []) await add(s, 'hardware', hw)
        }
        const [c1, c2] = p.couponRanks || [11, 100]
        if (s.ranked && s.rank >= c1 && s.rank <= c2) {
          const item = `${p.coupon.percent}% purchase discount`
          if (!(await exists(s, 'coupon', item))) {
            const code = 'OFL' + crypto.randomBytes(8).toString('hex').toUpperCase()
            await client.query("SELECT set_config('openfund.actor',$1,true)", [actor])
            const { rows: [coupon] } = await client.query(`INSERT INTO coupons (code, name, kind, value, status, max_redemptions, per_user_limit, internal, created_by, expires_at)
              VALUES ($1,$2,'percent',$3,'active',1,1,false,$4, now() + ($5::int * interval '1 day')) RETURNING id`,
              [code, `${t.name_en} rank ${s.rank}`, p.coupon.percent, actor, p.coupon.expiresDays ?? 90])
            await client.query('INSERT INTO coupon_allowed_users (coupon_id, user_id) VALUES ($1,$2)', [coupon.id, s.user_id])
            await add(s, 'coupon', item, { couponId: coupon.id, status: 'issued' })
          }
        }
        if (s.ranked && s.rank <= 10) await add(s, 'badge', `rank-${s.rank}`, { status: 'issued' })
        if (s.reg_status === 'active') await add(s, 'badge', 'finisher', { status: 'issued' })
      }
      await client.query('COMMIT')
      await record('tournament_awards_issued', req, { actor, reason, slug: t.slug, issued })
      res.json({ ok: true, issued })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))

  router.get('/:slug/awards', wrap(async (req, res) => {
    const t = await loadTournament(pool, req.params.slug)
    const { rows } = await pool.query(`SELECT a.*, r.nickname, r.wallet_address FROM tournament_awards a JOIN tournament_registrations r ON r.id=a.registration_id
      WHERE a.tournament_id=$1 ORDER BY a.rank NULLS LAST, a.kind, a.item`, [t.id])
    res.set('Cache-Control', 'no-store').json({ awards: rows })
  }))

  /* fulfilment tracking for cash and hardware (and notes on any award) */
  router.post('/:slug/awards/:id', wrap(async (req, res) => {
    const actor = adminActor(req), reason = reasonOf(req.body?.reason)
    if (!uuid.test(req.params.id)) throw fail(404, 'award_not_found')
    const status = req.body?.status
    if (!['pending', 'in_progress', 'fulfilled', 'cancelled'].includes(status)) throw fail(400, 'invalid_status')
    const note = req.body?.note == null ? null : String(req.body.note).slice(0, 1000)
    const { rows: [a] } = await pool.query(`UPDATE tournament_awards SET status=$2, fulfilment_note=coalesce($3, fulfilment_note), updated_by=$4, updated_at=now()
      WHERE id=$1 AND kind IN ('cash','hardware') RETURNING id, kind, status`, [req.params.id, status, note, actor])
    if (!a) throw fail(409, 'award_not_trackable')
    await record('tournament_award_updated', req, { actor, reason, awardId: a.id, status })
    res.json({ ok: true, award: a })
  }))
  return router
}
