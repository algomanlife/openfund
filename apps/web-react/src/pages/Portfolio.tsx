import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import portfolioBody from './portfolio-body.html?raw'
import { useSession, backendUrl } from '../session/useOpenfundSession'
import { RainbowConnect } from '../wallet/RainbowConnect'
import { fetchCmsTranslations } from '../cms/client'
import './portfolio.css'

/**
 * Openfund Portfolio — native page (#/portfolio) powered by
 * @luxalgo/journal-core analytics over the user's authoritative demo-account
 * trades (server-side /portfolio/* endpoints, ownership-scoped).
 * fa/en + RTL/LTR + dark/light, landing design tokens.
 */

const fmtUsd = (v: number | null | undefined, digits = 2) =>
  v == null || !Number.isFinite(v) ? '—' : `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
const fmtPct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(2)}%`
const fmtNum = (v: number, d = 4) => v.toLocaleString('en-US', { maximumFractionDigits: d })

interface Trade {
  key: string; ofPositionId: string; symbol: string; direction: 'long' | 'short'
  status: string; openedAt: string; closedAt: string | null
  ofEntryPrice: number; ofExitPrice: number | null; quantity: number
  ofLeverage: number; ofMargin: number; netPnl: number; fees: number
  ofExitReason: string | null; ofOpenFee: number; ofCloseFee: number; durationMs?: number
  ofStatus: string
}
interface Overview {
  account: Record<string, number | string>
  metrics: Record<string, number | null>
  equityCurve: { t: string; cumNetPnl: number }[]
  equityBasis: string
  daily: { date: string; netPnl: number; trades: number; wins: number; losses: number }[]
  drawdown: { maxDrawdown: number; maxDrawdownPct: number | null; peak: number }
  timeZone: string
}

const w = () => window as any

