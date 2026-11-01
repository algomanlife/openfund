import { useEffect, useMemo, useState, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { number, text } from '../information/content'
import { MarketIcon, FEATURED_BASES } from './MarketIcon'
import { useGainsMarkets, priceFor } from './useGainsMarkets'
import {
  CATEGORY_ORDER, CATEGORY_LABELS, filterMarkets, formatPrice, groupCounts,
  isStale, type CategoryKey,
} from './marketsData'
import './markets.css'

const PAGE_STEP = 120

/** Markets directory — Gains Network is the authoritative market source.
 *  Prices come from the shared Gains prices WebSocket via the existing
 *  adapter; fields Gains does not provide (volume, 24h change, market cap)
 *  are never invented. Selecting a market deep-links it into the terminal. */
export default function Markets() {
  const locale = useInformationLocale()
  const navigate = useNavigate()
  const { markets, prices, stream, loaded, failed, lastUpdate } = useGainsMarkets()
  const [category, setCategory] = useState<CategoryKey | 'all'>('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE_STEP)
  const searchId = useId()

  /* This page owns a script runtime (the shared Gains adapter). Follow the
     legacy-page teardown contract: leaving reloads the browser so the
     terminal always boots against a clean adapter singleton; the reload is
     cancelled by a re-mount of THIS page (StrictMode / route return). */
  useEffect(() => {
    const w = window as Window & { __ofReloadMarkets?: number | undefined }
    if (w.__ofReloadMarkets) { clearTimeout(w.__ofReloadMarkets); w.__ofReloadMarkets = undefined }
    return () => { w.__ofReloadMarkets = setTimeout(() => location.reload(), 120) as unknown as number }
  }, [])

  const counts = useMemo(() => groupCounts(markets), [markets])
  const total = markets.length
  const visible = useMemo(() => filterMarkets(markets, { category, query }), [markets, category, query])
  const shown = visible.slice(0, limit)

  /* selecting a market hands the symbol to the terminal via sessionStorage
     (the terminal reads it once at boot and selects the market) */
  const openInTerminal = (symbol: string) => {
    try { sessionStorage.setItem('of-terminal-symbol', symbol) } catch { /* optional */ }
    navigate('/terminal')
  }

  const statusLabel = failed && !total
    ? text('Could not reach the data source', 'دریافت داده ممکن نشد')[locale]
    : !loaded ? text('Loading markets…', 'در حال دریافت بازارها…')[locale]
    : stream === 'live' ? text('Live price stream', 'جریان قیمت متصل')[locale]
    : stream === 'reconnecting' ? text('Reconnecting…', 'در حال اتصال مجدد…')[locale]
    : text('Waiting for prices', 'در انتظار قیمت‌ها')[locale]

  return <InformationShell page="markets"
      description={text(
        'Explore every Openfund market — crypto, forex, stocks, indices and commodities — with live Gains Network prices.',
        'همهٔ بازارهای اوپن‌فاند را با قیمت زندهٔ Gains Network ببینید: رمزارز، فارکس، سهام، شاخص و کالا.'
      )[locale]}>
    <Hero locale={locale} page="markets"
      title={text('Explore Openfund', 'بازارهای جهانی')[locale]}
      accent={text('Markets', 'Openfund')[locale]}
      intro={text(
        'Every asset class the Openfund trading ecosystem tracks, with live mark prices straight from Gains Network. Pick a market and take it straight into the terminal.',
        'همهٔ کلاس‌های دارایی که اکوسیستم معاملاتی اوپن‌فاند پوشش می‌دهد، با قیمت Mark مستقیم از Gains Network. بازار را انتخاب کن و مستقیم به ترمینال ببر.'
      )[locale]}>
      <div className="mk-hero-meta">
        <span className={`mk-stream ${stream === 'live' ? 'live' : ''} ${failed ? 'error' : ''}`} role="status">
          <i aria-hidden="true" /> {statusLabel}
        </span>
        {total > 0 && <span>{number(total, locale)} {text('markets', 'بازار')[locale]}</span>}
        {lastUpdate > 0 && <span dir="ltr">{new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Dubai' }).format(lastUpdate)}</span>}
      </div>
    </Hero>

    <MarketConstellation />

    <div className="container mk-body">
      <div className="market-toolbar mk-toolbar" role="group" aria-label={text('Market category', 'دسته بازار')[locale]}>
        <div className="market-tabs">
          <button className={category === 'all' ? 'active' : ''} aria-pressed={category === 'all'} onClick={() => { setCategory('all'); setLimit(PAGE_STEP) }}>
            {text('All', 'همه')[locale]}
          </button>
          {CATEGORY_ORDER.filter(c => (counts[c] || 0) > 0).map(c => (
            <button key={c} className={category === c ? 'active' : ''} aria-pressed={category === c} onClick={() => { setCategory(c); setLimit(PAGE_STEP) }}>
              {CATEGORY_LABELS[c][locale]}
              <small dir="ltr">{number(counts[c] || 0, locale)}</small>
            </button>
          ))}
        </div>
        <label className="search mk-search">
          <span aria-hidden="true">⌕</span>
          <input id={searchId} type="search" autoComplete="off"
            placeholder={text('Search symbol (English works)', 'جست‌وجوی نماد (انگلیسی هم کار می‌کند)')[locale]}
            aria-label={text('Search markets', 'جست‌وجوی بازارها')[locale]}
            value={query}
            onChange={e => { setQuery(e.target.value); setLimit(PAGE_STEP) }} />
          {query && <button className="mk-clear" aria-label={text('Clear search', 'پاک کردن جست‌وجو')[locale]} onClick={() => { setQuery(''); setLimit(PAGE_STEP) }}>×</button>}
        </label>
      </div>

      {!loaded && !failed && <div className="mk-empty mk-loading" role="status">{text('Loading market data…', 'در حال دریافت اطلاعات بازار…')[locale]}</div>}
      {failed && !total && <div className="mk-empty" role="alert">
        <p>{text('Could not reach Gains Network. Check your connection and retry.', 'ارتباط با Gains Network برقرار نشد. اتصال خود را بررسی کن و دوباره تلاش کن.')[locale]}</p>
        <button className="refresh" onClick={() => location.reload()} aria-label={text('Retry', 'تلاش دوباره')[locale]}>↻</button>
      </div>}
      {loaded && visible.length === 0 && <div className="mk-empty">{text('No market matches this search.', 'نمادی با این عبارت پیدا نشد.')[locale]}</div>}

      {visible.length > 0 && <>
        <ul className="mk-grid" key={`${category}|${query}`} role="list">
          {shown.map(m => {
            const p = priceFor(prices, m.symbol)
            const stale = p ? isStale(p) : false
            const freshTick = p ? Date.now() - (p.tickAt || 0) < 1800 : false
            const label = `${m.base}${m.quote ? '/' + m.quote : ''} — ${CATEGORY_LABELS[(m.group || '') as CategoryKey]?.[locale] || m.group || ''}`
            return (
              <li key={m.symbol}>
                <button className="mk-card" onClick={() => openInTerminal(m.symbol)} title={text(`Open ${m.base} in the terminal`, `${m.base} را در ترمینال باز کن`)[locale]} aria-label={label}>
                  <span className="mk-card-head">
                    <MarketIcon base={m.base} group={m.group} size={26} />
                    <span dir="ltr" className="mk-symbol"><b>{m.base}</b>{m.quote ? <small>/{m.quote}</small> : null}</span>
                    <span className={`mk-status ${!m.isOpen ? 'closed' : stale ? 'old' : ''}`}>
                      {!m.isOpen ? text('Closed', 'بسته')[locale] : stale ? text('Stale', 'قدیمی')[locale] : text('Open', 'باز')[locale]}
                    </span>
                  </span>
                  <span className="mk-card-row">
                    <span className="mk-cat">{CATEGORY_LABELS[(m.group || '') as CategoryKey]?.[locale] || m.group || '—'}</span>
                    {m.maxLeverage != null && <span className="numeric mk-lev" dir="ltr">{number(Number(m.maxLeverage) || 0, locale)}×</span>}
                  </span>
                  <span className={`mk-card-row`}>
                    <span className={`numeric price-cell mk-price${p ? '' : ' none'}`}>{p ? formatPrice(p.mark, m.pricePrecision) : '—'}</span>
                    {freshTick && p ? <span className={`mk-tick ${p.direction > 0 ? 'up' : p.direction < 0 ? 'down' : ''}`} aria-hidden="true" /> : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {visible.length > shown.length && (
          <button className="button mk-more" onClick={() => setLimit(l => l + PAGE_STEP)}>
            {text(`Show more (${visible.length - shown.length} remaining)`, `بیشتر نشان بده (${number(visible.length - shown.length, locale)} باقی‌مانده)`)[locale]}
          </button>
        )}
      </>}

      <p className="market-disclaimer">
        {text(
          'Mark prices and market specs come from Gains Network (the data source); leverage and Openfund account terms are independent. Only fields provided by the source are shown.',
          'قیمت Mark و مشخصات بازار مربوط به منبع دادهٔ Gains Network است؛ اهرم و شرایط حساب‌های اوپن‌فاند مستقل است. تنها فیلدهای موجود در منبع نمایش داده می‌شود.'
        )[locale]}
      </p>
      <p className="mk-source">
        <span className="dot" aria-hidden="true" />
        <a href="https://gains.trade" target="_blank" rel="noopener" dir="ltr">Gains Network ↗</a>
        <span>{text('market data source', 'منبع دادهٔ بازار')[locale]}</span>
      </p>
    </div>
  </InformationShell>
}

/* Decorative animated asset universe — real Gains base assets on a slow
   orbit behind the hero. Pure CSS motion; disabled for reduced-motion. */
function MarketConstellation() {
  return <div className="mk-constellation" aria-hidden="true">
    <div className="mk-orbit">
      <i className="mk-orbit-ring" />
      {FEATURED_BASES.map((b, i) => (
        <span key={b} className="mk-orbit-item" style={{ '--angle': `${(i / FEATURED_BASES.length) * 360}deg` } as React.CSSProperties}>
          <span className="mk-orbit-spin"><MarketIcon base={b} size={i % 3 === 0 ? 34 : 26} /></span>
        </span>
      ))}
    </div>
  </div>
}
