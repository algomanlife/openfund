/* Trade Radar — public Hyperliquid whale activity, read-only.
   Logic adapted from drkxbt/whales (MIT); presentation is Openfund-native. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTerminal } from '../terminal/TerminalContext'
import { route } from '../terminal/model'
import { usePoll, useNow, radarFetch, usd, signedUsd, pct, price, shortWallet, lev, clock, tone, chartLink, WINDOWS,
  type Window, type Trade, type CoinRow, type Position, type Trader, type WalletProfile, type RadarMarket } from './radarData'
import './radar.css'

type Tab = 'tape' | 'positioning' | 'positions' | 'leaderboard'
const THRESHOLDS = [10_000, 50_000, 100_000, 500_000, 1_000_000]
const LARGE = 500_000

export function Freshness({ state, fetchedAt, updated, stale, error }: { state?: string; fetchedAt: number; updated?: number | null; stale?: boolean; error?: boolean }) {
  const { t } = useTerminal(), now = useNow()
  const age = Math.max(0, Math.round((now - (updated || fetchedAt)) / 1000))
  const kind = error && !fetchedAt ? 'down' : error || stale ? 'stale' : state === 'connecting' || state === 'reconnecting' || state === 'idle' ? 'connecting' : 'live'
  const label = kind === 'down' ? t('داده در دسترس نیست', 'Data unavailable') : kind === 'stale' ? t('دادهٔ قدیمی', 'Stale data') : kind === 'connecting' ? t('در حال اتصال…', 'Connecting…') : t('زنده', 'Live')
  return <span className="of-radar-fresh" data-kind={kind} role="status">
    <i aria-hidden="true" />{label}{fetchedAt > 0 && <span className="of-radar-age"> · <bdi dir="ltr">{age < 60 ? `${age}s` : `${Math.round(age / 60)}m`}</bdi></span>}
  </span>
}

export default function RadarPage() {
  const { t, locale, product } = useTerminal(), navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('tape')
  const [window, setWindow] = useState<Window>('month')
  const [coin, setCoin] = useState('')
  const [min, setMin] = useState(THRESHOLDS[1])
  const [side, setSide] = useState<'' | 'long' | 'short'>('')
  const [walletQuery, setWalletQuery] = useState('')
  const [profile, setProfile] = useState<string | null>(null)
  const markets = usePoll<{ markets: RadarMarket[]; updated: number; stale: boolean }>('/markets', 30_000)
  const coins = useMemo(() => (markets.data?.markets || []).filter(m => (m.dayVolume || 0) > 0).sort((a, b) => (b.dayVolume || 0) - (a.dayVolume || 0)).map(m => m.coin), [markets.data])
  const marketMap = useMemo(() => new Map((markets.data?.markets || []).map(m => [m.coin, m])), [markets.data])
  const walletFilter = walletQuery.trim().toLowerCase()

  const tabs: [Tab, string][] = [
    ['tape', t('معاملات زنده', 'Live tape')],
    ['positioning', t('موقعیت تجمیعی', 'Aggregated positioning')],
    ['positions', t('پوزیشن‌های نهنگ‌ها', 'Whale positions')],
    ['leaderboard', t('لیدربورد', 'Leaderboard')],
  ]
  const openChart = (symbol: string) => { chartLink(symbol); navigate(route(locale, product, 'chart')) }
  const sideLabel = (s: string) => (s === 'long' || s === 'buy' ? t('خرید', 'Long') : t('فروش', 'Short'))

  return <div className="of-radar">
    <header className="of-radar-head">
      <div>
        <p>{t('فعالیت عمومی معامله‌گران بزرگ Hyperliquid: معاملات بزرگ، پوزیشن‌های باز کیف‌پول‌های برتر لیدربورد و سوابق آن‌ها. فقط‌خواندنی؛ همهٔ بازارها یا همهٔ نهنگ‌ها را پوشش نمی‌دهد.',
          'Public Hyperliquid activity from large traders: big trades, the open positions of top leaderboard wallets and their records. Read-only; it does not cover every market or every whale.')}</p>
      </div>
      <Freshness fetchedAt={markets.fetchedAt} updated={markets.data?.updated} stale={markets.data?.stale} error={markets.error} />
    </header>

    <div className="of-radar-tabs" role="tablist" aria-label={t('بخش‌های رادار', 'Radar sections')}>
      {tabs.map(([id, label]) => <button key={id} role="tab" id={`radar-tab-${id}`} aria-controls={`radar-panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1}
        onClick={() => setTab(id)} onKeyDown={e => {
          const i = tabs.findIndex(([x]) => x === tab)
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            const step = (e.key === 'ArrowRight') !== (document.documentElement.dir === 'rtl') ? 1 : -1
            const next = tabs[(i + step + tabs.length) % tabs.length][0]; setTab(next)
            document.getElementById(`radar-tab-${next}`)?.focus()
          }
        }}>{label}</button>)}
    </div>

    <div className="of-radar-filters">
      <label><span>{t('نماد', 'Symbol')}</span>
        <select value={coin} onChange={e => setCoin(e.target.value)}><option value="">{t('همه', 'All')}</option>{coins.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
      {tab === 'tape' && <label><span>{t('حداقل ارزش', 'Minimum value')}</span>
        <select value={min} onChange={e => setMin(Number(e.target.value))}>{THRESHOLDS.map(v => <option key={v} value={v}>{usd(v)}</option>)}</select></label>}
      {tab !== 'leaderboard' && tab !== 'positioning' && <label><span>{t('جهت', 'Side')}</span>
        <select value={side} onChange={e => setSide(e.target.value as typeof side)}>
          <option value="">{t('همه', 'All')}</option><option value="long">{t('خرید', 'Long')}</option><option value="short">{t('فروش', 'Short')}</option></select></label>}
      {tab !== 'tape' && <label><span>{t('بازه', 'Window')}</span>
        <select value={window} onChange={e => setWindow(e.target.value as Window)}>{WINDOWS.map(w => <option key={w} value={w}>{windowLabel(w, t)}</option>)}</select></label>}
      <label className="of-radar-wallet"><span>{t('کیف پول', 'Wallet')}</span>
        <input dir="ltr" value={walletQuery} onChange={e => setWalletQuery(e.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" /></label>
    </div>

    <section id={`radar-panel-${tab}`} role="tabpanel" aria-labelledby={`radar-tab-${tab}`} className="of-radar-panel">
      {tab === 'tape' && <Tape coin={coin} min={min} side={side} wallet={walletFilter} onWallet={setProfile} sideLabel={sideLabel} />}
      {tab === 'positioning' && <Positioning window={window} coin={coin} wallet={walletFilter} marketMap={marketMap} onChart={openChart} onWallet={setProfile} />}
      {tab === 'positions' && <Positions window={window} coin={coin} side={side} wallet={walletFilter} onWallet={setProfile} sideLabel={sideLabel} />}
      {tab === 'leaderboard' && <Leaderboard window={window} wallet={walletFilter} onWallet={setProfile} />}
    </section>

    <p className="of-radar-source">{t('منبع: API عمومی، وب‌سوکت و لیدربورد Hyperliquid. Openfund به Hyperliquid وابسته نیست.', 'Source: Hyperliquid public info API, websocket and leaderboard. Openfund is not affiliated with Hyperliquid.')}</p>
    <WalletDialog wallet={profile} onClose={() => setProfile(null)} sideLabel={sideLabel} />
  </div>
}

function windowLabel(w: Window, t: (fa: string, en: string) => string) {
  return w === 'day' ? t('روز', 'Day') : w === 'week' ? t('هفته', 'Week') : w === 'month' ? t('ماه', 'Month') : t('همهٔ زمان‌ها', 'All time')
}

function Empty({ loading, error, children }: { loading: boolean; error: boolean; children?: React.ReactNode }) {
  const { t } = useTerminal()
  if (loading) return <p className="of-radar-empty" role="status">{t('در حال دریافت…', 'Loading…')}</p>
  if (error) return <p className="of-radar-empty is-error" role="alert">{t('دادهٔ Hyperliquid اکنون در دسترس نیست. چند لحظه بعد دوباره تلاش می‌شود.', 'Hyperliquid data is unavailable right now. Retrying shortly.')}</p>
  return <p className="of-radar-empty">{children ?? t('موردی با این فیلترها نیست.', 'Nothing matches these filters.')}</p>
}

function WalletButton({ wallet, name, onWallet }: { wallet: string; name?: string; onWallet: (w: string) => void }) {
  return <button type="button" className="of-radar-walletbtn" onClick={() => onWallet(wallet)}><bdi dir="ltr">{name || shortWallet(wallet)}</bdi></button>
}

function Tape({ coin, min, side, wallet, onWallet, sideLabel }: { coin: string; min: number; side: string; wallet: string; onWallet: (w: string) => void; sideLabel: (s: string) => string }) {
  const { t } = useTerminal()
  const q = new URLSearchParams({ min: String(min), ...(coin ? { coin } : {}) })
  const tape = usePoll<{ state: string; coins: string[]; lastMessageAt: number | null; trades: Trade[] }>(`/tape?${q}`, 3000)
  const [notify, setNotify] = useState(false)
  const notified = useRef(new Set<string>()), lastNotice = useRef(0)
  const rows = (tape.data?.trades || []).filter(tr => (!side || (side === 'long') === (tr.side === 'buy')) && (!wallet || tr.buyer.includes(wallet) || tr.seller.includes(wallet)))
  useEffect(() => {
    if (!notify || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const fresh = rows.filter(r => !notified.current.has(r.id) && Date.now() - r.time < 60_000)
    rows.forEach(r => notified.current.add(r.id))
    if (!fresh.length || Date.now() - lastNotice.current < 10_000 || document.visibilityState === 'visible') return
    lastNotice.current = Date.now()
    const top = fresh.sort((a, b) => b.usd - a.usd)[0]
    new Notification(t('رادار معاملات', 'Trade Radar'), { body: `${top.coin} ${sideLabel(top.side)} ${usd(top.usd)} @ ${price(top.price)}${fresh.length > 1 ? ` (+${fresh.length - 1})` : ''}`, tag: 'openfund-radar' })
  }, [rows, notify])
  const notificationsSupported = typeof Notification !== 'undefined'
  /* LRI…PDI keeps "$50K" intact inside Persian/Arabic sentences */
  const minimum = `\u2066${usd(min)}\u2069`, markets = tape.data?.coins.length ?? 0
  const toggle = async () => {
    if (notify) return setNotify(false)
    if (!notificationsSupported) return
    const p = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
    if (p === 'granted') { (tape.data?.trades || []).forEach(r => notified.current.add(r.id)); setNotify(true) }
  }
  return <>
    <div className="of-radar-bar">
      <Freshness state={tape.data?.state} fetchedAt={tape.fetchedAt} updated={tape.data?.lastMessageAt} error={tape.error} />
      <span className="of-radar-note">{t(`معاملات بالای ${minimum} در ${markets} بازار پرحجم Hyperliquid`, `Trades of ${minimum}+ on Hyperliquid's ${markets} busiest perps`)}</span>
      {notificationsSupported && <button type="button" className="of-radar-toggle" aria-pressed={notify} onClick={() => void toggle()} disabled={Notification.permission === 'denied'}>
        {Notification.permission === 'denied' ? t('اعلان مرورگر مسدود است', 'Browser notifications blocked') : notify ? t('اعلان‌ها روشن', 'Alerts on') : t('اعلان مرورگر', 'Browser alerts')}</button>}
    </div>
    {!rows.length ? <Empty loading={tape.loading} error={tape.error}>{tape.data?.state === 'live' ? t('هنوز معامله‌ای با این فیلترها ثبت نشده. معاملات جدید خودکار اضافه می‌شوند.', 'No trades match yet. New trades appear automatically.') : undefined}</Empty> :
      <div className="of-radar-table" tabIndex={0} role="region" aria-label={t('معاملات زنده', 'Live tape')}><table>
        <thead><tr><th>{t('زمان', 'Time')}</th><th>{t('نماد', 'Symbol')}</th><th>{t('جهت', 'Side')}</th><th className="r">{t('ارزش', 'Value')}</th><th className="r">{t('قیمت', 'Price')}</th><th>{t('کیف پول', 'Wallet')}</th></tr></thead>
        <tbody>{rows.map(tr => { const taker = tr.side === 'buy' ? tr.buyer : tr.seller
          return <tr key={tr.id} className={tr.usd >= LARGE ? 'is-large' : ''}>
            <td dir="ltr">{clock(tr.time)}</td><td><b>{tr.coin}</b></td>
            <td><span className={`of-radar-side ${tr.side === 'buy' ? 'is-up' : 'is-down'}`}>{sideLabel(tr.side)}</span></td>
            <td className="r" dir="ltr"><b>{usd(tr.usd)}</b></td><td className="r" dir="ltr">{price(tr.price)}</td>
            <td>{taker ? <WalletButton wallet={taker} onWallet={onWallet} /> : '—'}</td></tr> })}</tbody>
      </table></div>}
  </>
}

