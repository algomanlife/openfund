import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import InformationShell, { useInformationLocale } from '../information/InformationShell'
import { text, tx } from '../information/content'
import { intlLocale, pickFormat } from '../../i18n/locales'
import { apiFetch } from '../../session/useOpenfundSession'
import DirArrow from '../../ui/DirArrow'
import { ObjectiveCards, useLive, type Rules } from '../objectives/TradingObjectivesPage'
import { LabHeroArt } from './labsArt'
import { setLabsStatus } from './labsStatus'
import '../objectives/objectives.css'
import './labs.css'

/* /:locale/labs: limited drops (ADR 0055). Every figure comes from GET /labs
   (the published drop, its real inventory and sales, and the standard plans
   it is compared with). No drop is defined in code: until the owner
   publishes one in Backstage, the page says so. */
type L = { en: string; fa: string }
const c = {
  eyebrow: text('Openfund Labs', 'آزمایشگاه اوپن‌فاند'),
  title: text('Limited drops with experimental rules', 'دراپ‌های محدود با قوانین آزمایشی'),
  intro: text('Now and then we publish a small batch of challenges with unusual rules. Each drop has a fixed number of accounts, a sale window and a limit per wallet.', 'هر از گاهی تعداد کمی چلنج با قوانین متفاوت منتشر می‌کنیم. هر دراپ تعداد حساب ثابت، بازهٔ فروش و سقف خرید برای هر کیف پول دارد.'),
  loading: text('Loading the drops…', 'در حال دریافت دراپ‌ها…'),
  error: text('The drops could not be loaded. Please try again shortly.', 'دراپ‌ها دریافت نشدند. کمی بعد دوباره تلاش کن.'),
  none: text('No drop is published yet', 'هنوز دراپی منتشر نشده است'),
  noneBody: text('The first drop will be announced here. Nothing is for sale until it is published.', 'اولین دراپ همین‌جا اعلام می‌شود. تا انتشار آن چیزی برای فروش نیست.'),
  how: text('How drops work', 'دراپ‌ها چطور کار می‌کنند'),
  how1: text('Limited inventory: when the accounts are gone, the drop is sold out.', 'موجودی محدود: وقتی حساب‌ها تمام شود، دراپ تمام شده است.'),
  how2: text('A sale window: a drop opens and closes at published times.', 'بازهٔ فروش: هر دراپ در زمان‌های اعلام‌شده باز و بسته می‌شود.'),
  how3: text('A limit per wallet, from one to five accounts.', 'سقف خرید برای هر کیف پول، از یک تا پنج حساب.'),
  how4: text('Your account keeps the drop’s rules for its whole life.', 'حساب تو قوانین همان دراپ را تا پایان حفظ می‌کند.'),
  drop: text('Drop #${n}', 'دراپ شمارهٔ ${n}'),
  experimental: text('Experimental, limited', 'آزمایشی، محدود'),
  open: text('Open', 'باز'), comingSoon: text('Coming soon', 'به‌زودی'), soldOut: text('Sold out', 'تمام شد'), closed: text('Closed', 'بسته'),
  size: text('Account size', 'اندازهٔ حساب'), price: text('Price', 'قیمت'),
  left: text('${a} of ${n} accounts left', '${a} از ${n} حساب باقی مانده'),
  sold: text('${n} sold', '${n} فروخته‌شده'),
  reserved: text('${n} reserved and awaiting payment', '${n} رزروشده در انتظار پرداخت'),
  reservedNote: text('An unpaid reservation returns to the drop when its order expires.', 'رزرو پرداخت‌نشده با منقضی‌شدن سفارش به دراپ برمی‌گردد.'),
  opensIn: text('Opens in ${t}', 'شروع تا ${t}'), endsIn: text('Sale ends in ${t}', 'پایان فروش تا ${t}'),
  noEnd: text('No end date: on sale until sold out.', 'بدون تاریخ پایان: تا تمام شدن موجودی.'),
  quantity: text('Accounts', 'تعداد حساب'),
  capNote: text('Up to ${cap} per wallet. Each account is checked out as its own order.', 'حداکثر ${cap} حساب برای هر کیف پول. هر حساب جداگانه پرداخت می‌شود.'),
  buy: text('Check out', 'ادامهٔ خرید'),
  notYet: text('Not on sale yet', 'هنوز در فروش نیست'),
  gauges: text('How tight is it?', 'چقدر سخت‌گیرانه است؟'),
  gaugesNote: text('This drop’s limits against the range of the standard plans.', 'سقف‌های این دراپ در مقایسه با بازهٔ پلن‌های استاندارد.'),
  gDaily: text('Daily loss limit', 'سقف ضرر روزانه'), gMax: text('Maximum loss', 'حداکثر ضرر'), gTarget: text('Phase 1 target', 'هدف مرحلهٔ ۱'), gSplit: text('Profit split', 'تقسیم سود'),
  standard: text('Standard plans: ${range}', 'پلن‌های استاندارد: ${range}'),
  tighter: text('Tighter', 'سخت‌تر'), looser: text('Looser', 'آسان‌تر'), within: text('Within range', 'در همان بازه'),
  rules: text('Rules of this drop', 'قوانین این دراپ'),
  rulesNote: text('The rules the evaluation engine enforces on this drop, shown for the selected size.', 'قوانینی که موتور ارزیابی روی این دراپ اجرا می‌کند، برای اندازهٔ انتخاب‌شده.'),
  upcoming: text('Also coming', 'دراپ‌های بعدی'),
  previous: text('Previous drops', 'دراپ‌های قبلی'),
  previousNone: text('No previous drops yet.', 'هنوز دراپ قبلی وجود ندارد.'),
  soldOf: text('${s} of ${n} sold', '${s} از ${n} فروخته شد'),
  faq: text('Questions', 'پرسش‌ها'),
  q1: text('Are Labs accounts real money?', 'آیا حساب‌های آزمایشگاه پول واقعی هستند؟'),
  a1: text('No. Like every Openfund challenge, Labs accounts are simulated demo accounts. Rewards follow the published payout rules of the drop.', 'خیر. مانند همهٔ چلنج‌های اوپن‌فاند، حساب‌های آزمایشگاه حساب‌های دموی شبیه‌سازی‌شده هستند. پاداش‌ها طبق قوانین برداشت منتشرشدهٔ همان دراپ پرداخت می‌شوند.'),
  q2: text('Can a drop’s rules change after I buy?', 'آیا قوانین دراپ پس از خرید تغییر می‌کند؟'),
  a2: text('No. Your account keeps the rules it was bought with, even if a later drop uses different ones.', 'خیر. حساب تو قوانین زمان خرید را حفظ می‌کند، حتی اگر دراپ بعدی قوانین دیگری داشته باشد.'),
  q3: text('What happens if I do not pay?', 'اگر پرداخت نکنم چه می‌شود؟'),
  a3: text('Your order reserves one account until it expires. After that the account returns to the drop for someone else.', 'سفارش تو تا زمان انقضا یک حساب را رزرو می‌کند. پس از آن حساب برای دیگران به دراپ برمی‌گردد.'),
  q4: text('Why are some rules missing from Labs?', 'چرا بعضی قوانین در آزمایشگاه نیست؟'),
  a4: text('A drop can only use rules the evaluation engine enforces. Rules it cannot enforce yet are refused when the drop is published.', 'هر دراپ فقط می‌تواند از قوانینی استفاده کند که موتور ارزیابی اجرا می‌کند. قوانینی که هنوز اجرا نمی‌شوند هنگام انتشار دراپ پذیرفته نمی‌شوند.'),
  disclaimer: text('Simulated demo accounts. Past drops do not predict future results.', 'حساب‌های دموی شبیه‌سازی‌شده. دراپ‌های گذشته نشان‌دهندهٔ نتایج آینده نیستند.'),
}

