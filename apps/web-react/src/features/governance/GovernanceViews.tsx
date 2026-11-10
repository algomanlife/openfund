/**
 * Presentational governance components — no routing shell, no network, no
 * wallet. Everything here renders from props so loading, empty, error,
 * read-only and authorised states are all testable with renderToStaticMarkup.
 */
import type { ReactNode } from 'react'
import { text, number, type Locale } from '../information/content'
import {
  CONSTITUENCIES, CONSTITUENCY_LABEL, COUNCIL_SIZE, QUORUM, ORDINARY_THRESHOLD, CONSTITUTIONAL_THRESHOLD,
  VOTE_LABEL, approvalRequirement, categoryLabel, classificationLabel, errorMessage, formatDate, formatDay,
  GOVERNANCE_DOCS, DOC_BASE, isReservedCategory, statusLabel, timeLeft, type LoadState, type VotingSession,
} from './governanceModel'
import type { CouncilData, DecisionsData, ProposalList, ProposalDetail } from './api'

const T = (locale: Locale, en: string, fa: string) => text(en, fa)[locale]

/* -------------------------------------------------------------- state box -- */
export function StateBox<D>({ state, locale, empty, isEmpty, onRetry, children }: {
  state: LoadState<D>; locale: Locale; empty: string; isEmpty?: (d: D) => boolean; onRetry?: () => void; children: (d: D) => ReactNode
}) {
  if (state.status === 'loading') return <div className="gv-state" role="status" aria-live="polite" data-state="loading"><span className="gv-spinner" aria-hidden="true" />{T(locale, 'Loading governance records…', 'در حال بارگذاری سوابق حاکمیت…')}</div>
  if (state.status === 'error') return <div className="gv-state gv-state-error" role="alert" data-state="error">
    <p>{T(locale, 'Governance records could not be loaded. Nothing is shown rather than guessed.', 'سوابق حاکمیت بارگذاری نشد. به‌جای حدس‌زدن، چیزی نمایش داده نمی‌شود.')} {state.code ? <code>{state.code}</code> : null}</p>
    {onRetry && <button type="button" className="gv-btn" onClick={onRetry}>{T(locale, 'Try again', 'تلاش دوباره')}</button>}
  </div>
  if (isEmpty?.(state.data)) return <div className="gv-state" data-state="empty"><p>{empty}</p></div>
  return <>{children(state.data)}</>
}

export function ClassBadge({ binding, locale }: { binding: boolean; locale: Locale }) {
  return <span className={`gv-badge ${binding ? 'gv-binding' : 'gv-advisory'}`} data-class={binding ? 'binding' : 'advisory'}>{classificationLabel(binding, locale)}</span>
}
export function StatusBadge({ status, locale }: { status: string; locale: Locale }) {
  return <span className={`gv-badge gv-status gv-status-${status}`}>{statusLabel(status, locale)}</span>
}

