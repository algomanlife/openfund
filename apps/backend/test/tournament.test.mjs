/**
 * Openfund Premium League (tournament.js) on real PostgreSQL with the real
 * engine and a fixed market: schedule from the session calendar, registration
 * gates (terms, e-mail adapter), one entry per wallet and per e-mail, the
 * hashed one-time code, provisioning at the start, a rule breach that removes
 * an account from the ranking but keeps it tradable, settlement and freeze at
 * the end, frozen standings with the tie-breakers and the consistency rule,
 * awards (entitlement, coupon, badges) and tournament certificates.
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import pg from 'pg'
import { Engine } from '../engine.js'
import { createEmailSender } from '../email.js'
import { tournamentRoutes, tournamentAdminRoutes, ensureTournamentSeed, provisionAtStart, sampleEquity, tradingEnd, rankRows, DEFAULT_TOURNAMENT, TOURNAMENT_PLAN_SLUG } from '../tournament.js'
import { syncCertificates } from '../certificates.js'
import { PLAN_SEEDS } from '../plan-catalog.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const TOKEN = 'tournament-test-token-0123456789abcdef'
const market = { price: '50000', fresh: true, markets: new Map([['BTC/USD', { base: 'BTC', group: 'crypto', maxLeverage: 100 }]]),
  marketMeta(m) { return this.markets.get(m) }, mark(m) { return this.marketMeta(m) && this.fresh ? { mark: this.price, at: Date.now() } : null },
  tradeable(m) { return this.fresh && this.marketMeta(m) ? { ok: true, mark: this.price, meta: this.marketMeta(m) } : { ok: false, reason: 'stale_price' } } }
const engine = new Engine(pool, market)
const slug = 'league-test-' + crypto.randomBytes(3).toString('hex')
let server, base, email, tournament
const users = []

const call = async (method, path, { body, user, admin } = {}) => {
  const headers = { 'content-type': 'application/json' }
  if (user) headers['x-test-user'] = user
  if (admin) { headers.authorization = `Bearer ${TOKEN}`; headers['x-admin-actor'] = 'league owner' }
  const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await r.text()
  let data = text; try { data = JSON.parse(text) } catch {}
  return { status: r.status, data }
}
const lastCode = () => /code is (\d{6})/.exec(email.outbox.at(-1).text)[1]

before(async () => {
  process.env.ADMIN_API_TOKEN = TOKEN
  for (const p of PLAN_SEEDS) await pool.query(`INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3) ON CONFLICT (slug) DO NOTHING`, [p.slug, p.name, JSON.stringify(p.configuration)])
  await ensureTournamentSeed(pool)
  /* a stand-in for the Directus legal_documents collection (same shared database) */
  await pool.query(`CREATE TABLE IF NOT EXISTS legal_documents (id serial PRIMARY KEY, doc_type text, status text, version text)`)
  const start = new Date(Date.now() + 3 * 86_400_000).toISOString()
  tournament = (await pool.query(`INSERT INTO tournaments (slug, name_fa, name_en, status, starts_at, trading_days, ends_at, prizes)
    VALUES ($1,'لیگ آزمایشی','Test League','registration',$2,5,$3,$4) RETURNING *`, [slug, start, tradingEnd(start, 5).toISOString(), JSON.stringify({ ...DEFAULT_TOURNAMENT.prizes, couponRanks: [2, 100], accountRanks: [1, 1] })])).rows[0]
  for (let i = 0; i < 5; i++) users.push((await pool.query('INSERT INTO openfund_users (wallet_address, wallet_chain) VALUES ($1, 42161) RETURNING id, wallet_address', ['0x' + crypto.randomBytes(20).toString('hex')])).rows[0])
  email = createEmailSender({ EMAIL_PROVIDER: 'log', EMAIL_FROM: 'Openfund <no-reply@example.test>', NODE_ENV: 'test' }, { log: () => {} })
  const app = express()
  app.use(express.json())
  const requireAuth = (req, res, next) => (req.headers['x-test-user'] ? ((req.user = { user_id: req.headers['x-test-user'] }), next()) : res.status(401).json({ error: 'unauthenticated' }))
  const limit = () => (_req, _res, next) => next()
  let sender = createEmailSender({}) /* not configured until the test switches it */
  const emailProxy = { get configured() { return sender.configured }, send: (...a) => sender.send(...a) }
  app.locals.useEmail = s => { sender = s }
  app.use(tournamentRoutes({ pool, requireAuth, limit, email: emailProxy, audit: async () => {} }))
  app.use('/admin/tournaments', tournamentAdminRoutes({ pool, audit: async () => {} }))
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }))
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`
  app.locals.switch = () => app.locals.useEmail(email)
  globalThis.__switchEmail = app.locals.switch
})
after(async () => { server?.close(); await pool.end() })

test('the schedule is computed from weekdays and the default league starts 4 January 2027', async () => {
  assert.equal(tradingEnd('2027-01-04T00:00:00Z', 30).toISOString(), '2027-02-12T23:59:59.999Z')
  const seeded = (await pool.query(`SELECT starts_at, ends_at, trading_days, account_size_usd, daily_loss_pct, max_loss_pct, consistency_pct FROM tournaments WHERE slug=$1`, [DEFAULT_TOURNAMENT.slug])).rows[0]
  assert.equal(seeded.starts_at.toISOString(), '2027-01-04T00:00:00.000Z')
  assert.equal(seeded.ends_at.toISOString(), '2027-02-12T23:59:59.999Z')
  assert.deepEqual([seeded.trading_days, Number(seeded.account_size_usd), Number(seeded.daily_loss_pct), Number(seeded.max_loss_pct), Number(seeded.consistency_pct)], [30, 125000, 5, 10, 35])
  const plan = (await pool.query(`SELECT status FROM challenge_plans WHERE slug=$1`, [TOURNAMENT_PLAN_SLUG])).rows[0]
  assert.equal(plan.status, 'inactive', 'the tournament plan is never sold')
  await ensureTournamentSeed(pool) /* idempotent */
})

test('registration stays closed until the terms are published and e-mail is configured', async () => {
  const pub = await call('GET', `/tournaments/${slug}`)
  assert.equal(pub.status, 200)
  assert.equal(pub.data.registration.open, false)
  assert.equal(pub.data.registration.termsPublished, false)
  assert.equal(pub.data.registered, 0, 'the real count, never invented')
  assert.equal((await call('POST', `/tournaments/${slug}/register`, { user: users[0].id, body: { email: 'a@example.test', acceptTerms: true, termsVersion: null } })).data.error, 'terms_not_published')
  await pool.query(`INSERT INTO legal_documents (doc_type, status, version) VALUES ('tournament-terms','published','2026-11')`)
  assert.equal((await call('POST', `/tournaments/${slug}/register`, { user: users[0].id, body: { email: 'a@example.test', acceptTerms: true, termsVersion: '2026-11' } })).data.error, 'email_not_configured')
  globalThis.__switchEmail()
  assert.equal((await call('GET', `/tournaments/${slug}`)).data.registration.open, true)
})

test('one entry per wallet and per e-mail, verified by a hashed one-time code', async () => {
  assert.equal((await call('POST', `/tournaments/${slug}/register`, { user: users[0].id, body: { email: 'a@example.test', acceptTerms: false, termsVersion: '2026-11' } })).data.error, 'terms_not_accepted')
  assert.equal((await call('POST', `/tournaments/${slug}/register`, { user: users[0].id, body: { email: 'not-an-email', acceptTerms: true, termsVersion: '2026-11' } })).data.error, 'invalid_email')
  for (const [i, nick] of [[0, 'Alpha'], [1, 'Bravo'], [2, 'Charlie'], [3, 'Delta'], [4, null]]) {
    const r = await call('POST', `/tournaments/${slug}/register`, { user: users[i].id, body: { email: `trader${i}@example.test`, nickname: nick, acceptTerms: true, termsVersion: '2026-11' } })
    assert.equal(r.status, 202, JSON.stringify(r.data))
    if (i === 0) assert.equal((await call('POST', `/tournaments/${slug}/verify`, { user: users[i].id, body: { code: '000000' === lastCode() ? '111111' : '000000' } })).data.error, 'invalid_code')
    assert.equal((await call('POST', `/tournaments/${slug}/verify`, { user: users[i].id, body: { code: lastCode() } })).data.status, 'registered')
  }
  const stored = (await pool.query(`SELECT code_hash FROM tournament_email_codes ORDER BY id DESC LIMIT 1`)).rows[0].code_hash
  assert.match(stored, /^[0-9a-f]{64}$/, 'only a hash is stored')
  assert.equal((await call('POST', `/tournaments/${slug}/register`, { user: users[0].id, body: { email: 'other@example.test', acceptTerms: true, termsVersion: '2026-11' } })).data.error, 'already_registered')
  const extra = (await pool.query('INSERT INTO openfund_users (wallet_address, wallet_chain) VALUES ($1, 42161) RETURNING id', ['0x' + crypto.randomBytes(20).toString('hex')])).rows[0]
  assert.equal((await call('POST', `/tournaments/${slug}/register`, { user: extra.id, body: { email: 'TRADER1@example.test', acceptTerms: true, termsVersion: '2026-11' } })).data.error, 'email_already_used')
  assert.equal((await call('GET', `/tournaments/${slug}`)).data.registered, 5)
  const csv = await call('GET', `/admin/tournaments/${slug}/registrations?format=csv`, { admin: true })
  assert.match(csv.data, /^id,status,nickname,wallet_address,email/)
  assert.equal(csv.data.trim().split('\n').length, 6, 'header + 5 registrations (the refused duplicate e-mail created none)')
})

test('accounts are provisioned at the start; a breach leaves the ranking but not the account; the end freezes', async () => {
  await pool.query(`UPDATE tournaments SET starts_at=now() - interval '1 minute', ends_at=now() + interval '1 hour' WHERE id=$1`, [tournament.id])
  assert.equal(await provisionAtStart(pool), 5)
  assert.equal(await provisionAtStart(pool), 0, 'idempotent')
  const regs = (await pool.query(`SELECT r.*, c.demo_account_id, c.expires_at, c.rules_snapshot FROM tournament_registrations r JOIN openfund_challenges c ON c.id=r.challenge_id WHERE r.tournament_id=$1 ORDER BY r.created_at`, [tournament.id])).rows
  assert.equal(regs.length, 5)
  assert.ok(regs.every(r => r.status === 'active' && r.rules_snapshot.tournament?.slug === slug && r.rules_snapshot.phases === 0))
  assert.equal(regs[0].expires_at.toISOString(), (await pool.query('SELECT ends_at FROM tournaments WHERE id=$1', [tournament.id])).rows[0].ends_at.toISOString())
  const trade = async (reg, side, margin, leverage) => engine.submitOrder(reg.user_id, { market: 'BTC/USD', side, order_type: 'market', margin, leverage }, crypto.randomUUID(), reg.demo_account_id)
  const closeAll = async reg => { for (const p of (await pool.query(`SELECT id FROM trading_positions WHERE account_id=$1 AND status='open'`, [reg.demo_account_id])).rows) await engine.closePosition(reg.user_id, p.id, { fraction: 1 }) }
  /* Alpha and Charlie: three profitable days each (ranked); Bravo: all profit on
     one day (fails 35% consistency); Delta: breaches the maximum loss; the
     fifth entrant never trades (not ranked) */
  for (let day = 0; day < 3; day++) {
    market.price = '50000'; await trade(regs[0], 'long', 1000, 5); await trade(regs[2], 'long', 600, 5); if (day === 0) await trade(regs[1], 'long', 4000, 5)
    market.price = '50500'; await closeAll(regs[0]); await closeAll(regs[2]); if (day === 0) await closeAll(regs[1])
    /* fixture: move this round's closes to an earlier UTC+3 trading day */
    await pool.query(`UPDATE trading_positions SET closed_at = closed_at - ($2::int * interval '1 day') WHERE account_id = ANY($1) AND closed_at > now() - interval '1 minute'`,
      [[regs[0].demo_account_id, regs[1].demo_account_id, regs[2].demo_account_id], 3 - day])
  }
  market.price = '50000'; await trade(regs[3], 'long', 5000, 20)
  market.price = '43000'
  await engine.enforceChallengeRisk(regs[3].demo_account_id)
  const delta = (await pool.query(`SELECT r.status, r.out_of_ranking_rule, a.status AS account FROM tournament_registrations r JOIN openfund_challenges c ON c.id=r.challenge_id JOIN demo_accounts a ON a.id=c.demo_account_id WHERE r.id=$1`, [regs[3].id])).rows[0]
  assert.equal(delta.status, 'out_of_ranking')
  assert.match(delta.out_of_ranking_rule, /loss/)
  assert.equal(delta.account, 'active', 'the account stays open for practice')
  market.price = '50000'
  assert.ok(await sampleEquity(pool, market) >= 3)
  const live = await call('GET', `/tournaments/${slug}`)
  assert.equal(live.data.leaderboard.find(r => r.outOfRanking).position, null)
  assert.ok(live.data.leaderboard.every(r => !/^0x[0-9a-f]{40}$/.test(r.name)), 'wallets are masked')
  /* the end: the engine settles open positions at the mark and closes every account */
  await pool.query(`UPDATE openfund_challenges SET expires_at=now() - interval '1 second' WHERE id = ANY($1)`, [regs.map(r => r.challenge_id)])
  await pool.query(`UPDATE tournaments SET ends_at=now() - interval '1 second' WHERE id=$1`, [tournament.id])
  for (const r of regs) await engine.enforceChallengeRisk(r.demo_account_id)
  assert.equal((await pool.query(`SELECT count(*)::int n FROM demo_accounts WHERE id = ANY($1) AND status='active'`, [regs.map(r => r.demo_account_id)])).rows[0].n, 0)
  await sampleEquity(pool, market)
  assert.equal((await pool.query('SELECT status FROM tournaments WHERE id=$1', [tournament.id])).rows[0].status, 'finished')
})

test('final standings are frozen with the ranking rules; awards and certificates follow', async () => {
  const fin = await call('POST', `/admin/tournaments/${slug}/finalize`, { admin: true, body: { reason: 'end of the competition' } })
  assert.equal(fin.status, 200, JSON.stringify(fin.data))
  const standings = (await call('GET', `/admin/tournaments/${slug}/standings`, { admin: true })).data.standings
  const by = nick => standings.find(s => s.nickname === nick)
  assert.equal(by('Alpha').rank, 1, 'higher final equity wins')
  assert.equal(by('Charlie').rank, 2)
  assert.equal(by('Bravo').not_ranked_reason, 'consistency', 'one day held all the profit')
  assert.ok(Number(by('Bravo').best_day_share) > 0.35)
  assert.ok(Number(by('Alpha').best_day_share) <= 0.35)
  assert.equal(standings.find(s => s.nickname === null).not_ranked_reason, 'no_closed_trades')
  assert.match(by('Delta').not_ranked_reason, /^out_of_ranking:/)
  await assert.rejects(pool.query(`UPDATE tournament_standings SET rank=9 WHERE tournament_id=$1`, [tournament.id]), /append_only_table/)
  assert.equal((await call('POST', `/admin/tournaments/${slug}/finalize`, { admin: true, body: { reason: 'again' } })).data.error, 'tournament_finalized')
  const issued = await call('POST', `/admin/tournaments/${slug}/awards/issue`, { admin: true, body: { reason: 'award the league' } })
  assert.equal(issued.status, 200, JSON.stringify(issued.data))
  assert.equal((await call('POST', `/admin/tournaments/${slug}/awards/issue`, { admin: true, body: { reason: 'twice' } })).data.issued, 0, 'idempotent')
  const awards = (await call('GET', `/admin/tournaments/${slug}/awards`, { admin: true })).data.awards
  const alpha = awards.filter(a => a.nickname === 'Alpha').map(a => `${a.kind}:${a.status}`).sort()
  assert.ok(alpha.includes('cash:pending') && alpha.includes('account:issued') && alpha.includes('badge:issued'), alpha.join())
  assert.equal(awards.filter(a => a.nickname === 'Alpha' && a.kind === 'hardware').length, 3)
  assert.ok(!awards.some(a => a.nickname === 'Bravo' && a.kind !== 'badge'), 'not ranked: no prize')
  const coupon = awards.find(a => a.nickname === 'Charlie' && a.kind === 'coupon')
  const c = (await pool.query(`SELECT kind, value, max_redemptions, expires_at FROM coupons WHERE id=$1`, [coupon.coupon_id])).rows[0]
  assert.deepEqual([c.kind, Number(c.value), c.max_redemptions], ['percent', 35, 1])
  assert.ok(Math.abs(new Date(c.expires_at) - Date.now() - 90 * 86_400_000) < 120_000, '90-day expiry')
  assert.ok(awards.some(a => a.nickname === 'Alpha' && a.item === 'finisher'))
  assert.ok(!awards.some(a => a.nickname === 'Delta' && a.item === 'finisher'), 'no finisher badge after a breach')
  const cash = awards.find(a => a.kind === 'cash')
  assert.equal((await call('POST', `/admin/tournaments/${slug}/awards/${cash.id}`, { admin: true, body: { status: 'fulfilled', note: 'paid by bank transfer', reason: 'paid' } })).data.award.status, 'fulfilled')
  assert.equal((await call('POST', `/admin/tournaments/${slug}/awards/${coupon.id}`, { admin: true, body: { status: 'fulfilled', reason: 'coupon is self-service' } })).data.error, 'award_not_trackable')
  /* certificates: a badge becomes a tournament certificate once the holder has an identity */
  const bravoUser = standings.find(s => s.nickname === 'Alpha')
  const uid = (await pool.query('SELECT user_id FROM tournament_registrations WHERE id=$1', [bravoUser.registration_id])).rows[0].user_id
  await pool.query(`INSERT INTO certificate_identities (user_id, display_name) VALUES ($1,'Alpha') ON CONFLICT DO NOTHING`, [uid])
  await syncCertificates(pool, uid)
  assert.ok((await pool.query(`SELECT count(*)::int n FROM certificates WHERE user_id=$1 AND kind='tournament'`, [uid])).rows[0].n >= 1)
})

test('the ranking ties break on drawdown, then on the earlier time', () => {
  const rows = rankRows([
    { id: 'a', ranked: true, finalEquity: '130000.00', maxDrawdown: '900.00', reachedAt: '2027-02-01T10:00:00Z' },
    { id: 'b', ranked: true, finalEquity: '130000.00', maxDrawdown: '500.00', reachedAt: '2027-02-03T10:00:00Z' },
    { id: 'c', ranked: true, finalEquity: '130000.00', maxDrawdown: '500.00', reachedAt: '2027-02-02T10:00:00Z' },
    { id: 'd', ranked: false, finalEquity: '140000.00', maxDrawdown: '0', reachedAt: null },
  ])
  assert.deepEqual(rows.map(r => [r.id, r.rank]), [['a', 3], ['b', 2], ['c', 1], ['d', null]])
})

test('the e-mail adapter never pretends to send', async () => {
  const off = createEmailSender({})
  assert.equal(off.configured, false)
  await assert.rejects(off.send({ to: 'a@b.co', subject: 's', text: 't' }), /email_not_configured/)
  assert.equal(createEmailSender({ EMAIL_PROVIDER: 'log', NODE_ENV: 'production' }).configured, false, 'the log provider is refused in production')
  assert.equal(createEmailSender({ EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 'short', EMAIL_FROM: 'x@y.co' }).configured, false)
  assert.equal(createEmailSender({ EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 'k'.repeat(24), EMAIL_FROM: 'Openfund <no-reply@openfi.cloud>' }).configured, true)
})
