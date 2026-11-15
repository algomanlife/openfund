import InformationShell, { useInformationLocale } from '../information/InformationShell'
import { text, tx } from '../information/content'
import { useReveal } from '../company/reveal'
import { ROADMAP_PHASES, REGISTER_URL, MILESTONES_URL, type RoadmapStatus } from './roadmapData'
import { PRODUCT_ROADMAP } from './productRoadmap'
import './roadmap.css'

const copy = {
  eyebrow: text('Roadmap', 'نقشه راه'),
  title: text('Where Openfund is going', 'مسیر پیش روی اوپن‌فاند'),
  intro: text('Seven phases, ordered by dependency rather than by date. Each status below is copied from the public repository register, where every milestone has acceptance criteria and evidence.', 'هفت فاز که بر اساس وابستگی مرتب شده‌اند، نه تاریخ. هر وضعیت در این صفحه از ثبت عمومی مخزن کد گرفته شده است؛ جایی که هر نقطهٔ عطف معیار پذیرش و شواهد دارد.'),
  completed: text('Completed', 'تکمیل‌شده'),
  'in-progress': text('In progress', 'در حال انجام'),
  planned: text('Planned', 'برنامه‌ریزی‌شده'),
  vision: text('Future vision', 'چشم‌انداز آینده'),
  phase: text('Phase', 'فاز'),
  milestones: text('Milestones', 'نقاط عطف'),
  noDates: text('No delivery dates are committed. A phase advances only with deployed or verified evidence.', 'هیچ تاریخ تحویلی تعهد نشده است. هر فاز فقط با شواهد استقرار یا تأییدشده پیش می‌رود.'),
  ownerTitle: text('One-year product roadmap', 'نقشهٔ راه یک‌سالهٔ محصول'),
  quarter: text('Quarter', 'سه‌ماههٔ'),
  register: text('Read the register on GitHub', 'مشاهدهٔ ثبت در GitHub'),
  milestoneRegister: text('Milestones and acceptance criteria', 'نقاط عطف و معیارهای پذیرش'),
}

const ORDER: RoadmapStatus[] = ['completed', 'in-progress', 'planned', 'vision']

export default function Roadmap() {
  const locale = useInformationLocale()
  const c = (key: keyof typeof copy) => tx(locale, copy[key])
  const counts = Object.fromEntries(ORDER.map(s => [s, ROADMAP_PHASES.filter(p => p.status === s).length])) as Record<RoadmapStatus, number>
  const timeline = useReveal<HTMLOListElement>(), owner = useReveal<HTMLElement>()
  return <InformationShell page="roadmap" description={c('intro')}>
    <section id="top" className="of-roadmap-hero">
      <div className="of-roadmap-glow" aria-hidden="true" />
      <div className="container">
        <div className="eyebrow">{`OPENFUND · ${c('eyebrow')}`}</div>
        <h1>{c('title')}</h1>
        <p className="hero-intro">{c('intro')}</p>
        <ul className="of-roadmap-legend" aria-label={c('eyebrow')}>
          {ORDER.map(s => <li key={s} data-status={s}><i aria-hidden="true" />{c(s)} <bdi dir="ltr">{counts[s]}</bdi></li>)}
        </ul>
      </div>
    </section>
    <div className="container of-roadmap-body">
      <ol ref={timeline} className="of-roadmap-timeline of-reveal">
        {ROADMAP_PHASES.map(p => <li key={p.phase} data-status={p.status}>
          <span className="of-roadmap-node" aria-hidden="true"><bdi dir="ltr">{p.phase}</bdi></span>
          <article>
            <header>
              <span className="of-roadmap-phase">{c('phase')} <bdi dir="ltr">{p.phase}</bdi></span>
              <span className="of-roadmap-status" data-status={p.status}>{c(p.status)}</span>
            </header>
            <h2>{tx(locale, p.name)}</h2>
            <p className="of-roadmap-direction">{tx(locale, p.direction)}</p>
            <p className="of-roadmap-assessment">{tx(locale, p.assessment)}</p>
            <a className="of-roadmap-ms" href={MILESTONES_URL} rel="noopener noreferrer" target="_blank">{c('milestones')}: <bdi dir="ltr">{p.milestones}</bdi></a>
          </article>
        </li>)}
      </ol>
      <p className="of-roadmap-note">{c('noDates')}</p>

      <section ref={owner} className="of-roadmap-owner of-reveal" aria-labelledby="owner-roadmap" data-status="vision">
        <h2 id="owner-roadmap">{c('ownerTitle')}</h2>
        <ul>{PRODUCT_ROADMAP.map(item => <li key={item.quarter} data-status={item.status}>
          <h3>{c('quarter')} {item.quarter} · {tx(locale, item.title)}</h3>
          <p><bdi dir="ltr"><time dateTime={item.start}>{item.start}</time> – <time dateTime={item.end}>{item.end}</time></bdi> · {c(item.status)}</p>
          <p>{tx(locale, item.body)}</p>
          <p>{tx(locale, item.dependencies)}</p>
        </li>)}</ul>
        <div className="of-roadmap-links">
          <a className="text-link" href={REGISTER_URL} rel="noopener noreferrer" target="_blank">{c('register')} ↗</a>
          <a className="text-link" href={MILESTONES_URL} rel="noopener noreferrer" target="_blank">{c('milestoneRegister')} ↗</a>
        </div>
      </section>
    </div>
  </InformationShell>
}