/* ---------------------------------------------------- authority comparison -- */
export function AuthorityComparison({ locale }: { locale: Locale }) {
  const delegated = [
    T(locale, 'Product development priorities', 'اولویت‌های توسعهٔ محصول'),
    T(locale, 'Community policies and moderation standards', 'سیاست‌های جامعه و استانداردهای مدیریت'),
    T(locale, 'Open-source contribution priorities', 'اولویت‌های مشارکت متن‌باز'),
    T(locale, 'Roadmap priorities within a management-approved capacity', 'اولویت‌های نقشهٔ راه در چارچوب ظرفیت تأییدشدهٔ مدیریت'),
    T(locale, 'Documentation and accessibility priorities', 'اولویت‌های مستندات و دسترس‌پذیری'),
  ]
  const reserved = [
    T(locale, 'Treasury, reserves and capital allocation', 'خزانه، ذخایر و تخصیص سرمایه'),
    T(locale, 'Challenge prices, revenue model and payouts', 'قیمت چلنج، مدل درآمد و پرداخت‌ها'),
    T(locale, 'Ambassador commissions and coach compensation', 'کمیسیون سفیران و پاداش مربیان'),
    T(locale, 'Trading risk limits and real trading capital', 'محدودیت‌های ریسک و سرمایهٔ واقعی معاملاتی'),
    T(locale, 'Commercial contracts, legal and security duties', 'قراردادهای تجاری، تعهدات حقوقی و امنیتی'),
  ]
  return <div className="gv-authority">
    <article className="gv-card gv-card-council" aria-labelledby="gv-council-h">
      <span className="gv-eyebrow">{T(locale, 'COMMUNITY COUNCIL', 'شورای جامعه')}</span>
      <h3 id="gv-council-h">{T(locale, 'Binding decisions, delegated domains', 'تصمیم‌های الزام‌آور در حوزه‌های تفویض‌شده')}</h3>
      <p>{T(locale, 'Ten representatives from five constituencies. Approved decisions are binding inside these domains, subject to safety, legal and capacity limits.', 'ده نماینده از پنج گروه. تصمیم‌های تصویب‌شده در این حوزه‌ها الزام‌آور است، مشروط به محدودیت‌های ایمنی، حقوقی و ظرفیت.')}</p>
      <ul>{delegated.map(d => <li key={d}>{d}</li>)}</ul>
    </article>
    <article className="gv-card gv-card-company" aria-labelledby="gv-company-h">
      <span className="gv-eyebrow">{T(locale, 'COMPANY MANAGEMENT', 'مدیریت شرکت')}</span>
      <h3 id="gv-company-h">{T(locale, 'Exclusive financial authority', 'اختیار انحصاری مالی')}</h3>
      <p>{T(locale, 'Community members may submit recommendations here. They are always labelled “Advisory — Non-Binding” and can never execute anything.', 'اعضا می‌توانند در این حوزه‌ها توصیه ثبت کنند. این توصیه‌ها همیشه «مشورتی — غیرالزام‌آور» هستند و هیچ اجرایی ندارند.')}</p>
      <ul>{reserved.map(d => <li key={d}>{d}</li>)}</ul>
    </article>
  </div>
}

export function AuthorityTable({ locale }: { locale: Locale }) {
  const rows: Array<[string, string, string]> = [
    [T(locale, 'Who decides', 'چه کسی تصمیم می‌گیرد'), T(locale, 'Community Council, by recorded vote', 'شورای جامعه با رأی ثبت‌شده'), T(locale, 'Openfund company management', 'مدیریت شرکت اوپن‌فاند')],
    [T(locale, 'Effect of community input', 'اثر نظر جامعه'), T(locale, 'Binding when approved (6 of 10)', 'در صورت تصویب (۶ از ۱۰) الزام‌آور'), T(locale, 'Advisory — Non-Binding', 'مشورتی — غیرالزام‌آور')],
    [T(locale, 'Can move funds or change prices', 'امکان جابه‌جایی وجوه یا تغییر قیمت'), T(locale, 'No — technically and by policy', 'خیر — فنی و سیاستی'), T(locale, 'Yes, under company controls', 'بله، تحت کنترل‌های شرکت')],
    [T(locale, 'Enforced by', 'اِعمال توسط'), T(locale, 'Backend authorisation and database constraints', 'مجوزدهی بک‌اند و قیدهای پایگاه داده'), T(locale, 'Company financial controls', 'کنترل‌های مالی شرکت')],
  ]
  return <div className="info-table-wrap gv-table-wrap"><table>
    <caption>{T(locale, 'Authority comparison', 'مقایسهٔ اختیارات')}</caption>
    <thead><tr><th scope="col">{T(locale, 'Question', 'پرسش')}</th><th scope="col">{T(locale, 'Community Council', 'شورای جامعه')}</th><th scope="col">{T(locale, 'Company Management', 'مدیریت شرکت')}</th></tr></thead>
    <tbody>{rows.map(([q, a, b]) => <tr key={q}><th scope="row">{q}</th><td>{a}</td><td>{b}</td></tr>)}</tbody>
  </table></div>
}

