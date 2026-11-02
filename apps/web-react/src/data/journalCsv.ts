import type { ToolError } from '../cms/contentTypes'
import { parseUserNumber } from './calculators'

/**
 * Client-side trading journal import.
 *
 * The CSV is parsed in the browser; nothing is uploaded and nothing is sent to
 * the backend. Column names are matched case-insensitively against a synonym
 * table, numbers accept Latin, Persian and Arabic-Indic digits, and every row
 * that cannot be interpreted is counted and reported rather than dropped
 * silently. This module is pure so it can be tested from Node.
 */
export interface JournalRow {
  index: number
  date: string | null
  symbol: string | null
  side: 'long' | 'short' | null
  qty: number | null
  entry: number | null
  exit: number | null
  fees: number | null
  pnl: number
  derived: boolean
}

export interface JournalMetrics {
  trades: number
  skipped: number
  netPnl: number
  grossProfit: number
  grossLoss: number
  wins: number
  losses: number
  breakeven: number
  winRatePct: number
  profitFactor: number | null
  expectancy: number | null
  avgWin: number | null
  avgLoss: number | null
  payoff: number | null
  bestTrade: number | null
  worstTrade: number | null
  maxDrawdown: number
  maxDrawdownPct: number | null
  longestWinStreak: number
  longestLossStreak: number
  largestDayProfit: number
  consistencySharePct: number | null
  holdingDays: number | null
}

export interface JournalDay {
  date: string
  pnl: number
  trades: number
}

export type JournalReport =
  | { ok: true; rows: JournalRow[]; days: JournalDay[]; metrics: JournalMetrics; warnings: string[]; columns: string[] }
  | { ok: false; errors: ToolError[] }

/* ------------------------------- CSV parsing ----------------------------- */

/** detect the delimiter from the header line, ignoring quoted content */
export function detectDelimiter(sample: string): string {
  const line = sample.split(/\r?\n/).find(l => l.trim().length) || ''
  const counts: Array<[string, number]> = [',', ';', '\t', '|'].map(d => [d, line.split(d).length - 1])
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][1] > 0 ? counts[0][0] : ','
}

/** RFC-4180 style split: quoted fields, escaped quotes, embedded separators and newlines */
export function parseCsvRows(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let quoted = false
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += ch
      continue
    }
    if (ch === '"') { quoted = true; continue }
    if (ch === delimiter) { row.push(field); field = ''; continue }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    if (ch === '\r') continue
    field += ch
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(cell => cell.trim().length))
}

const SYNOMS: Record<string, string[]> = {
  date: ['date', 'datetime', 'time', 'timestamp', 'closed at', 'closedat', 'day', 'close_time', 'closetime', 'تاریخ', 'زمان'],
  symbol: ['symbol', 'market', 'pair', 'instrument', 'asset', 'ticker', 'currency', 'نماد', 'بازار'],
  side: ['side', 'direction', 'type', 'position', 'long_short', 'longshort', 'جهت'],
  qty: ['qty', 'quantity', 'size', 'volume', 'contracts', 'amount', 'تعداد', 'حجم'],
  entry: ['entry', 'entry price', 'entryprice', 'open price', 'openprice', 'price_open', 'ورود'],
  exit: ['exit', 'exit price', 'exitprice', 'close price', 'closeprice', 'price_close', 'خروج'],
  pnl: ['pnl', 'net pnl', 'netpnl', 'profit', 'pl', 'p/l', 'realized pnl', 'realizedpnl', 'gross_pnl', 'grosspnl', 'sod', 'سود', 'زیان'],
  fees: ['fee', 'fees', 'commission', 'commissions', 'funding', 'کارمزد'],
  notes: ['notes', 'note', 'comment', 'tags', 'strategy', 'یادداشت'],
}

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')

export function mapColumns(header: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  header.forEach((cell, index) => {
    const key = normalizeHeader(cell)
    for (const [field, synonyms] of Object.entries(SYNOMS)) {
      if (map[field] !== undefined) continue
      if (synonyms.some(syn => syn === key || key.includes(syn))) { map[field] = index; break }
    }
  })
  return map
}

const SIDE_WORDS: Record<string, 'long' | 'short'> = {
  long: 'long', buy: 'long', b: 'long', 'خرید': 'long', 'لانگ': 'long',
  short: 'short', sell: 'short', s: 'short', 'فروش': 'short', 'شورت': 'short',
}

function parseSignedNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const value = raw.trim()
  if (!value) return null
  /* parentheses and a trailing minus are common accounting notations */
  const parenthesised = /^\((.*)\)$/.exec(value)
  const n = parseUserNumber(parenthesised ? parenthesised[1] : value)
  if (n === null) return null
  if (parenthesised) return -n
  if (/[-−]\s*$/.test(value)) return -n
  return n
}

/* ------------------------------- analysis -------------------------------- */

