/**
 * Trade Radar and market heatmap feed — read-only public Hyperliquid data.
 *
 * Parsing, leaderboard condensing, positioning and track-record logic are
 * adapted from drkxbt/whales (MIT, © 2026 drk); see
 * third_party/drkxbt-whales/PROVENANCE.md for the commit and the changes.
 *
 * One server-side cache and one shared trades socket serve every viewer, so
 * Hyperliquid sees the same load for one viewer or for a thousand, and each
 * answer says how fresh it is. Nothing here reads or writes accounts, orders,
 * balances, pricing, evaluation or the trading engine.
 */
import { Router } from 'express'
import { limiter } from './rate-limit-store.js'
import WebSocket from 'ws'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const INFO_URL = 'https://api.hyperliquid.xyz/info'
export const LEADERBOARD_URL = 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard'
export const WS_URL = 'wss://api.hyperliquid.xyz/ws'
export const WINDOWS = ['day', 'week', 'month', 'allTime']
/** Trade-size thresholds offered by the upstream tape, in USD. */
export const THRESHOLDS = [10_000, 50_000, 100_000, 500_000, 1_000_000]

const WALLET = /^0x[0-9a-fA-F]{40}$/
export const isWallet = value => typeof value === 'string' && WALLET.test(value)
const num = value => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value !== '' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : NaN
}
const str = value => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '')
/* JSON has no NaN: unknown numbers travel as null */
const finite = value => (Number.isFinite(value) ? value : null)

/* ---------------- upstream transforms (adapted) ---------------- */

/** Keep the top of each leaderboard window among accounts that actually trade. */
export function condenseBoard(raw, { size = 200, minVolume = 100_000 } = {}, now = Date.now()) {
  const rows = (raw?.leaderboardRows ?? []).flatMap(row => {
    const windows = new Map(row.windowPerformances ?? [])
    const month = windows.get('month')
    if (!month || !(Number(month.vlm) >= minVolume) || !isWallet(row.ethAddress)) return []
    return [{ wallet: row.ethAddress.toLowerCase(), name: String(row.displayName ?? '').trim().slice(0, 40), accountValue: Number(row.accountValue), windows }]
  })
  const windows = {}
  for (const window of WINDOWS) {
    windows[window] = rows
      .map(row => { const p = row.windows.get(window); return { ...row, pnl: Number(p?.pnl), roi: Number(p?.roi), volume: Number(p?.vlm) } })
      .filter(row => Number.isFinite(row.pnl))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, size)
      .map((row, index) => ({ rank: index + 1, wallet: row.wallet, name: row.name, accountValue: finite(row.accountValue), pnl: row.pnl, roi: finite(row.roi), volume: finite(row.volume) }))
  }
  return { updated: now, windows }
}

export function toMarkets(body) {
  const [meta, contexts] = Array.isArray(body) ? body : [{}, []]
  const universe = Array.isArray(meta?.universe) ? meta.universe : []
  return universe.flatMap((asset, index) => {
    const context = contexts?.[index] ?? {}
    if (asset.isDelisted === true) return []
    const mark = num(context.markPx), prevDay = num(context.prevDayPx)
    return [{
      coin: str(asset.name), mark: finite(mark), prevDay: finite(prevDay),
      change: prevDay > 0 && mark > 0 ? mark / prevDay - 1 : null,
      funding: finite(num(context.funding)),
      openInterest: finite(num(context.openInterest) * mark),
      dayVolume: finite(num(context.dayNtlVlm)),
      maxLeverage: finite(num(asset.maxLeverage)),
    }]
  })
}

export function toAccount(wallet, body) {
  const state = body ?? {}, summary = state.marginSummary ?? {}
  const positions = (Array.isArray(state.assetPositions) ? state.assetPositions : []).flatMap(entry => {
    const position = entry?.position ?? {}, signed = num(position.szi)
    if (!signed) return []
    const size = Math.abs(signed), value = num(position.positionValue), leverage = position.leverage ?? {}
    return [{
      wallet: wallet.toLowerCase(), coin: str(position.coin), side: signed > 0 ? 'long' : 'short', size,
      entry: num(position.entryPx), value, mark: size > 0 ? value / size : NaN,
      upnl: num(position.unrealizedPnl), roe: num(position.returnOnEquity), liquidation: num(position.liquidationPx),
      leverage: num(leverage.value), leverageType: leverage.type === 'isolated' ? 'isolated' : 'cross', margin: num(position.marginUsed),
    }]
  })
  return {
    wallet: wallet.toLowerCase(), accountValue: num(summary.accountValue), marginUsed: num(summary.totalMarginUsed),
    notional: num(summary.totalNtlPos), withdrawable: num(state.withdrawable), positions: positions.sort((a, b) => b.value - a.value),
  }
}

