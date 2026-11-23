import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import InformationShell, { useInformationLocale } from '../information/InformationShell'
import { text, tx } from '../information/content'
import { intlLocale, pickFormat, type AppLocale } from '../../i18n/locales'
import { apiFetch } from '../../session/useOpenfundSession'
import DirArrow from '../../ui/DirArrow'
import { ObjectiveArt, type ObjectiveKind } from './schematics'
import { progression } from './progression'
import './objectives.css'

/* /:locale/trading-objectives — a visual summary of the published plan
   catalog. /rulebook stays the full official text; every card links to its
   section. Every number comes from GET /purchases/plans (the engine's
   normalized rules for the selected plan and size); nothing is hard-coded. */
type L = { en: string; fa: string }
const c = {
  eyebrow: text('Trading objectives', 'اهداف معاملاتی'),
  title: text('Every objective, at a glance', 'همهٔ اهداف، در یک نگاه'),
  intro: text('A visual summary of the rules the engine enforces on each plan. The rulebook remains the official text.', 'خلاصهٔ تصویری قوانینی که موتور ارزیابی روی هر پلن اجرا می‌کند. متن رسمی همچنان رول‌بوک است.'),
  readRulebook: text('Read the rulebook', 'خواندن رول‌بوک'),
  sEvaluation: text('Evaluation', 'ارزیابی'), sVerification: text('Skill verification', 'تأیید مهارت'), sWallet: text('Wallet verified', 'تأیید کیف پول'),
  sAgreement: text('Agreement', 'توافق‌نامه'), sFunded: text('Funded account', 'حساب فاندشده'),
  sWalletBody: text('Your sign-in signature proves wallet ownership; rewards go only to that wallet.', 'امضای ورود مالکیت کیف پول را ثابت می‌کند؛ پاداش‌ها فقط به همان کیف پول می‌رود.'),
  sAgreementBody: text('You accept the funded-trader terms by signing with your wallet before the first funded trade.', 'پیش از اولین معامله در حساب فاندشده، شرایط را با امضای کیف پول می‌پذیری.'),
  noKyc: text('Openfund does not run KYC: the wallet is your identity.', 'اوپن‌فاند احراز هویت KYC انجام نمی‌دهد؛ کیف پول هویت توست.'),
  plan: text('Plan', 'پلن'), size: text('Account size', 'اندازهٔ حساب'),
  loading: text('Loading the published plans…', 'در حال دریافت پلن‌های منتشرشده…'),
  unavailable: text('The plan catalog could not be loaded. Please try again shortly; the rulebook has every rule.', 'فهرست پلن‌ها دریافت نشد. کمی بعد دوباره تلاش کن؛ همهٔ قوانین در رول‌بوک هست.'),
  objectives: text('Objectives', 'اهداف'),
  target: text('Profit target', 'هدف سود'), targetBody: text('Reach ${pct} (${usd}) in this stage.', 'در این مرحله به ${pct} (${usd}) برس.'),
  targetNone: text('No profit target: the account starts funded.', 'بدون هدف سود: حساب از ابتدا فاندشده است.'),
  daily: text('Daily loss limit', 'سقف ضرر روزانه'), dailyBody: text('Equity may not fall ${pct} (${usd}) below the day’s basis. The day resets at 00:00 UTC+3.', 'ارزش حساب نباید ${pct} (${usd}) زیر مبنای روز برود. روز ساعت ۰۰:۰۰ UTC+3 بازنشانی می‌شود.'),
  max: text('Maximum loss', 'حداکثر ضرر'), maxStatic: text('Static: equity may not fall ${pct} (${usd}) below the starting balance.', 'ثابت: ارزش حساب نباید ${pct} (${usd}) زیر موجودی اولیه برود.'),
  maxTrailing: text('Trailing: the floor follows the equity peak, ${pct} (${usd}) below it.', 'دنباله‌دار: کف از اوج ارزش حساب، ${pct} (${usd}) پایین‌تر، پیروی می‌کند.'),
  maxTrailingLock: text('It stops trailing once profit reaches ${lock}.', 'وقتی سود به ${lock} برسد، دیگر جابه‌جا نمی‌شود.'),
  days: text('Minimum trading days', 'حداقل روزهای معاملاتی'), daysBody: text('Trade on at least ${n} separate days (UTC+3).', 'دست‌کم در ${n} روز جداگانه (UTC+3) معامله کن.'),
  daysNone: text('No minimum number of trading days.', 'حداقل تعداد روز معاملاتی ندارد.'),
  consistency: text('Consistency', 'ثبات'), consistencyBody: text('No single day may hold more than ${pct} of total profit.', 'سود هیچ روزی نباید بیش از ${pct} کل سود باشد.'),
  consistencyNone: text('No consistency rule on this plan.', 'این پلن قانون ثبات ندارد.'),
  split: text('Profit split', 'تقسیم سود'), splitBody: text('Up to ${pct} of the profit is yours.', 'تا ${pct} از سود سهم توست.'),
  cycle: text('Reward cycle', 'دورهٔ پاداش'), cycleBody: text('Choose one cycle once, when your funded account starts:', 'یک بار، هنگام شروع حساب فاندشده، یکی از دوره‌ها را انتخاب می‌کنی:'),
  cycleOnDemand: text('on demand', 'بر اساس درخواست'), cycleEvery: text('every ${n} days', 'هر ${n} روز'),
  conduct: text('Leverage, news and weekends', 'اهرم، اخبار و آخر هفته'),
  leverage: text('Leverage up to ${x}× for reference, within each market’s ceiling.', 'اهرم مرجع تا ${x}×، در محدودهٔ سقف هر بازار.'),
  leverageNone: text('Leverage follows each market’s Openfund ceiling.', 'اهرم از سقف اوپن‌فاند برای هر بازار پیروی می‌کند.'),
  news: text('High-impact news: a ${min}-minute window applies on the funded account.', 'اخبار پراهمیت: پنجرهٔ ${min} دقیقه‌ای در حساب فاندشده اعمال می‌شود.'),
  newsNone: text('No news-trading restriction.', 'محدودیت معامله در زمان اخبار ندارد.'),
  weekend: text('Weekend holding: positions are closed daily on the funded account.', 'نگهداری در آخر هفته: پوزیشن‌ها در حساب فاندشده روزانه بسته می‌شوند.'),
  weekendNone: text('Holding over the weekend is allowed.', 'نگهداری پوزیشن در آخر هفته مجاز است.'),
  refund: text('Fee refund', 'بازگشت هزینه'), refundBody: text('The evaluation fee is refunded with your 4th reward.', 'هزینهٔ ارزیابی همراه با چهارمین پاداش بازگردانده می‌شود.'),
  refundNone: text('This plan has no fee refund.', 'این پلن بازگشت هزینه ندارد.'),
  section: text('Rulebook section', 'بخش رول‌بوک'),
  scenarios: text('Allowed or breached?', 'مجاز یا نقض؟'), illustrative: text('Illustrative examples using this plan’s limits.', 'نمونه‌های نمادین با سقف‌های همین پلن.'),
  allowed: text('Allowed', 'مجاز'), breached: text('Breached', 'نقض'),
  scDailyOk: text('A ${a} dip in one day, then recovery: within the ${pct} daily limit.', 'افت ${a} در یک روز و سپس بازگشت: در محدودهٔ سقف روزانهٔ ${pct}.'),
  scDailyBad: text('A ${a} dip in one day: below the ${pct} daily limit, the account fails.', 'افت ${a} در یک روز: پایین‌تر از سقف روزانهٔ ${pct}؛ حساب رد می‌شود.'),
  scConsBad: text('One day holds ${a} of total profit: above the ${pct} cap, so it does not count yet.', 'یک روز ${a} از کل سود است: بالاتر از سقف ${pct}؛ پس هنوز پذیرفته نیست.'),
  other: text('Other paths', 'مسیرهای دیگر'),
  migrate: text('Migration to Openfund', 'مهاجرت به اوپن‌فاند'), migrateBody: text('Funded elsewhere with proven payouts? Start at the funded stage.', 'جای دیگر فاند شده‌ای و برداشت اثبات‌شده داری؟ از مرحلهٔ فاند شروع کن.'),
  league: text('Openfund Premium League', 'لیگ برتر اوپن‌فاند'), leagueBody: text('A 30-day competition in analysis and risk.', 'رقابت ۳۰ روزه در تحلیل و مدیریت ریسک.'),
  faq: text('Questions', 'پرسش‌ها'),
  q1: text('Where does each number come from?', 'هر عدد از کجا می‌آید؟'), a1: text('From the published plan catalog that the evaluation engine enforces. If a plan changes, this page changes with it; accounts already bought keep their frozen rules.', 'از فهرست پلن‌های منتشرشده که موتور ارزیابی اجرا می‌کند. اگر پلنی تغییر کند، این صفحه هم تغییر می‌کند؛ حساب‌های خریداری‌شده قوانین ثبت‌شدهٔ خود را حفظ می‌کنند.'),
  q2: text('Is this the official text?', 'آیا این متن رسمی است؟'), a2: text('No. The rulebook is the official text; each card links to its section.', 'خیر. متن رسمی رول‌بوک است؛ هر کارت به بخش مربوط پیوند دارد.'),
  q3: text('Do I need identity verification?', 'آیا احراز هویت لازم است؟'), a3: text('No KYC. Your wallet signature proves ownership, rewards go only to that wallet, and you sign the funded-trader agreement before your first funded trade.', 'KYC لازم نیست. امضای کیف پول مالکیت را ثابت می‌کند، پاداش فقط به همان کیف پول می‌رود و پیش از اولین معامله در حساب فاندشده توافق‌نامه را امضا می‌کنی.'),
  buy: text('Buy this challenge', 'خرید این چلنج'),
}