export function analyzeJournal(text: string, startingCapital = 0): JournalReport {
  const trimmed = (text || '').trim()
  if (!trimmed) return { ok: false, errors: [{ field: 'csv', code: 'required' }] }

  const delimiter = detectDelimiter(trimmed)
  const rows = parseCsvRows(trimmed, delimiter)
  if (!rows.length) return { ok: false, errors: [{ field: 'csv', code: 'empty' }] }

  let columns = mapColumns(rows[0])
  let start = 1
  /* a file without a header row still parses when the first line is numeric */
  if (!Object.keys(columns).length || !columns.pnl && !columns.exit) {
    const firstLineLooksNumeric = rows[0].some(cell => parseSignedNumber(cell) !== null)
    if (firstLineLooksNumeric) {
      columns = { pnl: rows[0].length - 1 }
      start = 0
    } else {
      return { ok: false, errors: [{ field: 'csv', code: 'unbalanced' }] }
    }
  }

  const parsed: JournalRow[] = []
  const warnings: string[] = []
  let skipped = 0
  let assumedNet = false
  const header = (rows[start - 1] || []).map(cell => normalizeHeader(cell))
  const profitHeader = header[columns.pnl] || ''
  const profitIsGross = /gross|raw|before/i.test(profitHeader)

  for (let i = start; i < rows.length; i++) {
    const cells = rows[i]
    const rawPnl = parseSignedNumber(cells[columns.pnl])
    const entry = parseSignedNumber(cells[columns.entry])
    const exit = parseSignedNumber(cells[columns.exit])
    const qty = parseSignedNumber(cells[columns.qty])
    const fees = parseSignedNumber(cells[columns.fees])
    const side = SIDE_WORDS[normalizeHeader(cells[columns.side] || '')] || null
    let pnl: number | null = rawPnl
    let derived = false

    if (pnl === null && entry !== null && exit !== null && qty !== null) {
      pnl = (side === 'short' ? entry - exit : exit - entry) * qty
      derived = true
      if (fees !== null) pnl -= Math.abs(fees)
    } else if (pnl !== null && fees !== null) {
      if (profitIsGross) pnl -= Math.abs(fees)
      else if (!assumedNet) {
        assumedNet = true
        warnings.push(`profit column “${(rows[start - 1] || [])[columns.pnl] || ''}” is treated as already net of fees`)
      }
    }

    if (pnl === null) {
      skipped++
      if (warnings.length < 8) warnings.push(`row ${i + 1}: no usable profit value`)
      continue
    }
    parsed.push({
      index: i + 1,
      date: (cells[columns.date] || '').trim() || null,
      symbol: (cells[columns.symbol] || '').trim() || null,
      side, qty, entry, exit,
      fees: fees === null ? null : Math.abs(fees),
      pnl,
      derived,
    })
  }

  if (!parsed.length) return { ok: false, errors: [{ field: 'csv', code: 'empty' }] }
  const metrics = summarize(parsed, startingCapital)
  metrics.skipped = skipped
  return { ok: true, rows: parsed, days: byDay(parsed), metrics, warnings, columns: rows[start - 1] || [] }
}

export function byDay(rows: JournalRow[]): JournalDay[] {
  const map = new Map<string, JournalDay>()
  for (const row of rows) {
    const key = (row.date || '').slice(0, 10) || 'undated'
    const bucket = map.get(key) || { date: key, pnl: 0, trades: 0 }
    bucket.pnl += row.pnl
    bucket.trades++
    map.set(key, bucket)
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function summarize(rows: JournalRow[], startingCapital: number): JournalMetrics {
  const pnls = rows.map(r => r.pnl)
  const wins = pnls.filter(x => x > 0)
  const losses = pnls.filter(x => x < 0)
  const breakeven = pnls.filter(x => x === 0)
  const grossProfit = wins.reduce((a, b) => a + b, 0)
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0))
  const net = pnls.reduce((a, b) => a + b, 0)

  let running = startingCapital
  let highest = startingCapital
  let maxDrawdown = 0
  for (const value of pnls) {
    running += value
    highest = Math.max(highest, running)
    maxDrawdown = Math.max(maxDrawdown, highest - running)
  }

  let winStreak = 0, lossStreak = 0, longestWin = 0, longestLoss = 0
  for (const value of pnls) {
    if (value > 0) { winStreak++; lossStreak = 0; longestWin = Math.max(longestWin, winStreak) }
    else if (value < 0) { lossStreak++; winStreak = 0; longestLoss = Math.max(longestLoss, lossStreak) }
    else { winStreak = 0; lossStreak = 0 }
  }

  const days = byDay(rows)
  const profitableDays = days.filter(d => d.pnl > 0)
  const largestDayProfit = profitableDays.reduce((max, d) => Math.max(max, d.pnl), 0)
  const datedRows = rows.filter(r => r.date)
  const timestamps = datedRows.map(r => Date.parse(String(r.date)))
  const validStamps = timestamps.filter(t => Number.isFinite(t))
  const holdingDays = validStamps.length > 1
    ? (Math.max(...validStamps) - Math.min(...validStamps)) / 86_400_000
    : null

  const avgWin = wins.length ? grossProfit / wins.length : null
  const avgLoss = losses.length ? grossLoss / losses.length : null
  const p = pnls.length ? wins.length / pnls.length : 0

  return {
    trades: rows.length,
    skipped: 0,
    netPnl: net,
    grossProfit,
    grossLoss,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRatePct: p * 100,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
    expectancy: pnls.length ? net / pnls.length : null,
    avgWin, avgLoss,
    payoff: avgWin !== null && avgLoss ? avgWin / avgLoss : null,
    bestTrade: pnls.length ? Math.max(...pnls) : null,
    worstTrade: pnls.length ? Math.min(...pnls) : null,
    maxDrawdown,
    maxDrawdownPct: peakEquity(startingCapital, pnls) > 0 ? maxDrawdown / peakEquity(startingCapital, pnls) * 100 : null,
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
    largestDayProfit,
    consistencySharePct: net > 0 ? largestDayProfit / net * 100 : null,
    holdingDays,
  }
}

/** the highest equity point reached, needed to express drawdown as a percent */
function peakEquity(startingCapital: number, pnls: number[]): number {
  let running = startingCapital
  let highest = startingCapital
  for (const value of pnls) { running += value; highest = Math.max(highest, running) }
  return highest
}
