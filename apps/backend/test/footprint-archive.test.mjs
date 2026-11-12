/**
 * Footprint archive importer: parsing, aggressor selection, deduplication,
 * completeness checks and the transactional write.
 *
 * Inputs are hand-built lines in the documented node_fills_by_block shape
 * (test inputs, not market data). The Postgres part runs only against an
 * isolated test DATABASE_URL.
 * Run: node --test test/footprint-archive.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { ArchiveImport, parseBlockLine, blockTimeMs, writeImport } from '../footprint/archive.js'

const H = Date.UTC(2026, 10, 12, 10, 0, 0)   /* window start, on an hour */
const spec = { coin: 'BTC', priceDecimals: 1, szDecimals: 5 }
const specs = new Map([['BTC', spec]])
const iso = (t) => new Date(t).toISOString().replace('Z', '') + '123456'
const fill = (o) => ({ coin: 'BTC', px: '100000.0', sz: '0.00100', side: 'B', time: H + 1000, tid: 1, crossed: true, hash: '0xh', fee: '0.1', closedPnl: '0', ...o })
const block = (t, events) => JSON.stringify({ local_time: iso(t), block_time: iso(t), block_number: 1, events })
/* one executed trade = a taker fill and a maker fill sharing tid */
const tradePair = (o) => [['0xtaker', fill(o)], ['0xmaker', fill({ ...o, side: o.side === 'A' ? 'B' : 'A', crossed: false })]]

test('block_time with nanoseconds parses to the millisecond, malformed values do not', () => {
  assert.equal(blockTimeMs('2026-11-12T10:00:01.123456789'), H + 1123)
  assert.equal(blockTimeMs('2026-11-12T10:00:01'), H + 1000)
  assert.ok(Number.isNaN(blockTimeMs('yesterday')))
  assert.ok(Number.isNaN(blockTimeMs(undefined)))
})

test('only the taker fill is kept; its side is the aggressor; user, hash and fee are discarded', () => {
  const p = parseBlockLine(block(H + 1000, tradePair({ side: 'A', tid: 7 })))
  assert.equal(p.ok, true)
  assert.equal(p.fills, 2)
  assert.deepEqual(p.takers, [{ coin: 'BTC', px: '100000.0', sz: '0.00100', side: 'A', time: H + 1000, tid: 7 }])
  assert.ok(!JSON.stringify(p).includes('0xtaker') && !JSON.stringify(p).includes('0xh'))
})

test('a fill without the crossed flag makes the line malformed (format drift fails closed)', () => {
  const { crossed, ...noFlag } = fill({})
  void crossed
  assert.equal(parseBlockLine(block(H, [['0xu', noFlag]])).ok, false)
  assert.equal(parseBlockLine('{not json').ok, false)
  assert.equal(parseBlockLine(JSON.stringify({ events: [] })).ok, false)
})

test('aggregation matches the live minute book: per level bid/ask lots and counts, duplicates ignored', () => {
  const imp = new ArchiveImport({ specs, from: H, to: H + 3_600_000 })
  imp.addLine(block(H + 1000, [...tradePair({ side: 'B', tid: 1 }), ...tradePair({ side: 'A', tid: 2, sz: '0.00200' })]))
  imp.addLine(block(H + 1000, tradePair({ side: 'B', tid: 1 })))                 /* the same trade again */
  imp.addLine(block(H + 61_000, tradePair({ side: 'B', tid: 3, time: H + 61_000, px: '100001.0' })))
  imp.addLine(block(H + 2000, [['0xu', fill({ coin: 'DOGE', tid: 9 })]]))       /* not a supported market */
  const s = [...imp.slices()]
  assert.equal(s.length, 2)
  assert.deepEqual(s[0].slice.levels, [[1000000, 200, 100, 1, 1]])
  assert.equal(s[0].slice.n, 2)
  assert.deepEqual(s[1].slice.levels, [[1000010, 0, 100, 0, 1]])
  assert.equal(imp.stats.duplicates, 1)
  assert.equal(imp.stats.untracked, 1)
})

test('completeness: a missing hour, malformed lines and trades outside the window are reported', () => {
  const imp = new ArchiveImport({ specs, from: H, to: H + 2 * 3_600_000 })
  imp.addLine(block(H + 1000, tradePair({ tid: 1 })))
  imp.addLine(block(H + 5000, tradePair({ tid: 2, time: H - 1000 })))           /* before the window */
  imp.addLine('garbage')
  const p = imp.problems().join('\n')
  assert.match(p, /1 malformed line/)
  assert.match(p, /no blocks for 1 hour/)
  assert.equal(imp.stats.outside, 1)
  const ok = new ArchiveImport({ specs, from: H, to: H + 3_600_000 })
  ok.addLine(block(H + 1000, tradePair({ tid: 1 })))
  assert.deepEqual(ok.problems(), [])
})