function Positioning({ window, coin, wallet, marketMap, onChart, onWallet }: { window: Window; coin: string; wallet: string; marketMap: Map<string, RadarMarket>; onChart: (s: string) => void; onWallet: (w: string) => void }) {
  const { t } = useTerminal()
  const data = usePoll<{ coins: CoinRow[]; tracked: number; answered: number; totals: { long: number; short: number }; updated: number; stale: boolean }>(`/positions?window=${window}&top=30`, 60_000)
  const rows = (data.data?.coins || []).filter(r => (!coin || r.coin === coin) && (!wallet || r.holders.some(h => h.wallet.includes(wallet))))
  const answered = data.data?.answered ?? 0, tracked = data.data?.tracked ?? 0
  const longTraders = new Set<string>(), shortTraders = new Set<string>()
  for (const r of data.data?.coins || []) for (const h of r.holders) (h.side === 'long' ? longTraders : shortTraders).add(h.wallet)
  return <>
    <div className="of-radar-bar">
      <Freshness fetchedAt={data.fetchedAt} updated={data.data?.updated} stale={data.data?.stale} error={data.error} />
      {data.data && <span className="of-radar-note">{t(`${answered} از ${tracked} کیف‌پول برتر لیدربورد`, `${answered} of the top ${tracked} leaderboard wallets`)}</span>}
    </div>
    {data.data && <div className="of-radar-cards">
      <Card label={t('معامله‌گران خرید', 'Long traders')} value={String(longTraders.size)} />
      <Card label={t('معامله‌گران فروش', 'Short traders')} value={String(shortTraders.size)} />
      <Card label={t('ارزش کل خرید', 'Total long value')} value={usd(data.data.totals.long)} tone="is-up" />
      <Card label={t('ارزش کل فروش', 'Total short value')} value={usd(data.data.totals.short)} tone="is-down" />
    </div>}
    {!rows.length ? <Empty loading={data.loading} error={data.error} /> :
      <div className="of-radar-table" tabIndex={0} role="region" aria-label={t('موقعیت تجمیعی', 'Aggregated positioning')}><table>
        <thead><tr><th>{t('نماد', 'Symbol')}</th><th className="r">{t('خرید / فروش', 'Long / short')}</th><th>{t('توزیع', 'Distribution')}</th><th className="r">{t('ارزش خرید', 'Long value')}</th><th className="r">{t('ارزش فروش', 'Short value')}</th><th className="r">{t('میانگین ورود خرید', 'Avg long entry')}</th><th className="r">{t('میانگین ورود فروش', 'Avg short entry')}</th><th className="r">{t('تمرکز', 'Concentration')}</th><th /></tr></thead>
        <tbody>{rows.slice(0, 60).map(r => { const of = marketMap.get(r.coin)?.openfund
          return <tr key={r.coin}>
            <td><b>{r.coin}</b> <span className={`of-radar-chg ${tone(r.change)}`} dir="ltr">{pct(r.change)}</span></td>
            <td className="r" dir="ltr">{r.long.traders} / {r.short.traders}</td>
            <td><span className="of-radar-bias" role="img" aria-label={`${Math.round(r.bias * 100)}% ${t('خرید', 'long')}`}><i style={{ inlineSize: `${r.bias * 100}%` }} /></span></td>
            <td className="r is-up" dir="ltr">{usd(r.long.notional)}</td><td className="r is-down" dir="ltr">{usd(r.short.notional)}</td>
            <td className="r" dir="ltr">{price(r.long.entry)}</td><td className="r" dir="ltr">{price(r.short.entry)}</td>
            <td className="r" dir="ltr">{pct(r.concentration, 1).replace('+', '')}</td>
            <td className="of-radar-actions">
              {r.holders[0] && <WalletButton wallet={r.holders[0].wallet} name={r.holders[0].name} onWallet={onWallet} />}
              {of && <button type="button" className="of-radar-link" onClick={() => onChart(of.symbol)}>{t('چارت', 'Chart')}</button>}
            </td></tr> })}</tbody>
      </table></div>}
  </>
}

