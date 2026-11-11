/* Read-only Bitpin market ticker for the Persian public website.

   Source: Bitpin public market data, GET https://api.bitpin.ir/api/v1/mkt/tickers/
   (no authentication, CORS `*`). Each row: { symbol: "BTC_IRT", price: "…",
   daily_change_price: <24h % change>, low, high, timestamp }. Bitpin's
   /api/v1/mkt/markets/ names the IRT markets "<Asset>/Toman", so every price
   shown here is in Toman.

   This module is display-only. It never authenticates, never places orders,
   and is not connected to Gains market data or any Openfund trading
   calculation. */

export const BITPIN_TICKERS_URL = 'https://api.bitpin.ir/api/v1/mkt/tickers/'
export const QUOTE = 'IRT'
export const QUOTE_LABEL_FA = 'تومان'

/** Display list. A market is shown only when Bitpin returns a valid row for it. */
export const TICKER_ASSETS = [
  { base: 'BTC', name: 'بیت‌کوین', color: '#f7931a' },
  { base: 'ETH', name: 'اتریوم', color: '#627eea' },
  { base: 'USDT', name: 'تتر', color: '#26a17b' },
  { base: 'BNB', name: 'بی‌ان‌بی', color: '#d9a400' },
  { base: 'XRP', name: 'ریپل', color: '#3a4450' },
  { base: 'SOL', name: 'سولانا', color: '#8a5cf6' },
  { base: 'DOGE', name: 'دوج‌کوین', color: '#b59a3a' },
  { base: 'TRX', name: 'ترون', color: '#d9302b' },
  { base: 'ADA', name: 'کاردانو', color: '#2a5ada' },
  { base: 'PAXG', name: 'پکس گلد', color: '#b8962e' },
] as const

export type TickerAsset = typeof TICKER_ASSETS[number]
export type TickerQuote = TickerAsset & { symbol: string; price: number; change: number; at: number }

/** Validates and maps the raw Bitpin rows. Rows that are missing, malformed
 *  or non-positive are dropped; nothing is ever estimated or filled in. */
export function parseTickers(raw: unknown): TickerQuote[] {
  if (!Array.isArray(raw)) return []
  const rows = new Map<string, Record<string, unknown>>()
  for (const row of raw) {
    if (row && typeof row === 'object' && typeof (row as { symbol?: unknown }).symbol === 'string') {
      rows.set((row as { symbol: string }).symbol, row as Record<string, unknown>)
    }
  }
  const out: TickerQuote[] = []
  for (const asset of TICKER_ASSETS) {
    const symbol = `${asset.base}_${QUOTE}`
    const row = rows.get(symbol)
    if (!row) continue
    const price = Number(row.price)
    const change = Number(row.daily_change_price)
    const at = Number(row.timestamp)
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(change) || !Number.isFinite(at)) continue
    out.push({ ...asset, symbol, price, change, at: at * 1000 })
  }
  return out
}

const priceFormat = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 })
const smallPriceFormat = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 })
const changeFormat = new Intl.NumberFormat('fa-IR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' })
const timeFormat = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' })

export const formatPrice = (price: number) => (price >= 100 ? priceFormat : smallPriceFormat).format(price)
export const formatChange = (change: number) => changeFormat.format(change / 100)
export const formatTime = (time: number) => timeFormat.format(time)

/* ---- one shared poller -------------------------------------------------
   Every mounted ticker subscribes to the same loop, so page navigation or a
   second mount never starts a duplicate polling loop. Polling pauses while
   the tab is hidden and backs off after failures. */
export const REFRESH_MS = 30_000
const MAX_BACKOFF_MS = 5 * 60_000
/** after this long without a successful refresh, prices are withdrawn */
export const WITHDRAW_AFTER_MS = 10 * 60_000

export interface TickerState {
  status: 'loading' | 'live' | 'delayed' | 'unavailable'
  quotes: TickerQuote[]
  updatedAt: number | null
}

/** Pure status rule (unit-tested): live only while the last success is recent. */
export function statusFor(updatedAt: number | null, failing: boolean, now: number): TickerState['status'] {
  if (updatedAt === null) return failing ? 'unavailable' : 'loading'
  if (now - updatedAt > WITHDRAW_AFTER_MS) return 'unavailable'
  return failing ? 'delayed' : 'live'
}

type Listener = (state: TickerState) => void
const listeners = new Set<Listener>()
let quotes: TickerQuote[] = []
let updatedAt: number | null = null
let failing = false
let failures = 0
let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined
/** id of the request currently allowed to write state; an aborted or
 *  superseded request can never block a new one or overwrite fresher data */
let request = 0
let inFlight = false

function snapshot(): TickerState {
  const status = statusFor(updatedAt, failing, Date.now())
  return { status, quotes: status === 'unavailable' ? [] : quotes, updatedAt }
}
const emit = () => { const state = snapshot(); listeners.forEach(listener => listener(state)) }

function schedule(delay: number) {
  clearTimeout(timer)
  if (!listeners.size || document.hidden) return
  timer = setTimeout(() => void refresh(), delay)
}

async function refresh() {
  if (inFlight || !listeners.size || document.hidden) return
  const id = ++request
  inFlight = true
  controller = new AbortController()
  let ok = false
  try {
    const response = await fetch(BITPIN_TICKERS_URL, { signal: controller.signal, credentials: 'omit', cache: 'no-store' })
    if (!response.ok) throw new Error(`bitpin ${response.status}`)
    const parsed = parseTickers(await response.json())
    if (!parsed.length) throw new Error('bitpin: no supported markets')
    if (id === request) { quotes = parsed; ok = true }
  } catch {
    /* network error, HTTP error (incl. 429) or abort — handled below */
  }
  if (id !== request) return /* cancelled: the canceller already reset the loop */
  inFlight = false; controller = undefined
  if (ok) { updatedAt = Date.now(); failing = false; failures = 0 }
  else { failing = true; failures++ }
  emit()
  schedule(failing ? Math.min(REFRESH_MS * 2 ** failures, MAX_BACKOFF_MS) : REFRESH_MS)
}

function onVisibility() {
  if (document.hidden) { clearTimeout(timer); return }
  emit() /* re-evaluate staleness after the tab was hidden */
  if (updatedAt === null || Date.now() - updatedAt >= REFRESH_MS) void refresh()
  else schedule(REFRESH_MS - (Date.now() - updatedAt))
}

export function subscribeTicker(listener: Listener): () => void {
  listeners.add(listener)
  if (listeners.size === 1) document.addEventListener('visibilitychange', onVisibility)
  listener(snapshot())
  if (updatedAt === null || Date.now() - updatedAt >= REFRESH_MS) void refresh()
  else if (!timer) schedule(REFRESH_MS - (Date.now() - updatedAt))
  return () => {
    listeners.delete(listener)
    if (listeners.size) return
    document.removeEventListener('visibilitychange', onVisibility)
    clearTimeout(timer); timer = undefined
    /* cancel the request and release the loop immediately */
    request++; inFlight = false
    controller?.abort(); controller = undefined
  }
}