export interface Drop { slug: string; name: string; number: number; status: 'open' | 'coming_soon' | 'sold_out' | 'closed'; inventory: number; sold: number; reserved: number; available: number
  perWalletCap: number; saleStartsAt: string; saleEndsAt: string | null; accountSizesUsd: number[]; priceUsd: Record<string, number>; rules: Rules }
interface Reference { slug: string; dailyLossPct: number; maxTotalLossPct: number; phase1TargetPct: number | null; profitSplitPct: number | null }
interface LabsData { current: Drop[]; previous: Drop[]; reference: Reference[]; serverTime: string }

export default function LabsPage() {
  const locale = useInformationLocale()
  const t = (v: L) => tx(locale, v)
  const f = (v: L, values: Record<string, string | number>) => pickFormat(locale, v.fa, v.en, values)
  const nf = (n: number, o?: Intl.NumberFormatOptions) => new Intl.NumberFormat(intlLocale(locale), o).format(n)
  const [data, setData] = useState<LabsData | null | 'error'>(null)
  const [skew, setSkew] = useState(0)
  useEffect(() => {
    void apiFetch('/labs').then(r => {
      if (!r.ok || !r.data) { setData('error'); return }
      setData(r.data); setLabsStatus(r.data.current?.find((d: Drop) => d.status === 'open')?.number ?? null)
      setSkew(Date.parse(r.data.serverTime) - Date.now())
    }).catch(() => setData('error'))
  }, [])
  const [heroRef, heroLive] = useLive<HTMLDivElement>()
  const drops = data && data !== 'error' ? data : null
  const active = drops?.current[0] ?? null
  const planName = (name: string) => (locale === 'fa' ? name.split(' — ')[0] : name.split(' — ').pop()) || name

  return <InformationShell page="labs" description={t(c.intro)} title={`${t(c.eyebrow)} | Openfund`}>
    <section className="lb-hero container" id="top" ref={heroRef} data-live={heroLive || undefined}>
      <div className="lb-hero-copy">
        <p className="ob-eyebrow">{t(c.eyebrow)}</p>
        <h1>{t(c.title)}</h1>
        <p className="ob-intro">{t(c.intro)}</p>
      </div>
      <LabHeroArt />
    </section>

    <section className="container ob-section" aria-labelledby="lb-drop">
      {data === null && <p className="ob-note" role="status">{t(c.loading)}</p>}
      {data === 'error' && <p className="ob-note" role="alert">{t(c.error)}</p>}
      {drops && !active && <div className="lb-empty">
        <h2 id="lb-drop">{t(c.none)}</h2>
        <p>{t(c.noneBody)}</p>
        <h3>{t(c.how)}</h3>
        <ul className="lb-how">{[c.how1, c.how2, c.how3, c.how4].map((x, i) => <li key={i}>{t(x)}</li>)}</ul>
      </div>}
      {drops && active && <ActiveDrop drop={active} reference={drops.reference} skew={skew} locale={locale} t={t} f={f} nf={nf} planName={planName} />}
      {drops && drops.current.length > 1 && <div className="lb-upcoming">
        <h3>{t(c.upcoming)}</h3>
        <ul>{drops.current.slice(1).map(d => <li key={d.slug}><b>{f(c.drop, { n: nf(d.number) })}</b> · {planName(d.name)} · {statusLabel(d.status, t)}</li>)}</ul>
      </div>}
    </section>

    <section className="container ob-section" aria-labelledby="lb-previous">
      <h2 id="lb-previous">{t(c.previous)}</h2>
      {drops && !drops.previous.length && <p className="ob-note">{t(c.previousNone)}</p>}
      {drops && drops.previous.length > 0 && <ul className="lb-archive">{drops.previous.map(d =>
        <li key={d.slug} className="lb-archived">
          <span className="lb-stamp" aria-hidden="true">{statusLabel(d.status, t)}</span>
          <b>{f(c.drop, { n: nf(d.number) })}</b>
          <span>{planName(d.name)}</span>
          <small>{statusLabel(d.status, t)} · {f(c.soldOf, { s: nf(d.sold), n: nf(d.inventory) })}</small>
        </li>)}</ul>}
    </section>

    <section className="container ob-section" aria-labelledby="lb-faq">
      <h2 id="lb-faq">{t(c.faq)}</h2>
      {[[c.q1, c.a1], [c.q2, c.a2], [c.q3, c.a3], [c.q4, c.a4]].map(([q, a], i) => <details key={i} className="ob-faq"><summary>{t(q)}</summary><p>{t(a)}</p></details>)}
      <p className="ob-note lb-disclaimer">{t(c.disclaimer)}</p>
    </section>
  </InformationShell>
}

