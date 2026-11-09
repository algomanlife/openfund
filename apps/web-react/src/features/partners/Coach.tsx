import { useState } from 'react'
import { Link } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { labels, text as t, type Locale } from '../information/content'
import { apiFetch, useOpenfundSession } from '../../session/useOpenfundSession'
import { Field, Kpi, StateBlock, Status, errorCopy, int, usd, when, useRemote } from '../economy/ui'
import { Checks } from '../economy/LiveMarketAccess'
import type { EligibilityCheck } from '../economy/types'
import { ApplicationForm, ApplicationStatus, usePartners } from './shared'

const intro = t('An independent role for experienced traders who mentor others. Approved coaches verify the traders they work with and share 10% of distributable realized profit from eligible live trades.', 'نقشی مستقل برای معامله‌گران باتجربه‌ای که دیگران را راهنمایی می‌کنند. کوچ‌های تأییدشده صلاحیت معامله‌گران خود را تأیید می‌کنند و ۱۰٪ سود خالص تحقق‌یافتهٔ قابل‌توزیع معاملات واقعی واجد شرایط را دریافت می‌کنند.')

interface CoachDash {
  status: string; code: string; revenueSharePct: number; linkedTraders: number; pendingRequests: number
  traders: { linkId: string; status: string; qualification: string; note: string | null; trader: { wallet: string; displayName: string | null }; requestedAt: string; verifiedAt: string | null; eligibility: EligibilityCheck[] | null }[]
  liveTrades: { tradeId: string; realizedPnlUsd: string; costsUsd: string; distributableUsd: string; coachShareUsd: string; settlement: string | null; txHash: string | null; reference: string | null; at: string }[]
  realizedNetProfitUsd: string; coachShareUsd: string; settledUsd: string; pendingUsd: string
}

