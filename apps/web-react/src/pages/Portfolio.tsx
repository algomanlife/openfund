import { useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import portfolioBody from './portfolio-body.html?raw'
import { useSession, backendUrl } from '../session/useOpenfundSession'
import { RainbowConnect } from '../wallet/RainbowConnect'
import { fetchCmsTranslations } from '../cms/client'
import './portfolio.css'

/**
 * Openfund Portfolio — native analytics hub powered by
 * @luxalgo/journal-core, with the terminal's own header and design.
 * Sections: Dashboard (KPIs + gauges + charts + calendar + activity),
 * Calendar (full monthly), Trades (filterable table), Reports, Journal.
 */

const fmtUsd = (v: number | null | undefined, digits = 2) =>
  v == null || !Number.isFinite(v) ? '—' : `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
const fmtPct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(2)}%`
const fmtNum = (v: number, d = 2) => v.toLocaleString('en-US', { maximumFractionDigits: d })
const tone = (v: number | null | undefined) => v == null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : ''
const fmtDate = (iso: string, fa: boolean) =>
  new Date(iso).toLocaleString(fa ? 'fa-IR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })

type Trade = {
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
  daily: { date: string; netPnl: number; trades: number; wins: number; losses: number; fees: number; grossPnl: number }[]
  drawdown: { maxDrawdown: number; maxDrawdownPct: number | null; peak: number }
  timeZone: string
}

/* ============ SVG chart components ============ */

function Gauge({ value, label }: { value: number | null; label: string }) {
  if (value == null || !Number.isFinite(value)) return <div className="pf-gauge"><span className="val">—</span><span className="lbl">{label}</span></div>
  const pct = Math.max(0, Math.min(1, value))
  const r = 40, cx = 50, cy = 50
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25
  const angle = a0 + (a1 - a0) * pct
  const large = (a1 - a0) * pct > Math.PI ? 1 : 0
  const pt = (a: number) => `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  return (
    <div className="pf-gauge">
      <svg viewBox="0 0 100 60">
        <path d={`M ${pt(a0)} A ${r} ${r} 0 1 1 ${pt(a1)}`} fill="none" stroke="#ffffff18" strokeWidth="8" strokeLinecap="round" />
        <path d={`M ${pt(a0)} A ${r} ${r} 0 ${large} 1 ${pt(angle)}`} fill="none" stroke="#82e7bd" strokeWidth="8" strokeLinecap="round" />
        <text x={cx} y={cy + 2} textAnchor="middle" fill="#eafaf0" fontSize="14" fontWeight="600">{(pct * 100).toFixed(1)}%</text>
      </svg>
      <span className="lbl">{label}</span>
    </div>
  )
}

function Radar({ data }: { data: { label: string; value: number }[] }) {
  if (!data.length) return null
  const W = 200, H = 200, cx = W / 2, cy = H / 2, r = 65
  const angle = (i: number) => (Math.PI * 2 * i) / data.length - Math.PI / 2
  const pt = (i: number, v: number) => {
    const rr = r * Math.max(0, Math.min(1, v))
    return [cx + rr * Math.cos(angle(i)), cy + rr * Math.sin(angle(i))]
  }
  const polygon = data.map((d, i) => pt(i, d.value).join(',')).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pf-radar">
      {[0.25, 0.5, 0.75, 1].map(f => (
        <polygon key={f} points={data.map((_, i) => pt(i, f).join(',')).join(' ')} fill="none" stroke="#ffffff12" strokeWidth="1" />
      ))}
      {data.map((_, i) => {
        const [x, y] = pt(i, 1)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#ffffff12" strokeWidth="1" />
      })}
      <polygon points={polygon} fill="#82e7bd22" stroke="#82e7bd" strokeWidth="2" />
      {data.map((d, i) => {
        const [x, y] = pt(i, 1.18)
        return <text key={i} x={x} y={y} textAnchor="middle" fill="#84928e" fontSize="8">{d.label}</text>
      })}
    </svg>
  )
}

function LineChart({ data, height = 160 }: { data: { t: string; v: number }[]; height?: number }) {
  if (data.length < 2) return <div className="pf-chart-empty" style={{ height }}>—</div>
  const W = 900, H = height, P = 6
  const vals = data.map(d => d.v)
  const min = Math.min(0, ...vals), max = Math.max(0, ...vals)
  const x = (i: number) => P + (i / (data.length - 1)) * (W - 2 * P)
  const y = (v: number) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P)
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.v).toFixed(1)}`).join('')
  const zero = y(0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pf-line-chart" preserveAspectRatio="none" style={{ height }}>
      <line x1={P} x2={W - P} y1={zero} y2={zero} stroke="#ffffff22" strokeDasharray="3 5" />
      <path d={`${path} L${x(data.length - 1)},${zero} L${x(0)},${zero} Z`} fill="#82e7bd14" />
      <path d={path} fill="none" stroke="#82e7bd" strokeWidth="2" />
    </svg>
  )
}

function BarChart({ data, height = 140 }: { data: { date: string; v: number }[]; height?: number }) {
  if (!data.length) return <div className="pf-chart-empty" style={{ height }}>—</div>
  const W = 900, H = height, P = 4
  const maxAbs = Math.max(...data.map(d => Math.abs(d.v)), 1)
  const bw = Math.max(2, (W - 2 * P) / data.length - 1)
  const zero = H / 2
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pf-bar-chart" preserveAspectRatio="none" style={{ height }}>
      <line x1={P} x2={W - P} y1={zero} y2={zero} stroke="#ffffff22" strokeWidth="1" />
      {data.map((d, i) => {
        const h = (Math.abs(d.v) / maxAbs) * (H / 2 - P)
        return <rect key={i} x={P + i * ((W - 2 * P) / data.length)} y={d.v >= 0 ? zero - h : zero}
          width={bw} height={Math.max(1, h)} fill={d.v >= 0 ? '#82e7bd88' : '#e8948388'} rx="1" />
      })}
    </svg>
  )
}

