import { useState } from 'react'
import { Link } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale, useUiLocale } from '../information/InformationShell'
import { text, number } from '../information/content'
import { useOpenfundSession } from '../../session/useOpenfundSession'
import { governanceFetch, useGovernance, type WorkspaceData } from './api'
import { StateBox, ClassBadge } from './GovernanceViews'
import ProposalVote from './ProposalVote'
import { CONSTITUENCY_LABEL, VOTE_LABEL, categoryLabel, errorMessage, formatDate, timeLeft, type Constituency } from './governanceModel'
import './governance.css'

/** Role-aware workspace. Every number comes from governance records returned by the backend. */
export default function CouncilWorkspace() {
  const locale = useInformationLocale()
  const ui = useUiLocale()
  const { status } = useOpenfundSession()
  const [tick, setTick] = useState(0)
  const ws = useGovernance<WorkspaceData>(status === 'authenticated' ? '/workspace' : null, tick)
  const [conflict, setConflict] = useState({ ofp: '', reason: '' })
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const t = (en: string, fa: string) => text(en, fa)[locale]

  async function declare() {
    setErr(null); setMsg(null)
    const r = await governanceFetch(`/proposals/${encodeURIComponent(conflict.ofp.trim())}/conflicts`, { method: 'POST', body: JSON.stringify({ reason: conflict.reason, seeksRecusal: true }) })
    if (!r.ok) { setErr(r.data?.error ?? 'error'); return }
    setMsg(t('Conflict declared. A governance reviewer will decide on recusal; you cannot vote on this proposal until then.', 'تعارض منافع اعلام شد. بازبین حاکمیت دربارهٔ کناره‌گیری تصمیم می‌گیرد؛ تا آن زمان در این پیشنهاد رأی نمی‌دهی.'))
    setConflict({ ofp: '', reason: '' }); setTick(n => n + 1)
  }

  return <InformationShell page="governance" description={t('Council member workspace.', 'فضای کار عضو شورا.')} title="Council workspace | Openfund">
    <Hero locale={locale} page="governance" title={t('Council workspace', 'فضای کار شورا')} accent={t('Your seat, your votes.', 'کرسی تو، رأی‌های تو.')} intro={t('Visible only to seated council members. Nothing here can move funds or change financial settings.', 'فقط برای اعضای مستقر شورا قابل مشاهده است. هیچ‌چیز در اینجا نمی‌تواند وجوه را جابه‌جا یا تنظیمات مالی را تغییر دهد.')} />
    <div className="container gv-page">
      <p><Link className="text-link" to={`/${ui}/governance`}>← {t('Governance', 'حاکمیت')}</Link></p>
      {status !== 'authenticated'
        ? <p className="gv-readonly" data-readonly>{t('Sign in with your wallet to open your workspace.', 'برای باز کردن فضای کار با کیف پول وارد شو.')}</p>
        : <StateBox state={ws.state} locale={locale} empty="" onRetry={ws.reload}>
            {w => <>
              <section className="gv-card gv-seat-card"><h2>{t('Your seat', 'کرسی تو')}</h2>
                <p><strong>{CONSTITUENCY_LABEL[w.seat.constituency as Constituency]?.[locale]}</strong> · {t('seat', 'کرسی')} {number(w.seat.seatNo, locale)} · {w.seat.membershipType === 'elected' ? t('elected', 'انتخابی') : t('appointed', 'انتصابی')}</p>
                <p>{formatDate(w.seat.startsAt, locale)} → {formatDate(w.seat.endsAt, locale)}</p>
                <p>{t('Votes cast', 'آرای ثبت‌شده')}: {number(w.participation.votesCast, locale)} / {number(w.participation.sessionsEligible, locale)} {t('finalised votes you were seated for', 'رأی‌گیری نهایی‌شده‌ای که عضو بودی')}</p>
              </section>

              <section className="gv-section"><h2>{t('Active voting responsibilities', 'مسئولیت‌های رأی‌گیری فعال')}</h2>
                {w.responsibilities.length === 0 ? <div className="gv-state" data-state="empty"><p>{t('No vote is open right now.', 'اکنون رأی‌گیری بازی نیست.')}</p></div>
                  : w.responsibilities.map(r => <div key={r.ofpId}>
                    <h3><Link to={`/${ui}/governance/proposals/${r.ofpId}`}>{r.ofpId} · {r.title}</Link> <small>{categoryLabel(r.category, locale)}</small> <ClassBadge binding={r.classification === 'binding'} locale={locale} /></h3>
                    {r.myVote && <p className="gv-confirm">{t('You voted', 'رأی دادی')}: {VOTE_LABEL[r.myVote.choice]?.[locale]}</p>}
                    <ProposalVote ofp={r.ofpId} locale={locale} onChanged={() => setTick(n => n + 1)} />
                  </div>)}
              </section>

              <section className="gv-section"><h2>{t('Upcoming deadlines', 'مهلت‌های پیش‌رو')}</h2>
                {w.deadlines.length === 0 ? <p>{t('No pending deadlines.', 'مهلت معوقی نیست.')}</p>
                  : <ul>{w.deadlines.map(d => { const left = timeLeft(d.closesAt); return <li key={d.ofpId}>{d.ofpId} — {formatDate(d.closesAt, locale)}{left ? ` (${number(left.days, locale)}${t('d', 'روز')} ${number(left.hours, locale)}${t('h', 'ساعت')})` : ''}</li> })}</ul>}
              </section>

              <section className="gv-section"><h2>{t('Previous decisions', 'تصمیم‌های قبلی')}</h2>
                {w.history.length === 0 ? <p>{t('No finalised decisions yet.', 'هنوز تصمیم نهایی‌ای نیست.')}</p>
                  : <div className="info-table-wrap gv-table-wrap"><table><thead><tr><th scope="col">OFP</th><th scope="col">{t('Title', 'عنوان')}</th><th scope="col">{t('Outcome', 'نتیجه')}</th><th scope="col">{t('Your vote', 'رأی تو')}</th></tr></thead>
                    <tbody>{w.history.map(h => <tr key={h.ofpId + h.decidedAt}><th scope="row">{h.ofpId}</th><td>{h.title}</td><td>{h.outcome}</td><td>{h.myChoice ? VOTE_LABEL[h.myChoice]?.[locale] : '—'}</td></tr>)}</tbody></table></div>}
              </section>

              <section className="gv-section"><h2>{t('Conflicts of interest', 'تعارض منافع')}</h2>
                <form className="gv-form" onSubmit={e => { e.preventDefault(); void declare() }}>
                  <label>{t('Proposal (OFP number)', 'پیشنهاد (شمارهٔ OFP)')}<input value={conflict.ofp} onChange={e => setConflict(s => ({ ...s, ofp: e.target.value }))} pattern="OFP-\d{4,}" placeholder="OFP-0001" dir="ltr" required /></label>
                  <label>{t('Reason', 'دلیل')}<textarea value={conflict.reason} onChange={e => setConflict(s => ({ ...s, reason: e.target.value }))} minLength={5} maxLength={1000} rows={3} required /></label>
                  {err && <p className="gv-error" role="alert">{errorMessage(err, locale)}</p>}{msg && <p className="gv-confirm" role="status">{msg}</p>}
                  <button className="gv-btn" type="submit">{t('Declare conflict and request recusal', 'اعلام تعارض و درخواست کناره‌گیری')}</button>
                </form>
                {w.conflicts.length > 0 && <ul>{w.conflicts.map(c => <li key={c.id}>{c.ofp_id} · {c.status}{c.review_note ? ` — ${c.review_note}` : ''}</li>)}</ul>}
              </section>
            </>}
          </StateBox>}
    </div>
  </InformationShell>
}
