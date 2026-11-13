/**
 * Multi-tab stream check against a running backend: W wallets × T tabs each
 * hold /trading/stream for D seconds (tabs open 0.5 s apart). Reports
 *   - per-wallet isolation: every payload's account id belongs to that wallet
 *   - tab consistency: tabs of one wallet receive identical payloads for the
 *     same as_of
 *   - state() executions per second during the window (pg_stat_statements
 *     count of the pending-orders read, which only engine.state() issues),
 *     minus the rate measured for 10 s before any stream opened
 * Usage: node harness/multitab.mjs [wallets=50] [tabs=3] [seconds=30]
 */
import fs from 'node:fs'
import http from 'node:http'
import pg from 'pg'

const [W, T, D] = [Number(process.argv[2] || 50), Number(process.argv[3] || 3), Number(process.argv[4] || 30)]
const TARGET = new URL(process.env.TARGET || 'http://127.0.0.1:18080')
const users = JSON.parse(fs.readFileSync(new URL('../results/users.json', import.meta.url), 'utf8')).slice(0, W)
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect()
const accountOf = new Map((await db.query(`SELECT u.id, a.id AS account FROM openfund_users u JOIN demo_accounts a ON a.user_id=u.id AND a.account_type='free_demo' WHERE u.id = ANY($1)`, [users.map(u => u.userId)])).rows.map(r => [r.id, r.account]))
const stateCalls = async () => Number((await db.query(`SELECT COALESCE(sum(calls),0)::bigint c FROM pg_stat_statements WHERE query LIKE 'SELECT * FROM trading_orders WHERE account_id=$1 AND status=$2 ORDER BY created_at DESC%'`)).rows[0].c)

const seen = new Map()   /* wallet → Map(as_of → payload hash) */
let payloads = 0, crossWallet = 0, mismatched = 0, drops = 0
const reqs = []
function open(u) {
  const req = http.get({ host: TARGET.hostname, port: TARGET.port, path: '/trading/stream', headers: { cookie: u.cookie, 'x-forwarded-for': u.xff, origin: TARGET.origin } }, res => {
    let buf = ''
    res.on('data', c => {
      buf += c
      let i
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const ev = buf.slice(0, i); buf = buf.slice(i + 2)
        if (!ev.startsWith('data: ')) continue
        const raw = ev.slice(6), s = JSON.parse(raw); payloads++
        if (s.account?.id && s.account.id !== accountOf.get(u.userId)) crossWallet++
        const m = seen.get(u.userId) || new Map(); seen.set(u.userId, m)
        if (m.has(s.as_of) && m.get(s.as_of) !== raw) mismatched++
        m.set(s.as_of, raw)
      }
    })
    res.on('end', () => { if (!stopping) drops++ })
  })
  req.on('error', () => { if (!stopping) drops++ })
  reqs.push(req)
}
let stopping = false
/* background state() rate (engine loop of builds that call state() there) */
const i0 = await stateCalls(), it0 = Date.now(); await new Promise(r => setTimeout(r, 10000))
const idleRate = (await stateCalls() - i0) / ((Date.now() - it0) / 1000)
for (let t = 0; t < T; t++) { for (const u of users) open(u); await new Promise(r => setTimeout(r, 500)) }
await new Promise(r => setTimeout(r, 3000))
const c0 = await stateCalls(), t0 = Date.now()
await new Promise(r => setTimeout(r, D * 1000))
const c1 = await stateCalls(), t1 = Date.now()
stopping = true; for (const r of reqs) r.destroy()
const out = { wallets: W, tabsPerWallet: T, streams: W * T, seconds: D, payloads, crossWallet, mismatchedTabs: mismatched, drops,
  backgroundStateCallsPerSecond: +idleRate.toFixed(1), stateCallsPerSecond: +((c1 - c0) / ((t1 - t0) / 1000)).toFixed(1),
  streamStateCallsPerWalletPerSecond: +(((c1 - c0) / ((t1 - t0) / 1000) - idleRate) / W).toFixed(2) }
console.log(JSON.stringify(out)); await db.end(); process.exit(0)
