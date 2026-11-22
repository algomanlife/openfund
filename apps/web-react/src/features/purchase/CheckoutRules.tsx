import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { pick, pickFormat, type AppLocale } from '../../i18n/locales'
import { challengePlans } from '../../data/challengePlans'

/** Public plan rules from GET /purchases/plans (apps/backend/purchases.js
 *  publicPlanRules): the evaluation engine's normalized rules. Every number on
 *  this page comes from here; nothing is hard-coded. */
export interface PlanRules {
  rulesVersion: number | null, catalogVersion: number | null, model: string | null, phases: number, phaseTargetsPct: number[]
  dailyLossPct: number | null, maxTotalLossPct: number | null, drawdownMode: 'static' | 'trailing', trailingLockAtProfitPct: number | null
  minTradingDays: number | null, consistencyPct: number | null, profitableDaysPer30: number | null, profitSplitPct: number | null
  rewardCycles: { key: string, splitPct: number | null }[], inactivityDays: number | null, timeLimitDays: number | null, trialDaysPerPhase: number | null
  refundPolicy: string, dailyLossVariant: { dailyLossPct: number | null, minTradingDays: number | null } | null
  conduct: { news: { mode: 'deduct' | 'prohibit', stage: string, windowMin: number | null } | null, holding: { mode: 'auto_close_daily' | 'prohibit_weekend', stage: string } | null }
}
export interface VariantInfo { dailyLossPct: number, priceUsd: number | Record<string, number> | null, available: boolean }

/** catalog version this build of the page was written against */
export const CLIENT_CATALOG_VERSION = Math.max(...challengePlans.map(p => p.catalogVersion))

