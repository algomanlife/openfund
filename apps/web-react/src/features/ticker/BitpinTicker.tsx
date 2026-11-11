import { useEffect, useState } from 'react'
import { formatChange, formatPrice, formatTime, QUOTE_LABEL_FA, subscribeTicker, type TickerQuote, type TickerState } from './bitpin'
import './ticker.css'

/** Persian-only live price strip fixed to the bottom of the public website.
 *  Callers render it for the `fa` locale only. Read-only Bitpin data. */
export default function BitpinTicker() {
  const [state, setState] = useState<TickerState>({ status: 'loading', quotes: [], updatedAt: null })
  useEffect(() => subscribeTicker(setState), [])
  /* reserve the strip's height so it never covers the end of the page */
  useEffect(() => {
    document.documentElement.classList.add('has-bitpin-ticker')
    return () => document.documentElement.classList.remove('has-bitpin-ticker')
  }, [])

  const { status, quotes, updatedAt } = state
  const statusText = status === 'live' ? 'زنده'
    : status === 'delayed' ? `تأخیر در به‌روزرسانی · آخرین: ${updatedAt ? formatTime(updatedAt) : '—'}`
    : status === 'loading' ? 'در حال دریافت قیمت‌ها…'
    : 'قیمت‌ها در دسترس نیست'
  const items = (copy: boolean) => quotes.map(quote => <TickerItem key={(copy ? 'b-' : 'a-') + quote.symbol} quote={quote} />)

  return <aside className="bitpin-ticker" dir="rtl" lang="fa" aria-label="قیمت لحظه‌ای رمزارزها به تومان از بیت‌پین" data-status={status}>
    <div className="bitpin-ticker-source">
      <i aria-hidden="true" className="bitpin-ticker-dot" />
      <span className="bitpin-ticker-status" role="status">{statusText}</span>
      <a className="bitpin-ticker-brand" href="https://bitpin.ir" target="_blank" rel="noopener noreferrer" aria-label="منبع داده: بیت‌پین">بیت‌پین</a>
    </div>
    <div className="bitpin-ticker-viewport">
      {quotes.length > 0 && <div className="bitpin-ticker-track" style={{ ['--ticker-items' as string]: quotes.length }}>
        <ul className="bitpin-ticker-list">{items(false)}</ul>
        {/* second copy only for the seamless loop; hidden from assistive tech */}
        <ul className="bitpin-ticker-list" aria-hidden="true">{items(true)}</ul>
      </div>}
    </div>
  </aside>
}

function TickerItem({ quote }: { quote: TickerQuote }) {
  const direction = quote.change > 0 ? 'up' : quote.change < 0 ? 'down' : 'flat'
  return <li className="bitpin-ticker-item">
    <svg className="bitpin-ticker-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill={quote.color} />
      <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="Ubuntu,sans-serif">{quote.base.slice(0, 1)}</text>
    </svg>
    <span className="bitpin-ticker-name">{quote.name}</span>
    <bdi dir="ltr" className="bitpin-ticker-symbol">{quote.base}</bdi>
    <span className="bitpin-ticker-price"><bdi>{formatPrice(quote.price)}</bdi> <small>{QUOTE_LABEL_FA}</small></span>
    <bdi dir="ltr" className={`bitpin-ticker-change ${direction}`}>{formatChange(quote.change)}</bdi>
  </li>
}