/* ---------------------------------------------------------- architecture -- */
export function ArchitectureDiagram({ locale }: { locale: Locale }) {
  return <figure className="gv-diagram">
    <svg viewBox="0 0 720 220" role="img" aria-labelledby="gv-arch-t gv-arch-d">
      <title id="gv-arch-t">{T(locale, 'Hybrid governance architecture', 'معماری حاکمیت ترکیبی')}</title>
      <desc id="gv-arch-d">{T(locale, 'The Community Council decides delegated domains through the governance backend. Company management controls treasury and finance separately. The two share no execution path.', 'شورای جامعه حوزه‌های تفویض‌شده را از طریق بک‌اند حاکمیت تصمیم می‌گیرد. مدیریت شرکت خزانه و مالی را جداگانه کنترل می‌کند. این دو مسیر اجرایی مشترک ندارند.')}</desc>
      <rect x="10" y="20" width="300" height="180" rx="14" className="gv-svg-box gv-svg-council" />
      <text x="160" y="52" textAnchor="middle" className="gv-svg-h">{T(locale, 'Community Council', 'شورای جامعه')}</text>
      <text x="160" y="82" textAnchor="middle" className="gv-svg-t">{T(locale, '10 seats · 5 constituencies', '۱۰ کرسی · ۵ گروه')}</text>
      <text x="160" y="110" textAnchor="middle" className="gv-svg-t">{T(locale, 'OFP proposals → recorded votes', 'پیشنهادهای OFP ← رأی ثبت‌شده')}</text>
      <text x="160" y="138" textAnchor="middle" className="gv-svg-t">{T(locale, 'Product · community · open source', 'محصول · جامعه · متن‌باز')}</text>
      <text x="160" y="176" textAnchor="middle" className="gv-svg-m">{T(locale, 'Output: a decision record', 'خروجی: سابقهٔ تصمیم')}</text>
      <rect x="410" y="20" width="300" height="180" rx="14" className="gv-svg-box gv-svg-company" />
      <text x="560" y="52" textAnchor="middle" className="gv-svg-h">{T(locale, 'Company Management', 'مدیریت شرکت')}</text>
      <text x="560" y="82" textAnchor="middle" className="gv-svg-t">{T(locale, 'Treasury · capital · pricing', 'خزانه · سرمایه · قیمت‌گذاری')}</text>
      <text x="560" y="110" textAnchor="middle" className="gv-svg-t">{T(locale, 'Commissions · payouts · risk', 'کمیسیون · پرداخت · ریسک')}</text>
      <text x="560" y="138" textAnchor="middle" className="gv-svg-t">{T(locale, 'Legal · security · contracts', 'حقوقی · امنیت · قراردادها')}</text>
      <text x="560" y="176" textAnchor="middle" className="gv-svg-m">{T(locale, 'Output: financial actions', 'خروجی: اقدام‌های مالی')}</text>
      <line x1="320" y1="110" x2="400" y2="110" className="gv-svg-gap" />
      <text x="360" y="100" textAnchor="middle" className="gv-svg-m">{T(locale, 'advisory only', 'فقط مشورتی')}</text>
      <text x="360" y="132" textAnchor="middle" className="gv-svg-m">✕ {T(locale, 'no execution', 'بدون اجرا')}</text>
    </svg>
  </figure>
}

/* -------------------------------------------------------------- council -- */
export function CouncilGrid({ data, locale }: { data: CouncilData; locale: Locale }) {
  const by = (k: string) => data.seats.filter(s => s.constituency === k)
  return <div>
    {data.term
      ? <p className="gv-term" data-term-method={data.term.appointmentMethod}>
          <strong>{data.term.label}</strong> · {formatDay(data.term.startsAt, locale)} → {formatDay(data.term.endsAt, locale)} · {' '}
          {data.term.appointmentMethod === 'appointed'
            ? T(locale, 'Appointed by company management — not community-elected', 'منصوب‌شده توسط مدیریت شرکت — نه انتخاب‌شده توسط جامعه')
            : T(locale, 'Elected by constituency vote', 'انتخاب‌شده با رأی گروه‌ها')}
        </p>
      : <p className="gv-term gv-term-none" data-term-method="none">{T(locale, 'No council term is active. No council has been seated, so no seat is shown as filled.', 'هیچ دورهٔ شورا فعال نیست. شورایی تشکیل نشده و هیچ کرسی پر نمایش داده نمی‌شود.')}</p>}
    <p className="gv-count" aria-live="polite">{number(data.seatedCount, locale)} / {number(COUNCIL_SIZE, locale)} {T(locale, 'seats filled', 'کرسی پر')} · {number(data.vacantCount, locale)} {T(locale, 'vacant', 'خالی')}</p>
    <div className="gv-constituencies">
      {CONSTITUENCIES.map(k => <section key={k} className="gv-card gv-constituency" aria-labelledby={`gv-c-${k}`}>
        <h3 id={`gv-c-${k}`}>{CONSTITUENCY_LABEL[k][locale]}</h3>
        <ul className="gv-seats">
          {[1, 2].map(n => {
            const seat = by(k).find(s => s.seatNo === n)
            const filled = seat?.status === 'seated'
            return <li key={n} className={`gv-seat ${filled ? 'gv-seat-filled' : 'gv-seat-vacant'}`} data-seat-status={filled ? 'seated' : 'vacant'}>
              <span className="gv-seat-no">{T(locale, 'Seat', 'کرسی')} {number(n, locale)}</span>
              {filled
                ? <>
                    <strong>{seat!.displayName ?? T(locale, 'Seated — name not published', 'منصوب — نام منتشر نشده')}</strong>
                    <span className="gv-seat-meta">{seat!.membershipType === 'elected' ? T(locale, 'Elected', 'انتخابی') : T(locale, 'Appointed', 'انتصابی')} · {formatDay(seat!.termStartsAt, locale)} → {formatDay(seat!.termEndsAt, locale)}</span>
                    <span className="gv-seat-meta">{T(locale, 'Votes cast', 'آرای ثبت‌شده')}: {number(seat!.participation?.votesCast ?? 0, locale)} / {number(seat!.participation?.sessionsEligible ?? 0, locale)}</span>
                  </>
                : <strong className="gv-vacant">{T(locale, 'Vacant', 'خالی')}</strong>}
            </li>
          })}
        </ul>
      </section>)}
    </div>
  </div>
}

