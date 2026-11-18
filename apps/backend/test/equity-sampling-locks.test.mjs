/**
 * Deterministic lock-order regression for free-demo equity sampling against
 * a concurrent demo-account deletion (DB-backed, two real sessions each).
 *
 * The CI deadlock (run 44153284877) was a cycle between:
 *   - the sampler: the regional fence trigger (BEFORE INSERT) took FOR SHARE
 *     on account_ownership, then the deferred foreign-key check at statement
 *     end waited for FOR KEY SHARE on the parent demo_accounts row;
 *   - the deleter: DELETE FROM demo_accounts held the parent row lock, then
 *     its ON DELETE CASCADE waited to delete the account_ownership row.
 * The fix locks the parent FOR KEY SHARE first, before any ownership lock.
 *
 * Interleavings are forced with real row locks and observed through
 * pg_stat_activity / pg_blocking_pids (no sleeps, retries or timeouts as the
 * ordering mechanism). The first test replays the pre-fix statement as a
 * control to prove the harness reproduces the cycle.
 *
 * Run: DATABASE_URL=<isolated test db> node --test test/equity-sampling-locks.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { randomUUID } from 'node:crypto'
import { Engine } from '../engine.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 12 })

class FakeMarket {
  marketMeta(symbol) { return { symbol, group: 'crypto', base: 'SOL', quote: 'USD', maxLeverage: 100, isOpen: true } }
  mark() { return null }
  tradeable() { return { ok: false, reason: 'stale_price' } }
}

/* The sampling statement exactly as it was before the fix (engine.js at
   v0.6.5, a87804a). Used only as the control that proves the cycle. */
const PRE_FIX_SAMPLE_SQL = `WITH r AS (INSERT INTO account_equity_risk
      (account_id,day,day_start_equity,peak_equity,last_equity)
      VALUES ($1,(now() AT TIME ZONE 'UTC')::date,$2,$2,$2)
      ON CONFLICT (account_id) DO UPDATE SET
        day = excluded.day,
        day_start_equity = CASE WHEN account_equity_risk.day=excluded.day THEN account_equity_risk.day_start_equity ELSE excluded.last_equity END,
        peak_equity = GREATEST(account_equity_risk.peak_equity,excluded.last_equity),
        maximum_drawdown = GREATEST(account_equity_risk.maximum_drawdown,account_equity_risk.peak_equity-excluded.last_equity,0),
        daily_drawdown = CASE WHEN account_equity_risk.day=excluded.day THEN GREATEST(account_equity_risk.daily_drawdown,account_equity_risk.day_start_equity-excluded.last_equity,0) ELSE 0 END,
        last_equity=excluded.last_equity,updated_at=now()
      RETURNING *),
      s AS (INSERT INTO account_equity_samples(account_id,sampled_at,equity,balance) SELECT id,date_trunc('minute',now()),$2,balance FROM demo_accounts WHERE id=$1 ON CONFLICT DO NOTHING)
      SELECT * FROM r`

const users = []
async function demoUser() {
  const { rows: [u] } = await pool.query('INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id',
    ['0xlocks' + randomUUID().replace(/-/g, '').slice(0, 34)])
  users.push(u.id)
  const account = await new Engine(pool, new FakeMarket()).ensureDemoAccount(u.id)
  return { uid: u.id, accountId: account.id }
}

/* Engine pool whose connections report their backend pid, so the test can
   wait for exactly the engine's sampling statement. */
