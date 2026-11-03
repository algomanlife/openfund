import { useEffect, useRef } from 'react'
import { useSession, backendUrl } from '../session/useOpenfundSession'

/**
 * Server trading bridge — connects the legacy terminal to the Openfund
 * backend when the user is authenticated.
 *
 * Exposes `window.__ofServerTP`, an adapter with the SAME surface the
 * terminal uses for its client-side demo provider (`tp`):
 *   state {positions, orders, history, fills, funding, notifications}
 *   getAccount() / validate(req) / liqPrice() / submitAsync(req) /
 *   closePosition(id) / cancelOrder(id) / modifyRisk(id, sl, tp)
 *
 * terminal.js swaps to this provider on the `of-trading-ready` event and
 * re-renders on `of-trading-update`. Unauthenticated visitors keep the
 * clearly-labelled client-side demo engine.
 */
const BACKEND = backendUrl()
  ;(window as any).__ofBackendUrl = BACKEND

export function TradingBridge({ pricing, accountId }: { pricing?: Record<string,number>; accountId?: string } = {}) {
  const pricingRef = useRef(pricing)
  pricingRef.current = pricing
  const session = useSession()

  useEffect(() => {
    if (session.status !== 'authenticated' || !session.user) return

    let es = null
    let stopped = false
    let connection = 'loading'
    let reconnect: ReturnType<typeof setTimeout> | undefined
    const requests = new Set<AbortController>()
    const changed = () => window.dispatchEvent(new CustomEvent('of-trading-update'))
    const n = (v: unknown) => v == null ? null : Number(v)
    let state = { account: null, positions: [], orders: [], history: [] }
    const isFa = () => (window as any).ofLang !== 'en'
    const L = (fa: string, en: string) => (isFa() ? fa : en)
    const scopedPath = (path: string) => path + (accountId ? `${path.includes('?') ? '&' : '?'}account=${encodeURIComponent(accountId)}` : '')

    const fmtAcct = (a: any) => a && {
      balance: n(a.balance), equity: n(a.equity), available: n(a.free_margin),
      marginUsed: Number(a.used_margin), upnl: n(a.unrealized_pnl),
      realized: Number(a.realized_pnl),
      positionCount: state.positions.length, orderCount: state.orders.length
    }

    /* ---------- adapter for terminal.js ---------- */
    const provider = {
      serverMode: true,
      product: 'prop',
      accountId,
      get canTrade() { return !stopped && connection === 'ready' && state.account?.status === 'active' && state.account?.valuation_status === 'fresh' },
      feeRate(market: string) { return pricingRef.current?.[market] ?? null },
      get status() { return connection !== 'ready' ? connection : state.account?.valuation_status === 'stale' ? 'stale' : state.account ? 'ready' : 'loading' },
      get state() {
        const md = (window as any).__ofMark
        return {
          positions: state.positions.map(p => ({
            id: p.id, market: p.market, side: p.side,
            size: Number(p.quantity), entry: Number(p.entry_price), leverage: p.leverage,
            margin: Number(p.margin), currency: state.account?.currency || 'USD', sl: p.sl_price != null ? Number(p.sl_price) : null,
            tp: p.tp_price != null ? Number(p.tp_price) : null,
            liq: n(p.liquidation_price),
            srvPnl: n(p.unrealized_pnl), srvRoi: n(p.roi_pct),
            /* server-authoritative live values for the details dialog */
            srvMark: p.mark_price != null ? Number(p.mark_price) : null,
            realized: p.status !== 'open' ? Number(p.realized_pnl) : null,
            openedAt: new Date(p.opened_at).getTime(), feePaid: Number(p.open_fee)
          })),
          orders: state.orders.map(o => ({
            id: o.id, market: o.market, side: o.side, type: o.order_type,
            size: Number(o.margin) * o.leverage / Number(o.target_price),
            trigger: Number(o.target_price), createdAt: new Date(o.created_at).getTime(),
            margin: Number(o.margin), leverage: o.leverage,
            sl: o.sl_price != null ? Number(o.sl_price) : null, tp: o.tp_price != null ? Number(o.tp_price) : null
          })),
          history: state.history.map(h => ({
            id: h.id, market: h.market, side: h.side,
            size: Number(h.quantity), price: Number(h.exit_price),
            time: new Date(h.closed_at).getTime(),
            type: h.exit_reason === 'sl' ? 'stop-loss'
              : h.exit_reason === 'tp' ? 'take-profit'
              : h.exit_reason === 'liquidation' ? 'liquidation' : 'market-close',
            result: Number(h.realized_pnl) >= 0 ? 'closed-profit' : 'closed-loss'
          })),
          fills: [], funding: [], notifications: []
        }
      },
      getAccount: () => fmtAcct(state.account),
      subscribe() { return () => {} },
      /* terminal.js row actions (SL/TP dialog, details) look positions up by id */
      getPosition(id: string) { return this.state.positions.find(p => p.id === id) },
      checkTriggers() { /* server engine monitors triggers browser-independently */ },
      loadDemoScenario() { /* disabled in server mode — persistent real account */ },
      liqPrice() { return null /* exact liquidation comes from the backend position snapshot */ },
      validate(req: any) {
        const errs: string[] = []
        if(state.account?.status === "permanently_disabled")return [L("این حساب برای همیشه غیرفعال شده است.","This Free Trial is permanently disabled.")]
        if (!provider.canTrade) return [L('دادهٔ حساب یا قیمت به‌روز نیست. دوباره تلاش کن.', 'Account data or prices are stale. Retry.')]
        const a = fmtAcct(state.account)
        if (!a) return [L('حساب معاملاتی در دسترس نیست — دوباره وارد شو.', 'Trading account unavailable — sign in again.')]
        if (!(req.collateral > 0)) errs.push(L('کولترال باید بزرگ‌تر از صفر باشد.', 'Collateral must be positive.'))
        if (req.collateral > a.available) errs.push(L('کولترال از موجودی قابل استفاده بیشتر است.', 'Collateral exceeds available balance.'))
        if (req.type !== 'market' && !(req.price > 0)) errs.push(L('قیمت تریگر نامعتبر است.', 'Invalid trigger price.'))
        return errs
      },
      async previewAsync(req: any) {
        const res=await postRaw('/trading/preview',{market:req.market,side:req.side,order_type:req.type,margin:req.collateral,leverage:req.leverage,target_price:req.type==='market'?null:req.price,sl:req.sl??null,tp:req.tp??null});
        const data=await res.json(); if(!res.ok)throw new Error(data.error || 'Preview unavailable');return data
      },
      async submitAsync(req: any) {
        if (stopped || !provider.canTrade) return { ok:false, errors:provider.validate(req) }
        const key = req.clientId ||= crypto.randomUUID()
        const res = await postRaw('/trading/order', {
            market: req.market, side: req.side, order_type: req.type,
            margin: req.collateral, leverage: req.leverage,
            target_price: req.type === 'market' ? null : req.price,
            sl: req.sl ?? null, tp: req.tp ?? null
          }, key)
        const data = await res.json().catch(() => null)
        if (res.ok && (data.ok || data.duplicate)) {
          await refresh()
          return { ok: true, kind: data.pending ? 'order' : 'position' }
        }
        const reasons: Record<string, string> = {
          insufficient_margin: L('مارجین کافی نیست.', 'Insufficient margin.'),
          leverage_exceeded: L('اهرم بیشتر از سقف بازار است.', 'Leverage exceeds the market limit.'),
          market_closed: L('این بازار بسته است.', 'This market is closed.'),
          stale_price: L('قیمت به‌روز نیست — دوباره تلاش کن.', 'Stale price — try again.'),
          unknown_market: L('بازار نامعتبر است.', 'Unknown market.'),
          sl_above_mark: L('استاپ‌لاس باید زیر قیمت مارک باشد.', 'Stop loss must be below the mark price.'),
          sl_below_mark: L('استاپ‌لاس باید بالای قیمت مارک باشد.', 'Stop loss must be above the mark price.'),
          tp_below_mark: L('تیک‌پرافیت باید بالای قیمت مارک باشد.', 'Take profit must be above the mark price.'),
          tp_above_mark: L('تیک‌پرافیت باید زیر قیمت مارک باشد.', 'Take profit must be below the mark price.'),
          margin_too_small: L('کولترال کمتر از حداقل است.', 'Collateral below the minimum.'),
          target_price_required: L('قیمت تریگر لازم است.', 'Trigger price required.')
        }
        return { ok: false, errors: [reasons[data?.error] || data?.error || L('خطای سرور.', 'Server error.')] }
      },
      async closePosition(id: string, fraction = 1) { await post(`/trading/positions/${id}/close`, { fraction }, crypto.randomUUID()); await refresh() },
      async cancelOrder(id: string) { await post(`/trading/orders/${id}/cancel`, {}); await refresh() },
      async modifyRisk(id: string, sl: number | null, tp: number | null) {
        const res = await postRaw(`/trading/positions/${id}/protection`, { sl, tp })
        const data = await res.json().catch(() => null)
        if (res.ok) { await refresh(); return { ok: true } }
        const map: Record<string, string> = {
          sl_above_mark: L('استاپ‌لاس باید زیر قیمت مارک باشد.', 'SL must be below the mark.'),
          sl_below_mark: L('استاپ‌لاس باید بالای قیمت مارک باشد.', 'SL must be above the mark.'),
          tp_below_mark: L('تیک‌پرافیت باید بالای قیمت مارک باشد.', 'TP must be above the mark.'),
          tp_above_mark: L('تیک‌پرافیت باید زیر قیمت مارک باشد.', 'TP must be below the mark.')
        }
        return { ok: false, errors: [map[data?.error] || data?.error] }
      }
    }

    const post = async (path: string, body: any, key?: string) => { const res = await postRaw(path, body, key); if (!res.ok) { const data = await res.json().catch(() => null); throw new Error(data?.error || `HTTP ${res.status}`) } }
    const postRaw = (path: string, body: any, key?: string) => {
      if (stopped) throw new Error('Account context changed. Review the order again.')
      return fetch(BACKEND + scopedPath(path), {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...(key ? {'Idempotency-Key':key} : {}) }, body: JSON.stringify({ ...body, product:'prop', ...(accountId ? {accountId} : {}) })
      })
    }

    async function refresh() {
      const controller = new AbortController()
      requests.add(controller)
      try {
        const res = await fetch(BACKEND + scopedPath('/trading/state'), { credentials: 'include', signal:controller.signal })
        if (stopped) return
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const nextState = await res.json()
        if (stopped) return
        if (nextState.as_of < (state as any).as_of) return
        state = nextState
        connection = 'ready'
        ;(window as any).__ofServerTP = provider
        window.dispatchEvent(new CustomEvent('of-trading-update'))
      } catch { if (!stopped) { connection = 'disconnected'; changed() } } finally { requests.delete(controller) }
    }

    /* SSE stream: server pushes account/positions changes */
    function connect() {
      if (stopped) return
      try {
        es = new EventSource(BACKEND + scopedPath('/trading/stream'), { withCredentials: true } as any)
        es.onmessage = (ev) => {
          if (stopped) return
          try { const next = JSON.parse(ev.data); if (next.as_of < (state as any).as_of) return; state = next; connection = 'ready' } catch { return }
          ;(window as any).__ofServerTP = provider
          window.dispatchEvent(new CustomEvent('of-trading-update'))
        }
        es.onerror = () => { es?.close(); es = null; connection = 'disconnected'; changed(); reconnect = setTimeout(connect, 3000) }
      } catch { connection = 'disconnected'; changed(); reconnect = setTimeout(connect, 5000) }
    }

    ;(window as any).__ofServerTP = provider
    refresh()                       /* first state load before the swap */
      .then(() => { if (!stopped) window.dispatchEvent(new CustomEvent('of-trading-ready')) })
    connect()
    const onRefresh = () => void refresh()
    addEventListener('of-refresh-trading', onRefresh)
    return () => {
      removeEventListener('of-refresh-trading', onRefresh)
      stopped = true
      clearTimeout(reconnect)
      requests.forEach(c => c.abort())
      es?.close()
      delete (window as any).__ofServerTP
      window.dispatchEvent(new CustomEvent('of-trading-off'))
    }
  }, [session.status, session.user?.id, accountId])

  return null
}
