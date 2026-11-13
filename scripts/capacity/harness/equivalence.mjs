/**
 * Differential equivalence check — reference build vs candidate build.
 *
 * Starts two backends (e.g. unmodified `main` and an optimization branch),
 * each on its own fresh disposable *_test database, both in SIM_TEST_MODE
 * with the synthetic Gains server for market metadata. Both receive exactly
 * the same deterministic sequence through the public API: sign-ins, market /
 * limit / stop orders, idempotent retries, concurrent orders on one account,
 * SL/TP edits, partial closes, a price path that fires SL, TP, liquidation
 * and pending orders (several positions on the same tick), and two Prop
 * challenges (one breached, one passed). Prices are injected through the
 * test seam on synthetic markets the feed never ticks.
 *
 * Afterwards the financial state of both databases is normalized (ids and
 * timestamps removed, rows keyed by wallet index) and compared field by
 * field: accounts, positions, orders, ledger, trading events, equity-risk
 * rows, challenges and challenge events. Each stream's first SSE snapshot is
 * also compared with /trading/state on the same build.
 *
 * Usage (backend binaries must be stopped on the chosen ports):
 *   REF_DIR=<ref repo> CAND_DIR=<candidate repo> PG_ADMIN=postgres://postgres@127.0.0.1:55471/postgres \
 *     node harness/equivalence.mjs [out.json]
 * Exit code 0 = equivalent, 1 = differences (listed), 2 = harness failure.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'
import pg from 'pg'
import { keccak256, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ADMIN = process.env.PG_ADMIN || 'postgres://postgres@127.0.0.1:55471/postgres'
const OUT = process.argv[2] || null
const builds = [
  { name: 'reference', dir: process.env.REF_DIR, port: 18181, db: 'openfund_eqref_test' },
  { name: 'candidate', dir: process.env.CAND_DIR, port: 18182, db: 'openfund_eqcand_test' },
]
if (!builds.every(b => b.dir)) { console.error('REF_DIR and CAND_DIR are required'); process.exit(2) }
const dbUrl = b => ADMIN.replace(/\/[^/]*$/, '/' + b.db)
const ORIGIN = 'http://localhost:5173'
const sleep = ms => new Promise(r => setTimeout(r, ms))

/* ---------- environment ---------- */
async function prepare(b) {
  const admin = new pg.Client({ connectionString: ADMIN }); await admin.connect()
  await admin.query(`DROP DATABASE IF EXISTS ${b.db} WITH (FORCE)`)
  await admin.query(`CREATE DATABASE ${b.db}`)
  await admin.end()
  const backend = path.join(b.dir, 'apps/backend')
  const env = { ...process.env, DATABASE_URL: dbUrl(b) }
  execFileSync('node', ['migrate.js'], { cwd: backend, env, stdio: 'ignore' })
  execFileSync('node', ['seed-plans.js'], { cwd: backend, env, stdio: 'ignore' })
  b.log = fs.openSync(path.join(OUT ? path.dirname(OUT) : '/tmp', `equivalence-${b.name}.log`), 'w')
  b.proc = spawn('node', ['--import', path.join(HERE, 'preload.mjs'), 'server.js'], {
    cwd: backend, stdio: ['ignore', b.log, b.log],
    env: { ...env, PORT: String(b.port), SIM_TEST_MODE: '1', NODE_ENV: 'test', BACKEND_DIR: backend,
      GAINS_API: 'http://127.0.0.1:18090/v1/arbitrum', GAINS_WSS: 'ws://127.0.0.1:18090/v1/arbitrum/ws', METRICS_FILE: '' },
  })
  b.base = `http://127.0.0.1:${b.port}`
  for (let i = 0; i < 60; i++) { try { if ((await fetch(b.base + '/health')).ok) break } catch {} await sleep(500) }
  b.pool = new pg.Pool({ connectionString: dbUrl(b), max: 3 })
}