/* ------------------------------------------------------------ proposals -- */
export function ProposalTable({ data, locale, href }: { data: ProposalList; locale: Locale; href: (ofp: string) => string }) {
  return <div className="info-table-wrap gv-table-wrap"><table>
    <caption>{T(locale, 'Proposals', 'پیشنهادها')} · {number(data.total, locale)}</caption>
    <thead><tr>
      <th scope="col">OFP</th><th scope="col">{T(locale, 'Title', 'عنوان')}</th><th scope="col">{T(locale, 'Category', 'دسته')}</th>
      <th scope="col">{T(locale, 'Author', 'نویسنده')}</th><th scope="col">{T(locale, 'Status', 'وضعیت')}</th>
      <th scope="col">{T(locale, 'Authority', 'اختیار')}</th><th scope="col">{T(locale, 'Voting deadline', 'مهلت رأی')}</th><th scope="col">{T(locale, 'Feedback', 'بازخورد')}</th>
    </tr></thead>
    <tbody>{data.proposals.map(p => <tr key={p.ofpId}>
      <th scope="row"><a href={href(p.ofpId)}>{p.ofpId}</a></th>
      <td><a href={href(p.ofpId)}>{p.title}</a></td>
      <td>{categoryLabel(p.category, locale)}{isReservedCategory(p.category) && <small className="gv-reserved"> · {T(locale, 'reserved to management', 'متعلق به مدیریت')}</small>}</td>
      <td dir="ltr">{p.author}</td>
      <td><StatusBadge status={p.status} locale={locale} /></td>
      <td><ClassBadge binding={p.binding} locale={locale} /></td>
      <td>{p.votingDeadline ? formatDate(p.votingDeadline, locale) : '—'}</td>
      <td>{number(p.commentCount ?? 0, locale)}</td>
    </tr>)}</tbody>
  </table></div>
}

