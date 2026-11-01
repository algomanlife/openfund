import { useEffect } from 'react'
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

export function TradingBridge() {
  const session = useSession()

  useEffect(() => {
    if (session.status !== 'authenticated' || !session.user) return

    let es = null
    let stopped = false
    let state = { account: null, positions: [], orders: [], history: [] }
    const isFa = () => (window as any).ofLang !== 'en'
    const L = (fa: string, en: string) => (isFa() ? fa : en)

    const fmtAcct = (a: any) => a && {
      balance: Number(a.balance), equity: Number(a.equity), available: Number(a.free_margin),
      marginUsed: Number(a.used_margin), upnl: Number(a.unrealized_pnl),
      realized: Number(a.realized_pnl),
      positionCount: state.positions.length, orderCount: state.orders.length
    }

    /* ---------- adapter for terminal.js ---------- */
    const provider = {
      serverMode: true,
      get state() {
        const md = (window as any).__ofMark
        return {
          positions: state.positions.map(p => ({
            id: p.id, market: p.market, side: p.side,
            size: Number(p.quantity), entry: Number(p.entry_price), leverage: p.leverage,
            margin: Number(p.margin), sl: p.sl_price != null ? Number(p.sl_price) : null,
            tp: p.tp_price != null ? Number(p.tp_price) : null,
            /* engine rule: liquidation at ~90% margin loss (maint 10%) */
            liq: p.side === 'long'
              ? Number(p.entry_price) * (1 - 0.9 / p.leverage)
              : Number(p.entry_price) * (1 + 0.9 / p.leverage),
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
      liqPrice(side: string, entry: number, leverage: number) {
        /* maintenance 10% of margin ⇒ liquidation at ~0.9×margin loss */
        const move = entry * 0.9 / leverage
        return side === 'long' ? entry - move : entry + move
      },
      validate(req: any) {
        const errs: string[] = []
        const a = fmtAcct(state.account)
        if (!a) return [L('حساب معاملاتی در دسترس نیست — دوباره وارد شو.', 'Trading account unavailable — sign in again.')]
        if (!(req.collateral > 0)) errs.push(L('کولترال باید بزرگ‌تر از صفر باشد.', 'Collateral must be positive.'))
        if (req.collateral > a.available) errs.push(L('کولترال از موجودی قابل استفاده بیشتر است.', 'Collateral exceeds available balance.'))
        if (req.type !== 'market' && !(req.price > 0)) errs.push(L('قیمت تریگر نامعتبر است.', 'Invalid trigger price.'))
        return errs
      },
      async submitAsync(req: any) {
        const key = crypto.randomUUID()
        const res = await fetch(BACKEND + '/trading/order', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
          body: JSON.stringify({
            market: req.market, side: req.side, order_type: req.type,
            margin: req.collateral, leverage: req.leverage,
            target_price: req.type === 'market' ? null : req.price,
            sl: req.sl ?? null, tp: req.tp ?? null
          })
        })
        const data = await res.json().catch(() => null)
        if (res.ok && (data.ok || data.duplicate)) {
          refresh()
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
      async closePosition(id: string) { await post(`/trading/positions/${id}/close`, {}); refresh() },
      async cancelOrder(id: string) { await post(`/trading/orders/${id}/cancel`, {}); refresh() },
      async modifyRisk(id: string, sl: number | null, tp: number | null) {
        const res = await postRaw(`/trading/positions/${id}/protection`, { sl, tp })
        const data = await res.json().catch(() => null)
        if (res.ok) { refresh(); return { ok: true } }
        const map: Record<string, string> = {
          sl_above_mark: L('استاپ‌لاس باید زیر قیمت مارک باشد.', 'SL must be below the mark.'),
          sl_below_mark: L('استاپ‌لاس باید بالای قیمت مارک باشد.', 'SL must be above the mark.'),
          tp_below_mark: L('تیک‌پرافیت باید بالای قیمت مارک باشد.', 'TP must be above the mark.'),
          tp_above_mark: L('تیک‌پرافیت باید زیر قیمت مارک باشد.', 'TP must be below the mark.')
        }
        return { ok: false, errors: [map[data?.error] || data?.error] }
      }
    }

    const post = async (path: string, body: any) => { await postRaw(path, body) }
    const postRaw = (path: string, body: any) => fetch(BACKEND + path, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    })

    async function refresh() {
      try {
        const res = await fetch(BACKEND + '/trading/state', { credentials: 'include' })
        if (!res.ok) return
        state = await res.json()
        ;(window as any).__ofServerTP = provider
        window.dispatchEvent(new CustomEvent('of-trading-update'))
      } catch { /* offline — keep last state */ }
    }

    /* SSE stream: server pushes account/positions changes */
    function connect() {
      if (stopped) return
      try {
        es = new EventSource(BACKEND + '/trading/stream', { withCredentials: true } as any)
        es.onmessage = (ev) => {
          try { state = JSON.parse(ev.data) } catch { return }
          ;(window as any).__ofServerTP = provider
          window.dispatchEvent(new CustomEvent('of-trading-update'))
        }
        es.onerror = () => { es?.close(); es = null; setTimeout(connect, 3000) }
      } catch { setTimeout(connect, 5000) }
    }

    ;(window as any).__ofServerTP = provider
    refresh()                       /* first state load before the swap */
      .then(() => window.dispatchEvent(new CustomEvent('of-trading-ready')))
    connect()
    return () => {
      stopped = true
      es?.close()
      delete (window as any).__ofServerTP
      window.dispatchEvent(new CustomEvent('of-trading-off'))
    }
  }, [session.status, session.user?.id])

  return null
}
