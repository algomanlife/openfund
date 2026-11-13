/**
 * Engine-level conduct enforcement (rules snapshot v3, owner decisions
 * D1–D8) on real PostgreSQL: sales gate, verified calendar import, Instant
 * weekend / news / open-risk / trade-idea / profitable-day breaches,
 * inactivity on idle evaluation accounts, strikes, pre-trade refusals, the
 * funded daily auto-close, D6 leverage and immutability of older snapshots.
 * The engine runs with a stubbed market (fixed marks) and a fixed clock for
 * the conduct rules.
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import pg from 'pg'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Engine } from '../engine.js'
import { ChallengeService, normalizeRules } from '../evaluation.js'
import { ConductService, validateCalendarImport, calendarAdminRoutes } from '../conduct.js'
import { propMaxLeverage } from '../prop-leverage.js'
import { PLAN_SEEDS } from '../plan-catalog.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const TOKEN = 'conduct-test-token-0123456789'
const T = s => Date.parse(s)
const DAY = 86_400_000
const plans = {}
const SOURCE = `test-calendar-${Date.now()}`

class FakeMarket {
  constructor() { this.prices = new Map([['EUR/USD', '1.1'], ['BTC/USD', '60000'], ['GBP/JPY', '190']]) }
  marketMeta(symbol) { return { symbol, group: symbol === 'BTC/USD' ? 'crypto' : 'forex', base: symbol.split('/')[0], quote: symbol.split('/')[1], maxLeverage: 100, isOpen: true } }
  mark(symbol) { const p = this.prices.get(symbol); return p == null ? null : { mark: p, at: Date.now(), injected: true } }
  tradeable(symbol) { const m = this.mark(symbol); return m ? { ok: true, meta: this.marketMeta(symbol), mark: m.mark } : { ok: false, reason: 'stale_price' } }
}
const clock = { now: Date.now() }
const conduct = new ConductService(pool, { now: () => clock.now })
const md = new FakeMarket()
const engine = new Engine(pool, md, { conduct })

const newUser = async () => (await pool.query('INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id', [privateKeyToAccount(generatePrivateKey()).address.toLowerCase()])).rows[0].id

/** A started challenge with its account (v3 snapshot from the catalog unless `snapshot` given). */
async function challenge(slug, { size = 100000, snapshot = null, funded = false, cycle = null, startedAt = null } = {}) {
  const user = await newUser()
  const plan = plans[slug]
  const order = (await pool.query(`INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, status, paid_at) VALUES ($1,$2,$3,100,'paid',now()) RETURNING id`, [user, plan.id, size])).rows[0]
  const rules = snapshot ?? { ...normalizeRules(plan.configuration), ...(funded ? { funded: true } : {}) }
  const stage = Number(rules.phases) === 0 || funded ? 0 : 1
  const c = (await pool.query(`INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, purchase_order_id, rules_snapshot, stage, reward_cycle, funded_from_challenge_id)
    VALUES ($1,$2,'created',$3,$4,$5,$6,$7,NULL) RETURNING *`, [user, plan.id, size, funded ? null : order.id, JSON.stringify(rules), stage, cycle])).rows[0]
  if (funded) await pool.query('UPDATE openfund_challenges SET funded_from_challenge_id=$1 WHERE id=$1', [c.id]).catch(() => {})
  const started = await new ChallengeService(pool).start(user, c.id)
  if (startedAt) await pool.query('UPDATE openfund_challenges SET started_at=$2 WHERE id=$1', [c.id, startedAt])
  return { user, id: c.id, accountId: started.demo_account_id, size }
}
/** Insert a root position; `net` sets realized PnL (closed) — open positions are valued from the fake mark. */
async function position(ch, { market = 'EUR/USD', side = 'long', openedAt, closedAt = null, net = '0', entry = null, qty = '10000', leverage = 10 }) {
  const o = (await pool.query(`INSERT INTO trading_orders (account_id, user_id, market, side, order_type, margin, leverage, status) VALUES ($1,$2,$3,$4,'market',1000,$5,'filled') RETURNING id`, [ch.accountId, ch.user, market, side, leverage])).rows[0]
  const p = (await pool.query(`INSERT INTO trading_positions (order_id, account_id, user_id, market, side, quantity, entry_price, margin, leverage, status, opened_at, closed_at, realized_pnl, open_fee)
    VALUES ($1,$2,$3,$4,$5,$6,$7,1000,$8,$9,$10,$11,$12,0) RETURNING *`,
    [o.id, ch.accountId, ch.user, market, side, qty, entry ?? md.prices.get(market), leverage, closedAt ? 'closed' : 'open', openedAt, closedAt, closedAt ? net : '0'])).rows[0]
  if (closedAt) {
    const bal = (await pool.query('UPDATE demo_accounts SET balance = balance + $2 WHERE id=$1 RETURNING balance', [ch.accountId, net])).rows[0].balance
    await pool.query(`INSERT INTO trading_ledger (account_id, user_id, event, position_id, amount, balance_after, ts) VALUES ($1,$2,'close',$3,$4,$5,$6)`, [ch.accountId, ch.user, p.id, net, bal, closedAt])
  } else {
    await pool.query('UPDATE demo_accounts SET used_margin = used_margin + 1000 WHERE id=$1', [ch.accountId])
  }
  return p
}
const status = async ch => (await pool.query('SELECT status FROM openfund_challenges WHERE id=$1', [ch.id])).rows[0].status
const violation = async ch => (await pool.query(`SELECT detail FROM challenge_events WHERE challenge_id=$1 AND kind='violation' ORDER BY id DESC LIMIT 1`, [ch.id])).rows[0]?.detail?.violations?.map(v => v.rule) ?? []
async function coverage(from, to, events = []) {
  await pool.query(`INSERT INTO economic_calendar_coverage (source, covers_from, covers_to, event_count, actor) VALUES ($1,$2,$3,$4,'test')`, [SOURCE, new Date(from).toISOString(), new Date(to).toISOString(), events.length])
  for (const e of events) await pool.query(`INSERT INTO economic_events (source, external_id, title, currency, kind, impact, restricted, starts_at, ends_at) VALUES ($1,$2,$3,$4,$5,'high',true,$6,$7)`,
    [SOURCE, `${e.id}-${Math.random()}`, e.title || 'test event', e.currency, e.kind || 'release', e.startsAt, e.endsAt ?? null])
}