/* ------------------------------------------------------------ decisions -- */
export function DecisionList({ data, locale, href }: { data: DecisionsData; locale: Locale; href: (ofp: string) => string }) {
  return <div className="gv-decisions">
    {data.decisions.map(d => <article key={d.ofpId + d.decidedAt} className="gv-card gv-decision" data-outcome={d.outcome}>
      <header><a href={href(d.ofpId)}><strong>{d.ofpId}</strong> · {d.title}</a>
        <span className={`gv-badge gv-outcome-${d.outcome}`}>{d.outcome === 'approved' ? T(locale, 'Approved', 'تصویب‌شده') : d.outcome === 'rejected' ? T(locale, 'Rejected', 'ردشده') : T(locale, 'Unresolved', 'نامشخص')}</span>
        <ClassBadge binding={d.binding} locale={locale} /></header>
      <p>{d.rationale}</p>
      <dl>
        <div><dt>{T(locale, 'Decided', 'تاریخ تصمیم')}</dt><dd>{formatDate(d.decidedAt, locale)}</dd></div>
        <div><dt>{T(locale, 'Votes', 'آرا')}</dt><dd>{T(locale, 'approve', 'موافق')} {number(Number(d.tally.approve ?? 0), locale)} · {T(locale, 'reject', 'مخالف')} {number(Number(d.tally.reject ?? 0), locale)} · {T(locale, 'abstain', 'ممتنع')} {number(Number(d.tally.abstain ?? 0), locale)}</dd></div>
        <div><dt>{T(locale, 'Implementation', 'وضعیت اجرا')}</dt><dd>{d.implementationStatus === 'not_started' ? T(locale, 'Not started — approval is not implementation', 'آغاز نشده — تصویب به معنای اجرا نیست') : statusLabel(d.proposalStatus, locale)}</dd></div>
      </dl>
    </article>)}
    {data.blocked.map(b => <article key={b.ofp_id} className="gv-card gv-decision gv-blocked" data-outcome="blocked">
      <header><strong>{b.ofp_id}</strong> · {b.title} <span className="gv-badge gv-status gv-status-blocked">{statusLabel('blocked', locale)}</span></header>
      {b.blocker && <dl>
        <div><dt>{T(locale, 'Documented reason', 'دلیل مستند')}</dt><dd>{b.blocker.blocked_reason}</dd></div>
        <div><dt>{T(locale, 'Evidence', 'شواهد')}</dt><dd>{b.blocker.blocked_evidence}</dd></div>
        <div><dt>{T(locale, 'Next review', 'بازبینی بعدی')}</dt><dd>{formatDay(b.blocker.next_review_on, locale)}</dd></div>
      </dl>}
    </article>)}
  </div>
}

