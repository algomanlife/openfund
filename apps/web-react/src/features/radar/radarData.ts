/* Trade Radar + Heatmap data access. Every read goes to the Openfund backend's
   shared cache (apps/backend/radar.js), never straight to Hyperliquid, so all
   viewers share one upstream budget. Polling pauses while the tab is hidden
   and every request is aborted on unmount. */
import { useEffect, useRef, useState } from 'react'
import { backendUrl } from '../../session/useOpenfundSession'

export type Window = 'day' | 'week' | 'month' | 'allTime'
export const WINDOWS: Window[] = ['day', 'week', 'month', 'allTime']

export interface RadarMarket { coin: string; mark: number | null; prevDay: number | null; change: number | null; funding: number | null; openInterest: number | null; dayVolume: number | null; maxLeverage: number | null; openfund: { symbol: string; group: string | null } | null }
export interface Trade { id: string; coin: string; side: 'buy' | 'sell'; price: number; size: number; usd: number; time: number; buyer: string; seller: string }
export interface Side { traders: number; notional: number; size: number; entry: number | null; leverage: number | null; upnl: number }
export interface CoinRow { coin: string; mark: number | null; change: number | null; long: Side; short: Side; notional: number; bias: number; concentration: number; upnl: number; holders: { wallet: string; name: string; rank: number; side: 'long' | 'short'; value: number; entry: number | null }[] }
export interface Position { wallet: string; name?: string; rank?: number; coin: string; side: 'long' | 'short'; size: number | null; entry: number | null; value: number | null; mark: number | null; upnl: number | null; roe: number | null; liquidation: number | null; leverage: number | null; leverageType: string; margin: number | null }
export interface Trader { rank: number; wallet: string; name: string; accountValue: number | null; pnl: number; roi: number | null; volume: number | null }
export interface Fill { id: string; coin: string; side: 'buy' | 'sell'; price: number | null; size: number | null; usd: number | null; time: number; direction: string; closedPnl: number | null; fee: number | null }
export interface WalletProfile {
  wallet: string; name: string; ranks: Partial<Record<Window, { rank: number; pnl: number; roi: number | null; volume: number | null }>>
  account: { accountValue: number | null; marginUsed: number | null; notional: number | null; withdrawable: number | null }
  positions: Position[]; fills: Fill[]
  record: { closes: number; wins: number; losses: number; winRate: number | null; realized: number; fees: number; since: number | null }
  pnl: { month: { time: number; pnl: number }[]; allTime: { time: number; pnl: number }[] }
  updated: number; stale: boolean
}

export async function radarFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(`${backendUrl()}/radar${path}`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) })
  const data = await r.json().catch(() => null)
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`)
  return data as T
}

export interface Polled<T> { data: T | null; error: boolean; loading: boolean; fetchedAt: number }
/** Poll `path` every `interval` ms while visible; keeps the last good answer through a failed refresh. */
export function usePoll<T>(path: string | null, interval: number): Polled<T> {
  const [state, setState] = useState<Polled<T>>({ data: null, error: false, loading: !!path, fetchedAt: 0 })
  const last = useRef<string | null>(null)
  useEffect(() => {
    if (!path) { setState({ data: null, error: false, loading: false, fetchedAt: 0 }); return }
    const ctrl = new AbortController()
    let timer: number | undefined, busy = false
    if (last.current !== path) setState(s => ({ ...s, data: null, loading: true }))
    last.current = path
    const load = async () => {
      if (busy || document.visibilityState === 'hidden') return
      busy = true
      try {
        const data = await radarFetch<T>(path, ctrl.signal)
        if (!ctrl.signal.aborted) setState({ data, error: false, loading: false, fetchedAt: Date.now() })
      } catch {
        if (!ctrl.signal.aborted) setState(s => ({ ...s, error: true, loading: false }))
      } finally { busy = false }
    }
    void load()
    timer = window.setInterval(load, interval)
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { ctrl.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [path, interval])
  return state
}

/** Re-render every `ms` so "updated N s ago" labels stay current. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(t) }, [ms])
  return now
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })
export const usd = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : `${v < 0 ? '-' : ''}$${compact.format(Math.abs(v))}`)
export const signedUsd = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${usd(v)}`)
export const pct = (v: number | null | undefined, digits = 2) => (v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`)
export function price(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return '—'
  const a = Math.abs(v), d = a >= 1000 ? 1 : a >= 1 ? 3 : a >= 0.01 ? 5 : 7
  return v.toLocaleString('en-US', { maximumFractionDigits: d })
}
export const shortWallet = (w: string) => (w ? `${w.slice(0, 6)}…${w.slice(-4)}` : '—')
export const lev = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(v < 10 ? 1 : 0)}×`)
export const clock = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour12: false })
export const tone = (v: number | null | undefined) => (v == null || !Number.isFinite(v) || v === 0 ? '' : v > 0 ? 'is-up' : 'is-down')

/** Open a symbol in the Openfund chart (the Markets page uses the same one-shot handshake). */
export function chartLink(symbol: string) {
  try { sessionStorage.setItem('of-terminal-symbol', symbol) } catch { /* optional */ }
}