before(async () => {
  for (const seed of PLAN_SEEDS) {
    plans[seed.slug] = (await pool.query(`INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3) RETURNING *`, [`${seed.slug}-ct-${Date.now()}`, seed.name, JSON.stringify(seed.configuration)])).rows[0]
  }
})
after(async () => { await pool.query(`DELETE FROM economic_calendar_coverage WHERE source=$1`, [SOURCE]); await pool.query(`DELETE FROM economic_events WHERE source=$1`, [SOURCE]); await pool.end() })

test('C1 plans whose rules need news data are not sold without verified calendar coverage', async () => {
  clock.now = T('2031-03-03T12:00:00Z') /* a period no import covers */
  for (const slug of ['standard', 'one-phase', 'instant']) assert.deepEqual(await conduct.salesBlockers(plans[slug].configuration), ['news_calendar_unavailable'], slug)
  assert.deepEqual(await conduct.salesBlockers(plans['free-trial'].configuration), [])
  await coverage(clock.now - 2 * 3_600_000, clock.now + 6 * DAY)
  assert.deepEqual(await conduct.salesBlockers(plans.standard.configuration), ['news_calendar_unavailable'], 'coverage must reach 7 days ahead')
  await coverage(clock.now - 2 * 3_600_000, clock.now + 8 * DAY)
  for (const slug of ['standard', 'one-phase', 'instant']) assert.deepEqual(await conduct.salesBlockers(plans[slug].configuration), [], slug)
})