/* ---------------------------------------------------------- vote panel -- */
export interface VotePanelProps {
  proposal: Pick<ProposalDetail, 'ofpId' | 'title' | 'binding' | 'viewer' | 'sessions'> & { status: string }
  locale: Locale; signedIn: boolean; busy?: boolean
  submitted?: { choice: string; signed: boolean } | null; errorCode?: string | null
  sign: boolean; onSignChange?: (v: boolean) => void; onVote?: (choice: 'approve' | 'reject' | 'abstain') => void; now?: number
}
export function VotePanel({ proposal, locale, signedIn, busy, submitted, errorCode, sign, onSignChange, onVote, now }: VotePanelProps) {
  const session: VotingSession | undefined = proposal.sessions.find(s => s.status === 'active') ?? proposal.sessions[proposal.sessions.length - 1]
  if (!session) return <section className="gv-card gv-vote" data-vote-mode="none"><h3>{T(locale, 'Council vote', 'رأی شورا')}</h3><p>{T(locale, 'No council vote has been scheduled for this proposal.', 'برای این پیشنهاد رأی‌گیری شورا زمان‌بندی نشده است.')}</p></section>
  const v = proposal.viewer
  const canVote = signedIn && v?.councilMember && v.canVote && session.phase === 'open' && !submitted
  const left = session.phase === 'open' ? timeLeft(session.closesAt, now) : null
  const tally = (session as { tally?: { participating?: number } | null }).tally
  const reasonText = !signedIn ? T(locale, 'Sign in with your wallet to see whether you may vote. This view is read-only.', 'برای دیدن امکان رأی‌دادن با کیف پول وارد شو. این نما فقط‌خواندنی است.')
    : !v?.councilMember ? T(locale, 'Only seated council members can vote. You can still follow the result and leave non-binding feedback.', 'فقط اعضای شورا رأی می‌دهند. می‌توانی نتیجه را دنبال کنی و بازخورد غیرالزام‌آور بگذاری.')
    : v.reason ? errorMessage(v.reason, locale) : ''
  return <section className="gv-card gv-vote" data-vote-mode={canVote ? 'vote' : 'readonly'} aria-labelledby="gv-vote-h">
    <h3 id="gv-vote-h">{T(locale, 'Council vote', 'رأی شورا')} · <ClassBadge binding={proposal.binding} locale={locale} /></h3>
    <dl className="gv-vote-facts">
      <div><dt>{T(locale, 'Phase', 'مرحله')}</dt><dd>{session.phase === 'open' ? T(locale, 'Open', 'باز') : session.phase === 'scheduled' ? T(locale, 'Scheduled', 'زمان‌بندی‌شده') : session.phase === 'closed' ? T(locale, 'Closed — awaiting finalisation', 'بسته — در انتظار نهایی‌سازی') : session.phase === 'finalized' ? T(locale, 'Finalised', 'نهایی‌شده') : T(locale, 'Void', 'باطل')}</dd></div>
      <div><dt>{T(locale, 'Opens', 'شروع')}</dt><dd>{formatDate(session.opensAt, locale)}</dd></div>
      <div><dt>{T(locale, 'Deadline', 'مهلت')}</dt><dd>{formatDate(session.closesAt, locale)}{left && <> · {T(locale, 'left', 'باقی')}: {left.days ? `${number(left.days, locale)}${T(locale, 'd', 'روز')} ` : ''}{number(left.hours, locale)}{T(locale, 'h', 'ساعت')} {number(left.minutes, locale)}{T(locale, 'm', 'دقیقه')}</>}</dd></div>
      <div><dt>{T(locale, 'To pass', 'شرط تصویب')}</dt><dd>{approvalRequirement(session, locale)}</dd></div>
      {session.kind === 'constitutional' && <div><dt>{T(locale, 'Type', 'نوع')}</dt><dd>{T(locale, 'Constitutional amendment', 'اصلاحیهٔ اساسی')}</dd></div>}
      {tally && typeof tally.participating === 'number' && <div><dt>{T(locale, 'Participation', 'مشارکت')}</dt><dd>
        <meter min={0} max={session.councilSize} value={tally.participating} low={session.quorum - 1} optimum={session.councilSize} aria-label={T(locale, 'Members who have voted', 'اعضای رأی‌داده')} /> {number(tally.participating, locale)} / {number(session.councilSize, locale)}
        {' '}({T(locale, 'quorum', 'حدنصاب')} {number(session.quorum, locale)}) — {T(locale, 'individual choices stay hidden until the result is final', 'آرای فردی تا نهایی‌شدن نتیجه پنهان می‌ماند')}</dd></div>}
    </dl>
    {submitted && <p className="gv-confirm" role="status" data-vote-confirmed>{T(locale, 'Your vote is recorded:', 'رأی تو ثبت شد:')} <strong>{VOTE_LABEL[submitted.choice]?.[locale]}</strong> · {submitted.signed ? T(locale, 'wallet signature stored as evidence', 'امضای کیف پول به‌عنوان مدرک ذخیره شد') : T(locale, 'authenticated session vote', 'رأی با نشست احراز‌شده')} · {T(locale, 'final', 'نهایی')}</p>}
    {errorCode && <p className="gv-error" role="alert">{errorMessage(errorCode, locale)}</p>}
    {canVote
      ? <form className="gv-vote-form" onSubmit={e => e.preventDefault()}>
          <fieldset disabled={busy}>
            <legend>{T(locale, 'Cast your vote — it cannot be changed', 'رأی خود را ثبت کن — قابل تغییر نیست')}</legend>
            <div className="gv-vote-options">{(['approve', 'reject', 'abstain'] as const).map(c =>
              <button key={c} type="button" className={`gv-btn gv-vote-${c}`} onClick={() => onVote?.(c)}>{VOTE_LABEL[c][locale]}</button>)}</div>
            <label className="gv-check"><input type="checkbox" checked={sign} onChange={e => onSignChange?.(e.target.checked)} /> {T(locale, 'Also sign with my wallet (free, no transaction, no network fee)', 'همچنین با کیف پول امضا کن (رایگان، بدون تراکنش و کارمزد)')}</label>
          </fieldset>
        </form>
      : !submitted && <p className="gv-readonly" data-readonly>{reasonText}</p>}
    <p className="gv-fineprint">{T(locale, 'Voting is recorded by the Openfund backend. It is not an on-chain or token-weighted vote.', 'رأی‌گیری در بک‌اند اوپن‌فاند ثبت می‌شود. رأی آن‌چین یا مبتنی بر توکن نیست.')}</p>
  </section>
}