const usd = (v: number) => '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 })
const pct = (v: number) => `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** true while the element is on screen and the tab is visible */
function useLive<T extends Element>() {
  const ref = useRef<T>(null)
  const [live, setLive] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || reduceMotion()) return
    let on = false
    const sync = () => setLive(on && !document.hidden)
    const io = new IntersectionObserver(([e]) => { on = e.isIntersecting; sync() })
    io.observe(el); document.addEventListener('visibilitychange', sync)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [])
  return [ref, live] as const
}

/** Animated SVG banner for one challenge model, drawn from its rules:
 *  standard = two-step staircase with both phase targets; one-step = one rising
 *  line to its target; instant = a pulse straight to the funded node. */
export function ModelBanner({ rules }: { rules: PlanRules | undefined }) {
  const [ref, live] = useLive<SVGSVGElement>()
  const targets = rules?.phaseTargetsPct || []
  const model = rules?.phases === 2 ? 'standard' : rules?.phases === 1 ? 'one-step' : 'instant'
  const cls = `of-co-banner is-${model}${live ? ' is-live' : ''}`
  const funded = (x: number, y: number) => <g className="of-co-banner-funded"><circle cx={x} cy={y} r="9" /><path d={`M${x - 4} ${y}l3 3 5-6`} /></g>
  const flag = (x: number, y: number, label: string) => <g className="of-co-banner-flag"><path d={`M${x} ${y}v-18h14l-4 4 4 4h-14`} /><text x={x + 2} y={y - 22} direction="ltr">{label}</text></g>
  if (model === 'standard') return <svg ref={ref} className={cls} viewBox="0 0 240 92" aria-hidden="true" focusable="false">
    <path className="of-co-banner-track" d="M12 80H76V54H146V28H214" />
    {targets[0] != null && flag(76, 54, pct(targets[0]))}
    {targets[1] != null && flag(146, 28, pct(targets[1]))}
    {funded(222, 28)}
    <circle className="of-co-banner-dot of-co-dot-stairs" cx="12" cy="80" r="4.5" />
  </svg>
  if (model === 'one-step') return <svg ref={ref} className={cls} viewBox="0 0 240 92" aria-hidden="true" focusable="false">
    <path className="of-co-banner-track" d="M12 80L196 30" />
    {targets[0] != null && flag(196, 30, pct(targets[0]))}
    {funded(222, 30)}
    <circle className="of-co-banner-dot of-co-dot-line" cx="12" cy="80" r="4.5" />
  </svg>
  return <svg ref={ref} className={cls} viewBox="0 0 240 92" aria-hidden="true" focusable="false">
    <circle className="of-co-banner-start" cx="20" cy="54" r="6" />
    <path className="of-co-banner-track" d="M26 54H208" />
    {funded(220, 54)}
    <circle className="of-co-banner-dot of-co-dot-pulse" cx="20" cy="54" r="4.5" />
    <circle className="of-co-banner-ring" cx="220" cy="54" r="13" />
  </svg>
}

/** The conditions of the selected model and size, each as a percentage and
 *  its dollar amount for that account size, computed from the rules. */
export function ConditionsPanel({ locale, rules, size, variant }: { locale: AppLocale, rules: PlanRules, size: number, variant: VariantInfo | null | undefined }) {
  const t = (fa: string, en: string) => pick(locale, fa, en)
  const amount = (p: number | null) => (p == null ? null : `${pct(p)} = ${usd(size * p / 100)}`)
  const rows: [string, string | null, string?][] = []
  rules.phaseTargetsPct.forEach((target, i) => rows.push([
    rules.phases === 1 ? t('هدف سود', 'Profit target') : i === 0 ? t('هدف مرحلهٔ ۱', 'Phase 1 target') : t('هدف مرحلهٔ ۲', 'Phase 2 target'), amount(target)]))
  rows.push([t('ضرر روزانه', 'Daily loss'), amount(rules.dailyLossPct)])
  rows.push([t('حداکثر ضرر', 'Maximum loss'), amount(rules.maxTotalLossPct), rules.drawdownMode === 'trailing' ? t('افت متحرک', 'Trailing drawdown') : t('افت ثابت', 'Static drawdown')])
  if (rules.minTradingDays) rows.push([t('حداقل روزهای معاملاتی', 'Minimum trading days'), String(rules.minTradingDays)])
  if (rules.profitSplitPct != null) rows.push([t('سهم معامله‌گر', 'Trader share'), pct(rules.profitSplitPct)])
  const variantPrice = variant?.priceUsd == null ? null : typeof variant.priceUsd === 'number' ? variant.priceUsd : variant.priceUsd[String(size)] ?? null
  return <div className="of-co-conditions" key={`${rules.model}-${size}`} aria-live="polite">
    <h3>{t('شرایط این حساب', 'Conditions for this account')}</h3>
    <dl>{rows.map(([label, value, note]) => value && <div key={label}><dt>{label}{note && <small>{note}</small>}</dt><dd dir="ltr">{value}</dd></div>)}</dl>
    {/* the lower daily-loss option appears only when the server offers it with a price */}
    {variant?.available && variantPrice != null && <p className="of-co-variant">
      {t('گزینهٔ ضرر روزانهٔ کمتر', 'Lower daily-loss option')}: <b dir="ltr">{pct(variant.dailyLossPct)} · {usd(variantPrice)}</b>
    </p>}
  </div>
}

/** Collapsed extra conditions: reward cycles, consistency, news and holding rules. */
export function MoreConditions({ locale, rules }: { locale: AppLocale, rules: PlanRules }) {
  const t = (fa: string, en: string) => pick(locale, fa, en)
  const cycle = (key: string) => key === 'weekly' ? t('هفتگی', 'Weekly') : key === 'biweekly' ? t('دوهفته‌ای', 'Bi-weekly') : t('درخواستی', 'On demand')
  const news = rules.conduct.news, holding = rules.conduct.holding
  const versionNewer = rules.catalogVersion != null && rules.catalogVersion !== CLIENT_CATALOG_VERSION
  return <details className="of-co-more">
    <summary>{t('شرایط بیشتر', 'More conditions')}</summary>
    {versionNewer && <p className="of-co-note" role="note">{t(
      'این شرایط همان چیزی است که سرور اوپن‌فاند الان اعمال می‌کند و ممکن است از این صفحه تازه‌تر باشد. قوانین کامل در قوانین معاملاتی آمده است.',
      'These conditions are what Openfund’s server enforces now and may be newer than this page. The Rulebook has the full rules.')}</p>}
    <dl>
      {rules.rewardCycles.length > 0 && <div><dt>{t('چرخه‌های پاداش', 'Reward cycles')}</dt><dd>{rules.rewardCycles.map(c => <span key={c.key} className="of-co-chip">{cycle(c.key)} <bdi dir="ltr">{c.splitPct != null ? pct(c.splitPct) : ''}</bdi></span>)}</dd></div>}
      {rules.consistencyPct != null && <div><dt>{t('ثبات', 'Consistency')}</dt><dd dir="ltr">{pct(rules.consistencyPct)}</dd></div>}
      {news && news.windowMin != null && <div><dt>{t('اخبار', 'News')}</dt><dd>{news.mode === 'prohibit'
        ? pickFormat(locale, 'اخبار پراثر: باز کردن، بستن یا نگه داشتن پوزیشن در فاصلهٔ ${min} دقیقه از رویداد تخلف است.', 'High-impact news: opening, closing or holding a position within ${min} minutes of the event is a breach.', { min: news.windowMin })
        : pickFormat(locale, 'اخبار پراثر: در حساب فاندشده، سود معاملات در فاصلهٔ ${min} دقیقه از رویداد از پاداش کسر می‌شود.', 'High-impact news: on funded accounts, profit from trades within ${min} minutes of the event is deducted from rewards.', { min: news.windowMin })}</dd></div>}
      {holding && <div><dt>{t('نگهداری پوزیشن', 'Holding')}</dt><dd>{holding.mode === 'prohibit_weekend'
        ? t('نگه داشتن پوزیشن باز در آخر هفته مجاز نیست.', 'Positions may not be held open over the weekend.')
        : t('در حساب فاندشده، پوزیشن‌های باز در بازهٔ بسته‌شدن روزانه به‌طور خودکار بسته می‌شوند.', 'On funded accounts, open positions are closed automatically in the daily closing window.')}</dd></div>}
    </dl>
    <Link className="of-co-rulebook" to={`/${locale}/rulebook`}>{t('قوانین معاملاتی', 'Rulebook')} <span aria-hidden="true">↗</span></Link>
  </details>
}

/** inline style helper for the ticket's notch colour */
export const ticketStyle = { '--ticket-notch': 'var(--bg, #060808)' } as CSSProperties
