/**
 * Footprint archive import (Hyperliquid `node_fills_by_block`).
 *
 * Turns decompressed archive lines into the SAME footprint_minutes rows the
 * live feed writes: trades go through normalizeTrade and MinuteBook, so the
 * aggressor rule, unit conversion and (time, tid) deduplication are shared
 * with live ingestion. Nothing is synthesized, shifted or interpolated.
 *
 * Expected line shape (Hyperliquid node output; to be confirmed against real
 * archive files before the first production import, see FOOTPRINT.md):
 *   { "block_time": "2026-11-01T00:00:00.123456789", "block_number": n,
 *     "events": [[ "<user>", { coin, px, sz, side, time, tid, crossed, ... } ], ...] }
 * Every executed trade appears once per side. Only the taker fill
 * (`crossed === true`) is kept; its `side` is the aggressor side, the same
 * meaning as WsTrade.side on the live feed. User addresses, hashes, fees and
 * PnL are never read into the output.
 *
 * Isolation: chart analytics only. Imports nothing from the engine, accounts,
 * payments or authentication.
 */
import { MinuteBook, normalizeTrade, MINUTE_MS } from '../../../packages/openfund-footprint/src/core.mjs'

const HOUR_MS = 3_600_000

/** block_time ("YYYY-MM-DDTHH:MM:SS.fffffffff", UTC, no zone) → epoch ms, or NaN */
export function blockTimeMs(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/.test(s)) return NaN
  const [main, frac = ''] = s.replace(/Z$/, '').split('.')
  return Date.parse(`${main}.${(frac + '000').slice(0, 3)}Z`)
}

/**
 * Parse one archive line. Returns { ok: false } for a malformed line (the
 * caller aborts the import), otherwise the block time and its taker fills.
 */
export function parseBlockLine(line) {
  let b
  try { b = JSON.parse(line) } catch { return { ok: false } }
  const blockTime = blockTimeMs(b?.block_time)
  if (!b || !Array.isArray(b.events) || !Number.isFinite(blockTime)) return { ok: false }
  const takers = []
  let fills = 0
  for (const ev of b.events) {
    const fill = Array.isArray(ev) && ev.length >= 2 ? ev[1] : null
    if (!fill || typeof fill !== 'object' || typeof fill.crossed !== 'boolean') return { ok: false }
    fills++
    if (!fill.crossed) continue
    /* only the public trade fields; the user address in ev[0] is discarded */
    takers.push({ coin: fill.coin, px: fill.px, sz: fill.sz, side: fill.side, time: fill.time, tid: fill.tid })
  }
  return { ok: true, blockTime, fills, takers }
}

/**
 * Accumulates archive lines for a fixed, minute-aligned window [from, to).
 * `specs`: Map coin → { coin, priceDecimals, szDecimals } of SUPPORTED markets
 * (the same verification the live service uses).
 */
