import { useId, useState } from 'react'
import { labels, number, text as t, type Locale } from '../information/content'
import { metricCopy } from './content'
import { metricDefinitions, summarize, type ActivityPoint, type TransparencyDataState } from './data/mockTransparency'

function date(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}
export function SampleBadge({ locale }: { locale: Locale }) { return <span className="pill sample-badge">{labels.sample[locale]}</span> }

function ActivityChart({ points, locale, pnl = false }: { points: ActivityPoint[]; locale: Locale; pnl?: boolean }) {
  const id = useId()
  const values = points.map(p => pnl ? p.pnlVirtualDai : p.activeAccounts)
  const max = Math.max(...values.map(Math.abs), 1)
  const x = (i: number) => 48 + i * (660 / Math.max(points.length - 1, 1))
  const y = (v: number) => pnl ? 130 - v / max * 92 : 220 - v / max * 184
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(' ')
  const title = (pnl ? t('Daily net demo PnL · virtual DAI', 'سود و زیان خالص روزانهٔ دمو · دای مجازی') : t('Daily active sample accounts', 'حساب‌های نمونهٔ فعال روزانه'))[locale]
  return <>
    <svg className="info-chart" viewBox="0 0 750 270" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{title}</title><desc id={`${id}-desc`}>{t('Synthetic series. Exact values are available in the data table below.', 'سری دادهٔ ساختگی؛ مقادیر دقیق در جدول دادهٔ زیر آمده‌اند.')[locale]} {date(points[0].date, locale)} — {date(points.at(-1)!.date, locale)}</desc>
      <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--mint)" stopOpacity=".18" /><stop offset="1" stopColor="var(--mint)" stopOpacity="0" /></linearGradient></defs>
      {[0, .5, 1].map((fraction, i) => <g key={i}><line x1="48" x2="708" y1={pnl ? 38 + i * 92 : 36 + i * 92} y2={pnl ? 38 + i * 92 : 36 + i * 92} stroke="var(--line)" strokeDasharray="3 6" /><text x="38" y={(pnl ? 38 + i * 92 : 36 + i * 92) + 4} textAnchor="end" className="chart-label">{number(Math.round(pnl ? max * (1 - 2 * fraction) : max * (1 - fraction)), locale)}</text></g>)}
      {pnl ? values.map((v, i) => <rect key={points[i].date} x={x(i) - 12} y={Math.min(130, y(v))} width="24" height={Math.max(Math.abs(y(v) - 130), 1)} rx="3" fill={v < 0 ? '#e89483' : 'var(--mint)'}><title>{`${date(points[i].date, locale)}: ${number(v, locale)}`}</title></rect>) : <><path d={`${path} L708 220 L48 220 Z`} fill={`url(#${id}-fill)`} /><path d={path} fill="none" stroke="var(--mint)" strokeWidth="2.5" />{values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="var(--bg)" stroke="var(--mint)"><title>{`${date(points[i].date, locale)}: ${number(v, locale)}`}</title></circle>)}</>}
      {[0, Math.floor((points.length - 1) / 2), points.length - 1].map((i, index) => <text key={index} x={x(i)} y="254" textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'} className="chart-label">{date(points[i].date, locale)}</text>)}
    </svg>
    <p className="chart-axis-note">{t('Chronological axis · oldest to newest, left to right', 'محور زمانی · از قدیمی به جدید، از چپ به راست')[locale]}</p>
  </>
}

export function TransparencyDashboard({ state, locale }: { state: TransparencyDataState; locale: Locale }) {
  const [days, setDays] = useState(14)
  if (state.status !== 'ready') return <section className="info-data-state" role="status" aria-live="polite" aria-busy={state.status === 'loading'}><h2>{({ loading: t('Preparing report…', 'در حال آماده‌سازی گزارش…'), empty: t('No reporting data yet', 'هنوز داده‌ای برای گزارش نیست'), error: t('Report unavailable', 'گزارش در دسترس نیست') })[state.status][locale]}</h2><p>{t('No figures are displayed until a valid reporting dataset is available.', 'تا زمان دسترسی به مجموعه‌دادهٔ معتبر، عددی نمایش داده نمی‌شود.')[locale]}</p></section>
  const { snapshot } = state
  if (!snapshot.activity.length) return <TransparencyDashboard state={{ status: 'empty' }} locale={locale} />
  const totals = summarize(snapshot)
  const points = snapshot.activity.slice(-days)
  const outcomeTotal = snapshot.outcomes.passed + snapshot.outcomes.failed + snapshot.outcomes.inProgress
  const passedAngle = outcomeTotal ? snapshot.outcomes.passed / outcomeTotal * 360 : 0
  const failedAngle = outcomeTotal ? (snapshot.outcomes.passed + snapshot.outcomes.failed) / outcomeTotal * 360 : 0
  return <>
    <div className="section-top" id="overview"><div><span className="eyebrow">01 / {t('THE REPORTING CONCEPT', 'طرح گزارش‌دهی')[locale]}</span><h2>{t('A view of the whole picture.', 'تصویری از تمام مسیر.')[locale]}</h2></div><p>{date(snapshot.periodStart, locale)} — {date(snapshot.periodEnd, locale)}<br />{t('Fixed sample period · no live feed', 'بازهٔ ثابت نمونه · بدون دادهٔ زنده')[locale]}</p></div>
    <div className="metrics-grid">{metricDefinitions.map(metric => <article className="metric-card model-card" key={metric.key}><div className="metric-label">{metricCopy[metric.key].label[locale]}<SampleBadge locale={locale} /></div><strong className={metric.key === 'pnl' ? 'positive' : ''}><bdi>{number(totals[metric.key], locale, metric.format === 'percent' ? { style: 'percent', maximumFractionDigits: 1 } : { maximumFractionDigits: 0 })}</bdi>{metric.format === 'usd' && <small> USD</small>}{metric.format === 'virtualDai' && <small> {t('virtual DAI', 'دای مجازی')[locale]}</small>}</strong><p>{metricCopy[metric.key].note[locale]}</p></article>)}</div>
    <div className="report-toolbar"><span className="eyebrow">{t('ACTIVITY / HISTORICAL SAMPLE', 'فعالیت / تاریخچهٔ نمونه')[locale]}</span><div className="market-tabs" role="group" aria-label={t('Chart period', 'بازهٔ نمودار')[locale]}>{[7, 14].map(value => <button key={value} aria-pressed={days === value} className={days === value ? 'active' : ''} onClick={() => setDays(value)}>{number(value, locale)} {t('days', 'روز')[locale]}</button>)}</div></div>
    <div className="report-grid"><section className="report-panel"><div className="panel-heading"><h3>{t('Simulated account activity', 'فعالیت شبیه‌سازی‌شدهٔ حساب‌ها')[locale]}</h3><SampleBadge locale={locale} /></div><p>{t('Daily active accounts · accounts may appear on multiple days', 'حساب‌های فعال روزانه · هر حساب ممکن است در چند روز تکرار شود')[locale]}</p><ActivityChart points={points} locale={locale} /></section>
      <section className="report-panel outcome-panel"><div className="panel-heading"><h3>{t('Evaluation outcomes', 'نتایج ارزیابی')[locale]}</h3><SampleBadge locale={locale} /></div><p>{t('Proposed reporting · evaluation engine not active', 'گزارش پیشنهادی · موتور ارزیابی فعال نیست')[locale]}</p><div className="outcome-donut" role="img" aria-label={t(`Sample outcomes: ${snapshot.outcomes.passed} passed, ${snapshot.outcomes.failed} failed, ${snapshot.outcomes.inProgress} in progress.`, `نتایج نمونه: ${number(snapshot.outcomes.passed, locale)} قبول، ${number(snapshot.outcomes.failed, locale)} مردود و ${number(snapshot.outcomes.inProgress, locale)} در حال انجام.`)[locale]} style={{ background: `conic-gradient(var(--mint) 0deg ${passedAngle}deg, #e89483 ${passedAngle}deg ${failedAngle}deg, #34483f ${failedAngle}deg 360deg)` }}><div><strong>{number(outcomeTotal, locale)}</strong><span>{t('sample evaluations', 'ارزیابی نمونه')[locale]}</span></div></div><dl className="outcome-legend">{(['passed', 'failed', 'inProgress'] as const).map((key, i) => <div key={key}><dt><i style={{ background: ['var(--mint)', '#e89483', '#34483f'][i] }} />{[t('Passed', 'قبول'), t('Failed', 'مردود'), t('In progress', 'در حال انجام')][i][locale]}</dt><dd>{number(snapshot.outcomes[key], locale)}</dd></div>)}</dl><p className="chart-axis-note">{t('Pass rate excludes evaluations in progress.', 'ارزیابی‌های در حال انجام در نرخ قبولی لحاظ نمی‌شوند.')[locale]}</p></section></div>
    <section className="report-panel pnl-panel"><div className="panel-heading"><h3>{t('Trading performance trends', 'روند عملکرد معاملاتی')[locale]}</h3><SampleBadge locale={locale} /></div><p>{t('Daily synthetic net PnL · virtual DAI · all-period totals above stay fixed', 'سود و زیان خالص ساختگی روزانه · دای مجازی · جمع شاخص‌های بالا برای کل بازه ثابت است')[locale]}</p><ActivityChart points={points} locale={locale} pnl /></section>
    <details className="info-explanation data-details"><summary>{t('Inspect the sample data and calculations', 'بررسی دادهٔ نمونه و روش محاسبه')[locale]}</summary><p>{t('Trade count, volume and PnL are sums across the fixed 14-day period. Completed = passed + failed. Pass rate = passed ÷ completed. Account total is a separate illustrative count; daily active accounts are not summed into unique accounts.', 'تعداد معامله، حجم و سود و زیان، مجموع بازهٔ ثابت ۱۴روزه‌اند. تکمیل‌شده = قبول + مردود. نرخ قبولی = قبول ÷ تکمیل‌شده. تعداد کل حساب، عدد نمایشی مستقلی است؛ جمع حساب‌های فعال روزانه، حساب یکتا محسوب نمی‌شود.')[locale]}</p><div className="info-table-wrap" role="region" aria-label={t('Sample activity data', 'دادهٔ فعالیت نمونه')[locale]} tabIndex={0}><table><caption>{t('Synthetic history · selected chart period', 'تاریخچهٔ ساختگی · بازهٔ انتخابی نمودار')[locale]}</caption><thead><tr>{[t('Date', 'تاریخ'), t('Active accounts', 'حساب فعال'), t('Trades', 'معامله'), t('Volume · USD', 'حجم · دلار'), t('Net PnL · virtual DAI', 'سود و زیان خالص · دای مجازی')].map((v, i) => <th scope="col" key={i}>{v[locale]}</th>)}</tr></thead><tbody>{points.map(point => <tr key={point.date}><th scope="row">{date(point.date, locale)}</th>{[point.activeAccounts, point.trades, point.volumeUsd, point.pnlVirtualDai].map((v, i) => <td key={i}><bdi>{number(v, locale)}</bdi></td>)}</tr>)}</tbody></table></div></details>
  </>
}