function trackedPool() {
  const pids = []
  return {
    pids,
    query: (...args) => pool.query(...args),
    async connect() {
      const client = await pool.connect()
      pids.push((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid)
      return client
    },
  }
}

const pidOf = async client => (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid

/* Resolves once `waiter` is waiting on a heavyweight lock held by `holder`.
   Fails (instead of hanging) if the waiter finishes or 15 s pass. */
async function blockedBy(waiter, holder, settled) {
  const deadline = Date.now() + 15000
  for (;;) {
    const ids = typeof waiter === 'function' ? waiter() : [waiter]
    for (const pid of ids) {
      const { rows: [r] } = await pool.query(
        "SELECT wait_event_type, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1", [pid])
      if (r?.wait_event_type === 'Lock' && r.blockers.includes(holder)) return pid
    }
    if (settled?.done) throw new Error('waiter finished before it blocked: ' + String(settled.error ?? 'ok'))
    if (Date.now() > deadline) throw new Error('timed out waiting for the lock wait')
    await new Promise(res => setImmediate(res))
  }
}

const track = promise => {
  const state = { done: false, error: null }
  state.promise = promise.then(v => { state.done = true; return v }, e => { state.done = true; state.error = e; throw e })
  state.promise.catch(() => {})
  return state
}

/* Removes the account's dependent rows in FK order (no cascade from
   ledger/events), then the account itself. Runs on the given session. */
async function deleteAccount(client, accountId) {
  await client.query('DELETE FROM trading_ledger WHERE account_id=$1', [accountId])
  await client.query('DELETE FROM trading_events WHERE account_id=$1', [accountId])
  return client.query('DELETE FROM demo_accounts WHERE id=$1', [accountId])
}

async function session(fn) {
  const client = await pool.connect()
  try { return await fn(client) } finally {
    await client.query('ROLLBACK').catch(() => {})
    client.release()
  }
}

test.after(async () => {
  for (const u of users) {
    await pool.query("UPDATE account_ownership SET state='active' WHERE account_id IN (SELECT id FROM demo_accounts WHERE user_id=$1) AND state<>'active'", [u])
    await pool.query('DELETE FROM account_equity_risk WHERE account_id IN (SELECT id FROM demo_accounts WHERE user_id=$1)', [u])
    await pool.query('DELETE FROM account_equity_samples WHERE account_id IN (SELECT id FROM demo_accounts WHERE user_id=$1)', [u])
    await pool.query('DELETE FROM trading_ledger WHERE user_id=$1', [u])
    await pool.query('DELETE FROM trading_positions WHERE user_id=$1', [u])
    await pool.query('DELETE FROM trading_orders WHERE user_id=$1', [u])
    await pool.query('DELETE FROM trading_events WHERE account_id IN (SELECT id FROM demo_accounts WHERE user_id=$1)', [u])
    await pool.query('DELETE FROM demo_accounts WHERE user_id=$1', [u])
    await pool.query('DELETE FROM openfund_users WHERE id=$1', [u])
  }
  await pool.end()
})

test('control: the pre-fix sampling statement deadlocks with a concurrent account deletion', async () => {
  const { accountId } = await demoUser()
  await session(async deleter => session(async sampler => {
    const deleterPid = await pidOf(deleter)
    const samplerPid = await pidOf(sampler)
    /* 1. the deleter holds the parent row lock (the lock DELETE takes) */
    await deleter.query('BEGIN')
    await deleter.query('SELECT 1 FROM demo_accounts WHERE id=$1 FOR UPDATE', [accountId])
    /* 2. the sampler takes FOR SHARE on account_ownership in the fence
          trigger, then waits for FOR KEY SHARE on demo_accounts */
    const sample = track(sampler.query(PRE_FIX_SAMPLE_SQL, [accountId, '100000']))
    await blockedBy(samplerPid, deleterPid, sample)
    /* 3. the deletion cascades into account_ownership: a cycle */
    const del = track(deleteAccount(deleter, accountId))
    const results = await Promise.allSettled([sample.promise, del.promise])
    const deadlocks = results.filter(r => r.status === 'rejected' && r.reason?.code === '40P01')
    assert.equal(deadlocks.length, 1, 'PostgreSQL detected exactly one deadlock: ' +
      JSON.stringify(results.map(r => r.status === 'rejected' ? r.reason.code + ' ' + r.reason.message : 'ok')))
    /* the cycle is between exactly these two sessions */
    const detail = deadlocks[0].reason.detail ?? ''
    assert.ok(detail.includes(`process ${deleterPid}`) && detail.includes(`process ${samplerPid}`), detail)
  }))
})

test('deletion first: the sampler waits on the parent account before any ownership lock and records nothing', async () => {
  const { uid, accountId } = await demoUser()
  await session(async deleter => {
    const deleterPid = await pidOf(deleter)
    await deleter.query('BEGIN')
    await deleter.query('SELECT 1 FROM demo_accounts WHERE id=$1 FOR UPDATE', [accountId])
    /* the state() snapshot still sees the account; its sampling write must
       then wait for the parent row without holding account_ownership */
    const db = trackedPool()
    const state = track(new Engine(db, new FakeMarket()).state(uid))
    await blockedBy(() => db.pids, deleterPid, state)
    /* the cascade into account_ownership must not wait on the sampler */
    await deleter.query("SET LOCAL lock_timeout = '10s'")
    const deleted = await deleteAccount(deleter, accountId)
    assert.equal(deleted.rowCount, 1)
    await deleter.query('COMMIT')
    const result = await state.promise
    assert.equal(result.account.risk, null, 'no sample for an account that disappeared')
  })
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM account_equity_risk WHERE account_id=$1', [accountId])).rows[0].n, 0)
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM account_equity_samples WHERE account_id=$1', [accountId])).rows[0].n, 0)
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM account_ownership WHERE account_id=$1', [accountId])).rows[0].n, 0)
})

test('sampling first: the deletion waits for the sampler, which commits, then cascades its rows', async () => {
  const { uid, accountId } = await demoUser()
  await new Engine(pool, new FakeMarket()).state(uid)   /* creates the risk row */
  await session(async gate => session(async deleter => {
    const gatePid = await pidOf(gate)
    const deleterPid = await pidOf(deleter)
    /* hold the existing risk row so the sampler stops inside its statement
       after taking its parent and ownership locks */
    await gate.query('BEGIN')
    await gate.query('SELECT 1 FROM account_equity_risk WHERE account_id=$1 FOR UPDATE', [accountId])
    const db = trackedPool()
    const state = track(new Engine(db, new FakeMarket()).state(uid))   /* fresh engine: no idle-skip cache */
    const samplerPid = await blockedBy(() => db.pids, gatePid, state)
    /* the deletion now has to wait for the sampler's FOR KEY SHARE */
    await deleter.query('BEGIN')
    await deleter.query("SET LOCAL lock_timeout = '10s'")
    const del = track(deleteAccount(deleter, accountId))
    await blockedBy(deleterPid, samplerPid, del)
    await gate.query('COMMIT')
    const result = await state.promise
    assert.ok(result.account.risk, 'the sampler completed and returned its risk view')
    assert.equal(result.account.risk.basis, 'sampled_equity')
    assert.equal((await del.promise).rowCount, 1)
    await deleter.query('COMMIT')
  }))
  for (const t of ['account_equity_risk', 'account_equity_samples', 'account_ownership'])
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${t} WHERE account_id=$1`, [accountId])).rows[0].n, 0, t + ' cascaded')
})

test('ownership fencing still rejects sampling for an account this region may not write', async () => {
  const { uid, accountId } = await demoUser()
  await pool.query("UPDATE account_ownership SET state='fenced' WHERE account_id=$1", [accountId])
  try {
    await assert.rejects(new Engine(pool, new FakeMarket()).state(uid), /account_not_writable_in_region/)
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM account_equity_risk WHERE account_id=$1', [accountId])).rows[0].n, 0)
  } finally {
    await pool.query("UPDATE account_ownership SET state='active' WHERE account_id=$1", [accountId])
  }
})