function CoachDashboard({ locale }: { locale: Locale }) {
  const [d, reload] = useRemote<CoachDash>('/coach/dashboard')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<string | null>(null)
  if (d.status !== 'ready') return <StateBlock state={d} locale={locale} />
  const x = d.data
  const act = async (path: string, body: object) => {
    setMsg(null)
    const r = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) })
    if (!r.ok) setMsg(errorCopy(r.data?.error, locale))
    reload()
  }
  return <>
    <div className="econ-panel"><div className="section-top"><h3>{t('Coach code', 'کد کوچ')[locale]}</h3><Status kind={x.status === 'active' ? 'ok' : 'warn'}>{x.status}</Status></div>
      <p className="econ-address" dir="ltr">{x.code}</p><p className="econ-source">{t('Traders enter this code on this page to request you as their coach.', 'معامله‌گران این کد را در همین صفحه وارد می‌کنند تا تو را به‌عنوان کوچ درخواست دهند.')[locale]}</p></div>
    <div className="econ-grid" style={{ marginTop: 16 }}>
      <Kpi label={t('Linked traders', 'معامله‌گران مرتبط')[locale]} value={int(x.linkedTraders, locale)} note={`${int(x.pendingRequests, locale)} ${t('pending requests', 'درخواست در انتظار')[locale]}`} />
      <Kpi label={t('Realized net profit (eligible live trades)', 'سود خالص تحقق‌یافته (معاملات واقعی واجد شرایط)')[locale]} value={usd(x.realizedNetProfitUsd, locale)} />
      <Kpi label={t(`Coach revenue share (${x.revenueSharePct}%)`, `سهم کوچ (${x.revenueSharePct}٪)`)[locale]} value={usd(x.coachShareUsd, locale)} tone="good" />
      <Kpi label={t('Settled / pending', 'تسویه‌شده / در انتظار')[locale]} value={`${usd(x.settledUsd, locale)} / ${usd(x.pendingUsd, locale)}`} />
    </div>
    <div className="econ-panel"><h3>{t('Traders and verification requests', 'معامله‌گران و درخواست‌های تأیید')[locale]}</h3>
      {msg && <p className="econ-msg error" role="alert">{msg}</p>}
      {x.traders.length === 0 && <p className="econ-empty">{t('No trader has requested you yet.', 'هنوز معامله‌گری تو را درخواست نکرده است.')[locale]}</p>}
      {x.traders.map(tr => <div key={tr.linkId} className="econ-panel" style={{ marginTop: 12 }}>
        <div className="section-top"><span className="econ-address" dir="ltr">{tr.trader.displayName ? `${tr.trader.displayName} · ` : ''}{tr.trader.wallet}</span><span><Status kind={tr.status === 'active' ? 'ok' : 'info'}>{tr.status}</Status> <Status kind={tr.qualification === 'verified' ? 'ok' : tr.qualification === 'rejected' ? 'off' : 'warn'}>{tr.qualification}</Status></span></div>
        {tr.status === 'requested' && <div className="econ-actions"><button className="button" onClick={() => act(`/coach/links/${tr.linkId}/respond`, { accept: true })}>{t('Accept', 'پذیرفتن')[locale]}</button><button className="text-link" onClick={() => act(`/coach/links/${tr.linkId}/respond`, { accept: false })}>{t('Decline', 'رد')[locale]}</button></div>}
        {tr.eligibility && <Checks checks={tr.eligibility} locale={locale} />}
        {tr.status === 'active' && <div className="econ-form" style={{ marginTop: 10 }}>
          <div className="wide"><Field label={t('Qualification note (required)', 'یادداشت صلاحیت (الزامی)')[locale]}><textarea value={notes[tr.linkId] || ''} onChange={e => setNotes(n => ({ ...n, [tr.linkId]: e.target.value }))} maxLength={1000} /></Field></div>
          <div className="econ-actions wide"><button className="button" disabled={!notes[tr.linkId]?.trim()} onClick={() => act(`/coach/links/${tr.linkId}/qualification`, { decision: 'verified', note: notes[tr.linkId] })}>{t('Verify qualification', 'تأیید صلاحیت')[locale]}</button><button className="text-link" disabled={!notes[tr.linkId]?.trim()} onClick={() => act(`/coach/links/${tr.linkId}/qualification`, { decision: 'rejected', note: notes[tr.linkId] })}>{t('Not qualified', 'فاقد صلاحیت')[locale]}</button></div>
        </div>}
      </div>)}
    </div>
    <div className="econ-panel"><h3>{t('Profit-share history', 'تاریخچهٔ سهم سود')[locale]}</h3>
      {x.liveTrades.length ? <div className="info-table-wrap"><table><thead><tr>{[t('Date', 'تاریخ'), t('Realized PnL', 'سود تحقق‌یافته'), t('Costs', 'هزینه‌ها'), t('Distributable', 'قابل‌توزیع'), t('Coach share', 'سهم کوچ'), t('Settlement', 'تسویه')].map((h, i) => <th key={i} scope="col">{h[locale]}</th>)}</tr></thead>
        <tbody>{x.liveTrades.map(r => <tr key={r.tradeId}><td>{when(r.at, locale)}</td><td>{usd(r.realizedPnlUsd, locale)}</td><td>{usd(r.costsUsd, locale)}</td><td>{usd(r.distributableUsd, locale)}</td><td>{usd(r.coachShareUsd, locale)}</td><td dir="ltr" style={{ overflowWrap: 'anywhere' }}>{r.settlement || '—'}{r.txHash ? ` · ${r.txHash.slice(0, 10)}…` : r.reference ? ` · ${r.reference}` : ''}</td></tr>)}</tbody></table></div>
        : <p className="econ-empty">{t('No eligible live trade has closed in profit for your traders. Simulated accounts never create coach revenue.', 'هنوز معاملهٔ واقعی واجد شرایطی با سود برای معامله‌گران تو بسته نشده است. حساب‌های شبیه‌سازی‌شده هرگز درآمد کوچ ایجاد نمی‌کنند.')[locale]}</p>}
    </div>
  </>
}

