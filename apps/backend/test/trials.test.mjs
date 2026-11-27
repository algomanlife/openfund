/**
 * Request-based Free Trial (ADR 0062) on real PostgreSQL: trial rules copied
 * from the paid plan, provisioning and the 14-day phase clock, eligibility
 * (no active account, 72-hour cooldown), validation, the trial certificates
 * and the owner-run retirement of former free demo accounts.
 * Runs in its own disposable database, migrated from scratch.
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { PLAN_SEEDS } from '../plan-catalog.js'
import { ChallengeService } from '../evaluation.js'
import { trialRules, trialEligibility, trialOffer, requestTrialTx, TRIAL_COOLDOWN_HOURS } from '../trials.js'
import { syncCertificates } from '../certificates.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const baseUrl = new URL(process.env.DATABASE_URL)
const isolatedDb = `${baseUrl.pathname.slice(1)}_trials_${process.pid}_${Date.now()}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase()
const admin = new pg.Client({ connectionString: process.env.DATABASE_URL })
await admin.connect()
await admin.query(`CREATE DATABASE "${isolatedDb}"`)
await admin.end()
const isolatedUrl = new URL(baseUrl); isolatedUrl.pathname = `/${isolatedDb}`
const migrate = fileURLToPath(new URL('../migrate.js', import.meta.url))
execFileSync(process.execPath, [migrate], {
  env: { ...process.env, DATABASE_URL: isolatedUrl.href, FOOTPRINT_DATABASE_URL: isolatedUrl.href }, stdio: ['ignore', 'ignore', 'inherit'],
})
const pool = new pg.Pool({ connectionString: isolatedUrl.href })
const seed = slug => PLAN_SEEDS.find(p => p.slug === slug)
const newUser = async () => (await pool.query('INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id',
  [privateKeyToAccount(generatePrivateKey()).address.toLowerCase()])).rows[0].id
const tx = async fn => {
  const c = await pool.connect()
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e } finally { c.release() }
}
const request = (userId, body) => tx(c => requestTrialTx(c, userId, body))

before(async () => {
  for (const s of PLAN_SEEDS) {
    await pool.query(`INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3)
      ON CONFLICT (slug) DO UPDATE SET configuration=excluded.configuration, status='active'`, [s.slug, s.name, JSON.stringify(s.configuration)])
  }
})
after(async () => {
  await pool.end()
  const drop = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await drop.connect()
  try { await drop.query(`DROP DATABASE IF EXISTS "${isolatedDb}" WITH (FORCE)`) } finally { await drop.end() }
})

test('T1 trial rules copy the paid plan and drop every reward term', () => {
  const std = trialRules(seed('standard').configuration, 'standard')
  assert.deepEqual([std.phases, std.phase1TargetPct, std.phase2TargetPct, std.dailyLossPct, std.maxTotalLossPct, std.minTradingDays],
    [2, 8, 5, 5, 10, 3])
  assert.deepEqual([std.free, std.profitSplitPct, std.timeLimitDays, std.trialDaysPerPhase, std.trialModel, std.dailyLossPctAlt],
    [true, 0, 14, 14, 'standard', null])
  assert.ok(std.evaluationCapable)
  const one = trialRules(seed('one-phase').configuration, 'one-phase')
  assert.deepEqual([one.phases, one.phase1TargetPct, one.dailyLossPct, one.maxTotalLossPct, one.free], [1, 12, 3, 12, true])
})

test('T2 the offer lists the site sizes and the two models, never Instant', async () => {
  const offer = await trialOffer(pool)
  assert.deepEqual(offer.accountSizesUsd, seed('free-trial').configuration.accountSizesUsd)
  assert.deepEqual(offer.models.map(m => m.model).sort(), ['one-phase', 'standard'])
  assert.equal(offer.daysPerPhase, 14)
  assert.equal(offer.cooldownHours, TRIAL_COOLDOWN_HOURS)
})

test('T3 a request provisions a started trial with a 14-day phase', async () => {
  const user = await newUser()
  assert.deepEqual(await trialEligibility(pool, user), { eligible: true, reason: null })
  const started = await request(user, { model: 'standard', accountSizeUsd: 25000 })
  assert.equal(started.status, 'started')
  assert.equal(started.stage, 1)
  const days = (new Date(started.expires_at) - new Date(started.started_at)) / 86_400_000
  assert.ok(Math.abs(days - 14) < 0.01, `expected 14 days, got ${days}`)
  const acc = (await pool.query('SELECT * FROM demo_accounts WHERE id=$1', [started.demo_account_id])).rows[0]
  assert.equal(acc.account_type, 'challenge')
  assert.equal(Number(acc.balance), 25000)
  const row = (await pool.query(`SELECT c.rules_snapshot, p.slug FROM openfund_challenges c JOIN challenge_plans p ON p.id=c.challenge_plan_id WHERE c.id=$1`, [started.id])).rows[0]
  assert.equal(row.slug, 'free-trial')
  assert.equal(row.rules_snapshot.free, true)
  assert.equal(row.rules_snapshot.trialModel, 'standard')
  const events = (await pool.query('SELECT kind FROM challenge_events WHERE challenge_id=$1 ORDER BY id', [started.id])).rows.map(r => r.kind)
  assert.deepEqual(events.filter(k => ['trial_requested', 'account_provisioned', 'started'].includes(k)), ['trial_requested', 'account_provisioned', 'started'])
})

test('T4 one active account at a time: a running trial or challenge blocks a request', async () => {
  const user = await newUser()
  await request(user, { model: 'one-phase', accountSizeUsd: 5000 })
  await assert.rejects(() => request(user, { model: 'standard', accountSizeUsd: 5000 }), e => e.status === 409 && e.message === 'active_account_exists')
  const paid = await newUser()
  const plan = (await pool.query(`SELECT id FROM challenge_plans WHERE slug='standard'`)).rows[0]
  await pool.query(`INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd) VALUES ($1,$2,'created',10000)`, [paid, plan.id])
  await assert.rejects(() => request(paid, { model: 'standard', accountSizeUsd: 5000 }), e => e.message === 'active_account_exists')
})

test('T5 concurrent requests create exactly one trial', async () => {
  const user = await newUser()
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => request(user, { model: 'standard', accountSizeUsd: 10000 })))
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  const n = (await pool.query('SELECT count(*)::int n FROM openfund_challenges WHERE user_id=$1', [user])).rows[0].n
  assert.equal(n, 1)
})

test('T6 72 hours must pass after a trial ends', async () => {
  const user = await newUser()
  const first = await request(user, { model: 'standard', accountSizeUsd: 5000 })
  await pool.query(`UPDATE openfund_challenges SET status='failed', completed_at=now() WHERE id=$1`, [first.id])
  const blocked = await trialEligibility(pool, user)
  assert.equal(blocked.reason, 'trial_cooldown')
  assert.ok(Math.abs(new Date(blocked.availableAt) - Date.now() - TRIAL_COOLDOWN_HOURS * 3600_000) < 60_000)
  await assert.rejects(() => request(user, { model: 'standard', accountSizeUsd: 5000 }), e => e.message === 'trial_cooldown')
  await pool.query(`UPDATE openfund_challenges SET completed_at=now() - interval '73 hours' WHERE id=$1`, [first.id])
  assert.equal((await trialEligibility(pool, user)).eligible, true)
  assert.equal((await request(user, { model: 'one-phase', accountSizeUsd: 5000 })).status, 'started')
})

test('T7 invalid models and sizes are rejected; Instant has no trial', async () => {
  const user = await newUser()
  await assert.rejects(() => request(user, { model: 'instant', accountSizeUsd: 5000 }), e => e.status === 400 && e.message === 'invalid_trial_model')
  await assert.rejects(() => request(user, { model: 'standard', accountSizeUsd: 7777 }), e => e.status === 400 && e.message === 'invalid_account_size')
  await assert.rejects(() => request(user, { model: 'standard', accountSizeUsd: 200000 }), e => e.message === 'invalid_account_size')
  assert.equal((await pool.query('SELECT count(*)::int n FROM openfund_challenges WHERE user_id=$1', [user])).rows[0].n, 0)
})

test('T8 trial activation, phase pass and final pass certificates', async () => {
  const user = await newUser()
  await pool.query(`INSERT INTO certificate_identities (user_id, display_name) VALUES ($1,'Trial Trader')`, [user])
  const stage1 = await request(user, { model: 'standard', accountSizeUsd: 50000 })
  await syncCertificates(pool, user)
  const kinds = async () => (await pool.query('SELECT kind FROM certificates WHERE user_id=$1 ORDER BY kind', [user])).rows.map(r => r.kind)
  assert.deepEqual(await kinds(), ['trial'])
  /* stage-1 pass: what the engine records, then stage 2 starts its own 14 days */
  const rules = (await pool.query('SELECT rules_snapshot FROM openfund_challenges WHERE id=$1', [stage1.id])).rows[0].rules_snapshot
  await pool.query(`UPDATE openfund_challenges SET status='passed', completed_at=now() WHERE id=$1`, [stage1.id])
  await ChallengeService.event(pool, stage1.id, 'stage_passed', { stage: 1 })
  const stage2 = await tx(async c => {
    const row = (await c.query(`INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, stage, rules_snapshot, parent_challenge_id)
      SELECT user_id, challenge_plan_id, 'created', account_size_usd, 2, $2, id FROM openfund_challenges WHERE id=$1 RETURNING *`, [stage1.id, JSON.stringify(rules)])).rows[0]
    return new ChallengeService(null).startTx(c, row)
  })
  const days = (new Date(stage2.expires_at) - new Date(stage2.started_at)) / 86_400_000
  assert.ok(Math.abs(days - 14) < 0.01)
  await syncCertificates(pool, user)
  assert.deepEqual(await kinds(), ['stage_pass', 'trial'], 'stage 2 is not a second activation')
  await pool.query(`UPDATE openfund_challenges SET status='passed', completed_at=now() WHERE id=$1`, [stage2.id])
  await ChallengeService.event(pool, stage2.id, 'passed', { stage: 2 })
  await syncCertificates(pool, user)
  assert.deepEqual(await kinds(), ['stage_pass', 'trial', 'trial_pass'])
  await syncCertificates(pool, user)
  assert.equal((await kinds()).length, 3, 'issuance is idempotent')
})

