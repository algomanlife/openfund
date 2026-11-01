/* Gains market-data access for React pages.
 * Reuses the existing Openfund Gains adapter (public/legacy/gains-adapter.js)
 * as the SHARED data source — same REST endpoints, same singleton prices
 * WebSocket (subscribe/unsubscribe, ping/pong, seq-gap resubscribe), no
 * duplicate price engine. The adapter is injected as a script once per
 * browser page; the hook only subscribes.
 *
 * Follows the legacy-page teardown contract: because this page owns a
 * script runtime, leaving it reloads the page (cancelled on re-mount), so
 * the terminal always boots against a clean adapter singleton. */
import { useEffect, useRef, useState } from 'react'
import { isValidMarket, usablePrice, type GainsMarket, type PricePoint } from './marketsData'

type GainsApi = {
  marketList: (force?: boolean) => Promise<Map<string, GainsMarket>>
  priceSnapshot: () => Promise<Array<{ market: string; mark: string | number; index?: string | number; updatedAt?: string | number }>>
  subscribePrices: (h: (p: { market: string; mark: number; index: number | null; updatedAt: number }) => void) => () => void
  subscribeStatus: (h: (s: string, info: { lastMsgAt: number }) => void) => () => void
}

declare global { interface Window { OpenfundGains?: GainsApi; __ofGainsAdapterPromise?: Promise<GainsApi> } }

const adapterUrl = `${import.meta.env.BASE_URL}legacy/gains-adapter.js`

function ensureGainsAdapter(): Promise<GainsApi> {
  if (window.OpenfundGains) return Promise.resolve(window.OpenfundGains)
  if (window.__ofGainsAdapterPromise) return window.__ofGainsAdapterPromise
  window.__ofGainsAdapterPromise = new Promise<GainsApi>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = adapterUrl
    s.dataset.page = 'markets'
    s.onload = () => { window.OpenfundGains ? resolve(window.OpenfundGains) : reject(new Error('Gains adapter missing')) }
    s.onerror = () => reject(new Error('Gains adapter failed to load'))
    document.body.appendChild(s)
  })
  return window.__ofGainsAdapterPromise
}

export type MarketsState = {
  markets: GainsMarket[]
  prices: ReadonlyMap<string, PricePoint>
  /** connecting | live | reconnecting (from the shared WS) */
  stream: string
  loaded: boolean
  failed: boolean
  lastUpdate: number
}

export function useGainsMarkets(): MarketsState {
  const [markets, setMarkets] = useState<GainsMarket[]>([])
  const [prices, setPrices] = useState<ReadonlyMap<string, PricePoint>>(new Map())
  const [stream, setStream] = useState('connecting')
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(0)
  const buffer = useRef(new Map<string, PricePoint>())
  const flushTimer = useRef<number | undefined>(undefined)
  const lastUpdateRef = useRef(0)

  useEffect(() => {
    let active = true
    const unsubs: Array<() => void> = []

    /* price updates are batched into state on a ~1s cadence — the same
       throttled rhythm as the landing table, safe for large category lists */
    const scheduleFlush = () => {
      if (flushTimer.current !== undefined) return
      flushTimer.current = window.setTimeout(() => {
        flushTimer.current = undefined
        if (!active) return
        setPrices(new Map(buffer.current))
        setLastUpdate(lastUpdateRef.current)
      }, 900)
    }

    void ensureGainsAdapter().then(G => {
      if (!active) return
      void G.marketList(true)
        .then(list => { if (active) { setMarkets([...list.values()].filter(isValidMarket)); setLoaded(true) } })
        .catch(() => { if (active) setFailed(true) })
      void G.priceSnapshot()
        .then(snapshot => {
          if (!active) return
          for (const p of snapshot) {
            const mark = Number(p.mark)
            if (!Number.isFinite(mark) || mark <= 0) continue
            buffer.current.set(p.market, { mark, index: Number(p.index) || null, updatedAt: Number(p.updatedAt) || Date.now(), direction: 0 })
          }
          lastUpdateRef.current = Date.now()
          scheduleFlush()
        })
        .catch(() => { /* REST prices unavailable — WS + states still render */ })
      unsubs.push(G.subscribePrices(p => {
        const old = buffer.current.get(p.market)
        buffer.current.set(p.market, {
          mark: p.mark, index: p.index, updatedAt: p.updatedAt,
          direction: old ? Math.sign(p.mark - old.mark) : 0,
          tickAt: old && p.mark !== old.mark ? Date.now() : (old?.tickAt || 0),
        })
        lastUpdateRef.current = Date.now()
        scheduleFlush()
      }))
      unsubs.push(G.subscribeStatus(s => { if (active) setStream(s) }))
    }).catch(() => { if (active) setFailed(true) })

    return () => {
      active = false
      if (flushTimer.current !== undefined) { clearTimeout(flushTimer.current); flushTimer.current = undefined }
      unsubs.forEach(u => u())
    }
  }, [])

  return { markets, prices, stream, loaded, failed, lastUpdate }
}

export function priceFor(prices: ReadonlyMap<string, PricePoint>, symbol: string): PricePoint | undefined {
  const p = prices.get(symbol)
  return usablePrice(p) ? p : undefined
}
