/* Market Heatmap — a treemap of Hyperliquid perpetual markets (not a
   liquidation or order-book heatmap). Tile AREA is the selected market metric
   (24h notional volume or open interest — never market cap); tile COLOUR is a
   separate, selectable real value (24h price change or hourly funding) on a
   symmetric scale. Markets too small to label are grouped into a "+N more"
   tile worth exactly their summed metric, which opens them at readable size,
   so area stays proportional at every level. The squarified layout is adapted
   from drkxbt/charts (MIT); tiles are DOM buttons so the map works with
   keyboard, touch and screen readers. Data, polling and sources are unchanged
   (radarData.ts → the backend's shared Hyperliquid cache). */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTerminal } from '../terminal/TerminalContext'
import { route } from '../terminal/model'
import { usePoll, usd, pct, price, lev, tone, chartLink, clock, type RadarMarket } from './radarData'
import { Freshness } from './RadarPage'
import { squarify, collapseSmall, stableOrder, colourWeight, type Rect } from './treemap'
import './radar.css'

type Metric = 'dayVolume' | 'openInterest'
type Grouping = 'leverage' | 'openfund' | 'none'
type ColourBy = 'change' | 'funding'
const HEADER = 24, GAP = 2, MIN_W = 56, MIN_H = 34, ESCAPE_KEY = 'Esc'
const RANGES: Record<ColourBy, number[]> = { change: [0.02, 0.05, 0.1, 0.2], funding: [0.00002, 0.00005, 0.0001, 0.0005] }
const DEFAULT_RANGE: Record<ColourBy, number> = { change: 0.1, funding: 0.0001 }
const OTHERS = '\u0000others'
/* level 0 (a group) may become one "+N" tile; inside a drill-down at least
   one market always stays, so every "+N" level shows something and ends */
const keepAt = (level: number) => (level === 0 ? 0 : 1)

interface Entry { m: RadarMarket | null; key: string; value: number; others?: RadarMarket[] }
interface Laid { group: string; rect: Rect; count: number; tiles: { e: Entry; rect: Rect }[] }

function colour(weight: number | null) {
  if (weight == null) return 'var(--hm-flat)'
  const strength = Math.round(16 + Math.abs(weight) * 74)
  return `color-mix(in srgb, ${weight >= 0 ? 'var(--hm-up)' : 'var(--hm-down)'} ${strength}%, var(--hm-flat))`
}