function Card({ label, value, tone: cls = '' }: { label: string; value: string; tone?: string }) {
  return <div className="of-radar-card"><span>{label}</span><b className={cls} dir="ltr">{value}</b></div>
}

function Positions({ window, coin, side, wallet, onWallet, sideLabel }: { window: Window; coin: string; side: string; wallet: string; onWallet: (w: string) => void; sideLabel: (s: string) => string }) {
  const { t } = useTerminal()
  const data = usePoll<{ positions: Position[]; updated: number; stale: boolean }>(`/positions?window=${window}&top=30`, 60_000)
  const rows = (data.data?.positions || []).filter(p => (!coin || p.coin === coin) && (!side || p.side === side) && (!wallet || p.wallet.includes(wallet)))
  return <>
    <div className="of-radar-bar"><Freshness fetchedAt={data.fetchedAt} updated={data.data?.updated} stale={data.data?.stale} error={data.error} /></div>
    {!rows.length ? <Empty loading={data.loading} error={data.error} /> :
      <div className="of-radar-table" tabIndex={0} role="region" aria-label={t('پوزیشن‌های نهنگ‌ها', 'Whale positions')}><PositionTable rows={rows} onWallet={onWallet} sideLabel={sideLabel} showWallet /></div>}
  </>
}

function PositionTable({ rows, onWallet, sideLabel, showWallet }: { rows: Position[]; onWallet?: (w: string) => void; sideLabel: (s: string) => string; showWallet?: boolean }) {
  const { t } = useTerminal()
  return <table>
    <thead><tr>{showWallet && <th>{t('کیف پول', 'Wallet')}</th>}<th>{t('نماد', 'Symbol')}</th><th>{t('جهت', 'Side')}</th><th className="r">{t('ارزش', 'Value')}</th><th className="r">{t('نقطه ورود', 'Entry')}</th><th className="r">{t('اهرم', 'Leverage')}</th><th className="r">{t('قیمت لیکوییدیشن', 'Liq. price')}</th><th className="r">{t('سود باز', 'Unrealized PnL')}</th></tr></thead>
    <tbody>{rows.map(p => <tr key={`${p.wallet}:${p.coin}`}>
      {showWallet && <td>{onWallet ? <WalletButton wallet={p.wallet} name={p.name} onWallet={onWallet} /> : shortWallet(p.wallet)}</td>}
      <td><b>{p.coin}</b></td><td><span className={`of-radar-side ${p.side === 'long' ? 'is-up' : 'is-down'}`}>{sideLabel(p.side)}</span></td>
      <td className="r" dir="ltr">{usd(p.value)}</td><td className="r" dir="ltr">{price(p.entry)}</td><td className="r" dir="ltr">{lev(p.leverage)}</td>
      <td className="r" dir="ltr">{price(p.liquidation)}</td><td className={`r ${tone(p.upnl)}`} dir="ltr">{signedUsd(p.upnl)}</td></tr>)}</tbody>
  </table>
}