/* ============ Calendar ============ */

function Calendar({ days, fa }: { days: { date: string; netPnl: number; trades: number }[]; fa: boolean }) {
  const [month, setMonth] = useState(() => {
    if (days.length) return days[days.length - 1].date.slice(0, 7)
    return new Date().toISOString().slice(0, 7)
  })
  const byDay = useMemo(() => new Map(days.map(d => [d.date, d])), [days])
  const monthDays = days.filter(d => d.date.startsWith(month))
  const totalPnl = monthDays.reduce((s, d) => s + d.netPnl, 0)
  const totalTrades = monthDays.reduce((s, d) => s + d.trades, 0)
  const [y, mo] = month.split('-').map(Number)
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const firstDow = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay()
  const monthLabel = new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString(fa ? 'fa-IR' : 'en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const weeks: ({ date: string; netPnl: number; trades: number } | null)[][] = [[]]
  for (let i = 0; i < firstDow; i++) weeks[0].push(null)
  for (let d = 1; d <= dim; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`
    weeks[weeks.length - 1].push(byDay.get(iso) || null)
    if (weeks[weeks.length - 1].length === 7) weeks.push([])
  }
  while (weeks[weeks.length - 1]?.length && weeks[weeks.length - 1].length < 7) weeks[weeks.length - 1].push(null)
  const t = (f: string, e: string) => (fa ? f : e)
  return (
    <div className="pf-cal-full">
      <div className="pf-cal-nav">
        <button onClick={() => setMonth(new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7))}>◀</button>
        <h3>{monthLabel}</h3>
        <button onClick={() => setMonth(new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7))}>▶</button>
      </div>
      <div className="pf-cal-dow">
        {(fa ? ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']).map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="pf-cal-grid-full">
        {weeks.flat().map((d, i) => d ? (
          <div key={i} className={`pf-cal-cell ${d.netPnl > 0 ? 'up' : d.netPnl < 0 ? 'down' : ''}`} title={`${d.date}: ${fmtUsd(d.netPnl)} · ${d.trades}`}>
            <span className="d">{Number(d.date.slice(8))}</span>
            {d.trades > 0 && <span className="p">{fmtUsd(d.netPnl, 0)}</span>}
            {d.trades > 0 && <span className="t">{d.trades} {t('معامله', 'tr')}</span>}
          </div>
        ) : <span key={i} className="pf-cal-cell empty" />)}
      </div>
      <div className="pf-cal-summary">
        <span>{t('ماه', 'Month')}: <b className={tone(totalPnl)}>{fmtUsd(totalPnl)}</b></span>
        <span>{t('معاملات', 'Trades')}: <b>{totalTrades}</b></span>
        <span>{t('روزهای معاملاتی', 'Days')}: <b>{monthDays.length}</b></span>
      </div>
    </div>
  )
}

/* ============ Main component ============ */

export default function Portfolio() {
  const session = useSession()
  const [fa, setFa] = useState((window as any).ofLang !== 'en')
  const [walletHost, setWalletHost] = useState<HTMLElement | null>(null)
  const [ov, setOv] = useState<Overview | null>(null)
  const [buckets, setBuckets] = useState<any>(null)
  const [history, setHistory] = useState<{ total: number; trades: Trade[] }>({ total: 0, trades: [] })
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<{ side?: string; status?: string; market?: string; sort?: string }>({})
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'ytd' | 'all'>('all')
  const [detail, setDetail] = useState<any>(null)
  const [noteDraft, setNoteDraft] = useState({ notes: '', tags: '' })
  const [tab, setTab] = useState<'dashboard' | 'calendar' | 'trades' | 'reports' | 'journal'>('dashboard')
  const PER = 20

  const t = (f: string, e: string) => (fa ? f : e)
  const api = useCallback(async (path: string, init?: RequestInit) => {
    const res = await fetch(backendUrl() + path, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
    return res.json().catch(() => null)
  }, [])

  const reload = useCallback(async () => {
    let tf = ''
    if (timeRange !== 'all') {
      const days = { '7d': 7, '30d': 30, '90d': 90, ytd: 365 }[timeRange] || 365
      const from = new Date(Date.now() - days * 86400000).toISOString()
      tf = `&from=${from}`
    }
    const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]).toString()
    const [o, b, h] = await Promise.all([
      api(`/portfolio/overview${tf ? `?${tf.slice(1)}` : ''}`),
      api('/portfolio/buckets'),
      api(`/portfolio/trades?limit=${PER}&offset=${page * PER}&${qs}${tf}`)
    ])
    if (o) setOv(o)
    if (b) setBuckets(b)
    if (h) setHistory(h)
  }, [api, page, filter, timeRange])

  useEffect(() => {
    const h = () => setFa((window as any).ofLang !== 'en')
    addEventListener('of-language', h)
    return () => removeEventListener('of-language', h)
  }, [])

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

  /* wallet chip in terminal header */
  useEffect(() => {
    const nav = document.querySelector('.nav-right')
    if (!nav || document.getElementById('rainbow-portfolio-host')) return
    const host = document.createElement('div')
    host.id = 'rainbow-portfolio-host'
    nav.insertBefore(host, nav.firstChild)
    setWalletHost(host)
    const legacy = document.getElementById('wallet-btn')
    if (legacy) legacy.style.display = 'none'
    return () => { host.remove(); const l = document.getElementById('wallet-btn'); if (l) l.style.display = '' }
  }, [])

  /* legacy runtime */
  useEffect(() => {
    const w = () => window as any
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
          const b = document.getElementById('theme-toggle')
          if (b) {
            const set = (th: string) => {
              document.documentElement.setAttribute('data-theme', th)
              b.textContent = th === 'dark' ? '◐' : '◑'
              try { localStorage.setItem('of-theme', th) } catch { }
            }
            let th = 'dark'
            try { th = localStorage.getItem('of-theme') || 'dark' } catch { }
            set(th)
            if (!(b as any).__ofThemeWired) {
              ;(b as any).__ofThemeWired = true
              b.addEventListener('click', () => set(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'))
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

  /* ALL hooks must run unconditionally — before any early returns */
  const metrics = ov?.metrics as any
  const drawdown = ov?.drawdown
  const radar = useMemo(() => {
    if (!metrics) return []
    return [
      { label: 'Win%', value: metrics.winRate ?? 0 },
      { label: 'PF', value: Math.min(1, (metrics.profitFactor ?? 0) / 3) },
      { label: 'W/L', value: Math.min(1, (metrics.avgWinLossRatio ?? 0) / 3) },
      { label: 'DD', value: 1 - Math.min(1, (drawdown?.maxDrawdownPct ?? 0) * 5) },
      { label: 'Consist', value: Math.min(1, (metrics.tradingDays ?? 0) / 30) },
      { label: 'Volume', value: Math.min(1, (metrics.totalVolume ?? 0) / 100000) },
    ]
  }, [metrics, drawdown])

  if (session.status !== 'authenticated') {
    return (
      <div className='pf-root' dir={fa ? 'rtl' : 'ltr'}>
        {walletHost && createPortal(<RainbowConnect />, walletHost)}
        <div dangerouslySetInnerHTML={{ __html: portfolioBody }} />
        <div className="pf-page container">
          <div className="pf-empty-state">
            <h2>{t('پورتفولیو', 'Portfolio')}</h2>
            <p>{t('برای دیدن پورتفولیو، کیف پولت را وصل کن و وارد شو.', 'Connect your wallet and sign in.')}</p>
          </div>
        </div>
      </div>
    )
  }

  const a = ov?.account as any
  const m = metrics
  const daily = ov?.daily || []
  const equity = ov?.equityCurve || []
  const dd = drawdown



  const dailyBars = daily.map(d => ({ date: d.date, v: d.netPnl }))
  const recent = history.trades.slice(0, 8)
  const header = (
    <>
      {walletHost && createPortal(<RainbowConnect />, walletHost)}
      <div dangerouslySetInnerHTML={{ __html: portfolioBody }} />
    </>
  )

  return (
    <div className='pf-root' dir={fa ? 'rtl' : 'ltr'}>
      {header}
      <div className="pf-page container">
        <div className="pf-timerange">
          {(['7d', '30d', '90d', 'ytd', 'all'] as const).map(r => (
            <button key={r} className={timeRange === r ? 'active' : ''} onClick={() => { setTimeRange(r); setPage(0) }}>
              {r === 'all' ? t('همه', 'All') : r === 'ytd' ? 'YTD' : r.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="pf-layout">
          <nav className="pf-sidebar">
            {([
              ['dashboard', t('داشبورد', 'Dashboard'), '▦'],
              ['calendar', t('تقویم', 'Calendar'), '▤'],
              ['trades', t('معاملات', 'Trades'), '≡'],
              ['reports', t('گزارش‌ها', 'Reports'), '◔'],
              ['journal', t('ژورنال', 'Journal'), '✎'],
            ] as const).map(([id, label, icon]) => (
              <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id as typeof tab)}>
                <span className="ic">{icon}</span>
                <span className="lb">{label}</span>
              </button>
            ))}
          </nav>

          <main className="pf-main">
            {tab === 'dashboard' && (
              <>
                <div className="pf-kpi-row">
                  <Card label={t('سود خالص', 'NET P&L')} value={fmtUsd(a?.netPnl)} tone={tone(a?.netPnl)} big />
                  <Gauge value={m?.winRate} label={t('نرخ برد', 'TRADE WIN %')} />
                  <Card label={t('فاکتور سود', 'PROFIT FACTOR')} value={m?.profitFactorIsInfinite ? '∞' : m?.profitFactor?.toFixed(2) ?? '—'} />
                  <Gauge value={m?.dayWinRate} label={t('نرخ روز برد', 'DAY WIN %')} />
                  <div className="pf-card wl-bar">
                    <span className="k">{t('میانگین س/ز', 'AVG W/L')}</span>
                    <b className="v">{m?.avgWinLossRatio?.toFixed(2) ?? '—'}</b>
                    <small className="s">{t('سود', 'W')}: {fmtUsd(m?.avgWin)} · {t('زیان', 'L')}: {fmtUsd(m?.avgLoss)}</small>
                  </div>
                </div>
                <div className="pf-grid-2">
                  <div className="pf-section">
                    <h2>{t('امتیاز لبه', 'Edge Score')}</h2>
                    <div className="pf-radar-wrap">
                      <Radar data={radar} />
                      <div className="pf-radar-score"><b>{(radar.reduce((s, d) => s + d.value, 0) / (radar.length || 1) * 100).toFixed(1)}</b><span>/100</span></div>
                    </div>
                  </div>
                  <div className="pf-section">
                    <h2>{t('سود تجمعی', 'Daily Net Cumulative P&L')}</h2>
                    <LineChart data={equity.map(e => ({ t: e.t, v: e.cumNetPnl }))} height={100} />
                    <h3>{t('افت نسبی', 'Rel. Drawdown')} · {t('بیشترین', 'Max')} {fmtPct(dd?.maxDrawdownPct)}</h3>
                    <BarChart data={equity.map((e, i) => {
                      const peak = Math.max(...equity.slice(0, i + 1).map(x => x.cumNetPnl), 0)
                      return { date: e.t, v: -(peak - e.cumNetPnl) }
                    })} height={50} />
                  </div>
                </div>
                <div className="pf-grid-2">
                  <div className="pf-section">
                    <h2>{t('سود خالص روزانه', 'Net Daily P&L')}</h2>
                    <BarChart data={dailyBars} height={120} />
                  </div>
                  <div className="pf-section">
                    <h2>{t('اکتیویتی', 'Activity')}</h2>
                    <div className="pf-activity">
                      {recent.map(tr => (
                        <div key={tr.key} className={`act-row ${tr.netPnl >= 0 ? 'win' : 'loss'}`}>
                          <span className="tag">{tr.netPnl >= 0 ? 'WIN' : 'LOSS'}</span>
                          <b>{tr.symbol}</b>
                          <span className="pnl">{fmtUsd(tr.netPnl)}</span>
                        </div>
                      ))}
                      {!recent.length && <p className="pf-empty-line">{t('معامله‌ای نیست', 'No trades')}</p>}
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === 'calendar' && (
              <div className="pf-section">
                <h2>{t('تقویم سود/زیان', 'PnL Calendar')} <small>{ov?.timeZone}</small></h2>
                <Calendar days={daily} fa={fa} />
              </div>
            )}

            {tab === 'trades' && (
              <div className="pf-section">
                <h2>{t('معاملات', 'Trades')} <small>{history.total}</small></h2>
                <div className="pf-filters">
                  <select value={filter.side || ''} onChange={e => setFilter({ ...filter, side: e.target.value })}>
                    <option value="">{t('همه', 'All')}</option>
                    <option value="long">{t('لانگ', 'Long')}</option>
                    <option value="short">{t('شورت', 'Short')}</option>
                  </select>
                  <select value={filter.status || ''} onChange={e => setFilter({ ...filter, status: e.target.value })}>
                    <option value="">{t('همه', 'All')}</option>
                    <option value="open">{t('باز', 'Open')}</option>
                    <option value="closed">{t('بسته', 'Closed')}</option>
                    <option value="liquidated">{t('لیکویید', 'Liq')}</option>
                  </select>
                  <input placeholder={t('نماد…', 'Symbol…')} value={filter.market || ''} onChange={e => setFilter({ ...filter, market: e.target.value })} />
                  <select value={filter.sort || 'closed_desc'} onChange={e => setFilter({ ...filter, sort: e.target.value })}>
                    <option value="closed_desc">{t('جدیدترین', 'Latest')}</option>
                    <option value="pnl_desc">{t('بیشترین سود', 'Most')}</option>
                    <option value="pnl_asc">{t('کمترین', 'Least')}</option>
                  </select>
                </div>
                <table className="pf-table">
                  <thead><tr>
                    <th>{t('نماد', 'Symbol')}</th><th>{t('جهت', 'Side')}</th><th>{t('باز', 'Opened')}</th>
                    <th>{t('بسته', 'Closed')}</th><th>{t('انتری', 'Entry')}</th><th>{t('خروج', 'Exit')}</th>
                    <th>{t('کولترال', 'Collateral')}</th><th>{t('اهرم', 'Lev')}</th>
                    <th>{t('سود خالص', 'Net PnL')}</th><th>{t('کارمزد', 'Fees')}</th><th>{t('وضعیت', 'Status')}</th><th />
                  </tr></thead>
                  <tbody>
                    {history.trades.map(tr => (
                      <tr key={tr.key}>
                        <td><b>{tr.symbol}</b></td>
                        <td className={tr.direction === 'long' ? 'up' : 'down'}>{tr.direction === 'long' ? t('لانگ', 'Long') : t('شورت', 'Short')}</td>
                        <td className="num">{fmtDate(tr.openedAt, fa)}</td>
                        <td className="num">{tr.closedAt ? fmtDate(tr.closedAt, fa) : '—'}</td>
                        <td className="num">{fmtNum(tr.ofEntryPrice)}</td>
                        <td className="num">{tr.ofExitPrice != null ? fmtNum(tr.ofExitPrice) : '—'}</td>
                        <td className="num">{fmtUsd(tr.ofMargin)}</td>
                        <td className="num">{tr.ofLeverage}×</td>
                        <td className={`num ${tone(tr.netPnl)}`}>{fmtUsd(tr.netPnl)}</td>
                        <td className="num">{fmtUsd(tr.fees)}</td>
                        <td><span className={`tag ${tr.ofStatus}`}>{tr.ofStatus}</span></td>
                        <td><button className="act-btn" onClick={() => void openDetail(tr.ofPositionId)}>{t('جزئیات', 'Details')}</button></td>
                      </tr>
                    ))}
                    {!history.trades.length && <tr className="empty-tr"><td colSpan={12}>{t('معامله‌ای نیست', 'No trades')}</td></tr>}
                  </tbody>
                </table>
                <div className="pf-pager">
                  <button disabled={page === 0} onClick={() => setPage(page - 1)}>{t('قبلی', 'Prev')}</button>
                  <span>{page + 1} / {Math.max(1, Math.ceil(history.total / PER))}</span>
                  <button disabled={(page + 1) * PER >= history.total} onClick={() => setPage(page + 1)}>{t('بعدی', 'Next')}</button>
                </div>
              </div>
            )}

            {tab === 'reports' && (
              <>
                <div className="pf-section">
                  <h2>{t('خلاصه حساب', 'Account Summary')}</h2>
                  <div className="pf-cards sm">
                    <Card label={t('موجودی', 'Balance')} value={fmtUsd(a?.balance)} />
                    <Card label={t('ارزش حساب', 'Equity')} value={fmtUsd(a?.equity)} />
                    <Card label={t('سود محقق', 'Realized')} value={fmtUsd(a?.realizedPnl)} tone={tone(a?.realizedPnl)} />
                    <Card label={t('سود شناور', 'Unrealized')} value={fmtUsd(a?.unrealizedPnl)} tone={tone(a?.unrealizedPnl)} />
                    <Card label={t('کل کارمزد', 'Fees')} value={fmtUsd(a?.totalFees)} />
                    <Card label={t('بیشترین افت', 'Max DD')} value={fmtPct(dd?.maxDrawdownPct)} tone="down" />
                  </div>
                </div>
                <div className="pf-buckets">
                  {buckets && <>
                    <BucketTable title={t('نمادها', 'By Symbol')} rows={buckets.bySymbol} fa={fa} />
                    <BucketTable title={t('لانگ/شورت', 'Long/Short')} rows={buckets.byDirection} fa={fa} />
                    <BucketTable title={t('دسته بازار', 'By Category')} rows={buckets.byAssetClass} fa={fa} />
                  </>}
                </div>
              </>
            )}

            {tab === 'journal' && (
              <div className="pf-section">
                <h2>{t('ژورنال معاملات', 'Trade Journal')}</h2>
                <p className="pf-sub">{t('یادداشت‌های شخصی — جدا از داده‌های معاملاتی', 'Personal notes — separate from trading data')}</p>
                {history.trades.filter(tr => tr.closedAt).slice(0, 10).map(tr => (
                  <div key={tr.key} className="pf-journal-row">
                    <div className="jf-meta">
                      <b>{tr.symbol}</b>
                      <span className={tr.direction === 'long' ? 'up' : 'down'}>{tr.direction === 'long' ? t('لانگ', 'Long') : t('شورت', 'Short')}</span>
                      <span className={`pnl ${tone(tr.netPnl)}`}>{fmtUsd(tr.netPnl)}</span>
                    </div>
                    <button className="act-btn" onClick={() => void openDetail(tr.ofPositionId)}>{t('یادداشت', 'Note')}</button>
                  </div>
                ))}
                {!history.trades.filter(tr => tr.closedAt).length && <p className="pf-empty-line">{t('معامله بسته نشده', 'No closed trades')}</p>}
              </div>
            )}
          </main>
        </div>
      </div>

      {detail && (
        <div className="pf-overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <dialog open className="pf-detail" dir={fa ? 'rtl' : 'ltr'}>
            <button className="dialog-close" onClick={() => setDetail(null)}>×</button>
            <h2>{detail.trade.symbol} · {fmtUsd(detail.trade.netPnl)}</h2>
            <div className="pf-detail-grid">
              <Row k={t('شناسه', 'ID')} v={detail.trade.ofPositionId.slice(0, 8) + '…'} />
              <Row k={t('نوع', 'Type')} v={detail.order?.type || 'market'} />
              <Row k={t('باز', 'Opened')} v={fmtDate(detail.trade.ofOpenedAt, fa)} />
              <Row k={t('بسته', 'Closed')} v={detail.trade.ofClosedAt ? fmtDate(detail.trade.ofClosedAt, fa) : '—'} />
              <Row k={t('اندازه', 'Size')} v={`${fmtNum(detail.trade.quantity)} ${detail.trade.symbol.split('/')[0]}`} />
              <Row k={t('کولترال', 'Collateral')} v={fmtUsd(detail.trade.ofMargin)} />
              <Row k={t('اهرم', 'Leverage')} v={`${detail.trade.ofLeverage}×`} />
              <Row k={t('ورود', 'Entry')} v={fmtNum(detail.trade.ofEntryPrice)} />
              <Row k={t('خروج', 'Exit')} v={detail.trade.ofExitPrice != null ? fmtNum(detail.trade.ofExitPrice) : '—'} />
              <Row k={t('دلیل خروج', 'Exit reason')} v={detail.trade.ofExitReason || '—'} />
              <Row k={t('کارمزد باز', 'Open fee')} v={fmtUsd(detail.trade.ofOpenFee)} />
              <Row k={t('کارمزد بستن', 'Close fee')} v={fmtUsd(detail.trade.ofCloseFee)} />
              <Row k={t('سود خالص', 'Net PnL')} v={fmtUsd(detail.trade.netPnl)} tone={tone(detail.trade.netPnl)} />
            </div>
            <h3>{t('دفتر حساب', 'Ledger')}</h3>
            <table className="pf-table sm"><tbody>
              {detail.ledger.map((l: any, i: number) => (
                <tr key={i}><td>{l.event}</td><td className={`num ${tone(Number(l.amount))}`}>{fmtUsd(l.amount)}</td><td className="num">{fmtUsd(l.balanceAfter)}</td></tr>
              ))}
            </tbody></table>
            <h3>{t('یادداشت', 'Note')}</h3>
            <textarea value={noteDraft.notes} maxLength={4000} onChange={e => setNoteDraft({ ...noteDraft, notes: e.target.value })} />
            <input className="pf-tags-input" value={noteDraft.tags} onChange={e => setNoteDraft({ ...noteDraft, tags: e.target.value })} placeholder={t('برچسب‌ها', 'Tags')} />
            <div className="pf-detail-actions">
              <button className="button" onClick={() => void saveNote()}>{t('ذخیره', 'Save')}</button>
            </div>
          </dialog>
        </div>
      )}
    </div>
  )
}

function Card({ label, value, sub, tone: tn, big }: { label: string; value: string; sub?: string; tone?: string; big?: boolean }) {
  return (
    <div className={`pf-card ${tn || ''} ${big ? 'big' : ''}`}>
      <span className="k">{label}</span>
      <b className="v">{value}</b>
      {sub && <small className="s">{sub}</small>}
    </div>
  )
}
function Row({ k, v, tone: tn }: { k: string; v: string; tone?: string }) {
  return <div><span>{k}</span><b className={tn}>{v}</b></div>
}
function BucketTable({ title, rows, fa }: { title: string; rows: any[]; fa: boolean }) {
  if (!rows?.length) return null
  return (
    <div className="pf-bucket">
      <h3>{title}</h3>
      <table><tbody>
        {rows.map((b: any) => (
          <tr key={b.key}><td>{b.key}</td><td className="num">{b.trades}</td>
            <td className={`num ${tone(b.netPnl)}`}>{fmtUsd(b.netPnl)}</td><td className="num">{fmtPct(b.winRate)}</td></tr>
        ))}
      </tbody></table>
      <small>{fa ? 'معاملات / سود / نرخ برد' : 'trades / PnL / win rate'}</small>
    </div>
  )
}