export function toFill(row) {
  const price = num(row.px), size = num(row.sz)
  return { id: `${str(row.hash)}:${str(row.tid)}`, coin: str(row.coin), side: row.side === 'B' ? 'buy' : 'sell', price, size, usd: price * size, time: num(row.time), direction: str(row.dir).slice(0, 40), closedPnl: num(row.closedPnl), fee: num(row.fee) }
}

export function toTrade(row) {
  const price = num(row.px), size = num(row.sz)
  const users = Array.isArray(row.users) ? row.users.map(user => str(user).toLowerCase()) : []
  return { id: `${str(row.hash)}:${str(row.tid)}`, coin: str(row.coin), side: row.side === 'B' ? 'buy' : 'sell', price, size, usd: price * size, time: num(row.time), buyer: users[0] ?? '', seller: users[1] ?? '' }
}

export function toPnl(body, window) {
  const series = new Map(Array.isArray(body) ? body : [])
  const name = `perp${window[0].toUpperCase()}${window.slice(1)}`
  const history = (series.get(name) ?? series.get(window) ?? {}).pnlHistory
  return (Array.isArray(history) ? history : []).map(([time, pnl]) => ({ time: num(time), pnl: num(pnl) })).filter(p => Number.isFinite(p.pnl) && Number.isFinite(p.time))
}

/** One row per coin: long and short sides added up across the given wallets. A wallet counts once per coin. */
export function positioning(holdings, markets = new Map()) {
  const rows = new Map(), seen = new Set()
  const side = () => ({ traders: 0, notional: 0, size: 0, cost: 0, levValue: 0, upnl: 0 })
  for (const { trader, positions } of holdings) for (const p of positions) {
    if (!(p.size > 0) || !(p.value > 0)) continue
    const key = `${p.coin}|${trader.wallet}`
    if (seen.has(key)) continue
    seen.add(key)
    let row = rows.get(p.coin)
    if (!row) rows.set(p.coin, row = { coin: p.coin, mark: markets.get(p.coin)?.mark ?? p.mark, change: markets.get(p.coin)?.change ?? null, long: side(), short: side(), holders: [] })
    const s = row[p.side]
    s.traders++; s.notional += p.value; s.size += p.size; s.cost += p.entry * p.size
    s.upnl += Number.isFinite(p.upnl) ? p.upnl : 0
    if (Number.isFinite(p.leverage)) s.levValue += p.leverage * p.value
    row.holders.push({ wallet: trader.wallet, name: trader.name, rank: trader.rank, side: p.side, value: p.value, entry: p.entry })
  }
  const total = [...rows.values()].reduce((sum, r) => sum + r.long.notional + r.short.notional, 0)
  return [...rows.values()].map(row => {
    const finish = s => ({ traders: s.traders, notional: s.notional, size: s.size, entry: finite(s.size > 0 ? s.cost / s.size : NaN), leverage: finite(s.notional > 0 ? s.levValue / s.notional : NaN), upnl: s.upnl })
    const long = finish(row.long), short = finish(row.short), notional = long.notional + short.notional
    return {
      coin: row.coin, mark: finite(row.mark), change: row.change, long, short, notional,
      bias: notional > 0 ? long.notional / notional : 0.5,
      /** share of all tracked whale notional held in this coin */
      concentration: total > 0 ? notional / total : 0,
      upnl: long.upnl + short.upnl,
      holders: row.holders.sort((a, b) => b.value - a.value).slice(0, 8).map(h => ({ ...h, entry: finite(h.entry) })),
    }
  }).sort((a, b) => b.notional - a.notional)
}

/** A wallet's record over the fills given: closes within a dollar of even count as neither win nor loss. */
export function fillRecord(fills) {
  let wins = 0, losses = 0, realized = 0, fees = 0, closes = 0, since = Infinity
  for (const fill of fills) {
    if (Number.isFinite(fill.fee)) fees += fill.fee
    if (fill.time < since) since = fill.time
    if (!Number.isFinite(fill.closedPnl) || fill.closedPnl === 0) continue
    closes++; realized += fill.closedPnl
    if (fill.closedPnl > 1) wins++; else if (fill.closedPnl < -1) losses++
  }
  return { closes, wins, losses, winRate: wins + losses ? wins / (wins + losses) : null, realized, fees, since: Number.isFinite(since) ? since : null }
}

