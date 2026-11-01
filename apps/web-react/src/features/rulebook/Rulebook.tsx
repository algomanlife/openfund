import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { labels, number, text } from '../information/content'
import { rulebookIntro, rulebookNotice, ruleSections } from './content'

export default function Rulebook() {
  const locale = useInformationLocale()
  const [active, setActive] = useState(ruleSections[0].id)
  useEffect(() => {
    // Read every section's position so long sections remain active between headings.
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const current = ruleSections.filter(s => (document.getElementById(s.id)?.getBoundingClientRect().top ?? Infinity) <= 200).at(-1)
        setActive(current?.id || ruleSections[0].id)
      })
    }
    addEventListener('scroll', update, { passive: true }); update()
    return () => { removeEventListener('scroll', update); cancelAnimationFrame(frame) }
  }, [])
  const jump = (id: string) => {
    const target = document.getElementById(id)
    target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    target?.focus({ preventScroll: true })
    setActive(id)
  }
  return <InformationShell page="rulebook" description={rulebookIntro[locale]}>
    <Hero locale={locale} page="rulebook"
      title={text('A clear account.', 'حساب روشن.')[locale]}
      accent={text('An informed next step.', 'قدم بعدی آگاهانه.')[locale]} intro={rulebookIntro[locale]}>
      <div className="info-hero-meta"><span className="pill">{labels.draft[locale]}</span><span>{labels.updated[locale]}</span><span>{number(21, locale)} {text('sections', 'بخش')[locale]}</span></div>
      <div className="hero-actions"><a className="button" href="#overview" onClick={e => { e.preventDefault(); jump('overview') }}>{text('Read the guide', 'راهنما را بخوان')[locale]} <span aria-hidden="true">↓</span></a><Link className="text-link" to={`/${locale}/transparency`}>{labels.transparency[locale]} <span aria-hidden="true">↗</span></Link></div>
    </Hero>
    <div className="container"><aside className="info-notice"><span className="tiny-mark" aria-hidden="true">◇</span><p>{rulebookNotice[locale]}</p></aside></div>
    <div className="container rulebook-layout">
      <aside className="rulebook-sidebar"><nav aria-label={labels.contents[locale]}>
        <span className="eyebrow">{labels.contents[locale]}</span>
        <ol>{ruleSections.map((section, i) => <li key={section.id}><a href={`#${section.id}`} aria-current={active === section.id ? 'location' : undefined} onClick={e => { e.preventDefault(); jump(section.id) }}><span className="section-number">{number(i + 1, locale, { minimumIntegerDigits: 2 })}</span>{section.title[locale]}</a></li>)}</ol>
        <a className="text-link" href="#top">{labels.top[locale]}</a>
      </nav></aside>
      <div className="rulebook-content">
        <label className="mobile-contents">{labels.contents[locale]}<select value={active} onChange={e => jump(e.target.value)}>{ruleSections.map((s, i) => <option key={s.id} value={s.id}>{number(i + 1, locale)} / {s.title[locale]}</option>)}</select></label>
        {ruleSections.map((section, i) => <section className="rule-section" id={section.id} key={section.id} tabIndex={-1} aria-labelledby={`${section.id}-heading`}>
          <div className="rule-section-meta"><span className="section-number">{number(i + 1, locale, { minimumIntegerDigits: 2 })} /</span><span className={`pill status-${section.status}`}>{labels[section.status][locale]}</span></div>
          <h2 id={`${section.id}-heading`}><a href={`#${section.id}`} onClick={e => { e.preventDefault(); jump(section.id) }}>{section.title[locale]}</a></h2>
          {section.paragraphs.map((p, index) => <p key={index}>{p[locale]}</p>)}
          {section.formula && <div className="formula-block"><span>{(section.id === 'targets' ? text('Conceptual formula · not an active evaluation rule', 'فرمول مفهومی · قانون فعال ارزیابی نیست') : text('Demo accounting formula', 'فرمول حسابداری دمو'))[locale]}</span><pre dir="ltr">{section.formula}</pre>{locale === 'fa' && <p>{section.id === 'targets' ? 'مقدار هدف نمونه = موجودی شروع × نرخ هدف' : section.id === 'leverage' ? 'ارزش اسمی = وجه تضمین × اهرم؛ مقدار دارایی = ارزش اسمی ÷ قیمت اجرا' : 'ارزش خالص = موجودی + مجموع سود و زیان شناور؛ وجه آزاد = موجودی − وجه تضمین مصرف‌شده'}</p>}</div>}
          {section.table && <div className="info-table-wrap" role="region" aria-label={section.table.caption[locale]} tabIndex={0}><table><caption>{section.table.caption[locale]}</caption><thead><tr>{section.table.columns.map((c, col) => <th scope="col" key={col}>{c[locale]}</th>)}</tr></thead><tbody>{section.table.rows.map((row, index) => <tr key={index}>{row.map((cell, col) => col === 0 ? <th scope="row" key={col}>{cell[locale]}</th> : <td key={col}>{cell[locale]}</td>)}</tr>)}</tbody></table></div>}
          {section.explanation && <details className="info-explanation"><summary>{section.explanation.title[locale]}</summary><p>{section.explanation.body[locale]}</p></details>}
          {section.id === 'verification' && <Link className="text-link" to={`/${locale}/transparency`}>{text('Explore the sample dashboard', 'داشبورد نمونه را ببین')[locale]} ↗</Link>}
          {section.id === 'support' && <a className="text-link" href="https://github.com/algomanlife/openfund/issues" target="_blank" rel="noopener noreferrer">{text('Report a product issue', 'گزارش خطای محصول')[locale]} ↗</a>}
        </section>)}
        <div className="info-end"><img src={`${import.meta.env.BASE_URL}assets/mark-mint.svg`} width="38" height="42" alt="" /><p>{text('Perspective. Discipline. Opportunity.', 'دید روشن. انضباط. فرصت.')[locale]}</p><a className="text-link" href="#top">{labels.top[locale]}</a></div>
      </div>
    </div>
  </InformationShell>
}