export default function Portfolio() {
  const session = useSession()
  const [walletHost, setWalletHost] = useState<HTMLElement | null>(null)

  /* RainbowKit chip in the SAME terminal header (.nav-right) */
  useEffect(() => {
    const nav = document.querySelector('.nav-right')
    if (!nav || document.getElementById('rainbow-portfolio-host')) return
    const host = document.createElement('div')
    host.id = 'rainbow-portfolio-host'
    nav.insertBefore(host, nav.firstChild)
    setWalletHost(host)
    const legacy = document.getElementById('wallet-btn')
    if (legacy) legacy.style.display = 'none'
    return () => {
      host.remove()
      const l = document.getElementById('wallet-btn')
      if (l) l.style.display = ''
    }
  }, [])

  /* legacy runtime: terminal.css (fonts/colors/header) + locale.js (fa/en) */
  useEffect(() => {
    if (w().__ofReloadPortfolio) { clearTimeout(w().__ofReloadPortfolio); w().__ofReloadPortfolio = null }
    if (!w().__ofLegacyPortfolioLoaded) {
      w().__ofLegacyPortfolioLoaded = true
      void (async () => {
        const cms = await fetchCmsTranslations()
        if (cms) { w().ofCmsLanding = cms.landing; w().ofCmsLandingFa = cms.landingFa }
        const link = document.createElement('link')
        link.rel = 'stylesheet'; link.href = 'legacy/terminal.css'; link.dataset.page = 'portfolio'
        document.head.appendChild(link)
        const sc = document.createElement('script')
        sc.src = 'legacy/locale.js'; sc.async = false; sc.dataset.page = 'portfolio'
        document.body.appendChild(sc)
        const kick = () => {
          if (w().__ofPortfolioKicked) return
          w().__ofPortfolioKicked = true
          document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }))
          /* theme: same toggle as the terminal */
          const b = document.getElementById('theme-toggle')
          if (b) {
            const set = (t: string) => {
              document.documentElement.setAttribute('data-theme', t)
              b.textContent = t === 'dark' ? '◐' : '◑'
              try { localStorage.setItem('of-theme', t) } catch { /* ignore */ }
            }
            let t = 'dark'
            try { t = localStorage.getItem('of-theme') || 'dark' } catch { /* ignore */ }
            set(t)
            if (!(b as any).__ofThemeWired) {
              ;(b as any).__ofThemeWired = true
              b.addEventListener('click', () =>
                set(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'))
            }
          }
        }
        sc.addEventListener('load', kick)
        setTimeout(kick, 1500)
      })()
    }
    const langHandler = () => setFa((window as any).ofLang !== 'en')
    addEventListener('of-language', langHandler)
    return () => {
      removeEventListener('of-language', langHandler)
      w().__ofReloadPortfolio = setTimeout(() => location.reload(), 120)
    }
  }, [])
  const [fa, setFa] = useState((window as any).ofLang !== 'en')
  const [ov, setOv] = useState<Overview | null>(null)
  const [buckets, setBuckets] = useState<any>(null)
  const [history, setHistory] = useState<{ total: number; trades: Trade[] }>({ total: 0, trades: [] })
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<{ side?: string; status?: string; market?: string; sort?: string }>({})
  const [detail, setDetail] = useState<any>(null)
  const [noteDraft, setNoteDraft] = useState<{ notes: string; tags: string }>({ notes: '', tags: '' })
  const [err, setErr] = useState<string | null>(null)
  const PER = 12

  const t = (f: string, e: string) => (fa ? f : e)

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const res = await fetch(backendUrl() + path, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
    if (res.status === 401) { setErr('unauthenticated'); return null }
    return res.json().catch(() => null)
  }, [])

  const reload = useCallback(async () => {
    const [o, b, h] = await Promise.all([
      api('/portfolio/overview'),
      api('/portfolio/buckets'),
      api(`/portfolio/trades?limit=${PER}&offset=${page * PER}&${new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]).toString()}`)
    ])
    if (o) setOv(o)
    if (b) setBuckets(b)
    if (h) setHistory(h)
  }, [api, page, filter])

  useEffect(() => { if (session.status === 'authenticated') void reload() }, [session.status, reload])

  const openDetail = async (id: string) => {
    const d = await api(`/portfolio/trades/${id}`)
    if (d) { setDetail(d); setNoteDraft({ notes: d.note.notes || '', tags: (d.note.tags || []).join(', ') }) }
  }
  const saveNote = async () => {
    if (!detail) return
    await api('/portfolio/notes', {
      method: 'PUT',
      body: JSON.stringify({ tradeKey: detail.trade.key, notes: noteDraft.notes, tags: noteDraft.tags.split(',').map(s => s.trim()).filter(Boolean) })
    })
    setDetail(null)
  }

  const header = (
    <>
      {walletHost && createPortal(<RainbowConnect />, walletHost)}
      <div dangerouslySetInnerHTML={{ __html: portfolioBody }} />
    </>
  )

  if (session.status !== 'authenticated') {
    return (
      <div className='pf-root' dir={fa ? 'rtl' : 'ltr'}>
        {header}
        <div className="pf-page container">
          <div className="pf-empty-state">
            <h2>{t('پورتفولیو', 'Portfolio')}</h2>
            <p>{t('برای دیدن پورتفولیو، ابتدا کیف پولت را وصل کن و وارد شوپن‌فاند شو.', 'Connect your wallet and sign in to view your portfolio.')}</p>
          </div>
        </div>
      </div>
    )
  }

  const a = ov?.account as any
  const m = ov?.metrics as any
  const months = calendarMonths(ov?.daily || [], fa)

  return (
    <div className='pf-root' dir={fa ? 'rtl' : 'ltr'}>
      {header}
      <div className="pf-page container">
      <header className="pf-head">
        <div>
          <h1>{t('پورتفولیو', 'Portfolio')}</h1>
          <p className="pf-sub">{t('تحلیل معاملات حساب دمو — داده‌ها از موتور معاملاتی اوپن‌فاند', 'Demo-account trading analytics — data from the Openfund engine')}</p>
        </div>
      </header>

      {err && <p className="pf-error">{err}</p>}

      {/* A. overview */}
      <section className="pf-cards">
        <Card label={t('موجودی', 'Balance')} value={fmtUsd(a?.balance)} sub={`${t('اولیه', 'Initial')}: ${fmtUsd(a?.initialBalance)}`} />
        <Card label={t('ارزش حساب', 'Equity')} value={fmtUsd(a?.equity)} sub={`${t('مارژین در استفاده', 'Used margin')}: ${fmtUsd(a?.usedMargin)}`} />
        <Card label={t('سود/زیان محقق‌شده', 'Realized PnL')} value={fmtUsd(a?.realizedPnl)} tone={tone(a?.realizedPnl)} />
        <Card label={t('سود/زیان شناور', 'Unrealized PnL')} value={fmtUsd(a?.unrealizedPnl)} tone={tone(a?.unrealizedPnl)} />
        <Card label={t('سود خالص', 'Net PnL')} value={fmtUsd(a?.netPnl)} tone={tone(a?.netPnl)} />
        <Card label={t('کل کارمزدها', 'Total fees')} value={fmtUsd(a?.totalFees)} />
        <Card label={t('موقعیت باز', 'Open positions')} value={String(a?.openPositions ?? '—')} />
        <Card label={t('کل معاملات', 'Total trades')} value={String(a?.totalTrades ?? '—')} />
      </section>

      {/* B. metrics */}
      <section className="pf-section">
        <h2>{t('تحلیل عملکرد', 'Performance analytics')}</h2>
        <div className="pf-cards sm">
          <Card label={t('نرخ برد', 'Win rate')} value={fmtPct(m?.winRate)} />
          <Card label={t('فاکتور سود', 'Profit factor')} value={m?.profitFactorIsInfinite ? '∞' : m?.profitFactor?.toFixed(2) ?? '—'} />
          <Card label={t('میانگین سود', 'Avg win')} value={fmtUsd(m?.avgWin)} tone="up" />
          <Card label={t('میانگین زیان', 'Avg loss')} value={fmtUsd(m?.avgLoss)} tone="down" />
          <Card label={t('بزرگ‌ترین سود', 'Largest win')} value={fmtUsd(m?.largestWin)} tone="up" />
          <Card label={t('بزرگ‌ترین زیان', 'Largest loss')} value={fmtUsd(m?.largestLoss)} tone="down" />
          <Card label={t('میانگین مدت', 'Avg duration')} value={m?.avgDurationMs ? fmtDur(m.avgDurationMs, fa) : '—'} />
          <Card label={t('روزهای معاملاتی', 'Trading days')} value={String(m?.tradingDays ?? '—')} />
          <Card label={t('بیشترین افت (مقدار)', 'Max drawdown')} value={fmtUsd(ov?.drawdown?.maxDrawdown)} tone="down" />
          <Card label={t('بیشترین افت (درصد)', 'Max drawdown %')} value={fmtPct(ov?.drawdown?.maxDrawdownPct)} tone="down" />
          <Card label={t('بیشترین سقف', 'Peak')} value={fmtUsd((ov?.drawdown?.peak || 0))} />
          <Card label={t('انتظار ریاضی', 'Expectancy')} value={fmtUsd(m?.expectancy)} tone={tone(m?.expectancy)} />
        </div>
        {buckets && (
          <div className="pf-buckets">
            <BucketTable title={t('عملکرد نمادها', 'By symbol')} rows={buckets.bySymbol} fa={fa} />
            <BucketTable title={t('لانگ در برابر شورت', 'Long vs Short')} rows={buckets.byDirection} fa={fa} />
            <BucketTable title={t('دسته بازار', 'By asset class')} rows={buckets.byAssetClass} fa={fa} />
          </div>
        )}
      </section>

      {/* C/D. equity + drawdown (realized-basis, honest label) */}
      <section className="pf-section">
        <h2>{t('منحنی سود (محقق‌شده)', 'Equity curve (realized)')}
          <small>{t('مجموع سود خالص در هر بسته‌شدن معامله — بدون داده تاریخی مارک‌تو‌مارکت', 'Cumulative net PnL at each trade close — no historical mark-to-market data')}</small>
        </h2>
        <Curve data={ov?.equityCurve || []} />
      </section>

      {/* E. PnL calendar */}
      <section className="pf-section">
        <h2>{t('تقویم سود/زیان', 'PnL calendar')} <small>{t('سود خالص روزانه محقق‌شده', 'Daily realized net PnL')} · {ov?.timeZone}</small></h2>
        <div className="pf-cal">
          {months.map(({ label, weeks }) => (
            <div key={label} className="pf-cal-month">
              <h3>{label}</h3>
              <div className="pf-cal-grid">
                {weeks.flat().map((d, i) => (
                  d ? <div key={i} className={`pf-cal-day ${d.netPnl > 0 ? 'up' : d.netPnl < 0 ? 'down' : ''}`} title={`${d.date} · ${fmtUsd(d.netPnl)} · ${d.trades}`}>
                    <span className="d">{Number(d.date.slice(8))}</span>
                    <span className="v">{d.trades ? fmtUsd(d.netPnl, 0) : ''}</span>
                  </div> : <span key={i} className="pf-cal-day empty" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* F. history */}
      <section className="pf-section">
        <h2>{t('تاریخچه معاملات', 'Trading history')} <small>{history.total} {t('معامله', 'trades')}</small></h2>
        <div className="pf-filters">
          <select value={filter.side || ''} onChange={e => setFilter({ ...filter, side: e.target.value })}>
            <option value="">{t('همه جهات', 'All sides')}</option>
            <option value="long">{t('لانگ', 'Long')}</option>
            <option value="short">{t('شورت', 'Short')}</option>
          </select>
          <select value={filter.status || ''} onChange={e => setFilter({ ...filter, status: e.target.value })}>
            <option value="">{t('همه وضعیت‌ها', 'All statuses')}</option>
            <option value="open">{t('باز', 'Open')}</option>
            <option value="closed">{t('بسته', 'Closed')}</option>
            <option value="liquidated">{t('لیکویید', 'Liquidated')}</option>
          </select>
          <input placeholder={t('جستجوی نماد…', 'Search symbol…')} value={filter.market || ''}
            onChange={e => setFilter({ ...filter, market: e.target.value })} />
          <select value={filter.sort || 'closed_desc'} onChange={e => setFilter({ ...filter, sort: e.target.value })}>
            <option value="closed_desc">{t('جدیدترین بسته', 'Latest close')}</option>
            <option value="pnl_desc">{t('بیشترین سود', 'Most profit')}</option>
            <option value="pnl_asc">{t('کمترین سود', 'Least profit')}</option>
          </select>
        </div>
        <table className="pf-table">
          <thead>
            <tr>
              <th>{t('نماد', 'Symbol')}</th><th>{t('جهت', 'Side')}</th>
              <th>{t('باز', 'Opened')}</th><th>{t('بسته', 'Closed')}</th>
              <th>{t('انتری', 'Entry')}</th><th>{t('خروج', 'Exit')}</th>
              <th>{t('کولترال', 'Collateral')}</th><th>{t('اهرم', 'Lev')}</th>
              <th>{t('سود خالص', 'Net PnL')}</th><th>{t('کارمزد', 'Fees')}</th>
              <th>{t('وضعیت', 'Status')}</th><th />
            </tr>
          </thead>
          <tbody>
            {history.trades.map(tr => (
              <tr key={tr.key}>
                <td><b>{tr.symbol}</b></td>
                <td className={tr.direction === 'long' ? 'up' : 'down'}>{tr.direction === 'long' ? t('لانگ', 'Long') : t('شورت', 'Short')}</td>
                <td className="num">{fmtDate(tr.openedAt, fa)}</td>
                <td className="num">{tr.closedAt ? fmtDate(tr.closedAt, fa) : '—'}</td>
                <td className="num">{fmtNum(tr.ofEntryPrice, 2)}</td>
                <td className="num">{tr.ofExitPrice != null ? fmtNum(tr.ofExitPrice, 2) : '—'}</td>
                <td className="num">{fmtUsd(tr.ofMargin)}</td>
                <td className="num">{tr.ofLeverage}×</td>
                <td className={`num ${tone(tr.netPnl)}`}>{fmtUsd(tr.netPnl)}</td>
                <td className="num">{fmtUsd(tr.fees)}</td>
                <td><span className={`tag ${tr.status}`}>{t(EXIT_FA[tr.ofStatus] || tr.ofStatus, tr.ofStatus)}</span></td>
                <td><button className="act-btn" onClick={() => void openDetail(tr.ofPositionId)}>{t('جزئیات', 'Details')}</button></td>
              </tr>
            ))}
            {!history.trades.length && <tr className="empty-tr"><td colSpan={12}>{t('هنوز معامله‌ای نداری — از ترمینال شروع کن.', 'No trades yet — start from the terminal.')}</td></tr>}
          </tbody>
        </table>
        <div className="pf-pager">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>{t('قبلی', 'Prev')}</button>
          <span>{page + 1} / {Math.max(1, Math.ceil(history.total / PER))}</span>
          <button disabled={(page + 1) * PER >= history.total} onClick={() => setPage(page + 1)}>{t('بعدی', 'Next')}</button>
        </div>
      </section>

      {/* G. trade details dialog */}
      {detail && (
        <div className="pf-overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <dialog open className="pf-detail" dir={fa ? 'rtl' : 'ltr'}>
            <button className="dialog-close" onClick={() => setDetail(null)}>×</button>
            <h2>{detail.trade.symbol} · {detail.trade.direction === 'long' ? t('لانگ', 'Long') : t('شورت', 'Short')} · {fmtUsd(detail.trade.netPnl)}</h2>
            <div className="pf-detail-grid">
              <Row k={t('شناسه معامله', 'Trade ID')} v={detail.trade.ofPositionId.slice(0, 8) + '…'} />
              <Row k={t('نوع سفارش', 'Order type')} v={detail.order?.type || 'market'} />
              <Row k={t('باز', 'Opened')} v={fmtDate(detail.trade.ofOpenedAt, fa)} />
              <Row k={t('بسته', 'Closed')} v={detail.trade.ofClosedAt ? fmtDate(detail.trade.ofClosedAt, fa) : '—'} />
              <Row k={t('اندازه', 'Size')} v={`${fmtNum(detail.trade.quantity)} ${detail.trade.symbol.split('/')[0]}`} />
              <Row k={t('کولترال', 'Collateral')} v={fmtUsd(detail.trade.ofMargin)} />
              <Row k={t('اهرم', 'Leverage')} v={`${detail.trade.ofLeverage}×`} />
              <Row k={t('قیمت ورود', 'Entry')} v={fmtNum(detail.trade.ofEntryPrice, 2)} />
              <Row k={t('قیمت خروج', 'Exit')} v={detail.trade.ofExitPrice != null ? fmtNum(detail.trade.ofExitPrice, 2) : '—'} />
              <Row k={t('دلیل خروج', 'Exit reason')} v={detail.trade.ofExitReason || '—'} />
              <Row k={t('کارمزد باز', 'Open fee')} v={fmtUsd(detail.trade.ofOpenFee)} />
              <Row k={t('کارمزد بستن', 'Close fee')} v={fmtUsd(detail.trade.ofCloseFee)} />
              <Row k={t('سود خالص', 'Net PnL')} v={fmtUsd(detail.trade.netPnl)} tone={tone(detail.trade.netPnl)} />
            </div>
            <h3>{t('دفتر حساب', 'Ledger')}</h3>
            <table className="pf-table sm">
              <tbody>
                {detail.ledger.map((l: any, i: number) => (
                  <tr key={i}><td>{l.event}</td><td className={`num ${tone(Number(l.amount))}`}>{fmtUsd(l.amount)}</td><td className="num">{fmtUsd(l.balanceAfter)}</td></tr>
                ))}
              </tbody>
            </table>
            <h3>{t('یادداشت شخصی (اختیاری)', 'Personal note (optional)')}</h3>
            <textarea value={noteDraft.notes} maxLength={4000} onChange={e => setNoteDraft({ ...noteDraft, notes: e.target.value })}
              placeholder={t('مشاهدات، استراتژی، بازبینی…', 'Observations, strategy, review…')} />
            <input className="pf-tags-input" value={noteDraft.tags} onChange={e => setNoteDraft({ ...noteDraft, tags: e.target.value })}
              placeholder={t('برچسب‌ها با ویرگول', 'Tags, comma separated')} />
            <div className="pf-detail-actions">
              <button className="button" onClick={() => void saveNote()}>{t('ذخیره یادداشت', 'Save note')}</button>
            </div>
          </dialog>
        </div>
      )}
      </div>
    </div>
  )
}

/* ---------- small building blocks (landing design tokens) ---------- */
function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`pf-card ${tone || ''}`}>
      <span className="k">{label}</span>
      <b className="v">{value}</b>
      {sub && <small className="s">{sub}</small>}
    </div>
  )
}
function Row({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return <div><span>{k}</span><b className={tone}>{v}</b></div>
}
function BucketTable({ title, rows, fa }: { title: string; rows: any[]; fa: boolean }) {
  if (!rows?.length) return null
  return (
    <div className="pf-bucket">
      <h3>{title}</h3>
      <table>
        <tbody>
          {rows.map((b: any) => (
            <tr key={b.key}>
              <td>{b.key}</td>
              <td className="num">{b.trades}</td>
              <td className={`num ${tone(b.netPnl)}`}>{fmtUsd(b.netPnl)}</td>
              <td className="num">{fmtPct(b.winRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <small>{fa ? 'کل معاملات / سود خالص / نرخ برد' : 'trades / net PnL / win rate'}</small>
    </div>
  )
}
function Curve({ data }: { data: { t: string; cumNetPnl: number }[] }) {
  if (data.length < 2) return <p className="pf-empty-line">—</p>
  const W = 900, H = 180, P = 8
  const vals = data.map(d => d.cumNetPnl)
  const min = Math.min(0, ...vals), max = Math.max(0, ...vals)
  const x = (i: number) => P + (i / (data.length - 1)) * (W - 2 * P)
  const y = (v: number) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P)
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.cumNetPnl).toFixed(1)}`).join('')
  const zero = y(0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pf-curve" preserveAspectRatio="none">
      <line x1={P} x2={W - P} y1={zero} y2={zero} className="zero" />
      <path d={path} className="line" />
      <path d={`${path} L${x(data.length - 1)},${zero} L${x(0)},${zero} Z`} className="fill" />
    </svg>
  )
}

/* ---------- helpers ---------- */
const EXIT_FA: Record<string, string> = { open: 'باز', closed: 'بسته', liquidated: 'لیکویید' }
const tone = (v: number | null | undefined) => v == null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : ''
const fmtDate = (iso: string, fa: boolean) =>
  new Date(iso).toLocaleString(fa ? 'fa-IR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })
const fmtDur = (ms: number, fa: boolean) => {
  const mins = Math.round(ms / 60000)
  const h = Math.floor(mins / 60)
  return fa ? `${h ? h + ' ساعت ' : ''}${mins % 60} دقیقه` : `${h ? h + 'h ' : ''}${mins % 60}m`
}
function calendarMonths(days: { date: string; netPnl: number; trades: number }[], fa: boolean) {
  if (!days.length) return []
  const byDay = new Map(days.map(d => [d.date, d]))
  const first = new Date(days[0].date + 'T00:00:00Z'), last = new Date(days[days.length - 1].date + 'T00:00:00Z')
  const out: { label: string; weeks: ({ date: string; netPnl: number; trades: number } | null)[][] }[] = []
  const cur = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1))
  while (cur <= last) {
    const y = cur.getUTCFullYear(), mo = cur.getUTCMonth()
    const label = new Date(Date.UTC(y, mo, 1)).toLocaleDateString(fa ? 'fa-IR' : 'en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    const weeks: ({ date: string; netPnl: number; trades: number } | null)[][] = [[]]
    const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()
    for (let d = 1; d <= dim; d++) {
      const iso = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      weeks[weeks.length - 1].push(byDay.get(iso) || null)
      if (weeks[weeks.length - 1].length === 7) weeks.push([])
    }
    while (weeks[weeks.length - 1].length && weeks[weeks.length - 1].length < 7) weeks[weeks.length - 1].push(null)
    out.push({ label, weeks })
    cur.setUTCMonth(cur.getUTCMonth() + 1)
  }
  return out
}