test('T9 retire-free-demo deletes former free demo accounts and nothing else', async () => {
  const user = await newUser()
  const demo = (await pool.query(`INSERT INTO demo_accounts (user_id, balance, currency) VALUES ($1, 100000, 'USD') RETURNING id`, [user])).rows[0].id
  await pool.query(`INSERT INTO trading_ledger (account_id, user_id, event, amount, balance_after, meta) VALUES ($1,$2,'demo_funding',100000,100000,'{}')`, [demo, user])
  await pool.query(`INSERT INTO journal_entries (user_id, product, account_ref, title, body, entry_date) VALUES ($1,'prop',$2,'Note','','2026-11-02')`, [user, demo])
  await pool.query(`INSERT INTO trade_notes (user_id, trade_key, notes) VALUES ($1, $2, 'n')`, [user, `${demo}|position|x`])
  await pool.query(`UPDATE demo_accounts SET status='permanently_disabled' WHERE id=$1`, [demo])
  await assert.rejects(() => pool.query('DELETE FROM demo_accounts WHERE id=$1', [demo]), /permanently_disabled_trial_is_immutable/)
  const trial = await request(user, { model: 'standard', accountSizeUsd: 5000 })
  const script = fileURLToPath(new URL('../retire-free-demo.mjs', import.meta.url))
  const env = { ...process.env, DATABASE_URL: isolatedUrl.href }
  const dry = JSON.parse(execFileSync(process.execPath, [script], { env, encoding: 'utf8' }).split('\nNothing was changed')[0])
  assert.equal(dry.mode, 'dry-run')
  assert.ok(dry.accounts >= 1)
  assert.equal((await pool.query('SELECT count(*)::int n FROM demo_accounts WHERE id=$1', [demo])).rows[0].n, 1, 'a dry run changes nothing')
  const done = JSON.parse(execFileSync(process.execPath, [script, '--confirm'], { env, encoding: 'utf8' }))
  assert.equal(done.mode, 'deleted')
  assert.equal((await pool.query(`SELECT count(*)::int n FROM demo_accounts WHERE account_type='free_demo'`)).rows[0].n, 0)
  assert.equal((await pool.query('SELECT count(*)::int n FROM trading_ledger WHERE account_id=$1', [demo])).rows[0].n, 0)
  assert.equal((await pool.query('SELECT count(*)::int n FROM journal_entries WHERE account_ref=$1', [demo])).rows[0].n, 0)
  assert.equal((await pool.query('SELECT count(*)::int n FROM trade_notes WHERE user_id=$1', [user])).rows[0].n, 0)
  assert.equal((await pool.query('SELECT count(*)::int n FROM demo_accounts WHERE id=$1', [trial.demo_account_id])).rows[0].n, 1, 'challenge accounts are kept')
  assert.equal((await pool.query(`SELECT count(*)::int n FROM audit_log WHERE action='free_demo_retired'`)).rows[0].n, 1)
})