const position = p => ({ wallet: p.wallet, coin: p.coin, side: p.side, size: finite(p.size), entry: finite(p.entry), value: finite(p.value), mark: finite(p.mark), upnl: finite(p.upnl), roe: finite(p.roe), liquidation: finite(p.liquidation), leverage: finite(p.leverage), leverageType: p.leverageType, margin: finite(p.margin) })

/** Fetch and condense the leaderboard in a short-lived child process with a capped heap. */
export function isolatedBoard(url, { maxBytes = 120e6, heapMb = 384, timeoutMs = 90_000 } = {}) {
  const script = fileURLToPath(new URL('./radar-board-worker.js', import.meta.url))
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [`--max-old-space-size=${heapMb}`, script, url, String(maxBytes)], { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      if (error) return reject(new Error(String(stderr || error.message).slice(0, 200)))
      try { resolve(JSON.parse(stdout)) } catch { reject(new Error('board_parse_failed')) }
    })
  })
}

/* ---------------- shared cache + request budget ---------------- */

/**
 * @param {object} [o]
 * @param {typeof fetch} [o.fetchImpl]
 * @param {typeof WebSocket} [o.WebSocketImpl]
 */
export function createRadar({ boardLoader, fetchImpl = globalThis.fetch, WebSocketImpl = WebSocket, now = () => Date.now(), info = INFO_URL, leaderboard = LEADERBOARD_URL, wsUrl = WS_URL, concurrency = 4, maxLeaderboardBytes = 120e6, idleMs = 5 * 60_000, tapeCoins = 30 } = {}) {
  const cache = new Map()
  let active = 0
  const queue = []
  async function slot(work) {
    if (active >= concurrency) await new Promise(resolve => queue.push(resolve))
    active++
    try { return await work() } finally { active--; queue.shift()?.() }
  }
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
  async function request(url, init = {}) {
    for (let attempt = 0; ; attempt++) {
      let response
      try { response = await slot(() => fetchImpl(url, { ...init, signal: AbortSignal.timeout(20_000) })) }
      catch (error) { if (attempt >= 2) throw error; await pause(400 * (attempt + 1)); continue }
      if (response.ok) {
        const length = Number(response.headers?.get?.('content-length'))
        if (Number.isFinite(length) && length > maxLeaderboardBytes) throw new Error('upstream_too_large')
        return response.json()
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        const after = Number(response.headers?.get?.('retry-after'))
        await pause(Number.isFinite(after) && after > 0 ? Math.min(after, 10) * 1000 : 1000 * (attempt + 1)); continue
      }
      throw new Error(`upstream_${response.status}`)
    }
  }
  /** Fresh answers are shared; concurrent misses share one request; a failed refresh serves the last good answer marked stale. */
  function remember(key, ttl, read) {
    const hit = cache.get(key), t = now()
    if (hit?.value !== undefined && t - hit.at < ttl) return Promise.resolve({ value: hit.value, at: hit.at, stale: false })
    if (hit?.pending) return hit.pending
    const pending = read().then(value => {
      cache.set(key, { value, at: now() })
      return { value, at: now(), stale: false }
    }, error => {
      const prev = cache.get(key)
      if (prev?.value !== undefined) { cache.set(key, { value: prev.value, at: prev.at }); return { value: prev.value, at: prev.at, stale: true } }
      cache.delete(key); throw error
    })
    cache.set(key, { ...(hit || {}), pending })
    return pending
  }
  const post = body => request(info, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

  const api = {
    /* production: an isolated worker; tests inject fetch and parse in-process */
    board: () => remember('board', 15 * 60_000, async () => boardLoader ? boardLoader(leaderboard)
      : fetchImpl === globalThis.fetch ? isolatedBoard(leaderboard, { maxBytes: maxLeaderboardBytes }) : condenseBoard(await request(leaderboard), {}, now())),
    markets: () => remember('markets', 15_000, async () => toMarkets(await post({ type: 'metaAndAssetCtxs' }))),
    account: wallet => remember(`account:${wallet}`, 60_000, async () => toAccount(wallet, await post({ type: 'clearinghouseState', user: wallet }))),
    fills: wallet => remember(`fills:${wallet}`, 60_000, async () => {
      const rows = await post({ type: 'userFills', user: wallet, aggregateByTime: true })
      return (Array.isArray(rows) ? rows : []).map(toFill).sort((a, b) => b.time - a.time)
    }),
    portfolio: wallet => remember(`pnl:${wallet}`, 120_000, () => post({ type: 'portfolio', user: wallet })),

    async positions(window = 'month', top = 30) {
      return remember(`positions:${window}:${top}`, 60_000, async () => {
        const [board, markets] = await Promise.all([api.board(), api.markets()])
        const traders = board.value.windows[window].slice(0, top)
        const accounts = await Promise.all(traders.map(trader => api.account(trader.wallet).then(r => ({ trader, positions: r.value.positions }), () => null)))
        const holdings = accounts.filter(Boolean)
        const marketMap = new Map(markets.value.map(m => [m.coin, m]))
        const coins = positioning(holdings, marketMap)
        const all = holdings.flatMap(h => h.positions.map(p => ({ ...position(p), name: h.trader.name, rank: h.trader.rank })))
        return {
          window, tracked: traders.length, answered: holdings.length, boardUpdated: board.value.updated,
          coins, positions: all.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 150),
          totals: { long: coins.reduce((s, c) => s + c.long.notional, 0), short: coins.reduce((s, c) => s + c.short.notional, 0) },
        }
      })
    },

    async wallet(wallet) {
      const [account, fills, portfolio, board] = await Promise.all([api.account(wallet), api.fills(wallet), api.portfolio(wallet), api.board().catch(() => null)])
      const ranked = board ? WINDOWS.map(w => [w, board.value.windows[w].find(t => t.wallet === wallet)]).filter(([, t]) => t) : []
      const a = account.value
      return {
        wallet, name: ranked[0]?.[1]?.name || '', ranks: Object.fromEntries(ranked.map(([w, t]) => [w, { rank: t.rank, pnl: t.pnl, roi: t.roi, volume: t.volume }])),
        account: { accountValue: finite(a.accountValue), marginUsed: finite(a.marginUsed), notional: finite(a.notional), withdrawable: finite(a.withdrawable) },
        positions: a.positions.map(position),
        fills: fills.value.slice(0, 100).map(f => ({ ...f, price: finite(f.price), size: finite(f.size), usd: finite(f.usd), closedPnl: finite(f.closedPnl), fee: finite(f.fee) })),
        record: fillRecord(fills.value),
        pnl: { month: toPnl(portfolio.value, 'month'), allTime: toPnl(portfolio.value, 'allTime') },
        updated: Math.min(account.at, fills.at), stale: account.stale || fills.stale,
      }
    },
  }

  /* ---------------- shared trades socket (started on demand) ---------------- */
  const tape = { socket: null, state: 'idle', coins: [], trades: [], seen: new Set(), lastMessageAt: 0, lastViewAt: 0, retry: 0, timer: null, ping: null, idle: null }
  const KEEP = 400
  function tapeStop() {
    clearTimeout(tape.timer); clearInterval(tape.ping); clearInterval(tape.idle)
    tape.timer = tape.ping = tape.idle = null
    const s = tape.socket; tape.socket = null; tape.state = 'idle'
    try { s?.close() } catch { /* already closed */ }
  }
  async function tapeConnect() {
    if (tape.socket) return
    let coins = tape.coins
    try {
      const m = await api.markets()
      coins = m.value.filter(x => x.dayVolume > 0).sort((a, b) => b.dayVolume - a.dayVolume).slice(0, tapeCoins).map(x => x.coin)
    } catch { /* keep the previous coin set */ }
    if (!coins.length || tape.socket) { tape.state = 'unavailable'; return }
    tape.coins = coins; tape.state = 'connecting'
    const socket = tape.socket = new WebSocketImpl(wsUrl)
    socket.on('open', () => {
      if (tape.socket !== socket) return
      tape.retry = 0; tape.state = 'live'
      for (const coin of coins) socket.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'trades', coin } }))
      clearInterval(tape.ping); tape.ping = setInterval(() => { try { socket.send(JSON.stringify({ method: 'ping' })) } catch { /* closing */ } }, 45_000)
    })
    socket.on('message', raw => {
      if (tape.socket !== socket) return
      tape.lastMessageAt = now()
      let message
      try { message = JSON.parse(String(raw)) } catch { return }
      if (message?.channel !== 'trades' || !Array.isArray(message.data)) return
      for (const row of message.data) {
        const trade = toTrade(row)
        if (!(trade.usd >= THRESHOLDS[0]) || !Number.isFinite(trade.time) || tape.seen.has(trade.id)) continue
        tape.seen.add(trade.id); tape.trades.push(trade)
      }
      if (tape.trades.length > KEEP) {
        tape.trades.sort((a, b) => a.time - b.time)
        for (const old of tape.trades.splice(0, tape.trades.length - KEEP)) tape.seen.delete(old.id)
      }
    })
    socket.on('close', () => {
      if (tape.socket !== socket) return
      tape.socket = null; clearInterval(tape.ping); tape.state = 'reconnecting'
      tape.timer = setTimeout(tapeConnect, Math.min(30_000, 1000 * 2 ** tape.retry++))
    })
    socket.on('error', () => { try { socket.close() } catch { /* ignore */ } })
    clearInterval(tape.idle)
    tape.idle = setInterval(() => { if (now() - tape.lastViewAt > idleMs) tapeStop() }, Math.min(idleMs, 60_000))
    tape.idle.unref?.()
  }
  api.tape = ({ since = 0, min = THRESHOLDS[0], coin = '' } = {}) => {
    tape.lastViewAt = now()
    if (!tape.socket && tape.state !== 'connecting' && tape.state !== 'reconnecting') void tapeConnect()
    const trades = tape.trades.filter(t => t.time > since && t.usd >= min && (!coin || t.coin === coin)).sort((a, b) => b.time - a.time).slice(0, 200)
    return { state: tape.state, coins: tape.coins, lastMessageAt: tape.lastMessageAt || null, trades }
  }
  api.close = tapeStop
  return api
}

