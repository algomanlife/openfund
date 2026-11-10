import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import InformationShell, { useInformationLocale, useUiLocale } from '../information/InformationShell'
import { text } from '../information/content'
import { useOpenfundSession } from '../../session/useOpenfundSession'
import { governanceFetch } from './api'
import { CATEGORY_LABEL, DELEGATED_CATEGORIES, RESERVED_CATEGORIES, errorMessage, isReservedCategory } from './governanceModel'
import './governance.css'

export default function NewProposal() {
  const locale = useInformationLocale()
  const ui = useUiLocale()
  const nav = useNavigate()
  const { status } = useOpenfundSession()
  const t = (en: string, fa: string) => text(en, fa)[locale]
  const [f, setF] = useState({ title: '', summary: '', description: '', category: 'product_priority', classification: 'binding', expectedBenefits: '', risks: '', resourceRequirements: '', technicalImplications: '', githubIssue: '' })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const reserved = isReservedCategory(f.category)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(s => ({ ...s, [k]: e.target.value }))

  async function submit() {
    setBusy(true); setErr(null)
    const body: Record<string, string> = { ...f, classification: reserved ? 'advisory' : f.classification }
    for (const k of Object.keys(body)) if (!body[k]) delete body[k]
    const r = await governanceFetch<{ ofpId: string }>('/proposals', { method: 'POST', body: JSON.stringify(body) })
    setBusy(false)
    if (!r.ok) { setErr(r.data?.error ?? 'error'); return }
    nav(`/${ui}/governance/proposals/${r.data.ofpId}`)
  }

  return <InformationShell page="governance" description={t('Submit an Openfund Proposal (OFP).', 'ثبت پیشنهاد اوپن‌فاند (OFP).')}>
    <div className="container gv-page">
      <p><Link className="text-link" to={`/${ui}/governance`}>← {t('Governance', 'حاکمیت')}</Link></p>
      <h1>{t('Submit a proposal', 'ثبت پیشنهاد')}</h1>
      <p className="gv-note">{t('Your proposal starts as a private draft. It becomes public when you move it to discussion.', 'پیشنهاد تو ابتدا پیش‌نویس خصوصی است و با انتقال به مرحلهٔ گفت‌وگو عمومی می‌شود.')}</p>
      {status !== 'authenticated'
        ? <p className="gv-readonly" data-readonly>{t('Sign in with your wallet to submit a proposal.', 'برای ثبت پیشنهاد با کیف پول وارد شو.')}</p>
        : <form className="gv-form" onSubmit={e => { e.preventDefault(); void submit() }}>
            <label>{t('Title', 'عنوان')}<input value={f.title} onChange={set('title')} minLength={5} maxLength={160} required /></label>
            <label>{t('Summary', 'خلاصه')}<textarea value={f.summary} onChange={set('summary')} minLength={10} maxLength={600} rows={3} required /></label>
            <label>{t('Category', 'دسته')}
              <select value={f.category} onChange={set('category')}>
                <optgroup label={t('Delegated to the council', 'تفویض‌شده به شورا')}>{DELEGATED_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c][locale]}</option>)}</optgroup>
                <optgroup label={t('Reserved to management (advisory only)', 'متعلق به مدیریت (فقط مشورتی)')}>{RESERVED_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c][locale]}</option>)}</optgroup>
              </select></label>
            {reserved
              ? <p className="gv-note" role="note" data-forced-advisory>{t('This is a company-management topic. It will be labelled “Advisory — Non-Binding”.', 'این موضوع در اختیار مدیریت شرکت است و با برچسب «مشورتی — غیرالزام‌آور» ثبت می‌شود.')}</p>
              : <label>{t('Authority requested', 'اختیار درخواستی')}<select value={f.classification} onChange={set('classification')}><option value="binding">{t('Binding (if the council approves)', 'الزام‌آور (در صورت تصویب شورا)')}</option><option value="advisory">{t('Advisory — Non-Binding', 'مشورتی — غیرالزام‌آور')}</option></select></label>}
            <label>{t('Description', 'شرح')}<textarea value={f.description} onChange={set('description')} rows={8} maxLength={20000} /></label>
            <label>{t('Expected benefits', 'مزایای مورد انتظار')}<textarea value={f.expectedBenefits} onChange={set('expectedBenefits')} rows={3} /></label>
            <label>{t('Risks', 'ریسک‌ها')}<textarea value={f.risks} onChange={set('risks')} rows={3} /></label>
            <label>{t('Technical implications', 'پیامدهای فنی')}<textarea value={f.technicalImplications} onChange={set('technicalImplications')} rows={3} /></label>
            <label>{t('Resource requirements', 'منابع موردنیاز')}<textarea value={f.resourceRequirements} onChange={set('resourceRequirements')} rows={3} /></label>
            <label>{t('Related GitHub issue (https)', 'ایشوی گیت‌هاب (https)')}<input value={f.githubIssue} onChange={set('githubIssue')} inputMode="url" dir="ltr" /></label>
            {err && <p className="gv-error" role="alert">{errorMessage(err, locale)}</p>}
            <button className="gv-btn" type="submit" disabled={busy}>{t('Create draft', 'ایجاد پیش‌نویس')}</button>
          </form>}
    </div>
  </InformationShell>
}
