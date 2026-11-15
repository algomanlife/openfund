/* Market Heatmap — a treemap of Hyperliquid perpetual markets (not a
   liquidation or order-book heatmap). Tile area is a clearly named market
   metric (24h notional volume or open interest — never market cap), colour is
   the real 24h price change. The squarified layout is adapted from
   drkxbt/charts (MIT); tiles are DOM buttons so the map works with keyboard,
   touch and screen readers. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTerminal } from '../terminal/TerminalContext'
import { route } from '../terminal/model'
import { usePoll, usd, pct, price, lev, tone, chartLink, type RadarMarket } from './radarData'
import { Freshness } from './RadarPage'
import { squarify } from './treemap'
import './radar.css'

type Metric = 'dayVolume' | 'openInterest'
type Grouping = 'leverage' | 'openfund'
const HEADER = 22, MAX_CHANGE = 0.1
/** Colour from the change, deeper the further it moves (clamped at ±10%). */
function colour(change: number | null) {
  if (change == null || !Number.isFinite(change)) return 'var(--hm-flat)'
  const t = Math.min(1, Math.abs(change) / MAX_CHANGE), strength = Math.round(18 + t * 72)
  return `color-mix(in srgb, ${change >= 0 ? 'var(--hm-up)' : 'var(--hm-down)'} ${strength}%, var(--hm-flat))`
}

