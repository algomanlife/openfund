import { Link } from 'react-router-dom'
import InformationShell, { useInformationLocale } from '../information/InformationShell'
import { number, tx, type Locale } from '../information/content'
import { publishedPlans, type ChallengePlan } from '../../data/challengePlans'
import { OFFICIAL_TELEGRAM_URL } from '../community/TelegramCommunity'
import { pick } from '../../i18n/locales'
import { aboutHero, aboutLinks, aboutMeta, aboutSections as s, statusLabels } from './aboutContent'
import { useReveal } from './reveal'
import './company.css'

/** Small original line icons (no third-party artwork). */
const ICONS: Record<string, string> = {
  gains: 'M3 17l5-6 4 3 6-8 3 2',
  engine: 'M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  vela: 'M5 19V9m4 10V5m4 14v-7m4 7V8m4 11H3',
  hyperliquid: 'M4 7h6M4 12h10M4 17h4m6-10h6m-2 5h2m-6 5h6',
  wallet: 'M4 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4V5h12M16 13h.01',
  checkout: 'M4 6h16v12H4zM4 10h16M8 15h3',
}
function Icon({ name }: { name: string }) {
  return <svg className="co-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[name] || ICONS.engine} /></svg>
}

function Section({ id, eyebrow, title, index, children, locale }: { id: string; eyebrow: string; title: string; index: number; children: React.ReactNode; locale: Locale }) {
  const ref = useReveal<HTMLElement>()
  return <section ref={ref} className="co-section co-reveal" id={id} aria-labelledby={`${id}-title`}>
    <div className="co-eyebrow"><span className="co-num">{number(index, locale, { minimumIntegerDigits: 2 })}</span>{eyebrow}</div>
    <h2 id={`${id}-title`}>{title}</h2>
    {children}
  </section>
}

/** Plan terms rendered from the catalog — never typed into the copy. */
function PlanTerms({ locale, plans }: { locale: Locale; plans: ChallengePlan[] }) {
  const pct = (v: number | null | undefined) => v == null ? '—' : `${number(v, locale)}${pick(locale, '٪', '%')}`
  const f = s.fairness
  return <div className="co-plan-grid" role="list" aria-label={tx(locale, f.planLabel)}>
    {plans.filter(p => !p.free).map(p => <article className="co-plan" role="listitem" key={p.slug}>
      <h3>{tx(locale, p.name)}</h3>
      <dl>
        <div><dt>{tx(locale, f.target)}</dt><dd>{p.phases === 0 ? tx(locale, f.none) : [p.phase1TargetPct, p.phase2TargetPct].filter(v => v != null).map(pct).join(' → ')}</dd></div>
        <div><dt>{tx(locale, f.daily)}</dt><dd>{pct(p.dailyLossPct)}</dd></div>
        <div><dt>{tx(locale, f.max)}</dt><dd>{pct(p.maxTotalLossPct)}{p.drawdownMode === 'trailing' ? ` · ${tx(locale, f.trailing)}` : ''}</dd></div>
        <div><dt>{tx(locale, f.share)}</dt><dd>{pct(p.profitSplitPct)}{p.profitSplitMonthlyPct ? ` / ${pct(p.profitSplitMonthlyPct)}` : ''}</dd></div>
      </dl>
    </article>)}
  </div>
}