/* ---------- API helpers (identical calls to both builds) ---------- */
async function j(b, method, p, body, cookie, headers = {}) {
  const r = await fetch(b.base + p, { method, headers: { 'content-type': 'application/json', origin: ORIGIN, ...(cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined })
  let data = null; try { data = await r.json() } catch {}
  return { status: r.status, data, cookie: (r.headers.get('set-cookie') || '').split(';')[0] }
}
const wallet = i => privateKeyToAccount(keccak256(toHex(`openfund-equivalence-wallet-${i}`)))
async function login(b, i) {
  const w = wallet(i)
  const n = (await j(b, 'POST', '/auth/nonce', { address: w.address })).data
  const message = createSiweMessage({ domain: 'localhost:5173', address: w.address, uri: ORIGIN + '/', chainId: 42161, nonce: n.nonce, version: '1' })
  return (await j(b, 'POST', '/auth/verify', { message, signature: await w.signMessage({ message }) })).cookie
}
const META = { EQA: { base: 'EQA', group: 'crypto', maxLeverage: 100 }, EQB: { base: 'EQB', group: 'crypto', maxLeverage: 100 } }
const prices = {}
async function price(sym, p) { prices[sym] = p; await Promise.all(builds.map(b => j(b, 'POST', '/internal/inject-price', { symbol: `${sym}/USD`, price: p, metadata: META[sym] }))) }
/* keep injected marks fresh (5 s staleness rule) while the engines settle */
async function settle(ms = 4000) {
  const end = Date.now() + ms
  while (Date.now() < end) { for (const [s, p] of Object.entries(prices)) await price(s, p); await sleep(700) }
}
/* run the same step on both builds; a step returns a JSON-able observation */
const observations = { reference: [], candidate: [] }
async function both(label, fn) {
  const out = await Promise.all(builds.map(b => fn(b)))
  builds.forEach((b, k) => observations[b.name].push({ step: label, result: out[k] }))
  return out
}
/* API responses: keep only stable, id-free fields */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g
const strip = v => JSON.parse(JSON.stringify(v ?? null, (k, x) =>
  /(^id$|_id$|^as_of$|_at$|^ts$|^order$|^position$|^since$|^day$|^parent_position_id$)/.test(k) && typeof x !== 'object' ? undefined
    : typeof x === 'string' ? x.replace(UUID, '<uuid>') : x))

/* ---------- the deterministic scenario ---------- */
async function scenario() {
  const S = {}   /* per build: cookies, position ids by label */
  for (const b of builds) S[b.name] = { c: {}, pos: {} }
  const U = 8
  await both('login', async b => { for (let i = 0; i < U; i++) S[b.name].c[i] = await login(b, i); return true })
  await price('EQA', '100'); await price('EQB', '2000')
  await settle(1500)

  const order = (b, i, body, key) => j(b, 'POST', '/trading/order', { product: 'prop', ...body }, S[b.name].c[i], key ? { 'idempotency-key': key } : {})
  const keep = (b, label, r) => { if (r.data?.position?.id) S[b.name].pos[label] = r.data.position.id; return { status: r.status, body: strip(r.data) } }

  await both('U0 long EQA 10x SL95 TP110', async b => keep(b, 'u0', await order(b, 0, { market: 'EQA/USD', side: 'long', order_type: 'market', margin: '1000', leverage: 10, sl: '95', tp: '110' }, 'u0-1')))
  await both('U0 idempotent retry', async b => ({ status: (await order(b, 0, { market: 'EQA/USD', side: 'long', order_type: 'market', margin: '1000', leverage: 10, sl: '95', tp: '110' }, 'u0-1')).status }))
  await both('U1 short EQA 10x SL104 TP90', async b => keep(b, 'u1', await order(b, 1, { market: 'EQA/USD', side: 'short', order_type: 'market', margin: '500', leverage: 10, sl: '104', tp: '90' }, 'u1-1')))
  await both('U2 limit long EQA @98', async b => keep(b, 'u2', await order(b, 2, { market: 'EQA/USD', side: 'long', order_type: 'limit', margin: '200', leverage: 5, target_price: '98' }, 'u2-1')))
  await both('U3 stop short EQB @1990', async b => keep(b, 'u3', await order(b, 3, { market: 'EQB/USD', side: 'short', order_type: 'stop', margin: '300', leverage: 10, target_price: '1990' }, 'u3-1')))
  await both('U4 long EQB 10x (liquidation candidate)', async b => keep(b, 'u4', await order(b, 4, { market: 'EQB/USD', side: 'long', order_type: 'market', margin: '900', leverage: 10 }, 'u4-1')))
  await both('U5 three longs EQA SL97 (same-tick SL)', async b => {
    const out = []
    for (let k = 0; k < 3; k++) out.push(keep(b, `u5-${k}`, await order(b, 5, { market: 'EQA/USD', side: 'long', order_type: 'market', margin: String(100 + k * 50), leverage: 10, sl: '97' }, `u5-${k}`)))
    return out
  })
  await both('U6 six concurrent orders on one account', async b => {
    const rs = await Promise.all(Array.from({ length: 6 }, (_, k) => order(b, 6, { market: 'EQB/USD', side: k % 2 ? 'short' : 'long', order_type: 'market', margin: String(50 + k * 10), leverage: 5 }, `u6-${k}`)))
    return rs.map(r => r.status).sort()
  })
  await both('U7 rejected order (insufficient margin)', async b => { const r = await order(b, 7, { market: 'EQA/USD', side: 'long', order_type: 'market', margin: '500000', leverage: 2 }, 'u7-1'); return { status: r.status, error: r.data?.error } })
  await settle()

  await both('U1 SL/TP edit on an open short', async b => {
    const r = await j(b, 'POST', `/trading/positions/${S[b.name].pos.u1}/protection`, { sl: '103', tp: '91' }, S[b.name].c[1]); return { status: r.status, body: strip(r.data) }
  })
  await both('U4 partial close 50%', async b => { const r = await j(b, 'POST', `/trading/positions/${S[b.name].pos.u4}/close`, { fraction: 0.5 }, S[b.name].c[4], { 'idempotency-key': 'u4-close-1' }); return { status: r.status, body: strip(r.data) } })
  await both('U4 partial close retry (idempotent)', async b => (await j(b, 'POST', `/trading/positions/${S[b.name].pos.u4}/close`, { fraction: 0.5 }, S[b.name].c[4], { 'idempotency-key': 'u4-close-1' })).status)

  /* price path: limit fill, same-tick SL on three positions, SL, TP, stop fill, liquidation */
  await price('EQA', '98'); await settle()
  await price('EQA', '96.5'); await settle()          /* U5 ×3 SL at 97 on one tick */
  await price('EQA', '94'); await settle()            /* U0 SL 95 */
  await price('EQA', '89'); await settle()            /* U1 TP 90 */
  await price('EQB', '1989'); await settle()          /* U3 stop short fills */
  await price('EQB', '1810'); await settle()          /* U4 remaining half liquidates (10x, >9% drop) */
  await price('EQB', '1820'); await settle(2500)

  /* Prop challenges: one breaches the max loss, one reaches its target */
  await both('challenges', async b => {
    const p = b.pool
    const plan = async (slug, cfg) => (await p.query(`INSERT INTO challenge_plans (slug,name,configuration) VALUES ($1,$1,$2) RETURNING id`,
      [slug, JSON.stringify({ accountSizesUsd: [5000], priceUsd: { 5000: 44 }, phases: 1, phase2TargetPct: null, drawdownMode: 'static', minTradingDays: 0, referenceLeverageX: 5, ...cfg })])).rows[0].id
    const out = []
    for (const [i, slug, cfg] of [[0, 'eq-breach', { phase1TargetPct: 50, dailyLossPct: 100, maxTotalLossPct: 2 }], [1, 'eq-pass', { phase1TargetPct: 1, dailyLossPct: 100, maxTotalLossPct: 50 }]]) {
      const uid = (await p.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [wallet(i).address.toLowerCase()])).rows[0].id
      const ch = (await p.query(`INSERT INTO openfund_challenges (user_id,challenge_plan_id,status,account_size_usd) VALUES ($1,$2,'created',5000) RETURNING *`, [uid, await plan(slug, cfg)])).rows[0]
      /* provision with the plan's rules exactly as purchase confirmation does
         (this build's own ChallengeService), then start through the API */
      const { ChallengeService } = await import(pathToFileURL(path.join(b.dir, 'apps/backend/evaluation.js')).href + `?${b.name}`)
      const plan_configuration = (await p.query('SELECT configuration FROM challenge_plans WHERE id=$1', [ch.challenge_plan_id])).rows[0].configuration
      const client = await p.connect()
      try { await client.query('BEGIN'); await new ChallengeService(client).provisionTx(client, { ...ch, plan_configuration }); await client.query('COMMIT') }
      catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
      const st = await j(b, 'POST', `/challenges/${ch.id}/start`, {}, S[b.name].c[i])
      const acc = st.data?.challenge?.accountId
      S[b.name][`ch${i}`] = acc
      const r = await j(b, 'POST', `/trading/order?account=${acc}`, { product: 'prop', accountId: acc, market: 'EQA/USD', side: i ? 'long' : 'short', order_type: 'market', margin: '1000', leverage: 5 }, S[b.name].c[i], { 'idempotency-key': `ch-${i}` })
      out.push({ start: st.status, order: r.status, err: r.data?.error ?? null })
    }
    return out
  })
  await settle(2500)
  await price('EQA', '92'); await settle(5000)        /* short loses → breach; long gains → target */
  await both('U1 closes its challenge position in profit (target on realized balance)', async b => {
    const acc = S[b.name].ch1
    const st = (await j(b, 'GET', `/trading/state?account=${acc}`, null, S[b.name].c[1])).data
    const pos = st?.positions?.[0]
    if (!pos) return { open: 0, status: st?.account?.status ?? null }
    const r = await j(b, 'POST', `/trading/positions/${pos.id}/close`, {}, S[b.name].c[1], { 'idempotency-key': 'ch1-close' })
    return { status: r.status, body: strip(r.data) }
  })
  await settle(4000)

  /* streams: first snapshot equals /trading/state on the same build */
  await both('stream first snapshot = state', async b => {
    const res = []
    for (const i of [2, 3, 6]) {
      const ctl = new AbortController()
      const r = await fetch(b.base + '/trading/stream', { headers: { cookie: S[b.name].c[i], origin: ORIGIN }, signal: ctl.signal })
      const reader = r.body.getReader(); let buf = ''
      while (!buf.includes('\ndata: ') && !buf.startsWith('data: ')) { const { value, done } = await reader.read(); if (done) break; buf += new TextDecoder().decode(value) }
      ctl.abort()
      const snap = JSON.parse(buf.split('data: ')[1].split('\n\n')[0])
      const st = (await j(b, 'GET', '/trading/state', null, S[b.name].c[i])).data
      const norm = s => JSON.stringify(strip({ ...s, account: { ...s.account, risk: undefined } }))
      res.push(norm(snap) === norm(st))
    }
    return res
  })
}

/* ---------- normalized financial state ---------- */
async function dump(b) {
  const q = async (sql, params = []) => (await b.pool.query(sql, params)).rows
  const users = await q(`SELECT id, wallet_address FROM openfund_users`)
  const idx = new Map(); for (let i = 0; i < 16; i++) idx.set(wallet(i).address.toLowerCase(), i)
  const out = {}
  for (const u of users) {
    const i = idx.get(u.wallet_address); if (i == null) continue
    const accounts = await q(`SELECT id, account_type, status, balance, used_margin, realized_pnl, disable_reason FROM demo_accounts WHERE user_id=$1 ORDER BY account_type, created_at`, [u.id])
    out[i] = { accounts: [] }
    for (const a of accounts) {
      out[i].accounts.push({
        type: a.account_type, status: a.status, balance: a.balance, used_margin: a.used_margin, realized_pnl: a.realized_pnl, disable_reason: a.disable_reason,
        positions: await q(`SELECT market, side, quantity, entry_price, margin, leverage, sl_price, tp_price, status, exit_price, exit_reason, open_fee, close_fee, realized_pnl, (parent_position_id IS NOT NULL) AS partial
                              FROM trading_positions WHERE account_id=$1 ORDER BY market, side, margin, entry_price, status`, [a.id]),
        orders: await q(`SELECT market, side, order_type, margin, leverage, target_price, sl_price, tp_price, status, reject_reason FROM trading_orders WHERE account_id=$1 ORDER BY market, side, margin, order_type, status`, [a.id]),
        /* concurrent submissions on one account may commit in either order, so
           the ledger is compared as its multiset of entries, its final balance
           and the internal consistency of its balance_after chain */
        ledger: (rows => ({
          entries: rows.map(r => `${r.event} ${r.amount}`).sort(),
          final: rows.at(-1)?.balance_after ?? null,
          chainConsistent: rows.every((r, k) => k === 0 ? r.amount === r.balance_after || r.event !== 'demo_funding'
            : Math.abs(Number(rows[k - 1].balance_after) + Number(r.amount) - Number(r.balance_after)) < 1e-9),
        }))(await q(`SELECT event, amount, balance_after FROM trading_ledger WHERE account_id=$1 ORDER BY id`, [a.id])),
        events: (await q(`SELECT kind FROM trading_events WHERE account_id=$1 ORDER BY kind`, [a.id])).map(e => e.kind),
        equity_risk: await q(`SELECT day_start_equity, peak_equity, maximum_drawdown, daily_drawdown, last_equity FROM account_equity_risk WHERE account_id=$1`, [a.id]),
      })
    }
    out[i].challenges = await q(`SELECT c.status, c.stage, c.account_size_usd, p.slug, (SELECT array_agg(kind ORDER BY kind) FROM challenge_events e WHERE e.challenge_id=c.id) AS events,
                                        (SELECT json_agg(json_build_object('basis',d.basis,'peak',d.peak_equity,'start',d.day_start_equity) ORDER BY d.day) FROM challenge_equity_days d WHERE d.challenge_id=c.id) AS days
                                   FROM openfund_challenges c JOIN challenge_plans p ON p.id=c.challenge_plan_id WHERE c.user_id=$1 ORDER BY p.slug, c.stage`, [u.id])
  }
  return out
}

function diff(a, b, at = '$', out = []) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${at}.${k}`, out)
  } else out.push({ at, reference: a, candidate: b })
  return out
}

let code = 2
try {
  for (const b of builds) await prepare(b)
  await scenario()
  const [ref, cand] = await Promise.all(builds.map(dump))
  const differences = [...diff(observations.reference, observations.candidate, '$.api'), ...diff(ref, cand, '$.db')]
  const chainBroken = [ref, cand].flatMap((d, k) => Object.entries(d).flatMap(([i, u]) => u.accounts.filter(x => !x.ledger.chainConsistent).map(x => `${builds[k].name} U${i} ${x.type}`)))
  if (chainBroken.length) differences.push({ at: '$.db.ledger.chainConsistent', reference: chainBroken, candidate: chainBroken })
  const streamOk = observations.candidate.concat(observations.reference).filter(o => o.step.startsWith('stream')).every(o => o.result.every(Boolean))
  const positions = Object.values(ref).flatMap(u => u.accounts.flatMap(a => a.positions))
  const summary = {
    equivalent: differences.length === 0 && streamOk, differences, streamSnapshotMatchesState: streamOk,
    coverage: { users: Object.keys(ref).length, positions: positions.length, exitReasons: [...new Set(positions.map(p => p.exit_reason).filter(Boolean))].sort(),
      challengeOutcomes: Object.values(ref).flatMap(u => u.challenges.map(c => `${c.slug}:${c.status}`)).sort() },
    observations, reference: ref,
  }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify({ equivalent: summary.equivalent, differences: differences.slice(0, 20), streamSnapshotMatchesState: streamOk, coverage: summary.coverage }, null, 2))
  code = summary.equivalent ? 0 : 1
} catch (e) { console.error('[equivalence] harness failure', e) }
finally {
  for (const b of builds) { try { await b.pool?.end() } catch {} try { b.proc?.kill('SIGTERM') } catch {} }
  setTimeout(() => process.exit(code), 1500)
}