const statusLabel = (s: Drop['status'], t: (v: L) => string) => t(s === 'open' ? c.open : s === 'coming_soon' ? c.comingSoon : s === 'sold_out' ? c.soldOut : c.closed)

function ActiveDrop({ drop, reference, skew, locale, t, f, nf, planName }: { drop: Drop; reference: Reference[]; skew: number; locale: ReturnType<typeof useInformationLocale>
  t: (v: L) => string; f: (v: L, values: Record<string, string | number>) => string; nf: (n: number, o?: Intl.NumberFormatOptions) => string; planName: (n: string) => string }) {
  const [size, setSize] = useState(drop.accountSizesUsd[0] ?? 0)
  const allowance = Math.max(1, Math.min(drop.perWalletCap, drop.available))
  const [qty, setQty] = useState(1)
  const now = useClock(skew)
  const [cardRef, live] = useLive<HTMLDivElement>()
  const pct = (n: number) => nf(n / 100, { style: 'percent', maximumFractionDigits: 2 })
  const usd = (n: number) => nf(n, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const open = drop.status === 'open' && drop.available > 0
  const until = drop.status === 'coming_soon' ? Date.parse(drop.saleStartsAt) : drop.saleEndsAt ? Date.parse(drop.saleEndsAt) : null
  const left = until ? Math.max(0, until - now) : null
  const gauges = useMemo(() => {
    const out: { key: string; label: L; value: number; values: number[]; lowerIsTighter: boolean | null }[] = []
    const r = drop.rules
    out.push({ key: 'daily', label: c.gDaily, value: r.dailyLossPct, values: reference.map(x => x.dailyLossPct), lowerIsTighter: true })
    out.push({ key: 'max', label: c.gMax, value: r.maxTotalLossPct, values: reference.map(x => x.maxTotalLossPct), lowerIsTighter: true })
    if (r.phaseTargetsPct?.length) out.push({ key: 'target', label: c.gTarget, value: r.phaseTargetsPct[0], values: reference.flatMap(x => (x.phase1TargetPct != null ? [x.phase1TargetPct] : [])), lowerIsTighter: false })
    if (r.profitSplitPct != null) out.push({ key: 'split', label: c.gSplit, value: r.profitSplitPct, values: reference.flatMap(x => (x.profitSplitPct != null ? [x.profitSplitPct] : [])), lowerIsTighter: null })
    return out.filter(g => g.values.length)
  }, [drop.rules, reference])

  return <div className="lb-capsule" ref={cardRef} data-live={live || undefined}>
    <header className="lb-capsule-head">
      <span className="lb-pill">{f(c.drop, { n: nf(drop.number) })}</span>
      <span className="lb-tag">{t(c.experimental)}</span>
      <span className={`lb-status is-${drop.status}`}>{statusLabel(drop.status, t)}</span>
    </header>
    <h2 id="lb-drop">{planName(drop.name)}</h2>
    <div className="lb-buy-row">
      <label className="ob-size">{t(c.size)}
        <select value={size} onChange={e => setSize(Number(e.target.value))} dir="ltr">{drop.accountSizesUsd.map(s => <option key={s} value={s}>{usd(s)}</option>)}</select>
      </label>
      <p className="lb-price"><small>{t(c.price)}</small><b dir="ltr">{usd(Number(drop.priceUsd[size] ?? 0))}</b></p>
    </div>

    <div className="lb-inventory">
      <div className="lb-bar" role="meter" aria-valuemin={0} aria-valuemax={drop.inventory} aria-valuenow={drop.available} aria-label={f(c.left, { a: nf(drop.available), n: nf(drop.inventory) })}>
        <i style={{ ['--lb-sold' as string]: drop.sold / drop.inventory, ['--lb-held' as string]: (drop.sold + drop.reserved) / drop.inventory }} />
      </div>
      <p><b>{f(c.left, { a: nf(drop.available), n: nf(drop.inventory) })}</b> · {f(c.sold, { n: nf(drop.sold) })}{drop.reserved > 0 && <> · {f(c.reserved, { n: nf(drop.reserved) })}</>}</p>
      {drop.reserved > 0 && <p className="ob-note">{t(c.reservedNote)}</p>}
      <p className="lb-countdown" role="timer">{left != null ? f(drop.status === 'coming_soon' ? c.opensIn : c.endsIn, { t: duration(left, locale) }) : t(c.noEnd)}</p>
    </div>

    {open ? <div className="lb-checkout">
      <label className="ob-size">{t(c.quantity)}
        <select value={Math.min(qty, allowance)} onChange={e => setQty(Number(e.target.value))} dir="ltr">{Array.from({ length: allowance }, (_, i) => <option key={i} value={i + 1}>{nf(i + 1)}</option>)}</select>
      </label>
      <Link className="button" to={`/${locale}/checkout?plan=${encodeURIComponent(drop.slug)}&size=${size}&lab=${encodeURIComponent(drop.slug)}&qty=${Math.min(qty, allowance)}`}>{t(c.buy)} <DirArrow kind="forward" /></Link>
      <p className="ob-note">{f(c.capNote, { cap: nf(drop.perWalletCap) })}</p>
    </div> : drop.status === 'coming_soon' ? <p className="lb-soon">{t(c.notYet)}</p> : null}

    {gauges.length > 0 && <div className="lb-gauges">
      <h3>{t(c.gauges)}</h3>
      <p className="ob-note">{t(c.gaugesNote)}</p>
      <ul>{gauges.map(g => <Gauge key={g.key} label={t(g.label)} value={g.value} values={g.values} lowerIsTighter={g.lowerIsTighter} pct={pct} t={t} f={f} />)}</ul>
    </div>}

    <div className="lb-rules">
      <h3>{t(c.rules)}</h3>
      <p className="ob-note">{t(c.rulesNote)}</p>
      <ObjectiveCards r={drop.rules} size={size} locale={locale} role="list" />
    </div>
  </div>
}

function Gauge({ label, value, values, lowerIsTighter, pct, t, f }: { label: string; value: number; values: number[]; lowerIsTighter: boolean | null
  pct: (n: number) => string; t: (v: L) => string; f: (v: L, values: Record<string, string | number>) => string }) {
  const lo = Math.min(...values), hi = Math.max(...values)
  const top = Math.max(hi, value) * 1.25 || 1
  const verdict = lowerIsTighter === null ? null : value < lo ? (lowerIsTighter ? c.tighter : c.looser) : value > hi ? (lowerIsTighter ? c.looser : c.tighter) : c.within
  return <li className="lb-gauge">
    <div className="lb-gauge-head"><b>{label}</b><span dir="ltr">{pct(value)}</span>{verdict && <em className={verdict === c.tighter ? 'is-tight' : ''}>{t(verdict)}</em>}</div>
    <div className="lb-track" aria-hidden="true">
      <i className="lb-range" style={{ ['--lb-a' as string]: lo / top, ['--lb-b' as string]: (hi - lo) / top || 0.01 }} />
      <i className="lb-mark" style={{ ['--lb-v' as string]: value / top }} />
    </div>
    <small>{f(c.standard, { range: lo === hi ? pct(lo) : `${pct(lo)}–${pct(hi)}` })}</small>
  </li>
}

/* a server-aligned clock that ticks once a minute (text only, no animation) */
function useClock(skew: number) {
  const [now, setNow] = useState(() => Date.now() + skew)
  useEffect(() => {
    setNow(Date.now() + skew)
    const id = setInterval(() => setNow(Date.now() + skew), 30_000)
    return () => clearInterval(id)
  }, [skew])
  return now
}

function duration(ms: number, locale: string) {
  const m = Math.floor(ms / 60_000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), min = m % 60
  const unit = (n: number, u: 'day' | 'hour' | 'minute') => new Intl.NumberFormat(intlLocale(locale as Parameters<typeof intlLocale>[0]), { style: 'unit', unit: u, unitDisplay: 'short' }).format(n)
  return [d ? unit(d, 'day') : '', d || h ? unit(h, 'hour') : '', unit(min, 'minute')].filter(Boolean).join(' ')
}
