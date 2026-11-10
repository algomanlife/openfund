import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale, useUiLocale } from '../information/InformationShell'
import { text, number } from '../information/content'
import { useOpenfundSession } from '../../session/useOpenfundSession'
import { governanceFetch, useGovernance, type ProposalDetail } from './api'
import { ClassBadge, StateBox, StatusBadge } from './GovernanceViews'
import ProposalVote from './ProposalVote'
import { categoryLabel, errorMessage, formatDate, isReservedCategory, statusLabel } from './governanceModel'
import './governance.css'

interface CommentsData { notice: string; comments: Array<{ id: string; body: string; stance: string | null; author: string; createdAt: string }> }

export default function ProposalPage() {
  const locale = useInformationLocale()
  const ui = useUiLocale()
  const { ofp = '' } = useParams()
  const { status } = useOpenfundSession()
  const [tick, setTick] = useState(0)
  const detail = useGovernance<ProposalDetail>(`/proposals/${encodeURIComponent(ofp)}`, `${status}:${tick}`)
  const comments = useGovernance<CommentsData>(`/proposals/${encodeURIComponent(ofp)}/comments`, tick)
  const [body, setBody] = useState('')
  const [stance, setStance] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const t = (en: string, fa: string) => text(en, fa)[locale]

  async function post() {
    setBusy(true); setErr(null)
    const r = await governanceFetch(`/proposals/${encodeURIComponent(ofp)}/comments`, { method: 'POST', body: JSON.stringify({ body, stance: stance || undefined }) })
    setBusy(false)
    if (!r.ok) { setErr(r.data?.error ?? 'error'); return }
    setBody(''); setStance(''); setTick(n => n + 1)
  }

  return <InformationShell page="governance" description={t('Openfund proposal record.', 'سابقهٔ پیشنهاد اوپن‌فاند.')} title={`${ofp} | Openfund`}>
    <div className="container gv-page gv-proposal">
      <p><Link className="text-link" to={`/${ui}/governance#proposals`}>← {t('All proposals', 'همهٔ پیشنهادها')}</Link></p>
      <StateBox state={detail.state} locale={locale} empty="" onRetry={detail.reload}>
        {p => <>
          <header className="gv-proposal-head">
            <span className="eyebrow">{p.ofpId} · {t('revision', 'بازنگری')} {number(p.revision, locale)}</span>
            <h1>{p.title}</h1>
            <p className="hero-intro">{p.summary}</p>
            <div className="gv-badges"><StatusBadge status={p.status} locale={locale} /><ClassBadge binding={p.binding} locale={locale} />
              <span className="gv-badge">{categoryLabel(p.category, locale)}</span></div>
            {isReservedCategory(p.category) && <aside className="info-notice"><span className="tiny-mark" aria-hidden="true">◇</span><p>{t('This topic belongs to company management. The council and community can only recommend; this proposal can never execute or bind anything.', 'این موضوع در اختیار مدیریت شرکت است. شورا و جامعه فقط می‌توانند توصیه کنند؛ این پیشنهاد هرگز چیزی را اجرا یا ملزم نمی‌کند.')}</p></aside>}
          </header>

          <section className="gv-section"><h2>{t('Proposal', 'پیشنهاد')}</h2>
            <p className="gv-prose">{p.description}</p>
            <dl className="gv-defs">
              {([['Author', 'نویسنده', p.author], ['Affected product area', 'حوزهٔ محصول', p.productArea], ['Technical implications', 'پیامدهای فنی', p.technicalImplications], ['Resource requirements', 'منابع موردنیاز', p.resourceRequirements],
                ['Expected benefits', 'مزایای مورد انتظار', p.expectedBenefits], ['Risks', 'ریسک‌ها', p.risks]] as const).filter(r => r[2]).map(([en, fa, v]) => <div key={en}><dt>{t(en, fa)}</dt><dd>{v}</dd></div>)}
              {p.githubIssue && <div><dt>{t('Related GitHub issue', 'ایشوی گیت‌هاب')}</dt><dd><a href={p.githubIssue} target="_blank" rel="noopener noreferrer">{p.githubIssue}</a></dd></div>}
              {p.githubPullRequest && <div><dt>{t('Related pull request', 'پول‌ریکوست مرتبط')}</dt><dd><a href={p.githubPullRequest} target="_blank" rel="noopener noreferrer">{p.githubPullRequest}</a></dd></div>}
              {p.documentation.length > 0 && <div><dt>{t('Documentation', 'مستندات')}</dt><dd>{p.documentation.map(d => <a key={d} href={d} target="_blank" rel="noopener noreferrer">{d}</a>)}</dd></div>}
              <div><dt>{t('Last updated', 'آخرین به‌روزرسانی')}</dt><dd>{formatDate(p.updatedAt, locale)}</dd></div>
            </dl>
          </section>

          {(p.status === 'voting' || p.sessions.length > 0) && <section className="gv-section"><h2>{t('Council vote', 'رأی شورا')}</h2><ProposalVote ofp={p.ofpId} locale={locale} onChanged={() => setTick(n => n + 1)} /></section>}

          {p.decisions.length > 0 && <section className="gv-section"><h2>{t('Decision', 'تصمیم')}</h2>
            {p.decisions.map(d => <article key={d.id} className="gv-card gv-decision" data-outcome={d.outcome}><header><strong>{d.outcome === 'approved' ? t('Approved', 'تصویب‌شده') : d.outcome === 'rejected' ? t('Rejected', 'ردشده') : t('Unresolved', 'نامشخص')}</strong> <ClassBadge binding={d.binding} locale={locale} /></header>
              <p>{d.rationale}</p><p className="gv-fineprint">{formatDate(d.decided_at, locale)}{d.amendments?.length ? ` · ${number(d.amendments.length, locale)} ${t('recorded amendment(s)', 'اصلاحیهٔ ثبت‌شده')}` : ''}</p></article>)}
          </section>}

          <section className="gv-section"><h2>{t('Implementation', 'وضعیت اجرا')}</h2>
            {p.implementation.length === 0
              ? <p>{p.status === 'approved' ? t('Approved, not implemented. Implementation requires recorded execution evidence.', 'تصویب‌شده، اجرا نشده. اجرا به ثبت شواهد اجرایی نیاز دارد.') : t('No implementation has been recorded.', 'اجرایی ثبت نشده است.')}</p>
              : <ol className="gv-timeline">{p.implementation.map((i, n) => <li key={n}><strong>{statusLabel(i.status === 'scheduled' ? 'implementation_scheduled' : i.status, locale)}</strong> · {formatDate(i.created_at, locale)}
                {i.evidence_url && <> · <a href={i.evidence_url} target="_blank" rel="noopener noreferrer">{t('evidence', 'شواهد')}</a></>}
                {i.blocked_reason && <p>{i.blocked_reason} — {i.blocked_evidence} ({t('next review', 'بازبینی بعدی')}: {i.next_review_on})</p>}</li>)}</ol>}
          </section>

          <section className="gv-section"><h2>{t('History', 'تاریخچه')}</h2>
            <ol className="gv-timeline">{p.history.map((h, n) => <li key={n}>{statusLabel(h.to_status, locale)} · {formatDate(h.created_at, locale)} · <small>{h.actor_role}</small>{h.note ? <> — {h.note}</> : null}</li>)}</ol></section>

          <section className="gv-section" id="feedback"><h2>{t('Community feedback', 'بازخورد جامعه')}</h2>
            <p className="gv-note">{t('Feedback is the community’s opinion. It is not a council vote and has no binding effect.', 'بازخورد نظر جامعه است. رأی شورا نیست و اثر الزام‌آور ندارد.')}</p>
            <StateBox state={comments.state} locale={locale} empty={t('No feedback yet.', 'هنوز بازخوردی نیست.')} isEmpty={c => c.comments.length === 0} onRetry={comments.reload}>
              {c => <ul className="gv-comments">{c.comments.map(m => <li key={m.id}><header><span dir="ltr">{m.author}</span>{m.stance && <span className="gv-badge">{m.stance === 'support' ? t('supports', 'موافق') : m.stance === 'oppose' ? t('opposes', 'مخالف') : t('neutral', 'بی‌طرف')}</span>} <small>{formatDate(m.createdAt, locale)}</small></header><p>{m.body}</p></li>)}</ul>}
            </StateBox>
            {status === 'authenticated'
              ? <form className="gv-form" onSubmit={e => { e.preventDefault(); void post() }}>
                  <label>{t('Your feedback', 'بازخورد تو')}<textarea value={body} onChange={e => setBody(e.target.value)} maxLength={2000} required rows={4} /></label>
                  <label>{t('Position (optional)', 'موضع (اختیاری)')}<select value={stance} onChange={e => setStance(e.target.value)}><option value="">—</option><option value="support">{t('Support', 'موافق')}</option><option value="oppose">{t('Oppose', 'مخالف')}</option><option value="neutral">{t('Neutral', 'بی‌طرف')}</option></select></label>
                  {err && <p className="gv-error" role="alert">{errorMessage(err, locale)}</p>}
                  <button className="gv-btn" disabled={busy || !body.trim()} type="submit">{t('Post feedback', 'ارسال بازخورد')}</button>
                </form>
              : <p className="gv-readonly">{t('Sign in with your wallet to leave feedback.', 'برای ثبت بازخورد با کیف پول وارد شو.')}</p>}
          </section>
        </>}
      </StateBox>
    </div>
  </InformationShell>
}
