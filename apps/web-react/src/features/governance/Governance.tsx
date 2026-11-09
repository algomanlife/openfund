import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale, useUiLocale } from '../information/InformationShell'
import { text, number } from '../information/content'
import { useOpenfundSession } from '../../session/useOpenfundSession'
import { fetchCmsGovernance, type CmsGovernanceContent } from '../../cms/client'
import { useGovernance, type CouncilData, type DecisionsData, type OverviewData, type ProposalList } from './api'
import {
  ArchitectureDiagram, AuthorityComparison, AuthorityTable, BUNDLED_MILESTONES, CouncilGrid, DecisionList, DocLinks,
  PolicyFacts, ProposalTable, Roadmap, StateBox, type Milestone,
} from './GovernanceViews'
import ProposalVote from './ProposalVote'
import { formatDate, categoryLabel } from './governanceModel'
import './governance.css'

const SECTIONS = [
  ['overview', text('Overview', 'نمای کلی')], ['council', text('Council', 'شورا')], ['proposals', text('Proposals', 'پیشنهادها')],
  ['voting', text('Voting', 'رأی‌گیری')], ['decisions', text('Decisions', 'تصمیم‌ها')], ['roadmap', text('Roadmap', 'نقشهٔ راه')], ['documents', text('Documents', 'مستندات')],
] as const