function Leaderboard({ window, wallet, onWallet }: { window: Window; wallet: string; onWallet: (w: string) => void }) {
  const { t } = useTerminal()
  const data = usePoll<{ traders: Trader[]; updated: number; stale: boolean }>(`/board?window=${window}&limit=100`, 120_000)
  const rows = (data.data?.traders || []).filter(r => !wallet || r.wallet.includes(wallet) || r.name.toLowerCase().includes(wallet))
  return <>
    <div className="of-radar-bar"><Freshness fetchedAt={data.fetchedAt} updated={data.data?.updated} stale={data.data?.stale} error={data.error} />
      <span className="of-radar-note">{t('حساب‌هایی با حجم معاملات ماهانهٔ حداقل ۱۰۰ هزار دلار', 'Accounts with at least $100K monthly volume')}</span></div>
    {!rows.length ? <Empty loading={data.loading} error={data.error} /> :
      <div className="of-radar-table" tabIndex={0} role="region" aria-label={t('لیدربورد', 'Leaderboard')}><table>
        <thead><tr><th className="r">#</th><th>{t('معامله‌گر', 'Trader')}</th><th className="r">{t('سود و زیان', 'PnL')}</th><th className="r">{t('بازده', 'ROI')}</th><th className="r">{t('حجم', 'Volume')}</th><th className="r">{t('ارزش حساب', 'Account value')}</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.wallet}>
          <td className="r" dir="ltr">{r.rank}</td><td><WalletButton wallet={r.wallet} name={r.name} onWallet={onWallet} /></td>
          <td className={`r ${tone(r.pnl)}`} dir="ltr">{signedUsd(r.pnl)}</td><td className={`r ${tone(r.roi)}`} dir="ltr">{pct(r.roi, 1)}</td>
          <td className="r" dir="ltr">{usd(r.volume)}</td><td className="r" dir="ltr">{usd(r.accountValue)}</td></tr>)}</tbody>
      </table></div>}
  </>
}