export default function About() {
  const locale = useInformationLocale()
  const L = (path: string) => `/${locale}/${path}`
  const plans = publishedPlans()
  const hero = useReveal<HTMLElement>()
  return <InformationShell page="about" description={tx(locale, aboutMeta.description)} title={`${tx(locale, aboutMeta.title)} | Openfund`}>
    <section ref={hero} className="container co-hero co-reveal" id="top">
      <div className="co-hero-art" aria-hidden="true"><i /><i /><i /></div>
      <div className="eyebrow"><span className="tiny-mark" aria-hidden="true">✳</span> OPENFUND / {tx(locale, aboutHero.eyebrow)}</div>
      <h1>{tx(locale, aboutHero.title)}<br /><em>{tx(locale, aboutHero.accent)}</em></h1>
      <p className="hero-intro">{tx(locale, aboutHero.intro)}</p>
      <div className="hero-actions co-actions">
        <Link className="button" to={L('challenges')}>{tx(locale, aboutLinks.challenges)}</Link>
        <Link className="text-link" to={L('rulebook')}>{tx(locale, aboutLinks.rulebook)} <span aria-hidden="true">↗</span></Link>
      </div>
      <p className="co-footnote">{tx(locale, aboutHero.note)}</p>
    </section>

    <div className="container co-body">
      <Section id="story" index={1} locale={locale} eyebrow={tx(locale, s.story.eyebrow)} title={tx(locale, s.story.title)}>
        {s.story.body.map((p, i) => <p key={i} className={i === 0 ? 'co-lede' : undefined}>{tx(locale, p)}</p>)}
      </Section>

      <Section id="problem" index={2} locale={locale} eyebrow={tx(locale, s.problem.eyebrow)} title={tx(locale, s.problem.title)}>
        <div className="co-cards four">{s.problem.items.map((it, i) => <article className="co-card" key={i}><h3>{tx(locale, it.title)}</h3><p>{tx(locale, it.body)}</p></article>)}</div>
      </Section>

      <Section id="why" index={3} locale={locale} eyebrow={tx(locale, s.why.eyebrow)} title={tx(locale, s.why.title)}>
        {s.why.body.map((p, i) => <p key={i}>{tx(locale, p)}</p>)}
      </Section>

      <div className="co-pair">
        <Section id="mission" index={4} locale={locale} eyebrow={tx(locale, s.mission.eyebrow)} title={tx(locale, s.mission.title)}><p>{tx(locale, s.mission.body)}</p></Section>
        <Section id="vision" index={5} locale={locale} eyebrow={tx(locale, s.vision.eyebrow)} title={tx(locale, s.vision.title)}><p>{tx(locale, s.vision.body)}</p></Section>
      </div>

      <Section id="traders" index={6} locale={locale} eyebrow={tx(locale, s.traders.eyebrow)} title={tx(locale, s.traders.title)}>
        <div className="co-cards four">{s.traders.items.map((it, i) => <article className="co-card" key={i}><h3>{tx(locale, it.title)}</h3><p>{tx(locale, it.body)}</p></article>)}</div>
      </Section>

      <Section id="technology" index={7} locale={locale} eyebrow={tx(locale, s.technology.eyebrow)} title={tx(locale, s.technology.title)}>
        <p>{tx(locale, s.technology.intro)}</p>
        <div className="co-cards three">{s.technology.items.map(it => <article className="co-card co-tech" key={it.key}>
          <div className="co-tech-top"><Icon name={it.key} /><span className={`co-badge ${it.status}`}>{tx(locale, statusLabels[it.status as keyof typeof statusLabels])}</span></div>
          <h3>{tx(locale, it.title)}</h3><p>{tx(locale, it.body)}</p>
        </article>)}</div>
      </Section>

      <Section id="decentralization" index={8} locale={locale} eyebrow={tx(locale, s.decentralization.eyebrow)} title={tx(locale, s.decentralization.title)}>
        {s.decentralization.body.map((p, i) => <p key={i}>{tx(locale, p)}</p>)}
        <div className="co-split">
          <div className="co-list ok"><h3>{tx(locale, s.decentralization.today)}</h3><ul>{s.decentralization.todayItems.map((x, i) => <li key={i}>{tx(locale, x)}</li>)}</ul></div>
          <div className="co-list planned"><h3>{tx(locale, s.decentralization.planned)}</h3><ul>{s.decentralization.plannedItems.map((x, i) => <li key={i}>{tx(locale, x)}</li>)}</ul></div>
        </div>
      </Section>

      <Section id="fairness" index={9} locale={locale} eyebrow={tx(locale, s.fairness.eyebrow)} title={tx(locale, s.fairness.title)}>
        <p>{tx(locale, s.fairness.body)}</p>
        <h3 className="co-subhead">{tx(locale, s.fairness.planLabel)}</h3>
        <PlanTerms locale={locale} plans={plans} />
        <div className="co-actions"><Link className="text-link" to={L('rulebook')}>{tx(locale, aboutLinks.rulebook)} <span aria-hidden="true">↗</span></Link><Link className="text-link" to={L('transparency')}>{tx(locale, aboutLinks.transparency)} <span aria-hidden="true">↗</span></Link></div>
      </Section>

      <Section id="future" index={10} locale={locale} eyebrow={tx(locale, s.future.eyebrow)} title={tx(locale, s.future.title)}>
        <p>{tx(locale, s.future.body)}</p>
        <div className="co-actions"><Link className="text-link" to={L('governance')}>{tx(locale, aboutLinks.governance)} <span aria-hidden="true">↗</span></Link><Link className="text-link" to={L('revenue-model')}>{tx(locale, aboutLinks.economy)} <span aria-hidden="true">↗</span></Link></div>
      </Section>

      <Section id="join" index={11} locale={locale} eyebrow={tx(locale, s.join.eyebrow)} title={tx(locale, s.join.title)}>
        <p>{tx(locale, s.join.body)}</p>
        <nav className="co-cta-grid" aria-label={tx(locale, s.join.eyebrow)}>
          <Link className="co-cta primary" to={L('challenges')}>{tx(locale, aboutLinks.challenges)}<span aria-hidden="true">→</span></Link>
          <Link className="co-cta" to={L('prop/trade')}>{tx(locale, aboutLinks.terminal)}<span aria-hidden="true">→</span></Link>
          <Link className="co-cta" to={L('revenue-model')}>{tx(locale, aboutLinks.economy)}<span aria-hidden="true">→</span></Link>
          <Link className="co-cta" to={L('transparency')}>{tx(locale, aboutLinks.transparency)}<span aria-hidden="true">→</span></Link>
          <Link className="co-cta" to={L('governance')}>{tx(locale, aboutLinks.governance)}<span aria-hidden="true">→</span></Link>
          <Link className="co-cta" to={L('contact')}>{tx(locale, aboutLinks.contact)}<span aria-hidden="true">→</span></Link>
          <a className="co-cta" href={OFFICIAL_TELEGRAM_URL} target="_blank" rel="noopener noreferrer">{tx(locale, aboutLinks.community)}<span aria-hidden="true">↗</span></a>
        </nav>
      </Section>
    </div>
  </InformationShell>
}