test('C2 calendar import: coverage bounds, event validation, only high-impact can be restricted', async () => {
  const base = { source: 'licensed-feed', coversFrom: '2026-07-06T00:00:00Z', coversTo: '2026-07-13T00:00:00Z' }
  const ok = validateCalendarImport({ ...base, events: [
    { externalId: 'a', title: 'CPI', currency: 'USD', kind: 'release', impact: 'high', restricted: true, startsAt: '2026-07-08T12:30:00Z' },
    { externalId: 'b', title: 'Retail sales', currency: 'EUR', kind: 'release', impact: 'medium', restricted: true, startsAt: '2026-07-08T09:00:00Z' },
    { externalId: 'c', title: 'Chair speech', currency: 'USD', kind: 'speech', impact: 'high', restricted: true, startsAt: '2026-07-09T14:00:00Z', endsAt: '2026-07-09T15:00:00Z' },
  ] })
  assert.deepEqual(ok.events.map(e => e.restricted), [true, false, true])
  for (const [bad, err] of [
    [{ ...base, coversTo: base.coversFrom, events: [] }, 'invalid_coverage'],
    [{ ...base, coversTo: '2026-10-01T00:00:00Z', events: [] }, 'invalid_coverage'],
    [{ ...base, events: [{ externalId: 'x', title: 'CPI', currency: 'USD', kind: 'release', impact: 'high', startsAt: '2026-07-20T12:00:00Z' }] }, 'invalid_event'],
    [{ ...base, events: [{ externalId: 'x', title: 'CPI', currency: 'usd', kind: 'release', impact: 'high', startsAt: '2026-07-08T12:00:00Z' }] }, 'invalid_event'],
    [{ ...base, events: [{ externalId: 'x', title: 'CPI', currency: 'USD', kind: 'release', impact: 'high', startsAt: '2026-07-08T12:00:00Z' }, { externalId: 'x', title: 'CPI', currency: 'USD', kind: 'release', impact: 'high', startsAt: '2026-07-08T12:00:00Z' }] }, 'duplicate_event'],
  ]) assert.throws(() => validateCalendarImport(bad), new RegExp(err))
  process.env.ADMIN_API_TOKEN = TOKEN
  const app = express(); app.use(express.json({ limit: '2mb' })); app.use('/admin/calendar', calendarAdminRoutes({ pool, conduct }))
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }))
  const server = app.listen(0); const url = `http://127.0.0.1:${server.address().port}/admin/calendar`
  try {
    const anon = await fetch(url + '/status'); assert.equal(anon.status, 403)
    const imp = await fetch(url + '/import', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, 'x-admin-actor': 'qa ops' }, body: JSON.stringify({ ...base, source: SOURCE, events: [] }) })
    assert.equal(imp.status, 200)
    const noActor = await fetch(url + '/import', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ ...base, events: [] }) })
    assert.equal(noActor.status, 400)
  } finally { server.close() }
})

test('C3 Instant: holding a position into the weekend is a hard breach', async () => {
  clock.now = T('2026-07-11T10:00:00Z') /* Saturday */
  const ch = await challenge('instant', { startedAt: '2026-07-06T09:00:00Z' })
  await position(ch, { openedAt: '2026-07-10T15:00:00Z' })
  assert.equal(await engine.enforceChallengeRisk(ch.accountId), 'failed')
  assert.ok((await violation(ch)).includes('weekend_holding_breach'))
})