function WalletDialog({ wallet, onClose, sideLabel }: { wallet: string | null; onClose: () => void; sideLabel: (s: string) => string }) {
  const { t } = useTerminal()
  const ref = useRef<HTMLDialogElement>(null)
  const [data, setData] = useState<WalletProfile | null>(null), [error, setError] = useState(false)
  useEffect(() => {
    const d = ref.current; if (!d) return
    if (wallet && !d.open) d.showModal(); else if (!wallet && d.open) d.close()
    setData(null); setError(false)
    if (!wallet) return
    const ctrl = new AbortController()
    radarFetch<WalletProfile>(`/wallet/${wallet}`, ctrl.signal).then(setData, () => { if (!ctrl.signal.aborted) setError(true) })
    return () => ctrl.abort()
  }, [wallet])
  const spark = useMemo(() => sparkline((data?.pnl.month || []).map(p => p.pnl), 320, 64), [data])
  return <dialog ref={ref} className="of-radar-dialog" onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }} aria-labelledby="radar-wallet-title">
    <div className="of-radar-dialog-body">
      <header><h2 id="radar-wallet-title">{data?.name || t('پروفایل کیف پول', 'Wallet profile')}</h2><bdi dir="ltr" className="of-radar-mono">{wallet}</bdi>
        <button type="button" className="of-radar-close" onClick={onClose} aria-label={t('بستن', 'Close')}>×</button></header>
      {error ? <p className="of-radar-empty is-error" role="alert">{t('دادهٔ این کیف پول اکنون در دسترس نیست.', 'This wallet’s data is unavailable right now.')}</p> : !data ? <p className="of-radar-empty" role="status">{t('در حال دریافت…', 'Loading…')}</p> : <>
        <div className="of-radar-cards">
          <Card label={t('ارزش حساب', 'Account value')} value={usd(data.account.accountValue)} />
          <Card label={t('ارزش پوزیشن‌ها', 'Open notional')} value={usd(data.account.notional)} />
          <Card label={t('سود تحقق‌یافته', 'Realized PnL')} value={signedUsd(data.record.realized)} tone={tone(data.record.realized)} />
          <Card label={t('نرخ برد', 'Win rate')} value={data.record.winRate == null ? '—' : `${Math.round(data.record.winRate * 100)}% (${data.record.wins}/${data.record.wins + data.record.losses})`} />
        </div>
        {Object.keys(data.ranks).length > 0 && <p className="of-radar-note">{t('رتبه در لیدربورد', 'Leaderboard rank')}: {Object.entries(data.ranks).map(([w, r]) => `${windowLabel(w as Window, t)} #${r!.rank}`).join(' · ')}</p>}
        {spark.line && <figure className="of-radar-spark"><figcaption>{t('سود و زیان ۳۰ روز اخیر (پرپ)', 'Perp PnL, last 30 days')}</figcaption>
          <svg viewBox="0 0 320 64" role="img" aria-label={t('نمودار سود و زیان', 'PnL chart')}><line x1="0" x2="320" y1={spark.zero} y2={spark.zero} /><path d={spark.line} /></svg></figure>}
        <h3>{t('پوزیشن‌های باز', 'Open positions')}</h3>
        {data.positions.length ? <div className="of-radar-table"><PositionTable rows={data.positions} sideLabel={sideLabel} /></div> : <p className="of-radar-empty">{t('پوزیشن بازی وجود ندارد.', 'No open positions.')}</p>}
        <h3>{t('فعالیت اخیر', 'Recent activity')}</h3>
        {data.fills.length ? <div className="of-radar-table"><table>
          <thead><tr><th>{t('زمان', 'Time')}</th><th>{t('نماد', 'Symbol')}</th><th>{t('اقدام', 'Action')}</th><th className="r">{t('ارزش', 'Value')}</th><th className="r">{t('قیمت', 'Price')}</th><th className="r">{t('نتیجهٔ تحقق‌یافته', 'Realized')}</th></tr></thead>
          <tbody>{data.fills.slice(0, 25).map(f => <tr key={f.id}><td dir="ltr">{new Date(f.time).toLocaleString('en-GB', { hour12: false, month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
            <td><b>{f.coin}</b></td><td dir="ltr">{f.direction}</td><td className="r" dir="ltr">{usd(f.usd)}</td><td className="r" dir="ltr">{price(f.price)}</td>
            <td className={`r ${tone(f.closedPnl)}`} dir="ltr">{f.closedPnl ? signedUsd(f.closedPnl) : '—'}</td></tr>)}</tbody></table></div> : <p className="of-radar-empty">{t('فعالیتی ثبت نشده است.', 'No recorded activity.')}</p>}
      </>}
    </div>
  </dialog>
}

/** SVG path through the values scaled to the box, and the y of zero (adapted from drkxbt/whales). */
function sparkline(values: number[], width: number, height: number, pad = 2) {
  const finite = values.filter(Number.isFinite)
  if (finite.length < 2) return { line: '', zero: height / 2 }
  let lo = Math.min(...finite, 0), hi = Math.max(...finite, 0)
  if (hi === lo) { hi += 1; lo -= 1 }
  const x = (i: number) => (i / (finite.length - 1)) * width, y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (height - pad * 2)
  return { line: `M${finite.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('L')}`, zero: y(0) }
}