function TraderLink({ locale }: { locale: Locale }) {
  const { status } = useOpenfundSession()
  const [link, reload] = useRemote<{ link: { id: string; status: string; qualification: string; coachCode: string; coachName: string | null; requestedAt: string } | null }>(status === 'authenticated' ? '/coach/link' : null, [status])
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  if (status !== 'authenticated') return <p className="econ-msg">{t('Sign in with your wallet to link a coach.', 'برای اتصال به کوچ با کیف پول وارد شو.')[locale]}</p>
  if (link.status !== 'ready') return <StateBlock state={link} locale={locale} />
  const l = link.data.link
  const open = l && ['requested', 'active'].includes(l.status)
  return <div className="econ-panel">
    {l && <div className="econ-list"><div><span>{t('Coach', 'کوچ')[locale]}</span><span dir="ltr">{l.coachName || ''} {l.coachCode}</span></div><div><span>{t('Relationship', 'ارتباط')[locale]}</span><span>{l.status}</span></div><div><span>{t('Your qualification', 'صلاحیت تو')[locale]}</span><span>{l.qualification}</span></div></div>}
    {open ? <div className="econ-actions"><button className="text-link" onClick={async () => { await apiFetch(`/coach/link/${l!.id}/end`, { method: 'POST', body: '{}' }); reload() }}>{t('End relationship', 'پایان ارتباط')[locale]}</button></div>
      : <form className="econ-form" onSubmit={async e => { e.preventDefault(); setMsg(null); const r = await apiFetch('/coach/link', { method: 'POST', body: JSON.stringify({ coachCode: code.trim() }) }); if (!r.ok) setMsg(errorCopy(r.data?.error, locale)); reload() }}>
        <Field label={t('Coach code', 'کد کوچ')[locale]}><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} required dir="ltr" maxLength={12} /></Field>
        <div className="econ-actions"><button className="button">{t('Request coach', 'درخواست کوچ')[locale]}</button></div>
      </form>}
    {msg && <p className="econ-msg error" role="alert">{msg}</p>}
  </div>
}

