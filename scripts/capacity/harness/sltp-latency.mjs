/**
 * SL/TP execution delay for LT/USD positions closed during a run window.
 * LT/USD follows a known sawtooth (mock-gains.mjs):
 *   price(t) = 1000 + ((t - T0) mod 600000) / 1000   (rises 1 USD/s, resets every 10 min)
 * so the exact instant the mark crossed a stop/target is computable:
 *   level crossed while rising (long TP, short SL): t = cycleStart + (level - 1000) * 1000
 *   level crossed at the reset drop (long SL, short TP): t = cycleStart (wrap)
 * delay = closed_at − crossing. Measures engine-loop responsiveness under load.
 * Usage: node sltp-latency.mjs <runDir> <fromMs> <toMs>
 */
import fs from 'node:fs'
import pg from 'pg'
const [RUN, FROM, TO] = process.argv.slice(2)
const T0 = Number(process.env.MOCK_T0 || 1794000000000), P = 600000
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect()
const { rows } = await db.query(`SELECT side, exit_reason, sl_price::float sl, tp_price::float tp, (extract(epoch from closed_at)*1000)::float closed
  FROM trading_positions WHERE market='LT/USD' AND exit_reason IN ('sl','tp') AND closed_at BETWEEN to_timestamp($1/1000.0) AND to_timestamp($2/1000.0)`, [Number(FROM), Number(TO)])
await db.end()
const out = []
for (const r of rows) {
  const cycleStart = r.closed - (((r.closed - T0) % P) + P) % P
  const level = r.exit_reason === 'sl' ? r.sl : r.tp
  const rising = (r.side === 'long' && r.exit_reason === 'tp') || (r.side === 'short' && r.exit_reason === 'sl')
  let cross = rising ? cycleStart + (level - 1000) * 1000 : cycleStart
  if (cross > r.closed) cross -= P   /* crossed in the previous cycle */
  out.push({ side: r.side, reason: r.exit_reason, delayMs: Math.round(r.closed - cross), closed: r.closed })
}
const d = out.map(o => o.delayMs).sort((a, b) => a - b)
const q = x => d.length ? d[Math.min(d.length - 1, Math.floor(x * d.length))] : null
const res = { n: d.length, p50: q(.5), p95: q(.95), p99: q(.99), max: d.at(-1) ?? null, samples: out }
fs.writeFileSync(`${RUN}/sltp-latency.json`, JSON.stringify(res))
console.log(JSON.stringify({ ...res, samples: undefined }))
