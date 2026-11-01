import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { labels, number, text } from '../information/content'
import { fetchCmsRules, fetchCmsPlans, fetchCmsPageMeta, type CmsRuleSection, type CmsPageMeta } from '../../cms/client'
import type { ChallengePlan } from '../../data/challengePlans'
import { rulebookIntro, rulebookNotice } from './content'

/* The Rulebook renders from Directus:
 *  - section list  ← `trading_rules` (owner edits/adds/reorders/publishes sections)
 *  - the catalog table ← `challenge_plans` (the same commercial table the
 *    backend uses — plan numbers can never disagree with the landing)
 *  - intro/notice copy ← `pages` (slug: rulebook)
 * The interface (layout, TOC, anchors, status pills, tables) is unchanged. */

type Locale = 'fa' | 'en'

function CatalogTable({ locale, plans }: { locale: Locale; plans: ChallengePlan[] }) {
  const pct = (v: number) => `${number(v, locale)}${locale === 'fa' ? '٪' : '%'}`
  const sizesList = (sizes: number[]) => sizes.map(s => number(s, locale)).join(' / ')
  const target = (p: ChallengePlan) =>
    p.phases === 0 ? (locale === 'fa' ? 'بدون مرحله' : '—') :
      `${number(p.phases, locale)} · ${pct(p.phase1TargetPct!)}${p.phase2TargetPct != null ? ` + ${pct(p.phase2TargetPct)}` : ''}`
  const loss = (p: ChallengePlan) =>
    `${pct(p.dailyLossPct)} / ${pct(p.maxTotalLossPct)}${p.drawdownMode === 'trailing' ? (locale === 'fa' ? ' شناور' : ' trailing') : ''}`
  const split = (p: ChallengePlan) => p.free
    ? text('None (trial)', 'ندارد (تست)')[locale]
    : `${pct(p.profitSplitPct)}${p.profitSplitMonthlyPct ? ` · ${pct(p.profitSplitMonthlyPct)}${locale === 'fa' ? ' ماهانه' : ' monthly'}` : ''}`
  return <section className="rule-section" id="configurations" tabIndex={-1}>
    <div className="rule-section-meta"><span className="section-number">{number(0, locale, { minimumIntegerDigits: 2 })} /</span><span className="pill status-draft">{labels.draft[locale]}</span></div>
    <h2>{text('Challenge configurations', 'ترکیب‌های چلنج')[locale]}</h2>
    <p>{text('The configurations below are the published product structure — the same catalog that renders the landing builder and the comparison table. Terms are conditions of the challenge; fee values are the published nominal prices.',
      'ترکیب‌های زیر ساختار منتشرشدهٔ محصول‌اند — همان فهرستی که حساب‌ساز و جدول مقایسهٔ صفحهٔ چلنج‌ها را می‌سازد. شرایط، شرایطِ همان چلنج‌اند و مبالغ، قیمت‌های اسمی منتشرشده.')[locale]}</p>
    <div className="info-table-wrap" role="region" aria-label={text('Published challenge catalog', 'فهرست منتشرشدهٔ چلنج‌ها')[locale]} tabIndex={0}>
      <table>
        <caption>{text('Published challenge catalog', 'فهرست منتشرشدهٔ چلنج‌ها')[locale]}</caption>
        <thead><tr>
          <th scope="col">{text('Challenge', 'چلنج')[locale]}</th>
          <th scope="col">{text('Sizes · USD', 'اندازه‌ها · دلار')[locale]}</th>
          <th scope="col">{text('Phases · target', 'مراحل · هدف')[locale]}</th>
          <th scope="col">{text('Daily / total loss', 'سقف ضرر روزانه / کل')[locale]}</th>
          <th scope="col">{text('Reward share', 'سهم سود')[locale]}</th>
        </tr></thead>
        <tbody>
          {plans.map(p => <tr key={p.slug}>
            <th scope="row">{p.name[locale]}</th>
            <td>{sizesList(p.accountSizesUsd)}</td>
            <td>{target(p)}</td>
            <td>{loss(p)}</td>
            <td>{split(p)}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>
}

export default function Rulebook() {
  const locale = useInformationLocale()
  const [rules, setRules] = useState<CmsRuleSection[] | null>(null)
  const [plans, setPlans] = useState<ChallengePlan[] | null>(null)
  const [meta, setMeta] = useState<CmsPageMeta | null>(null)
  const [active, setActive] = useState('')

  useEffect(() => {
    let alive = true
    void fetchCmsRules().then(d => { if (alive) setRules(d) })
    void fetchCmsPlans().then(d => { if (alive) setPlans(d) })
    void fetchCmsPageMeta('rulebook').then(d => { if (alive) setMeta(d) })
    return () => { alive = false }
  }, [])

  const sections = useMemo(() => rules || [], [rules])
  const firstId = sections[0]?.id || ''
  const hasCatalog = !!plans?.length

  useEffect(() => {
    const jump = () => {
      const current = sections.filter(s => (document.getElementById(s.id)?.getBoundingClientRect().top ?? Infinity) <= 200).at(-1)
      setActive(current?.id || firstId)
    }
    addEventListener('scroll', jump, { passive: true }); jump()
    return () => removeEventListener('scroll', jump)
  }, [sections, firstId])

  const jumpTo = (id: string) => {
    const target = document.getElementById(id)
    target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    target?.focus({ preventScroll: true })
    setActive(id)
  }

  const intro = meta?.description[locale] || rulebookIntro[locale]
  const notice = meta ? (locale === 'fa'
    ? 'این‌ها شرایط منتشرشده و مرجع چلنج‌های اوپن‌فاند هستند. فعال‌سازی خرید، حساب فاندشده و برداشت در این نسخه فعال نیست — ترمینال فعلاً دموی شبیه‌سازی‌شدهٔ ۱۰۰٬۰۰۰ دای را اجرا می‌کند — و پیش از عرضه، قرارداد نهایی نسخه‌دار منتشر خواهد شد.'
    : 'These are the published terms of record for the Openfund challenges. Purchase activation, funded accounts and payouts are not yet enabled in this release — the terminal currently runs the simulated 100,000 DAI demo — and a final versioned agreement will be published before launch.')
    : rulebookNotice[locale]

  return <InformationShell page="rulebook" description={intro}>
    <Hero locale={locale} page="rulebook"
      title={meta?.title[locale] || text('Trading rules', 'قوانین معاملاتی')[locale]}
      accent={meta?.subtitle[locale] || ''}
      intro={intro}>
      <div className="info-hero-meta">
        <span className="pill">{labels.draft[locale]}</span>
        <span>{labels.updated[locale]}</span>
        <span>{number(sections.length, locale)} {text('sections', 'بخش')[locale]}</span>
      </div>
      <div className="hero-actions">
        <a className="button" href={`#${firstId || 'top'}`} onClick={e => { e.preventDefault(); if (firstId) jumpTo(firstId) }}>{text('Read the guide', 'راهنما را بخوان')[locale]} <span aria-hidden="true">↓</span></a>
        <Link className="text-link" to={`/${locale}/transparency`}>{labels.transparency[locale]} <span aria-hidden="true">↗</span></Link>
      </div>
    </Hero>

    <div className="container"><aside className="info-notice"><span className="tiny-mark" aria-hidden="true">◇</span><p>{notice}</p></aside></div>

    {!rules && (
      <div className="container"><aside className="info-notice">
        <span className="tiny-mark" aria-hidden="true">⚠</span>
        <p>{locale === 'fa'
          ? 'بارگیری بخش‌های رول‌بوک از سامانهٔ مدیریت محتوا ممکن نشد. چند لحظه بعد صفحه را تازه‌سازی کن.'
          : 'The rulebook sections could not be loaded from the content service. Please refresh in a moment.'}
        </p>
      </aside></div>
    )}

    {rules && <div className="container rulebook-layout">
      <aside className="rulebook-sidebar"><nav aria-label={labels.contents[locale]}>
        <span className="eyebrow">{labels.contents[locale]}</span>
        <ol>
          {sections.map((section, i) => <li key={section.id}><a href={`#${section.id}`} aria-current={active === section.id ? 'location' : undefined} onClick={e => { e.preventDefault(); jumpTo(section.id) }}>
            <span className="section-number">{number(i + 1, locale, { minimumIntegerDigits: 2 })}</span>{section.title[locale]}
          </a></li>)}
          {hasCatalog && <li><a href="#configurations" aria-current={active === 'configurations' ? 'location' : undefined} onClick={e => { e.preventDefault(); jumpTo('configurations') }}>
            <span className="section-number">{number(sections.length + 1, locale, { minimumIntegerDigits: 2 })}</span>{text('Challenge configurations', 'ترکیب‌های چلنج')[locale]}
          </a></li>}
        </ol>
        <a className="text-link" href="#top">{labels.top[locale]}</a>
      </nav></aside>
      <div className="rulebook-content">
        <label className="mobile-contents">{labels.contents[locale]}<select value={active} onChange={e => jumpTo(e.target.value)}>
          {sections.map((s, i) => <option key={s.id} value={s.id}>{number(i + 1, locale)} / {s.title[locale]}</option>)}
          {hasCatalog && <option value="configurations">{number(sections.length + 1, locale)} / {text('Challenge configurations', 'ترکیب‌های چلنج')[locale]}</option>}
        </select></label>

        {sections.map((section, i) => <section className="rule-section" id={section.id} key={section.id} tabIndex={-1} aria-labelledby={`${section.id}-heading`}>
          <div className="rule-section-meta"><span className="section-number">{number(i + 1, locale, { minimumIntegerDigits: 2 })} /</span><span className={`pill status-${section.status}`}>{labels[section.status][locale]}</span></div>
          <h2 id={`${section.id}-heading`}><a href={`#${section.id}`} onClick={e => { e.preventDefault(); jumpTo(section.id) }}>{section.title[locale]}</a></h2>
          {section.paragraphs.map((p, index) => <p key={index}>{p[locale]}</p>)}
          {section.formula && <div className="formula-block"><span>{text('Condition formula · terms of record', 'فرمول شرایط · شرایط مرجع')[locale]}</span><pre dir="ltr">{section.formula}</pre></div>}
          {section.explanation && <details className="info-explanation"><summary>{section.explanation.title[locale]}</summary><p>{section.explanation.body[locale]}</p></details>}
          {section.table && <div className="info-table-wrap" role="region" aria-label={section.table.caption[locale]} tabIndex={0}><table>
            <caption>{section.table.caption[locale]}</caption>
            <thead><tr>{section.table.columns.map((c, col) => <th scope="col" key={col}>{c[locale]}</th>)}</tr></thead>
            <tbody>{section.table.rows.map((row, index) => <tr key={index}>{row.map((cell, col) => col === 0 ? <th scope="row" key={col}>{cell[locale]}</th> : <td key={col}>{cell[locale]}</td>)}</tr>)}</tbody>
          </table></div>}
          {section.id === 'verification' && <Link className="text-link" to={`/${locale}/transparency`}>{text('Explore the sample dashboard', 'داشبورد نمونه را ببین')[locale]} ↗</Link>}
          {section.id === 'support' && <a className="text-link" href="https://github.com/algomanlife/openfund/issues" target="_blank" rel="noopener noreferrer">{text('Report a product issue', 'گزارش خطای محصول')[locale]} ↗</a>}
        </section>)}

        {hasCatalog && plans && <CatalogTable locale={locale} plans={plans} />}

        <div className="info-end"><img src={`${import.meta.env.BASE_URL}assets/mark-mint.svg`} width={38} height={42} alt="" /><p>{text('Perspective. Discipline. Opportunity.', 'دید روشن. انضباط. فرصت.')[locale]}</p><a className="text-link" href="#top">{labels.top[locale]}</a></div>
      </div>
    </div>}
  </InformationShell>
}