interface Cycle { key: string; splitPct: number | null; everyDays: number | null }
interface Rules { phases: number; phaseTargetsPct: number[]; dailyLossPct: number; maxTotalLossPct: number; drawdownMode: string; trailingLockAtProfitPct: number | null
  minTradingDays: number; consistencyPct: number | null; profitSplitPct: number | null; rewardCycles: Cycle[] | null; refundPolicy: string; referenceLeverageX: number | null
  conduct: { news: { windowMin?: number } | null; holding: { mode?: string } | null } }
interface Plan { slug: string; name: string; names?: { en: string | null; fa: string | null } | null; accountSizesUsd: number[]; free?: boolean; rules?: Rules }

/* motion only while an element is on screen and the tab is visible */
export function useLive<T extends Element>() {
  const ref = useRef<T>(null)
  const [live, setLive] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    let seen = false
    const sync = () => setLive(seen && document.visibilityState === 'visible')
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(e => { seen = e.some(x => x.isIntersecting); sync() }) : null
    if (io) io.observe(el); else { seen = true; sync() }
    document.addEventListener('visibilitychange', sync)
    return () => { io?.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [])
  return [ref, live] as const
}

export default function TradingObjectivesPage() {
  const locale = useInformationLocale()
  const t = (v: L) => tx(locale, v)
  const f = (v: L, values: Record<string, string | number>) => pickFormat(locale, v.fa, v.en, values)
  const nf = (n: number, o?: Intl.NumberFormatOptions) => new Intl.NumberFormat(intlLocale(locale), o).format(n)
  const pct = (n: number) => nf(n / 100, { style: 'percent', maximumFractionDigits: 2 })
  const usd = (n: number) => nf(n, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const [plans, setPlans] = useState<Plan[] | null | 'error'>(null)
  const [slug, setSlug] = useState('')
  const [size, setSize] = useState(0)
  useEffect(() => {
    void apiFetch('/purchases/plans').then(r => {
      /* only plans the engine can evaluate (positive loss limits); anything else would read as 0% */
      const list: Plan[] = r.ok ? (r.data?.plans || []).filter((p: Plan) => !p.free && p.rules && p.rules.dailyLossPct > 0 && p.rules.maxTotalLossPct > 0 && p.accountSizesUsd?.length) : []
      if (!list.length) { setPlans('error'); return }
      setPlans(list); setSlug(list[0].slug); setSize(list[0].accountSizesUsd.includes(100000) ? 100000 : list[0].accountSizesUsd[Math.floor(list[0].accountSizesUsd.length / 2)])
    }).catch(() => setPlans('error'))
  }, [])
  const plan = Array.isArray(plans) ? plans.find(p => p.slug === slug) ?? null : null
  const r = plan?.rules ?? null
  const stages = useMemo(() => (r ? progression(r) : ['evaluation', 'verification', 'wallet', 'agreement', 'funded'] as const), [r])
  const [heroRef, heroLive] = useLive<HTMLDivElement>()
  /* the catalog name is "fa — en"; show the reader's half (as checkout does) */
  const planName = (p: Plan) => (locale === 'fa' ? p.names?.fa : p.names?.en) || (locale === 'fa' ? p.name.split(' — ')[0] : p.name.split(' — ').pop()) || p.name
  const stageLabel = { evaluation: c.sEvaluation, verification: c.sVerification, wallet: c.sWallet, agreement: c.sAgreement, funded: c.sFunded }

  return <InformationShell page="trading-objectives" description={t(c.intro)} title={`${t(c.eyebrow)} | Openfund`}>
    <section className="ob-hero container" id="top" ref={heroRef} data-live={heroLive || undefined}>
      <p className="ob-eyebrow">{t(c.eyebrow)}</p>
      <h1>{t(c.title)}</h1>
      <p className="ob-intro">{t(c.intro)}</p>
      <ol className="ob-path" style={{ ['--ob-steps' as string]: stages.length }} aria-label={t(c.eyebrow)}>
        <li className="ob-path-line" aria-hidden="true"><i /></li>
        {stages.map((s, i) => <li key={s} className="ob-stage" style={{ ['--i' as string]: i }}>
          <span className="ob-node" aria-hidden="true">{nf(i + 1)}</span>
          <b>{t(stageLabel[s])}</b>
          {s === 'wallet' && <small>{t(c.sWalletBody)}</small>}
          {s === 'agreement' && <small>{t(c.sAgreementBody)}</small>}
        </li>)}
      </ol>
      <p className="ob-note">{t(c.noKyc)}</p>
      <div className="hero-actions"><Link className="text-link" to={`/${locale}/rulebook`}>{t(c.readRulebook)} <DirArrow kind="forward" /></Link></div>
    </section>

    <section className="container ob-section" aria-labelledby="ob-objectives">
      <h2 id="ob-objectives">{t(c.objectives)}</h2>
      {plans === null && <p className="ob-note" role="status">{t(c.loading)}</p>}
      {plans === 'error' && <p className="ob-note" role="alert">{t(c.unavailable)}</p>}
      {plan && r && <>
        <div className="ob-controls">
          <div role="tablist" aria-label={t(c.plan)} className="ob-tabs">{(plans as Plan[]).map(p =>
            <button key={p.slug} role="tab" type="button" aria-selected={p.slug === slug} className={p.slug === slug ? 'is-active' : ''}
              onClick={() => { setSlug(p.slug); if (!p.accountSizesUsd.includes(size)) setSize(p.accountSizesUsd[0]) }}>{planName(p)}</button>)}</div>
          <label className="ob-size">{t(c.size)}
            <select value={size} onChange={e => setSize(Number(e.target.value))} dir="ltr">{plan.accountSizesUsd.map(s => <option key={s} value={s}>{usd(s)}</option>)}</select>
          </label>
        </div>
        <ul className="ob-cards" role="tabpanel">
          <Card kind="target" title={t(c.target)} anchor="targets" locale={locale} t={t}>
            {r.phaseTargetsPct.length ? r.phaseTargetsPct.map((p, i) => <p key={i}>{r.phaseTargetsPct.length > 1 ? `${nf(i + 1)}. ` : ''}{f(c.targetBody, { pct: pct(p), usd: usd(size * p / 100) })}</p>) : <p>{t(c.targetNone)}</p>}
          </Card>
          <Card kind="daily" title={t(c.daily)} anchor="daily-loss" locale={locale} t={t}><p>{f(c.dailyBody, { pct: pct(r.dailyLossPct), usd: usd(size * r.dailyLossPct / 100) })}</p></Card>
          <Card kind={r.drawdownMode === 'trailing' ? 'trailing' : 'max'} title={t(c.max)} anchor="maximum-loss" locale={locale} t={t}>
            <p>{f(r.drawdownMode === 'trailing' ? c.maxTrailing : c.maxStatic, { pct: pct(r.maxTotalLossPct), usd: usd(size * r.maxTotalLossPct / 100) })}</p>
            {r.drawdownMode === 'trailing' && r.trailingLockAtProfitPct != null && <p>{f(c.maxTrailingLock, { lock: pct(r.trailingLockAtProfitPct) })}</p>}
          </Card>
          <Card kind="days" title={t(c.days)} anchor="conditions" locale={locale} t={t}><p>{r.minTradingDays > 0 ? f(c.daysBody, { n: nf(r.minTradingDays) }) : t(c.daysNone)}</p></Card>
          <Card kind="consistency" title={t(c.consistency)} anchor="payouts" locale={locale} t={t}><p>{r.consistencyPct != null ? f(c.consistencyBody, { pct: pct(r.consistencyPct) }) : t(c.consistencyNone)}</p></Card>
          {r.profitSplitPct != null && <Card kind="split" title={t(c.split)} anchor="payouts" locale={locale} t={t} style={{ ['--ob-split' as string]: r.profitSplitPct / 100 }}><p>{f(c.splitBody, { pct: pct(Math.max(r.profitSplitPct, ...(r.rewardCycles ?? []).map(x => x.splitPct ?? 0))) })}</p></Card>}
          {r.rewardCycles?.length ? <Card kind="cycle" title={t(c.cycle)} anchor="payouts" locale={locale} t={t}>
            <p>{t(c.cycleBody)}</p>
            <ul className="ob-cycles">{r.rewardCycles.map(x => <li key={x.key}><b dir="ltr">{x.splitPct != null ? pct(x.splitPct) : '—'}</b> · {x.everyDays ? f(c.cycleEvery, { n: nf(x.everyDays) }) : t(c.cycleOnDemand)}</li>)}</ul>
          </Card> : null}
          <Card kind="conduct" title={t(c.conduct)} anchor="conduct" locale={locale} t={t}>
            <p>{r.referenceLeverageX ? f(c.leverage, { x: nf(r.referenceLeverageX) }) : t(c.leverageNone)}</p>
            <p>{r.conduct?.news ? f(c.news, { min: nf(r.conduct.news.windowMin ?? 0) }) : t(c.newsNone)}</p>
            <p>{r.conduct?.holding ? t(c.weekend) : t(c.weekendNone)}</p>
          </Card>
          <Card kind="refund" title={t(c.refund)} anchor="fees" locale={locale} t={t}><p>{r.refundPolicy === 'fourth-reward' ? t(c.refundBody) : t(c.refundNone)}</p></Card>
        </ul>

        <section className="ob-scenarios" aria-labelledby="ob-scenarios">
          <h2 id="ob-scenarios">{t(c.scenarios)}</h2>
          <p className="ob-note">{t(c.illustrative)}</p>
          <div className="ob-scenario-grid">
            <Scenario ok title={t(c.allowed)} kind="daily-ok" body={f(c.scDailyOk, { a: pct(r.dailyLossPct * 0.6), pct: pct(r.dailyLossPct) })} />
            <Scenario title={t(c.breached)} kind="daily-bad" body={f(c.scDailyBad, { a: pct(r.dailyLossPct * 1.2), pct: pct(r.dailyLossPct) })} />
            {r.consistencyPct != null && <Scenario ok={false} title={t(c.breached)} kind="cons-bad" body={f(c.scConsBad, { a: pct(Math.min(95, r.consistencyPct + 20)), pct: pct(r.consistencyPct) })} />}
          </div>
        </section>
        <div className="hero-actions ob-buy"><Link className="button" to={`/${locale}/checkout?plan=${plan.slug}&size=${size}`}>{t(c.buy)} <DirArrow kind="forward" /></Link></div>
      </>}
    </section>

    <section className="container ob-section" aria-labelledby="ob-other">
      <h2 id="ob-other">{t(c.other)}</h2>
      <div className="ob-other">
        <Link className="ob-path-card is-migrate" to={`/${locale}/migrate`}><b>{t(c.migrate)}</b><span>{t(c.migrateBody)}</span><DirArrow kind="forward" /></Link>
        <Link className="ob-path-card" to={`/${locale}/tournament`}><b>{t(c.league)}</b><span>{t(c.leagueBody)}</span><DirArrow kind="forward" /></Link>
      </div>
    </section>

    <section className="container ob-section" aria-labelledby="ob-faq">
      <h2 id="ob-faq">{t(c.faq)}</h2>
      {[[c.q1, c.a1], [c.q2, c.a2], [c.q3, c.a3]].map(([q, a], i) => <details key={i} className="ob-faq"><summary>{t(q)}</summary><p>{t(a)}</p></details>)}
    </section>
  </InformationShell>
}

function Card({ kind, title, anchor, locale, t, children, style }: { kind: ObjectiveKind; title: string; anchor: string; locale: AppLocale; t: (v: L) => string; children: ReactNode; style?: React.CSSProperties }) {
  const [ref, live] = useLive<HTMLLIElement>()
  return <li ref={ref} className={`ob-card is-${kind}`} data-live={live || undefined} style={style}>
    <ObjectiveArt kind={kind} />
    <h3>{title}</h3>
    {children}
    <Link className="text-link" to={`/${locale}/rulebook#${anchor}`}>{t(c.section)} <DirArrow kind="forward" /></Link>
  </li>
}

function Scenario({ ok = false, title, kind, body }: { ok?: boolean; title: string; kind: string; body: string }) {
  return <article className={`ob-scenario ${ok ? 'is-ok' : 'is-bad'}`}>
    <svg viewBox="0 0 160 70" aria-hidden="true" focusable="false">
      <path d="M4 22H156" className="ob-sc-start" />
      <path d={kind === 'daily-ok' ? 'M4 22l30 6 28 14 24-8 30-10 40-6' : kind === 'daily-bad' ? 'M4 22l30 8 30 16 24 18' : 'M4 60l40-4 20-40 30 4 30-2 32-2'} className="ob-sc-line" />
      {kind !== 'cons-bad' && <path d="M4 50H156" className="ob-sc-floor" />}
    </svg>
    <b>{title}</b><p>{body}</p>
  </article>
}