/* ---------------- HTTP ---------------- */

/** Hyperliquid coin → the Openfund (Gains) market for the same base, when one exists and is open. */
export function openfundMarketFor(coin, gainsMarkets) {
  const base = String(coin).replace(/^k(?=[A-Z])/, '')
  const m = gainsMarkets?.get?.(`${base}/USD`)
  return m && m.isOpen !== false ? { symbol: m.symbol, group: typeof m.group === 'string' ? m.group : null } : null
}

export function radarRoutes({ radar, gainsMarkets = () => new Map() }) {
  const router = Router()
  const limit = limiter('radar.read', { windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'rate_limited' } })
  const send = (res, maxAge, body) => res.set('Cache-Control', `public, max-age=${maxAge}`).json(body)
  const fail = res => res.status(503).set('Cache-Control', 'no-store').json({ error: 'radar_unavailable' })
  const windowOf = value => (WINDOWS.includes(value) ? value : 'month')
  router.use('/radar', limit)
  router.get('/radar/markets', async (req, res) => {
    try {
      const r = await radar.markets(), gains = gainsMarkets()
      send(res, 10, { updated: r.at, stale: r.stale, source: 'hyperliquid', markets: r.value.map(m => ({ ...m, openfund: openfundMarketFor(m.coin, gains) })) })
    } catch { fail(res) }
  })
  router.get('/radar/board', async (req, res) => {
    const window = windowOf(req.query.window), size = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
    try { const r = await radar.board(); send(res, 60, { updated: r.value.updated, stale: r.stale, window, traders: r.value.windows[window].slice(0, size) }) } catch { fail(res) }
  })
  router.get('/radar/positions', async (req, res) => {
    const window = windowOf(req.query.window), top = [10, 20, 30, 50].includes(Number(req.query.top)) ? Number(req.query.top) : 30
    try { const r = await radar.positions(window, top); send(res, 30, { updated: r.at, stale: r.stale, ...r.value }) } catch { fail(res) }
  })
  router.get('/radar/wallet/:wallet', async (req, res) => {
    if (!isWallet(req.params.wallet)) return res.status(400).json({ error: 'invalid_wallet' })
    try { send(res, 30, await radar.wallet(req.params.wallet.toLowerCase())) } catch { fail(res) }
  })
  router.get('/radar/tape', (req, res) => {
    const min = THRESHOLDS.includes(Number(req.query.min)) ? Number(req.query.min) : THRESHOLDS[0]
    const since = Number(req.query.since) > 0 ? Number(req.query.since) : 0
    const coin = typeof req.query.coin === 'string' && /^[A-Za-z0-9:@_-]{1,24}$/.test(req.query.coin) ? req.query.coin : ''
    send(res, 2, { thresholds: THRESHOLDS, ...radar.tape({ since, min, coin }) })
  })
  return router
}