test('C4 Instant: combined floating loss of 1% of the size is a hard breach (winners do not offset)', async () => {
  clock.now = T('2026-07-08T10:00:00Z')
  await coverage(clock.now - 10 * DAY, clock.now + DAY)
  const ch = await challenge('instant', { startedAt: '2026-07-06T09:00:00Z' })
  /* qty 10,000 EUR/USD long from 1.15 at mark 1.1 → −500; BTC short winner +1,000 */
  await position(ch, { openedAt: '2026-07-08T08:00:00Z', entry: '1.15' })
  await position(ch, { market: 'GBP/JPY', openedAt: '2026-07-08T08:05:00Z', entry: '190.05', qty: '10000', side: 'long' })
  await position(ch, { market: 'BTC/USD', side: 'short', openedAt: '2026-07-08T08:06:00Z', entry: '60100', qty: '10' })
  const r = await engine.enforceChallengeRisk(ch.accountId)
  assert.equal(r, 'failed'); assert.ok((await violation(ch)).includes('open_risk_breach'))
})

test('C5 Instant: a trade idea losing 2% of a $100K account (re-entry within 10 minutes) is a hard breach', async () => {
  clock.now = T('2026-07-08T12:00:00Z')
  const ch = await challenge('instant', { startedAt: '2026-07-06T09:00:00Z' })
  await position(ch, { openedAt: '2026-07-08T09:00:00Z', closedAt: '2026-07-08T09:30:00Z', net: '-1200' })
  await position(ch, { openedAt: '2026-07-08T09:35:00Z', closedAt: '2026-07-08T09:50:00Z', net: '-800' })
  assert.equal(await engine.enforceChallengeRisk(ch.accountId), 'failed')
  assert.ok((await violation(ch)).includes('trade_idea_breach'))
  const ok = await challenge('instant', { startedAt: '2026-07-06T09:00:00Z' })
  await position(ok, { openedAt: '2026-07-08T09:00:00Z', closedAt: '2026-07-08T09:30:00Z', net: '-1200' })
  await position(ok, { openedAt: '2026-07-08T09:45:00Z', closedAt: '2026-07-08T09:50:00Z', net: '-800' }) /* 15 min later: new idea */
  assert.equal(await engine.enforceChallengeRisk(ok.accountId), null)
})

test('C6 Instant: fewer than 7 profitable days (≥ 0.25%) in a completed 30-day period is a hard breach', async () => {
  clock.now = T('2026-08-08T12:00:00Z')
  const ch = await challenge('instant', { size: 10000, startedAt: '2026-07-01T09:00:00Z' })
  for (let d = 2; d <= 7; d++) await position(ch, { openedAt: `2026-07-0${d}T09:00:00Z`, closedAt: `2026-07-0${d}T10:00:00Z`, net: '30', qty: '1' })
  await position(ch, { openedAt: '2026-07-20T09:00:00Z', closedAt: '2026-07-20T10:00:00Z', net: '20', qty: '1' }) /* below $25 */
  await position(ch, { openedAt: '2026-08-07T09:00:00Z', closedAt: '2026-08-07T10:00:00Z', net: '1', qty: '1' })   /* keeps it active */
  assert.equal(await engine.enforceChallengeRisk(ch.accountId), 'failed')
  assert.ok((await violation(ch)).includes('profitable_days_breach'))
})

test('C7 inactivity: an idle evaluation account breaches after 30 days without a completed trade', async () => {
  const ch = await challenge('standard', { startedAt: '2026-06-01T09:00:00Z' })
  clock.now = T('2026-07-01T08:59:00Z')
  assert.equal(await engine.enforceChallengeRisk(ch.accountId), null)
  clock.now = T('2026-07-01T09:00:00Z')
  assert.equal(await engine.enforceChallengeRisk(ch.accountId), 'failed')
  assert.ok((await violation(ch)).includes('inactivity_breach'))
  const open = await challenge('standard', { startedAt: '2026-06-01T09:00:00Z' })
  await position(open, { openedAt: '2026-06-02T09:00:00Z' }) /* an open position does not reset the clock */
  assert.equal(await engine.enforceChallengeRisk(open.accountId), 'failed')
})