export default function HeatmapPage() {
  const { t, locale, product } = useTerminal(), navigate = useNavigate()
  const data = usePoll<{ markets: RadarMarket[]; updated: number; stale: boolean }>('/markets', 30_000)
  const [metric, setMetric] = useState<Metric>('dayVolume')
  const [grouping, setGrouping] = useState<Grouping>('leverage')
  const [zoom, setZoom] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [box, setBox] = useState<HTMLDivElement | null>(null), [size, setSize] = useState({ w: 0, h: 0 })
  /* measure immediately, on resize, and when data arrives (a first observation can be 0×0 while the shell mounts) */
  const measure = useCallback(() => {
    if (!box) return
    const r = box.getBoundingClientRect(), w = Math.floor(r.width), h = Math.floor(r.height)
    setSize(prev => (prev.w === w && prev.h === h ? prev : { w, h }))
  }, [box])
  useLayoutEffect(() => {
    if (!box) return
    measure()
    const ro = new ResizeObserver(measure); ro.observe(box)
    return () => ro.disconnect()
  }, [box, measure])
  useEffect(measure, [data.fetchedAt, measure])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && zoom) { e.preventDefault(); setZoom(null) } }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [zoom])

  const groupOf = (m: RadarMarket) => grouping === 'openfund'
    ? (m.openfund ? t('قابل معامله در اوپن‌فاند', 'Tradable on Openfund') : t('فقط Hyperliquid', 'Hyperliquid only'))
    : (m.maxLeverage ?? 0) >= 25 ? t('اهرم بالا (۲۵× و بیشتر)', 'High leverage (25×+)') : (m.maxLeverage ?? 0) >= 10 ? t('اهرم متوسط (۱۰–۲۰×)', 'Mid leverage (10–20×)') : t('اهرم پایین (زیر ۱۰×)', 'Low leverage (under 10×)')
  const markets = (data.data?.markets || []).filter(m => (m[metric] ?? 0) > 0)
  const layout = useMemo(() => {
    const groups = new Map<string, RadarMarket[]>()
    for (const m of markets) { const g = groupOf(m); groups.set(g, [...(groups.get(g) || []), m]) }
    const entries = [...groups].map(([name, items]) => ({ name, items, value: items.reduce((s, m) => s + (m[metric] || 0), 0) })).filter(g => !zoom || g.name === zoom)
    const blocks = squarify(entries, { x: 0, y: 0, w: size.w, h: size.h })
    return blocks.map(({ item: g, rect }) => {
      const inner = { x: rect.x + 1, y: rect.y + HEADER, w: Math.max(0, rect.w - 2), h: Math.max(0, rect.h - HEADER - 1) }
      return { name: g.name, rect, count: g.items.length, tiles: squarify(g.items.map(m => ({ m, value: m[metric] || 0 })), inner) }
    })
  }, [markets, metric, grouping, zoom, size, locale])
  const sel = markets.find(m => m.coin === selected) || null
  const metricLabel = metric === 'dayVolume' ? t('حجم معاملات ۲۴ ساعته', '24h notional volume') : t('موقعیت‌های باز (USD)', 'Open interest (USD)')
  const openChart = (symbol: string) => { chartLink(symbol); navigate(route(locale, product, 'chart')) }

  return <div className="of-radar of-heatmap">
    <header className="of-radar-head">
      <div>
        <p>{t('هر کاشی یک بازار دائمی Hyperliquid است؛ اندازه بر اساس شاخص انتخاب‌شده و رنگ بر اساس تغییر قیمت ۲۴ ساعته. این نقشه ارزش بازار یا لیکوییدیشن را نشان نمی‌دهد.',
          'Each tile is a Hyperliquid perpetual market: area follows the selected metric, colour the 24h price change. It does not show market capitalisation or liquidations.')}</p>
      </div>
      <Freshness fetchedAt={data.fetchedAt} updated={data.data?.updated} stale={data.data?.stale} error={data.error} />
    </header>
    <div className="of-radar-filters">
      <label><span>{t('اندازهٔ کاشی', 'Tile size')}</span>
        <select value={metric} onChange={e => setMetric(e.target.value as Metric)}>
          <option value="dayVolume">{t('حجم معاملات ۲۴ ساعته', '24h notional volume')}</option><option value="openInterest">{t('موقعیت‌های باز (USD)', 'Open interest (USD)')}</option></select></label>
      <label><span>{t('گروه‌بندی', 'Grouping')}</span>
        <select value={grouping} onChange={e => { setGrouping(e.target.value as Grouping); setZoom(null) }}>
          <option value="leverage">{t('سقف اهرم', 'Maximum leverage')}</option><option value="openfund">{t('دسترسی در اوپن‌فاند', 'Openfund availability')}</option></select></label>
      <span className="of-radar-chip" title={t('Hyperliquid فقط تغییر ۲۴ ساعته را در یک درخواست ارائه می‌دهد.', 'Hyperliquid serves only the 24h change in one request.')}>{t('بازه: ۲۴ ساعت', 'Window: 24h')}</span>
      <span className="of-hm-legend" aria-hidden="true"><i data-v="-" />−10%<i data-v="0" />0<i data-v="+" />+10%</span>
    </div>
    {zoom && <button type="button" className="of-hm-back" onClick={() => setZoom(null)}>← {t('همهٔ گروه‌ها', 'All groups')} · <b>{zoom}</b> <kbd>Esc</kbd></button>}
    <div className="of-hm-wrap">
      <div className="of-hm" ref={setBox} role="group" aria-label={`${t('نقشه حرارتی بازار', 'Market Heatmap')} — ${metricLabel}`}>
        {!markets.length && <p className="of-radar-empty" role={data.error ? 'alert' : 'status'}>{data.error ? t('دادهٔ بازار Hyperliquid در دسترس نیست.', 'Hyperliquid market data is unavailable.') : t('در حال دریافت…', 'Loading…')}</p>}
        {layout.map(g => <div key={g.name} className="of-hm-group" style={{ left: g.rect.x, top: g.rect.y, width: g.rect.w, height: g.rect.h }}>
          <button type="button" className="of-hm-ghead" disabled={!!zoom} onClick={() => setZoom(g.name)} aria-label={`${g.name} — ${t('بزرگ‌نمایی', 'zoom in')}`}>
            <span dir="auto">{g.name}</span><small dir="ltr">{g.count}</small></button>
          {g.tiles.map(({ item: { m }, rect }) => {
            const small = rect.w < 46 || rect.h < 30, label = `${m.coin}, ${pct(m.change)}, ${metricLabel} ${usd(m[metric])}`
            return <button key={m.coin} type="button" className={`of-hm-tile${selected === m.coin ? ' is-selected' : ''}${small ? ' is-small' : ''}`} aria-label={label} aria-pressed={selected === m.coin}
              style={{ left: rect.x - g.rect.x, top: rect.y - g.rect.y, width: Math.max(0, rect.w - 1), height: Math.max(0, rect.h - 1), background: colour(m.change) }}
              onClick={() => setSelected(m.coin)} onFocus={() => setSelected(m.coin)} onMouseEnter={() => setSelected(m.coin)}>
              {!small && <><b>{m.coin}</b><span dir="ltr">{pct(m.change)}</span></>}
            </button>
          })}
        </div>)}
      </div>
      <aside className="of-hm-detail" aria-live="polite">
        {!sel ? <p className="of-radar-note">{t('روی یک کاشی بروید، لمس کنید یا با Tab انتخاب کنید.', 'Hover, tap or Tab to a tile.')}</p> : <>
          <h2>{sel.coin} <span className={`of-radar-chg ${tone(sel.change)}`} dir="ltr">{pct(sel.change)}</span></h2>
          <dl>
            <div><dt>{t('قیمت مارک', 'Mark price')}</dt><dd dir="ltr">{price(sel.mark)}</dd></div>
            <div><dt>{t('حجم معاملات ۲۴ ساعته', '24h notional volume')}</dt><dd dir="ltr">{usd(sel.dayVolume)}</dd></div>
            <div><dt>{t('موقعیت‌های باز (USD)', 'Open interest (USD)')}</dt><dd dir="ltr">{usd(sel.openInterest)}</dd></div>
            <div><dt>{t('فاندینگ ساعتی', 'Hourly funding')}</dt><dd dir="ltr">{pct(sel.funding, 4)}</dd></div>
            <div><dt>{t('سقف اهرم', 'Maximum leverage')}</dt><dd dir="ltr">{lev(sel.maxLeverage)}</dd></div>
          </dl>
          {sel.openfund ? <button type="button" className="button of-hm-chart" onClick={() => openChart(sel.openfund!.symbol)}>{t('باز کردن چارت در اوپن‌فاند', 'Open chart in Openfund')} · <bdi dir="ltr">{sel.openfund.symbol}</bdi></button>
            : <p className="of-radar-note">{t('این بازار در اوپن‌فاند قابل معامله نیست.', 'This market is not tradable on Openfund.')}</p>}
        </>}
      </aside>
    </div>
    <p className="of-radar-source">{t('منبع: API عمومی Hyperliquid (metaAndAssetCtxs). Openfund به Hyperliquid وابسته نیست.', 'Source: Hyperliquid public info API (metaAndAssetCtxs). Openfund is not affiliated with Hyperliquid.')}</p>
  </div>
}