export class ArchiveImport {
  constructor({ specs, from, to }) {
    if (!(specs instanceof Map) || !specs.size) throw new Error('no supported markets')
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from % MINUTE_MS || to % MINUTE_MS || to <= from) throw new Error('window must be minute-aligned with to > from')
    this.specs = specs; this.from = from; this.to = to
    /* retention is irrelevant here: the book holds the whole window */
    this.books = new Map([...specs.keys()].map(c => [c, new MinuteBook({ retainMinutes: Number.MAX_SAFE_INTEGER })]))
    this.hours = new Set()
    this.stats = { lines: 0, malformed: 0, fills: 0, takers: 0, accepted: 0, rejected: 0, duplicates: 0, outside: 0, untracked: 0 }
  }

  addLine(line) {
    if (!line || !line.trim()) return
    this.stats.lines++
    const p = parseBlockLine(line)
    if (!p.ok) { this.stats.malformed++; return }
    this.hours.add(Math.floor(p.blockTime / HOUR_MS) * HOUR_MS)
    this.stats.fills += p.fills
    for (const raw of p.takers) {
      this.stats.takers++
      const spec = this.specs.get(raw.coin)
      if (!spec) { this.stats.untracked++; continue }
      const t = normalizeTrade(raw, spec)
      if (!t) { this.stats.rejected++; continue }
      if (t.time < this.from || t.time >= this.to) { this.stats.outside++; continue }
      if (this.books.get(t.coin).add(t) == null) this.stats.duplicates++
      else this.stats.accepted++
    }
  }

  /** Hours of the window without a single block: a missing archive file. */
  missingHours() {
    const out = []
    for (let h = Math.floor(this.from / HOUR_MS) * HOUR_MS; h < this.to; h += HOUR_MS) if (!this.hours.has(h)) out.push(h)
    return out
  }

  /** Fail-closed completeness check; returns a list of problems (empty = importable). */
  problems() {
    const p = []
    if (this.stats.malformed) p.push(`${this.stats.malformed} malformed line(s): the archive format differs from the documented shape`)
    if (this.stats.rejected) p.push(`${this.stats.rejected} taker fill(s) failed normalization (precision or field mismatch)`)
    const missing = this.missingHours()
    if (missing.length) p.push(`no blocks for ${missing.length} hour(s) of the window, first ${new Date(missing[0]).toISOString()}: an archive file is missing`)
    if (!this.stats.accepted) p.push('no trades for any supported market in the window')
    return p
  }

  /** Minute slices for every supported coin, in the live row format. */
  * slices() {
    for (const [coin, book] of this.books) {
      const spec = this.specs.get(coin)
      for (const t of [...book.minutes.keys()].sort((a, b) => a - b)) yield { coin, spec, slice: book.slice(t) }
    }
  }
}

const overlaps = (g, from, to) => (g.from == null || g.from < to) && g.to > from

/**
 * Write an import in one transaction.
 * - A minute already recorded live is kept, unless it touches a recorded gap
 *   (then the live row is partial and the complete archive minute replaces it).
 * - Every gap overlapping [from, to) is cut back to the part outside the
 *   window, so the chart stops marking imported bars as partial coverage.
 * Returns { written, skipped, gapsTrimmed }.
 */
export async function writeImport(pool, imp) {
  const client = await pool.connect()
  let written = 0, skipped = 0, gapsTrimmed = 0
  try {
    await client.query('BEGIN')
    for (const coin of imp.specs.keys()) {
      const { rows } = await client.query(
        'SELECT ctid, from_ms, to_ms, reason FROM footprint_gaps WHERE coin = $1 AND to_ms > $2 AND (from_ms IS NULL OR from_ms < $3) FOR UPDATE',
        [coin, imp.from, imp.to])
      const gaps = rows.map(r => ({ ctid: r.ctid, from: r.from_ms == null ? null : Number(r.from_ms), to: Number(r.to_ms), reason: r.reason }))
      for (const { spec, slice } of [...imp.slices()].filter(s => s.coin === coin)) {
        const partialLive = gaps.some(g => overlaps(g, slice.t, slice.t + MINUTE_MS))
        const r = await client.query(
          `INSERT INTO footprint_minutes (coin, minute, price_decimals, size_decimals, levels, last_pu, last_time, trades, source)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, 'archive')
           ON CONFLICT (coin, minute) DO ${partialLive
             ? `UPDATE SET levels = EXCLUDED.levels, last_pu = EXCLUDED.last_pu, last_time = EXCLUDED.last_time,
                trades = EXCLUDED.trades, source = 'archive', updated_at = now()`
             : 'NOTHING'}`,
          [coin, slice.t, spec.priceDecimals, spec.szDecimals, JSON.stringify(slice.levels), slice.lastPu, slice.lastTime, slice.n])
        if (r.rowCount) written++; else skipped++
      }
      for (const g of gaps) {
        await client.query('DELETE FROM footprint_gaps WHERE ctid = $1', [g.ctid])
        gapsTrimmed++
        if (g.from == null || g.from < imp.from)
          await client.query('INSERT INTO footprint_gaps (coin, from_ms, to_ms, reason) VALUES ($1, $2, $3, $4)', [coin, g.from, imp.from, g.reason])
        if (g.to > imp.to)
          await client.query('INSERT INTO footprint_gaps (coin, from_ms, to_ms, reason) VALUES ($1, $2, $3, $4)', [coin, imp.to, g.to, g.reason])
      }
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally { client.release() }
  return { written, skipped, gapsTrimmed }
}
