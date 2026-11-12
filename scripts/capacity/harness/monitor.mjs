/**
 * Resource monitor + automatic stop conditions for one capacity run.
 * Every 2 s writes JSONL ($RUN/monitor.jsonl):
 *   backend, PostgreSQL (all server processes), load generators: CPU % and RSS (ps)
 *   PostgreSQL: connections by state, lock waits, ungranted locks, commits/rollbacks/s,
 *               deadlocks, temp files, longest running query
 *   backend in-process metrics are written by preload.mjs (backend-metrics.jsonl)
 * Stop conditions (writes $RUN/STOP with the reason and SIGINTs the generators):
 *   - database connections ≥ max_connections − 3 for 10 s     (exhaustion)
 *   - backend process gone                                    (instability)
 *   - backend event-loop p99 > 2000 ms for 30 s               (severe saturation)
 *   - pg pool waiting > 200 for 30 s                          (severe saturation)
 *   - integrity flag file written by integrity checks         (data integrity)
 * Error-rate stop conditions live in k6 (abortOnFail thresholds).
 * Usage: node monitor.mjs <runDir> <backendPid> [generatorPid...]
 */
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import pg from 'pg'

const [RUN, BPID, ...GEN] = process.argv.slice(2)
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
const maxConn = Number((await db.query('show max_connections')).rows[0].max_connections)
const out = fs.createWriteStream(`${RUN}/monitor.jsonl`, { flags: 'a' })
let prev = null
const strikes = { conn: 0, eld: 0, wait: 0 }

function ps(pids) {
  if (!pids.length) return { cpu: 0, rssMB: 0 }
  try {
    const o = execFileSync('ps', ['-o', '%cpu=,rss=', '-p', pids.join(',')], { encoding: 'utf8' })
    return o.trim().split('\n').filter(Boolean).reduce((a, l) => { const [c, r] = l.trim().split(/\s+/).map(Number); return { cpu: +(a.cpu + c).toFixed(1), rssMB: +(a.rssMB + r / 1024).toFixed(1) } }, { cpu: 0, rssMB: 0 })
  } catch { return null }
}
const pgPids = () => { try { return execFileSync('pgrep', ['-f', 'postgres'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean) } catch { return [] } }
const pgClusterPids = () => { try { const pm = fs.readFileSync(process.env.PGDATA_PID || '/dev/null', 'utf8').split('\n')[0]; return execFileSync('pgrep', ['-P', pm], { encoding: 'utf8' }).trim().split('\n').concat(pm).filter(Boolean) } catch { return pgPids() } }
const lastEld = () => { try { const l = fs.readFileSync(`${RUN}/backend-metrics.jsonl`, 'utf8').trim().split('\n').at(-1); return JSON.parse(l) } catch { return null } }
function stop(reason) {
  if (fs.existsSync(`${RUN}/STOP`)) return
  fs.writeFileSync(`${RUN}/STOP`, JSON.stringify({ t: Date.now(), reason, last: prev }) + '\n')
  console.error(`[monitor] STOP: ${reason}`)
  for (const p of GEN) { try { process.kill(Number(p), 'SIGINT') } catch {} }
}

setInterval(async () => {
  try {
    const t = Date.now()
    const act = (await db.query(`SELECT state, wait_event_type, count(*)::int n, max(EXTRACT(EPOCH FROM now()-query_start))::float longest
                                   FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() GROUP BY 1,2`)).rows
    const all = (await db.query(`SELECT count(*)::int n FROM pg_stat_activity`)).rows[0].n
    const locks = (await db.query(`SELECT count(*)::int n FROM pg_locks WHERE NOT granted`)).rows[0].n
    const st = (await db.query(`SELECT xact_commit::bigint c, xact_rollback::bigint r, deadlocks::int d, temp_files::int tf, tup_returned::bigint tr, tup_fetched::bigint tfch, tup_inserted::bigint ti, tup_updated::bigint tu, blks_hit::bigint bh, blks_read::bigint br
                                  FROM pg_stat_database WHERE datname=current_database()`)).rows[0]
    const loopCalls = Number((await db.query(`SELECT COALESCE(sum(calls),0)::bigint c FROM pg_stat_statements WHERE query LIKE 'SELECT a.user_id FROM demo_accounts a WHERE a.account_type=%'`)).rows[0].c)
    const dt = prev ? (t - prev.t) / 1000 : null
    const rate = k => prev && dt ? Math.round((Number(st[k]) - Number(prev.raw[k])) / dt) : null
    const backend = ps([BPID])
    const rec = {
      t, connections: { total: all, max: maxConn, byState: Object.fromEntries(act.map(a => [`${a.state}${a.wait_event_type ? ':' + a.wait_event_type : ''}`, a.n])), longestQueryS: Math.max(0, ...act.filter(a => a.state === 'active').map(a => a.longest || 0)) },
      lockWaits: act.filter(a => a.wait_event_type === 'Lock').reduce((a, x) => a + x.n, 0), ungrantedLocks: locks,
      engineLoopPassesPs: prev && dt ? +((loopCalls - prev.loopCalls) / dt).toFixed(2) : null,
      tps: rate('c'), rollbacksPs: rate('r'), deadlocks: st.d, tempFiles: st.tf, tupReturnedPs: rate('tr'), tupInsertedPs: rate('ti'), tupUpdatedPs: rate('tu'),
      cacheHit: prev ? +(1 - (Number(st.br) - Number(prev.raw.br)) / Math.max(1, (Number(st.bh) - Number(prev.raw.bh)) + (Number(st.br) - Number(prev.raw.br)))).toFixed(4) : null,
      cpu: { backend: backend?.cpu ?? null, backendRssMB: backend?.rssMB ?? null, postgres: ps(pgClusterPids()).cpu, generators: ps(GEN).cpu, generatorsRssMB: ps(GEN).rssMB },
    }
    out.write(JSON.stringify(rec) + '\n')
    prev = { ...rec, raw: st, loopCalls }
    /* stop conditions */
    if (!backend || backend.cpu == null) return stop('backend process exited')
    strikes.conn = all >= maxConn - 3 ? strikes.conn + 1 : 0
    if (strikes.conn >= 5) stop(`database connections exhausted (${all}/${maxConn})`)
    const b = lastEld()
    strikes.eld = b && b.eld.p99 > 2000 ? strikes.eld + 1 : 0
    if (strikes.eld >= 15) stop(`backend event-loop p99 ${b.eld.p99} ms for 30 s`)
    strikes.wait = b?.pool && b.pool.waiting > 200 ? strikes.wait + 1 : 0
    if (strikes.wait >= 15 && process.env.MON_POOL_STOP !== "0") stop(`pg pool queue ${b.pool.waiting} waiting for 30 s`)
    if (fs.existsSync(`${RUN}/INTEGRITY_FAIL`)) stop('data-integrity violation')
  } catch (e) { console.error('[monitor]', e.message) }
}, 2000)
process.on('SIGINT', async () => { out.end(); await db.end().catch(() => {}); process.exit(0) })
process.on('SIGTERM', async () => { out.end(); await db.end().catch(() => {}); process.exit(0) })