export default function Coach() {
  const locale = useInformationLocale()
  const [me, reload] = usePartners()
  const data = me?.status === 'ready' ? me.data : null
  const app = data?.applications.coach || null
  return <InformationShell page="coach" description={intro[locale]}>
    <Hero locale={locale} page="coach" title="Openfund" accent={labels.coach[locale]} intro={intro[locale]}>
      <div className="hero-actions"><a className="button" href="#apply">{t('Apply as a coach', 'درخواست کوچ شدن')[locale]} <span aria-hidden="true">↓</span></a><a className="text-link" href="#trader">{t('I am a trader', 'معامله‌گر هستم')[locale]} ↓</a></div>
    </Hero>
    <div className="container">
      <section className="econ-section" id="role"><div className="section-top"><div><span className="eyebrow">01 / {t('THE ROLE', 'نقش')[locale]}</span><h2>{t('Independent from ambassadors.', 'مستقل از سفیران.')[locale]}</h2></div></div>
        <div className="econ-grid three">
          <Kpi label={t('Audience requirement', 'شرط مخاطب')[locale]} value={t('None', 'ندارد')[locale]} note={t('Coaching is judged on verifiable trading and risk experience.', 'کوچینگ بر اساس سابقهٔ قابل‌تأیید معامله و مدیریت ریسک سنجیده می‌شود.')[locale]} />
          <Kpi label={t('Coach share', 'سهم کوچ')[locale]} value="10%" note={t('Of distributable realized net profit of eligible live trades only', 'فقط از سود خالص تحقق‌یافتهٔ قابل‌توزیع معاملات واقعی واجد شرایط')[locale]} />
          <Kpi label={t('Separate approval', 'تأیید جداگانه')[locale]} value={t('Required', 'الزامی')[locale]} note={t('Holding both roles needs two approvals.', 'داشتن هر دو نقش به دو تأیید جداگانه نیاز دارد.')[locale]} />
        </div>
        <p className="econ-source">{t('Distributable profit = verified realized PnL − trading fees − execution costs. No share is paid on simulated accounts or unrealized PnL. Coaches see only the traders linked to them.', 'سود قابل‌توزیع = سود تحقق‌یافتهٔ تأییدشده − کارمزد معامله − هزینهٔ اجرا. از حساب شبیه‌سازی‌شده یا سود تحقق‌نیافته سهمی پرداخت نمی‌شود. کوچ فقط معامله‌گران مرتبط با خودش را می‌بیند.')[locale]}</p>
      </section>
      <section className="econ-section" id="apply"><div className="section-top"><div><span className="eyebrow">02 / {t('COACH APPLICATION', 'درخواست کوچ')[locale]}</span><h2>{data?.coach ? t('Your coach dashboard.', 'داشبورد کوچ تو.')[locale] : t('Show your track record.', 'سابقه‌ات را نشان بده.')[locale]}</h2></div></div>
        {me && me.status !== 'ready' && <StateBlock state={me} locale={locale} />}
        {data?.coach ? <CoachDashboard locale={locale} /> : <>
          <ApplicationStatus app={app} locale={locale} />
          {(!me || !app || app.status === 'rejected') && <ApplicationForm role="coach" locale={locale} onDone={reload} collect={f => ({
            contact: f.get('contact') || null, tradingExperience: f.get('tradingExperience'), marketsTraded: f.get('marketsTraded'), trackRecord: f.get('trackRecord'),
            riskManagement: f.get('riskManagement'), mentoringExperience: f.get('mentoringExperience'), motivation: f.get('motivation'),
            profileLinks: String(f.get('profileLinks') || '').split(/\s+/).filter(Boolean), supportingDocuments: String(f.get('supportingDocuments') || '').split(/\s+/).filter(Boolean),
          })}>
            <Field label={t('Other contact (optional)', 'راه ارتباطی دیگر (اختیاری)')[locale]}><input name="contact" maxLength={200} /></Field>
            <Field label={`${t('Markets traded', 'بازارهای معامله‌شده')[locale]} *`}><input name="marketsTraded" required maxLength={300} /></Field>
            <div className="wide"><Field label={`${t('Trading experience', 'تجربهٔ معاملاتی')[locale]} *`}><textarea name="tradingExperience" required maxLength={3000} /></Field></div>
            <div className="wide"><Field label={`${t('Verifiable trading track record', 'سابقهٔ معاملاتی قابل‌تأیید')[locale]} *`} hint={t('Describe statements or records a reviewer can verify.', 'صورت‌حساب یا سوابقی را که بازبین می‌تواند تأیید کند توضیح بده.')[locale]}><textarea name="trackRecord" required maxLength={3000} /></Field></div>
            <div className="wide"><Field label={`${t('Risk management experience', 'تجربهٔ مدیریت ریسک')[locale]} *`}><textarea name="riskManagement" required maxLength={3000} /></Field></div>
            <div className="wide"><Field label={`${t('Previous mentoring experience', 'تجربهٔ قبلی منتورینگ')[locale]} *`}><textarea name="mentoringExperience" required maxLength={3000} /></Field></div>
            <Field label={t('Professional profile links (https, space-separated)', 'لینک پروفایل‌های حرفه‌ای (https، با فاصله)')[locale]}><input name="profileLinks" dir="ltr" /></Field>
            <Field label={t('Supporting documents (https links)', 'مدارک پشتیبان (لینک https)')[locale]}><input name="supportingDocuments" dir="ltr" /></Field>
            <div className="wide"><Field label={`${t('Motivation', 'انگیزه')[locale]} *`}><textarea name="motivation" required maxLength={3000} /></Field></div>
          </ApplicationForm>}
        </>}
      </section>
      <section className="econ-section" id="trader"><div className="section-top"><div><span className="eyebrow">03 / {t('FOR TRADERS', 'برای معامله‌گران')[locale]}</span><h2>{t('Link your coach.', 'به کوچت متصل شو.')[locale]}</h2></div></div>
        <p className="econ-msg">{t('A verified coach relationship is one of the conditions for Live Market Access. Your coach sees your eligibility progress, never your private journal.', 'ارتباط با کوچ تأییدشده یکی از شرایط اتصال به بازار است. کوچ پیشرفت احراز شرایط تو را می‌بیند، نه ژورنال خصوصی‌ات را.')[locale]}</p>
        <TraderLink locale={locale} />
      </section>
      <div className="info-end"><img src={`${import.meta.env.BASE_URL}assets/mark-mint.svg`} width="38" height="42" alt="" /><p>{t('Live capital follows verified skill.', 'سرمایهٔ واقعی به‌دنبال مهارت تأییدشده است.')[locale]}</p><Link className="button" to={`/${locale}/live-market-access`}>{labels['live-market-access'][locale]} <span aria-hidden="true">↗</span></Link></div>
    </div>
  </InformationShell>
}