export default function Governance() {
  const locale = useInformationLocale()
  const ui = useUiLocale()
  const { status } = useOpenfundSession()
  const overview = useGovernance<OverviewData>('/overview')
  const council = useGovernance<CouncilData>('/council')
  const [filter, setFilter] = useState('')
  const proposals = useGovernance<ProposalList>(`/proposals?limit=50${filter ? `&status=${filter}` : ''}`)
  const decisions = useGovernance<DecisionsData>('/decisions?limit=50')
  const me = useGovernance<{ roles: string[]; councilMember: boolean }>(status === 'authenticated' ? '/me' : null, status)
  const [cms, setCms] = useState<CmsGovernanceContent | null>(null)
  useEffect(() => { let live = true; void fetchCmsGovernance().then(c => { if (live) setCms(c) }).catch(() => {}); return () => { live = false } }, [])
  const milestones: Milestone[] = cms?.milestones.length ? cms.milestones : BUNDLED_MILESTONES
  const intro = cms?.blocks.overview_intro?.[locale]
    ?? text('Openfund is built in the open. A ten-seat Community Council holds real, enforceable authority over explicitly delegated, non-financial domains. Company management keeps exclusive control of the treasury and every financial decision.', 'اوپن‌فاند در فضای باز ساخته می‌شود. شورای ده‌نفرهٔ جامعه بر حوزه‌های غیرمالیِ صریحاً تفویض‌شده اختیار واقعی و اجرایی دارد. مدیریت شرکت کنترل انحصاری خزانه و همهٔ تصمیم‌های مالی را حفظ می‌کند.')[locale]
  const href = (ofp: string) => `/${ui}/governance/proposals/${ofp}`
  const councilMember = me.state.status === 'ready' && me.state.data.councilMember

  return <InformationShell page="governance" description={intro}>
    <Hero locale={locale} page="governance" title={text('Community-Governed Development.', 'توسعهٔ مبتنی بر جامعه.')[locale]} accent={text('Company-Managed Treasury.', 'خزانهٔ تحت مدیریت شرکت.')[locale]} intro={intro}>
      <div className="info-hero-meta">
        <span className="pill">{text('Hybrid governance v1.0', 'حاکمیت ترکیبی نسخهٔ ۱٫۰')[locale]}</span>
        <span>{text('Not a DAO · no governance token · off-chain records', 'نه DAO · بدون توکن حاکمیتی · سوابق خارج از زنجیره')[locale]}</span>
      </div>
      <div className="hero-actions">
        <Link className="button" to={`/${ui}/governance/new`}>{text('Submit a proposal', 'ثبت پیشنهاد')[locale]} <span aria-hidden="true">↗</span></Link>
        {councilMember && <Link className="text-link" to={`/${ui}/governance/workspace`}>{text('Open council workspace', 'فضای کار شورا')[locale]} <span aria-hidden="true">↗</span></Link>}
      </div>
    </Hero>
    <div className="container gv-page">
      <nav className="gv-toc" aria-label={text('On this page', 'در این صفحه')[locale]}>{SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`}>{label[locale]}</a>)}</nav>

      <section id="overview" className="gv-section" aria-labelledby="gv-h-overview">
        <span className="eyebrow">01 / {text('HYBRID GOVERNANCE', 'حاکمیت ترکیبی')[locale]}</span>
        <h2 id="gv-h-overview">{text('Two authorities. One clear boundary.', 'دو اختیار. یک مرز روشن.')[locale]}</h2>
        <ArchitectureDiagram locale={locale} />
        <AuthorityComparison locale={locale} />
        <AuthorityTable locale={locale} />
        <PolicyFacts locale={locale} />
        <aside className="info-notice"><span className="tiny-mark" aria-hidden="true">◇</span><p>{text('Approved policy and implementation status are different things. A proposal that the council approved is not “implemented” until verifiable execution evidence is recorded. Community feedback and polls are never council votes.', 'سیاست تصویب‌شده و وضعیت پیاده‌سازی یکی نیستند. پیشنهادِ تصویب‌شده تا ثبت شواهد قابل‌راستی‌آزمایی «اجراشده» نیست. بازخورد و نظرسنجی جامعه رأی شورا نیست.')[locale]}</p></aside>
      </section>

      <section id="council" className="gv-section" aria-labelledby="gv-h-council">
        <span className="eyebrow">02 / {text('COUNCIL', 'شورا')[locale]}</span>
        <h2 id="gv-h-council">{text('Ten seats, five constituencies.', 'ده کرسی، پنج گروه.')[locale]}</h2>
        <StateBox state={council.state} locale={locale} empty="" onRetry={council.reload}>{c => <CouncilGrid data={c} locale={locale} />}</StateBox>
        {overview.state.status === 'ready' && <p className="gv-note">{overview.state.data.elections.publicEnabled
          ? text('Election status is listed with each constituency election below.', 'وضعیت انتخابات در فهرست انتخابات هر گروه آمده است.')[locale]
          : text('No election is scheduled. Elections open only after company management approves the rules and voter criteria.', 'هیچ انتخاباتی زمان‌بندی نشده است. انتخابات فقط پس از تأیید قواعد و معیار رأی‌دهندگان توسط مدیریت باز می‌شود.')[locale]}</p>}
        {overview.state.status === 'ready' && overview.state.data.elections.elections.length > 0 && <ul className="gv-elections">{overview.state.data.elections.elections.map(e => <li key={e.id}>{e.termLabel} · {e.constituency} · {e.status} · {formatDate(e.votingOpensAt, locale)} → {formatDate(e.votingClosesAt, locale)}</li>)}</ul>}
      </section>

      <section id="proposals" className="gv-section" aria-labelledby="gv-h-proposals">
        <span className="eyebrow">03 / {text('PROPOSALS', 'پیشنهادها')[locale]}</span>
        <h2 id="gv-h-proposals">{text('Openfund Proposals (OFP)', 'پیشنهادهای اوپن‌فاند (OFP)')[locale]}</h2>
        <label className="gv-filter">{text('Status', 'وضعیت')[locale]}{' '}
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">{text('All public proposals', 'همهٔ پیشنهادهای عمومی')[locale]}</option>
            {['discussion', 'submitted', 'under_review', 'voting', 'approved', 'rejected', 'implementation_scheduled', 'in_progress', 'implemented', 'blocked'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select></label>
        <StateBox state={proposals.state} locale={locale} empty={text('No public proposals yet. Be the first to submit one.', 'هنوز پیشنهاد عمومی‌ای نیست. نخستین پیشنهاد را تو ثبت کن.')[locale]} isEmpty={d => d.proposals.length === 0} onRetry={proposals.reload}>
          {p => <ProposalTable data={p} locale={locale} href={href} />}
        </StateBox>
      </section>

      <section id="voting" className="gv-section" aria-labelledby="gv-h-voting">
        <span className="eyebrow">04 / {text('VOTING', 'رأی‌گیری')[locale]}</span>
        <h2 id="gv-h-voting">{text('Council voting', 'رأی‌گیری شورا')[locale]}</h2>
        <p>{text('Only seated council members can vote. Everyone else sees the same information, read-only.', 'فقط اعضای شورا می‌توانند رأی دهند. دیگران همین اطلاعات را فقط‌خواندنی می‌بینند.')[locale]}</p>
        <StateBox state={overview.state} locale={locale} empty={text('No council vote is open.', 'رأی‌گیری بازی وجود ندارد.')[locale]} isEmpty={d => d.openVotes.length === 0} onRetry={overview.reload}>
          {o => <div className="gv-open-votes">{o.openVotes.map(v => <div key={v.ofpId}>
            <h3><a href={href(v.ofpId)}>{v.ofpId} · {v.title}</a> <small>{categoryLabel(v.category, locale)}</small></h3>
            <ProposalVote ofp={v.ofpId} locale={locale} />
          </div>)}</div>}
        </StateBox>
      </section>

      <section id="decisions" className="gv-section" aria-labelledby="gv-h-decisions">
        <span className="eyebrow">05 / {text('DECISIONS', 'تصمیم‌ها')[locale]}</span>
        <h2 id="gv-h-decisions">{text('Recorded decisions', 'تصمیم‌های ثبت‌شده')[locale]}</h2>
        <StateBox state={decisions.state} locale={locale} empty={text('No decision has been recorded yet.', 'هنوز تصمیمی ثبت نشده است.')[locale]} isEmpty={d => d.decisions.length === 0 && d.blocked.length === 0} onRetry={decisions.reload}>
          {d => <DecisionList data={d} locale={locale} href={href} />}
        </StateBox>
      </section>

      <section id="roadmap" className="gv-section" aria-labelledby="gv-h-roadmap">
        <span className="eyebrow">06 / {text('ROADMAP', 'نقشهٔ راه')[locale]}</span>
        <h2 id="gv-h-roadmap">{text('Governance milestones', 'نقاط عطف حاکمیت')[locale]}</h2>
        <Roadmap items={milestones} locale={locale} />
      </section>

      <section id="documents" className="gv-section" aria-labelledby="gv-h-docs">
        <span className="eyebrow">07 / {text('DOCUMENTS', 'مستندات')[locale]}</span>
        <h2 id="gv-h-docs">{text('Policies and procedures', 'سیاست‌ها و روندها')[locale]}</h2>
        <DocLinks locale={locale} />
        {overview.state.status === 'ready' && <p className="gv-note">{overview.state.data.initialCouncilNote} · {number(overview.state.data.council.seatedCount, locale)}/{number(10, locale)}</p>}
      </section>
    </div>
  </InformationShell>
}