test('C8 Instant news: holding through a restricted window on the affected currency is a hard breach', async () => {
  clock.now = T('2026-07-08T12:35:00Z')
  await coverage(T('2026-07-01T00:00:00Z'), T('2026-07-15T00:00:00Z'), [{ id: 'cpi', currency: 'USD', startsAt: '2026-07-08T12:30:00Z' }])
  const ch = await challenge('instant', { startedAt: '2026-07-06T09:00:00Z' })
  await position(ch, { openedAt: '2026-07-08T11:00:00Z' })
  assert.equal(await engine.enforceChallengeRisk(ch.accountId), 'failed')
  assert.ok((await violation(ch)).includes('news_breach'))
  const jpy = await challenge('instant', { startedAt: '2026-07-06T09:00:00Z' })
  await position(jpy, { market: 'GBP/JPY', openedAt: '2026-07-08T11:00:00Z' })
  assert.equal(await engine.enforceChallengeRisk(jpy.accountId), null, 'unaffected currencies are not restricted')
})

test('C9 pre-trade refusals protect the trader from an immediate breach', async () => {
  const inst = normalizeRules(plans.instant.configuration)
  assert.equal(await conduct.preTradeBlock(pool, { rules: inst, market: 'EUR/USD', now: T('2026-07-11T10:00:00Z') }), 'weekend_trading_prohibited')
  assert.equal(await conduct.preTradeBlock(pool, { rules: inst, market: 'EUR/USD', now: T('2026-07-08T12:25:00Z') }), 'news_window_prohibited')
  assert.equal(await conduct.preTradeBlock(pool, { rules: inst, market: 'EUR/USD', now: T('2026-07-08T12:45:00Z') }), null)
  assert.equal(await conduct.preTradeBlock(pool, { rules: inst, market: 'EUR/USD', now: T('2033-03-03T12:00:00Z') }), 'news_calendar_unavailable')
  const fundedStd = { ...normalizeRules(plans.standard.configuration), funded: true }
  assert.equal(await conduct.preTradeBlock(pool, { rules: fundedStd, market: 'EUR/USD', now: T('2026-07-08T20:50:00Z') }), 'holding_window_closing')
  const evalStd = normalizeRules(plans.standard.configuration)
  assert.equal(await conduct.preTradeBlock(pool, { rules: evalStd, market: 'EUR/USD', now: T('2026-07-08T20:50:00Z') }), null, 'evaluations may hold overnight')
  assert.equal(await conduct.preTradeBlock(pool, { rules: { ...evalStd, rulesVersion: 2 }, market: 'EUR/USD', now: T('2026-07-11T10:00:00Z') }), null)
})

test('C10 on-demand strike system: one strike per 1% trade idea; the fourth is a breach', async () => {
  clock.now = T('2026-07-08T18:00:00Z')
  const ch = await challenge('standard', { funded: true, cycle: 'on_demand', startedAt: '2026-07-06T09:00:00Z' })
  const ideas = ['09', '11', '13']
  for (const h of ideas) await position(ch, { openedAt: `2026-07-08T${h}:00:00Z`, closedAt: `2026-07-08T${h}:30:00Z`, net: '-1000' })
  assert.equal(await engine.enforceChallengeRisk(ch.accountId), null)
  assert.equal((await pool.query('SELECT count(*)::int n FROM challenge_strikes WHERE challenge_id=$1', [ch.id])).rows[0].n, 3)
  assert.equal(await engine.enforceChallengeRisk(ch.accountId), null, 'strikes are recorded once per idea')
  await position(ch, { openedAt: '2026-07-08T15:00:00Z', closedAt: '2026-07-08T15:30:00Z', net: '-1000' })
  assert.equal(await engine.enforceChallengeRisk(ch.accountId), 'failed')
  assert.ok((await violation(ch)).includes('strike_breach'))
  const biweekly = await challenge('standard', { funded: true, cycle: 'biweekly', startedAt: '2026-07-06T09:00:00Z' })
  await position(biweekly, { openedAt: '2026-07-08T09:00:00Z', closedAt: '2026-07-08T09:30:00Z', net: '-1500' })
  await engine.enforceChallengeRisk(biweekly.accountId)
  assert.equal((await pool.query('SELECT count(*)::int n FROM challenge_strikes WHERE challenge_id=$1', [biweekly.id])).rows[0].n, 0, 'no strikes outside the on-demand cycle')
})

