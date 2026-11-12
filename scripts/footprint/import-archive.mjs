#!/usr/bin/env node
/**
 * Import Hyperliquid archive fills into the footprint store.
 *
 *   node scripts/footprint/import-archive.mjs --from 2026-11-01T00:00Z --to 2026-11-02T00:00Z \
 *     [--apply] <decompressed node_fills_by_block files...>
 *
 * The files come from the requester-pays bucket s3://hl-mainnet-node-data/node_fills_by_block
 * (downloaded and `lz4 -d` decompressed by the owner; see docs/integrations/FOOTPRINT.md).
 * Without --apply nothing is written: the run reports what it would import and
 * every completeness problem. With --apply it writes to FOOTPRINT_DATABASE_URL,
 * else DATABASE_URL, in one transaction, and only when no problem was found.
 * Market precision comes from the live Hyperliquid meta and the same
 * verification the footprint service uses; unsupported markets are skipped.
 */
import { createReadStream } from 'node:fs'
import readline from 'node:readline'
import pg from '../../apps/backend/node_modules/pg/lib/index.js'
import { ArchiveImport, writeImport } from '../../apps/backend/footprint/archive.js'
import { loadCalibration, footprintConfig } from '../../apps/backend/footprint/service.js'
import { CANDIDATE_MARKETS, verifyMarket } from '../../packages/openfund-footprint/src/markets.mjs'

const args = { files: [] }
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a === '--apply') args.apply = true
  else if (a === '--from' || a === '--to') args[a.slice(2)] = process.argv[++i]
  else args.files.push(a)
}
const ms = (s) => { const t = Date.parse(s || ''); if (!Number.isFinite(t)) throw new Error(`invalid time: ${s}`); return t }
const from = ms(args.from), to = ms(args.to)
if (!args.files.length) throw new Error('no archive files given')
for (const f of args.files) if (/\.lz4$/i.test(f)) throw new Error(`${f} is compressed: run "lz4 -d" first`)

const env = process.env
const cfg = footprintConfig(env)
const retentionFloor = Date.now() - cfg.retentionDays * 86_400_000
if (from < retentionFloor) throw new Error(`--from is older than FOOTPRINT_RETENTION_DAYS (${cfg.retentionDays}); the service would prune it`)

const calibration = loadCalibration()
const specs = new Map()
for (const dex of [...new Set(CANDIDATE_MARKETS.map(m => m.dex))]) {
  const r = await fetch(cfg.infoUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(dex ? { type: 'meta', dex } : { type: 'meta' }), signal: AbortSignal.timeout(10_000) })
  if (!r.ok) throw new Error('Hyperliquid meta unavailable')
  const universe = (await r.json())?.universe || []
  for (const c of CANDIDATE_MARKETS.filter(m => m.dex === dex)) {
    const rec = verifyMarket(c, universe, calibration.markets?.[c.gains])
    if (rec.status === 'supported') specs.set(c.coin, { coin: c.coin, priceDecimals: rec.priceDecimals, szDecimals: rec.szDecimals })
    else console.log(`skip ${c.gains} (${c.coin}): ${rec.reasons.join(', ')}`)
  }
}

const imp = new ArchiveImport({ specs, from, to })
for (const f of args.files) {
  const rl = readline.createInterface({ input: createReadStream(f), crlfDelay: Infinity })
  for await (const line of rl) imp.addLine(line)
}
console.log(JSON.stringify({ window: { from: new Date(from).toISOString(), to: new Date(to).toISOString() }, markets: [...specs.keys()], stats: imp.stats }, null, 2))
const problems = imp.problems()
for (const p of problems) console.log(`PROBLEM ${p}`)
if (problems.length) { console.log('Nothing written.'); process.exit(2) }
if (!args.apply) { console.log('Dry run: re-run with --apply to write.'); process.exit(0) }

const url = cfg.databaseUrl || env.DATABASE_URL
if (!url) throw new Error('FOOTPRINT_DATABASE_URL or DATABASE_URL is required with --apply')
const pool = new pg.Pool({ connectionString: url, max: 1 })
try { console.log(JSON.stringify(await writeImport(pool, imp))) } finally { await pool.end() }