export default function HeatmapPage() {
  const { t, locale, product } = useTerminal(), navigate = useNavigate()
  const data = usePoll<{ markets: RadarMarket[]; updated: number; stale: boolean }>('/markets', 30_000)
  const [metric, setMetric] = useState<Metric>('dayVolume')
  const [grouping, setGrouping] = useState<Grouping>('leverage')
  const [colourBy, setColourBy] = useState<ColourBy>('change')
  const [range, setRange] = useState(DEFAULT_RANGE.change)
  /* drill-down path: [] → all groups; [g] → group g; [g, OTHERS, …] → its grouped small markets */
  const [path, setPath] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<{ coin: string; x: number; y: number } | null>(null)
  const [query, setQuery] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [box, setBox] = useState<HTMLDivElement | null>(null), [size, setSize] = useState({ w: 0, h: 0 })
  const order = useRef(new Map<string, string[]>())
  const narrow = useMedia('(max-width: 720px)')

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

  const groupOf = useCallback((m: RadarMarket) => grouping === 'none' ? t('همهٔ بازارها', 'All markets')
    : grouping === 'openfund' ? (m.openfund ? t('قابل معامله در اوپن‌فاند', 'Tradable on Openfund') : t('فقط Hyperliquid', 'Hyperliquid only'))
    : (m.maxLeverage ?? 0) >= 25 ? t('اهرم بالا (۲۵× و بیشتر)', 'High leverage (25×+)') : (m.maxLeverage ?? 0) >= 10 ? t('اهرم متوسط (۱۰–۲۰×)', 'Mid leverage (10–20×)') : t('اهرم پایین (زیر ۱۰×)', 'Low leverage (under 10×)'), [grouping, t])
  const markets = useMemo(() => (data.data?.markets || []).filter(m => (m[metric] ?? 0) > 0), [data.data, metric])
  const valueOf = useCallback((m: RadarMarket) => m[metric] || 0, [metric])
  const colourValue = (m: RadarMarket) => (colourBy === 'change' ? m.change : m.funding)

  /* the market list of the current level and where each market lives */
  const levels = useMemo(() => {
    const groups = new Map<string, RadarMarket[]>()
    for (const m of markets) { const g = groupOf(m); groups.set(g, [...(groups.get(g) || []), m]) }
    return groups
  }, [markets, groupOf])

  const scopeOf = useCallback((group: string, level: number) => `t:${grouping}:${metric}:${group}:${level}`, [grouping, metric])
  const ordered = useCallback(<T,>(scope: string, items: T[], key: (x: T) => string, value: (x: T) => number) => {
    const next = stableOrder(items, key, value, order.current.get(scope) ?? null)
    order.current.set(scope, next.map(key))
    return next
  }, [])

  /* one level of a group: labelled markets plus a "+N" entry. Markets whose
     tile would come out too thin or too short to carry even a compact label
     move into "+N" and the level is laid out again (at most three passes).
     Layout, drill-down and search all use this, so "+N" means the same set
     everywhere. Reads the stored tile order without changing it. */
  const split = useCallback((items: RadarMarket[], inner: Rect, level: number, scope: string) => {
    const pool = items.map(m => ({ m, value: valueOf(m) }))
    let { kept, others } = collapseSmall(pool, inner, MIN_W * MIN_H, keepAt(level))
    for (let pass = 0; ; pass++) {
      const entries: Entry[] = stableOrder(kept.map(x => ({ m: x.m, key: x.m.coin, value: x.value })), e => e.key, e => e.value, order.current.get(scope) ?? null)
      if (others.length) entries.push({ m: null, key: OTHERS, value: others.reduce((a, x) => a + x.value, 0), others: others.map(x => x.m) })
      const tiles = squarify(entries, inner, true)
      const thin = new Set(tiles.filter(t => t.item.m && (t.rect.w - GAP < 40 || t.rect.h - GAP < 22)).map(t => t.item.key))
      if (!thin.size || pass >= 2 || kept.length - thin.size < keepAt(level)) return { entries, tiles, others: others.map(x => x.m) }
      others = [...others, ...kept.filter(x => thin.has(x.m.coin))]
      kept = kept.filter(x => !thin.has(x.m.coin))
    }
  }, [valueOf])

  const layout = useMemo((): Laid[] => {
    if (!size.w || !size.h) return []
    const full = { x: 0, y: 0, w: size.w, h: size.h }
    const groupEntries = [...levels].map(([name, items]) => ({ name, items, value: items.reduce((s, m) => s + valueOf(m), 0) }))
    const visible = path.length ? groupEntries.filter(g => g.name === path[0]) : groupEntries
    const blocks = squarify(ordered(`g:${grouping}:${metric}`, visible, g => g.name, g => g.value), full, true)
    return blocks.map(({ item: g, rect }) => {
      const inner = { x: rect.x + GAP / 2, y: rect.y + HEADER, w: Math.max(0, rect.w - GAP), h: Math.max(0, rect.h - HEADER - GAP / 2) }
      /* descend into grouped small markets along the path */
      let items = g.items, level = 0
      for (const step of path.slice(1)) if (step === OTHERS) { items = split(items, inner, level, scopeOf(g.name, level)).others; level++ }
      const scope = scopeOf(g.name, level), { entries, tiles } = split(items, inner, level, scope)
      order.current.set(scope, entries.filter(e => e.m).map(e => e.key))
      return { group: g.name, rect, count: items.length, tiles: tiles.map(({ item, rect }) => ({ e: item, rect })) }
    })
  }, [levels, path, size, metric, grouping, split, ordered, scopeOf])

  /* Escape steps back one level, then closes the details */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (selected) { e.preventDefault(); setSelected(null) } else if (path.length) { e.preventDefault(); setPath(p => p.slice(0, -1)) }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [selected, path])

  const sel = markets.find(m => m.coin === selected) || null
  const hovered = hover ? markets.find(m => m.coin === hover.coin) : null
  const metricLabel = metric === 'dayVolume' ? t('حجم معاملات ۲۴ ساعته', '24h notional volume') : t('موقعیت‌های باز (USD)', 'Open interest (USD)')
  const colourLabel = colourBy === 'change' ? t('تغییر ۲۴ ساعته', '24h change') : t('فاندینگ ساعتی', 'Hourly funding')
  const fmtColour = (v: number | null) => (colourBy === 'change' ? pct(v) : pct(v, 4))
  const openChart = (symbol: string) => { chartLink(symbol); navigate(route(locale, product, 'chart')) }

  /* symbol search: opens the level where the market is and selects it */
  /* symbol search: select the market, then walk the DISPLAYED layout until
     its tile is visible: open its group, then the "+N" tile holding it, one
     level per render. Following what is on screen (not a prediction) stays
     correct when opening the details narrows the map and re-lays it out. */
  const [seek, setSeek] = useState<string | null>(null)
  useEffect(() => {
    if (!seek || !size.w || !layout.length) return
    if (layout.some(g => g.tiles.some(t => t.e.m?.coin === seek))) {
      setSeek(null)
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`.of-hm-tile[data-coin="${CSS.escape(seek)}"]`)?.focus())
      return
    }
    const m = markets.find(x => x.coin === seek)
    if (!m) { setSeek(null); return }
    const g = groupOf(m)
    if (path[0] !== g) { setPath([g]); return }
    const holder = layout.find(l => l.group === g)?.tiles.some(t => !t.e.m && t.e.others?.some(x => x.coin === seek))
    if (holder) setPath(p => [...p, OTHERS]); else setSeek(null)
  }, [seek, size, layout, markets, path, groupOf])
  const find = (raw: string) => {
    const coin = raw.trim().toUpperCase()
    const m = markets.find(x => x.coin.toUpperCase() === coin)
    if (!m) { setNotFound(Boolean(coin)); return }
    setNotFound(false)
    setSelected(m.coin)
    setSeek(m.coin)
  }

  const crumbs = path.map((step, i) => step === OTHERS ? t('بازارهای کوچک‌تر', 'Smaller markets') : step).map((label, i) => ({ label, depth: i + 1 }))
  return <div className="of-radar of-heatmap">
    <header className="of-radar-head">
      <p>{t('هر کاشی یک بازار دائمی Hyperliquid است؛ اندازه بر اساس شاخص انتخاب‌شده و رنگ بر اساس شاخص رنگ. این نقشه ارزش بازار یا لیکوییدیشن را نشان نمی‌دهد.',
        'Each tile is a Hyperliquid perpetual market: area follows the size metric, colour the colour metric. It does not show market capitalisation or liquidations.')}</p>
    </header>

    <div className="of-hm-toolbar">
      <details className="of-hm-controls" open={!narrow}>
        <summary>{t('فیلترها', 'Filters')}</summary>
        <div className="of-radar-filters">
          <label><span>{t('گروه‌بندی', 'Grouping')}</span>
            <select aria-label={t('گروه‌بندی', 'Grouping')} value={grouping} onChange={e => { setGrouping(e.target.value as Grouping); setPath([]) }}>
              <option value="leverage">{t('سقف اهرم', 'Maximum leverage')}</option><option value="openfund">{t('دسترسی در اوپن‌فاند', 'Openfund availability')}</option>
              <option value="none">{t('همهٔ بازارها', 'All markets')}</option></select></label>
          <label><span>{t('اندازهٔ کاشی', 'Tile size')}</span>
            <select aria-label={t('اندازهٔ کاشی', 'Tile size')} value={metric} onChange={e => { setMetric(e.target.value as Metric); setPath([]) }}>
              <option value="dayVolume">{t('حجم معاملات ۲۴ ساعته', '24h notional volume')}</option><option value="openInterest">{t('موقعیت‌های باز (USD)', 'Open interest (USD)')}</option></select></label>
          <label><span>{t('رنگ', 'Colour')}</span>
            <select aria-label={t('رنگ', 'Colour')} value={colourBy} onChange={e => { const c = e.target.value as ColourBy; setColourBy(c); setRange(DEFAULT_RANGE[c]) }}>
              <option value="change">{t('تغییر ۲۴ ساعته', '24h change')}</option><option value="funding">{t('فاندینگ ساعتی', 'Hourly funding')}</option></select></label>
          <label><span>{t('بازهٔ رنگ', 'Colour range')}</span>
            <select aria-label={t('بازهٔ رنگ', 'Colour range')} value={range} onChange={e => setRange(Number(e.target.value))}>
              {RANGES[colourBy].map(r => <option key={r} value={r}>±{colourBy === 'change' ? `${r * 100}%` : `${(r * 100).toFixed(3)}%`}</option>)}</select></label>
          <form className="of-hm-search" role="search" onSubmit={e => { e.preventDefault(); find(query) }}>
            <label><span>{t('جست‌وجوی نماد', 'Search symbol')}</span>
              <input dir="ltr" list="of-hm-coins" value={query} placeholder="BTC" autoComplete="off" spellCheck={false}
                onChange={e => { setQuery(e.target.value); setNotFound(false); if (markets.some(m => m.coin.toUpperCase() === e.target.value.trim().toUpperCase())) find(e.target.value) }} /></label>
            <datalist id="of-hm-coins">{markets.map(m => <option key={m.coin} value={m.coin} />)}</datalist>
            {notFound && <span className="of-hm-notfound" role="status">{t('موردی پیدا نشد', 'No match')}</span>}
          </form>
        </div>
      </details>
      <div className="of-hm-status">
        <Freshness fetchedAt={data.fetchedAt} updated={data.data?.updated} stale={data.data?.stale} error={data.error} />
        {data.data?.updated ? <span className="of-radar-note"><bdi dir="ltr">{clock(data.data.updated)}</bdi></span> : null}
        <span className="of-hm-legend" aria-label={`${colourLabel}: ±${fmtColour(range).replace('+', '')}`}>
          <bdi dir="ltr">−{fmtColour(range).replace('+', '')}</bdi><i className="of-hm-scale" aria-hidden="true" /><bdi dir="ltr">{fmtColour(range)}</bdi>
        </span>
      </div>
    </div>

    {path.length > 0 && <nav className="of-hm-crumbs" aria-label={t('مسیر', 'Path')}>
      <button type="button" onClick={() => setPath([])}>{t('همهٔ گروه‌ها', 'All groups')}</button>
      {crumbs.map(c => <span key={c.depth}><span aria-hidden="true">›</span>{c.depth < path.length
        ? <button type="button" onClick={() => setPath(p => p.slice(0, c.depth))}>{c.label}</button> : <b aria-current="page">{c.label}</b>}</span>)}
      <kbd>{ESCAPE_KEY}</kbd>
    </nav>}

    <div className={`of-hm-wrap${sel ? ' has-detail' : ''}`}>
      <div className="of-hm" ref={setBox} role="group" aria-label={`${t('نقشه حرارتی بازار', 'Market Heatmap')} — ${metricLabel} · ${colourLabel}`} onMouseLeave={() => setHover(null)}>
        {!markets.length && <p className="of-radar-empty" role={data.error ? 'alert' : 'status'}>{data.error ? t('دادهٔ بازار Hyperliquid در دسترس نیست.', 'Hyperliquid market data is unavailable.') : t('در حال دریافت…', 'Loading…')}</p>}
        {layout.map(g => <div key={g.group} className="of-hm-group" style={{ left: g.rect.x, top: g.rect.y, width: g.rect.w, height: g.rect.h }}>
          <button type="button" className="of-hm-ghead" disabled={path.length > 0} onClick={() => setPath([g.group])} aria-label={`${g.group} — ${t('بزرگ‌نمایی', 'zoom in')}`}>
            <span dir="auto">{g.group}</span><small dir="ltr">{g.count}</small></button>
          {g.tiles.map(({ e, rect }) => {
            const style = { left: rect.x - g.rect.x, top: rect.y - g.rect.y, width: Math.max(0, rect.w - GAP), height: Math.max(0, rect.h - GAP) }
            if (!e.m) {
              const n = e.others!.length
              return <button key={e.key} type="button" className="of-hm-tile of-hm-more" style={style}
                onClick={() => setPath(path.length ? [...path, OTHERS] : [g.group])}
                aria-label={`${t('${count} بازار کوچک‌تر', '${count} smaller markets').replace('${count}', String(n))} — ${metricLabel} ${usd(e.value)}`}>
                {rect.w >= 46 && rect.h >= 26 && <><b dir="ltr">+{n}</b>{rect.h >= 40 && <span dir="ltr">{usd(e.value)}</span>}</>}
              </button>
            }
            const m = e.m, cv = colourValue(m), large = rect.w >= 92 && rect.h >= 58, labelled = rect.w >= MIN_W - 1 && rect.h >= MIN_H - 1, compact = !labelled && rect.w >= 40 && rect.h >= 22
            return <button key={e.key} type="button" data-coin={m.coin} className={`of-hm-tile${selected === m.coin ? ' is-selected' : ''}${labelled ? '' : compact ? ' is-compact' : ' is-small'}`}
              aria-label={`${m.coin}, ${colourLabel} ${fmtColour(cv)}, ${metricLabel} ${usd(valueOf(m))}`} aria-pressed={selected === m.coin}
              style={{ ...style, background: colour(colourWeight(cv, range)) }}
              onClick={() => setSelected(s => (s === m.coin ? null : m.coin))}
              onMouseEnter={() => setHover({ coin: m.coin, x: style.left + g.rect.x, y: style.top + g.rect.y })} onFocus={() => setHover({ coin: m.coin, x: style.left + g.rect.x, y: style.top + g.rect.y })} onBlur={() => setHover(null)}>
              {labelled && <><b>{m.coin}</b><span dir="ltr">{fmtColour(cv)}</span>{large && <small dir="ltr">{usd(valueOf(m))}</small>}</>}
              {compact && <b>{m.coin}</b>}
            </button>
          })}
        </div>)}
        {hovered && hover && !narrow && <div className="of-hm-tip" role="tooltip" style={{ left: Math.min(hover.x + 8, Math.max(0, size.w - 220)), top: Math.min(hover.y + 8, Math.max(0, size.h - 120)) }}>
          <b>{hovered.coin}</b>
          <span>{colourLabel} <bdi dir="ltr" className={tone(cv(hovered))}>{fmtColour(cv(hovered))}</bdi></span>
          <span>{metricLabel} <bdi dir="ltr">{usd(valueOf(hovered))}</bdi></span>
          <span>{t('قیمت مارک', 'Mark price')} <bdi dir="ltr">{price(hovered.mark)}</bdi></span>
        </div>}
      </div>
      {sel && <>
        {narrow && <div className="of-hm-sheet-backdrop" onClick={() => setSelected(null)} aria-hidden="true" />}
        <aside className={`of-hm-detail${narrow ? ' is-sheet' : ''}`} aria-live="polite" aria-label={sel.coin} role={narrow ? 'dialog' : undefined} aria-modal={narrow ? true : undefined}>
          <div className="of-hm-detail-head">
            <h2>{sel.coin} <span className={`of-radar-chg ${tone(sel.change)}`} dir="ltr">{pct(sel.change)}</span></h2>
            <button type="button" className="of-radar-close" onClick={() => setSelected(null)} aria-label={t('بستن', 'Close')}>×</button>
          </div>
          <dl>
            <div><dt>{t('قیمت مارک', 'Mark price')}</dt><dd dir="ltr">{price(sel.mark)}</dd></div>
            <div><dt>{t('حجم معاملات ۲۴ ساعته', '24h notional volume')}</dt><dd dir="ltr">{usd(sel.dayVolume)}</dd></div>
            <div><dt>{t('موقعیت‌های باز (USD)', 'Open interest (USD)')}</dt><dd dir="ltr">{usd(sel.openInterest)}</dd></div>
            <div><dt>{t('فاندینگ ساعتی', 'Hourly funding')}</dt><dd dir="ltr">{pct(sel.funding, 4)}</dd></div>
            <div><dt>{t('سقف اهرم', 'Maximum leverage')}</dt><dd dir="ltr">{lev(sel.maxLeverage)}</dd></div>
          </dl>
          {sel.openfund ? <button type="button" className="button of-hm-chart" onClick={() => openChart(sel.openfund!.symbol)}>{t('باز کردن چارت در اوپن‌فاند', 'Open chart in Openfund')} · <bdi dir="ltr">{sel.openfund.symbol}</bdi></button>
            : <p className="of-radar-note">{t('این بازار در اوپن‌فاند قابل معامله نیست.', 'This market is not tradable on Openfund.')}</p>}
        </aside>
      </>}
    </div>
    <p className="of-radar-source">{t('منبع: API عمومی Hyperliquid (metaAndAssetCtxs). Openfund به Hyperliquid وابسته نیست.', 'Source: Hyperliquid public info API (metaAndAssetCtxs). Openfund is not affiliated with Hyperliquid.')}</p>
  </div>

  function cv(m: RadarMarket) { return colourValue(m) }
}

function useMedia(query: string) {
  const [match, setMatch] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query), on = () => setMatch(mq.matches)
    on(); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}