test('C11 funded Standard: open positions are closed in the daily holding window (not a breach)', async () => {
  const ch = await challenge('standard', { funded: true, cycle: 'biweekly', startedAt: '2026-07-06T09:00:00Z' })
  await position(ch, { openedAt: new Date(Date.now() - 3_600_000).toISOString() })
  clock.now = T('2026-07-08T20:50:00Z')
  engine.running = true
  try { await engine.loop() } finally { engine.running = false }
  const open = (await pool.query(`SELECT count(*)::int n FROM trading_positions WHERE account_id=$1 AND status='open'`, [ch.accountId])).rows[0].n
  assert.equal(open, 0)
  assert.equal((await pool.query(`SELECT exit_reason FROM trading_positions WHERE account_id=$1`, [ch.accountId])).rows[0].exit_reason, 'holding_auto_close')
  assert.equal(await status(ch), 'started')
})

test('C12 D6 leverage: v3 challenges use the Openfund ceilings; older 5× snapshots keep their cap', () => {
  const meta = s => md.marketMeta(s)
  const v3 = normalizeRules(plans.standard.configuration)
  assert.equal(v3.referenceLeverageX, null)
  assert.equal(propMaxLeverage(meta('BTC/USD'), 'BTC/USD', v3.referenceLeverageX ?? 100), 20)
  assert.equal(propMaxLeverage(meta('EUR/USD'), 'EUR/USD', v3.referenceLeverageX ?? 100), 50)
  assert.equal(propMaxLeverage({ ...meta('BTC/USD'), symbol: 'SOL/USD', base: 'SOL' }, 'SOL/USD', 100), 15)
  assert.equal(propMaxLeverage(meta('EUR/USD'), 'EUR/USD', 5), 5, 'a sold v1/v2 snapshot keeps its 5× plan cap')
})

test('C13 snapshots before v3 are never given new conduct obligations', async () => {
  clock.now = T('2026-07-11T10:00:00Z')
  const v2 = { ...normalizeRules(plans.instant.configuration), rulesVersion: 2, conduct: undefined, inactivityDays: undefined }
  const ch = await challenge('instant', { snapshot: v2, startedAt: '2026-05-01T09:00:00Z' })
  await position(ch, { openedAt: '2026-07-10T15:00:00Z' })
  assert.equal(await engine.enforceChallengeRisk(ch.accountId), null)
})

test('C14 regression: a challenge created without a snapshot is provisioned from its own plan, not defaults', async () => {
  const user = await newUser()
  const cfg = { accountSizesUsd: [5000], priceUsd: { 5000: 44 }, phases: 1, phase1TargetPct: 12, dailyLossPct: 4, maxTotalLossPct: 9, drawdownMode: 'static', minTradingDays: 0, referenceLeverageX: 5 }
  const plan = (await pool.query(`INSERT INTO challenge_plans (slug, name, status, configuration) VALUES ($1,'regression','inactive',$2) RETURNING id`, [`snap-reg-${Date.now()}`, JSON.stringify(cfg)])).rows[0]
  const c = (await pool.query(`INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd) VALUES ($1,$2,'created',5000) RETURNING id`, [user, plan.id])).rows[0]
  await new ChallengeService(pool).start(user, c.id)
  const snap = (await pool.query('SELECT rules_snapshot FROM openfund_challenges WHERE id=$1', [c.id])).rows[0].rules_snapshot
  assert.deepEqual([snap.referenceLeverageX, snap.dailyLossPct, snap.maxTotalLossPct, snap.evaluationCapable], [5, 4, 9, true])
})