test('the window must be minute-aligned and markets must be supplied', () => {
  assert.throws(() => new ArchiveImport({ specs, from: H + 1, to: H + 60_000 }), /minute-aligned/)
  assert.throws(() => new ArchiveImport({ specs: new Map(), from: H, to: H + 60_000 }), /no supported markets/)
})

test('the importer imports nothing from trading, accounts, payments or auth', () => {
  const src = readFileSync(new URL('../footprint/archive.js', import.meta.url), 'utf8')
  const imports = [...src.matchAll(/^import .* from '([^']+)'/gm)].map(m => m[1])
  assert.deepEqual(imports, ['../../../packages/openfund-footprint/src/core.mjs'])
})

const dbUrl = process.env.DATABASE_URL || ''
test('write: complete archive minutes replace partial live rows, keep full live rows, and trim gaps (isolated test DB only)', { skip: !/test|_ci/.test(dbUrl) && 'no isolated test DATABASE_URL' }, async () => {
  const pool = new pg.Pool({ connectionString: dbUrl })
  const coin = 'TESTARC'
  const s = { coin, priceDecimals: 1, szDecimals: 5 }
  try {
    await pool.query(readFileSync(new URL('../footprint/schema.sql', import.meta.url), 'utf8'))
    await pool.query('DELETE FROM footprint_minutes WHERE coin = $1', [coin])
    await pool.query('DELETE FROM footprint_gaps WHERE coin = $1', [coin])
    const live = (t, levels) => pool.query(
      `INSERT INTO footprint_minutes (coin, minute, price_decimals, size_decimals, levels, last_pu, last_time, trades) VALUES ($1,$2,1,5,$3::jsonb,1,$4,1)`,
      [coin, t, JSON.stringify(levels), t + 1])
    /* recording started at H+30 min (gap from the beginning of time); minute H+30 is partial live,
       minute H+40 is complete live; a restart gap lies after the window */
    await pool.query('INSERT INTO footprint_gaps (coin, from_ms, to_ms, reason) VALUES ($1, NULL, $2, $3)', [coin, H + 30 * 60_000 + 30_000, 'coverage_start'])
    await pool.query('INSERT INTO footprint_gaps (coin, from_ms, to_ms, reason) VALUES ($1, $2, $3, $4)', [coin, H + 70 * 60_000, H + 75 * 60_000, 'restart'])
    await live(H + 30 * 60_000, [[1, 0, 9, 0, 1]])
    await live(H + 40 * 60_000, [[1, 0, 5, 0, 1]])

    const imp = new ArchiveImport({ specs: new Map([[coin, s]]), from: H, to: H + 3_600_000 })
    const at = (min, tid, side = 'B') => block(H + min * 60_000 + 1000, tradePair({ coin, tid, side, time: H + min * 60_000 + 1000 }))
    for (const [min, tid] of [[0, 1], [30, 2], [40, 3], [59, 4]]) imp.addLine(at(min, tid))
    assert.deepEqual(imp.problems(), [])
    const r = await writeImport(pool, imp)
    assert.deepEqual(r, { written: 3, skipped: 1, gapsTrimmed: 1 })

    const rows = new Map((await pool.query('SELECT minute, levels, source FROM footprint_minutes WHERE coin = $1', [coin])).rows.map(x => [Number(x.minute), x]))
    assert.equal(rows.get(H).source, 'archive')
    assert.equal(rows.get(H + 30 * 60_000).source, 'archive', 'partial live minute replaced')
    assert.deepEqual(rows.get(H + 40 * 60_000).levels, [[1, 0, 5, 0, 1]], 'complete live minute kept')
    assert.equal(rows.get(H + 40 * 60_000).source, 'live')
    const gaps = (await pool.query('SELECT from_ms, to_ms, reason FROM footprint_gaps WHERE coin = $1 ORDER BY to_ms', [coin])).rows
      .map(g => [g.from_ms == null ? null : Number(g.from_ms), Number(g.to_ms), g.reason])
    assert.deepEqual(gaps, [[null, H, 'coverage_start'], [H + 70 * 60_000, H + 75 * 60_000, 'restart']])
  } finally {
    await pool.query('DELETE FROM footprint_minutes WHERE coin = $1', [coin]).catch(() => {})
    await pool.query('DELETE FROM footprint_gaps WHERE coin = $1', [coin]).catch(() => {})
    await pool.end()
  }
})