/* -------------------------------------------------------------- roadmap -- */
export interface Milestone { key: string; status: 'planned' | 'in_progress' | 'implemented' | 'not_planned'; title: { en: string; fa: string }; body: { en: string; fa: string } }
export const BUNDLED_MILESTONES: Milestone[] = [
  { key: 'framework', status: 'implemented', title: text('Governance framework in the application', 'چارچوب حاکمیت در برنامه'), body: text('Backend rules, proposal lifecycle, voting records and audit trail exist in this build. They are verified by automated tests, not by production use.', 'قواعد بک‌اند، چرخهٔ عمر پیشنهاد، سوابق رأی و ردپای حسابرسی در این نسخه وجود دارد. با آزمون خودکار بررسی شده‌اند، نه با استفادهٔ تولیدی.') },
  { key: 'council', status: 'planned', title: text('Initial council appointed and published', 'انتصاب و انتشار شورای اولیه'), body: text('Company management nominates and appoints the first term through a documented process. No date is committed and no member is shown until one is appointed.', 'مدیریت شرکت دورهٔ اول را با روندی مستند معرفی و منصوب می‌کند. تاریخی تعهد نشده و تا انتصاب، عضوی نمایش داده نمی‌شود.') },
  { key: 'elections', status: 'planned', title: text('First constituency elections', 'نخستین انتخابات گروه‌ها'), body: text('Elections stay disabled until management approves the election rules and voter criteria.', 'انتخابات تا تأیید قواعد و معیار رأی‌دهندگان توسط مدیریت غیرفعال می‌ماند.') },
  { key: 'whitepaper', status: 'planned', title: text('Whitepaper governance chapter', 'فصل حاکمیت وایت‌پیپر'), body: text('Editorial content is prepared for the Whitepaper and is managed in Directus once the Whitepaper page ships.', 'محتوای تحریری برای وایت‌پیپر آماده است و پس از انتشار صفحه در Directus مدیریت می‌شود.') },
  { key: 'onchain', status: 'not_planned', title: text('Optional on-chain governance', 'حاکمیت آن‌چین (اختیاری)'), body: text('Not planned and not an existing capability. Any future version needs its own approved, audited design.', 'برنامه‌ریزی نشده و قابلیت موجود نیست. هر نسخهٔ آینده به طراحی تأییدشده و ممیزی‌شدهٔ جداگانه نیاز دارد.') },
]
const MILESTONE_STATUS = { planned: text('Planned', 'برنامه‌ریزی‌شده'), in_progress: text('In progress', 'در حال انجام'), implemented: text('Built · not yet in production use', 'ساخته‌شده · هنوز در استفادهٔ تولیدی نیست'), not_planned: text('Not planned', 'برنامه‌ریزی نشده') }
export function Roadmap({ items, locale }: { items: Milestone[]; locale: Locale }) {
  return <ol className="gv-roadmap">{items.map((m, i) => <li key={m.key} className="gv-card" data-milestone-status={m.status}>
    <span className="section-number">{number(i + 1, locale, { minimumIntegerDigits: 2 })}</span>
    <h3>{m.title[locale]}</h3><span className="pill">{MILESTONE_STATUS[m.status][locale]}</span><p>{m.body[locale]}</p>
  </li>)}</ol>
}

export function DocLinks({ locale }: { locale: Locale }) {
  return <ul className="gv-docs">{GOVERNANCE_DOCS.map(d => <li key={d.path}><a href={DOC_BASE + d.path} target="_blank" rel="noopener noreferrer">{d.label[locale]} <span aria-hidden="true">↗</span></a></li>)}</ul>
}

export function PolicyFacts({ locale }: { locale: Locale }) {
  const f: Array<[string, string]> = [
    [number(COUNCIL_SIZE, locale), T(locale, 'council seats', 'کرسی شورا')],
    [number(QUORUM, locale), T(locale, 'members for quorum', 'عضو برای حدنصاب')],
    [`${number(ORDINARY_THRESHOLD, locale)}/${number(COUNCIL_SIZE, locale)}`, T(locale, 'affirmative votes to approve', 'رأی موافق برای تصویب')],
    [`${number(CONSTITUTIONAL_THRESHOLD, locale)}/${number(COUNCIL_SIZE, locale)}`, T(locale, 'for governance amendments', 'برای اصلاحیه‌های حاکمیتی')],
  ]
  return <dl className="gv-facts">{f.map(([n, l]) => <div key={l}><dt>{l}</dt><dd>{n}</dd></div>)}</dl>
}
