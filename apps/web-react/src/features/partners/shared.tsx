import { useState, type FormEvent, type ReactNode } from 'react'
import { text as t, type Locale } from '../information/content'
import { apiFetch, useOpenfundSession } from '../../session/useOpenfundSession'
import { Status, errorCopy, useRemote, when, type Remote } from '../economy/ui'

export interface PartnersMe {
  applications: Record<'ambassador' | 'coach', { id: string; status: string; submittedAt: string; updatedAt: string; decidedAt: string | null; note: string | null } | null>
  ambassador: { code: string; status: string; approvedAt: string } | null
  coach: { code: string; status: string; approvedAt: string } | null
  terms: { ambassador: string; coach: string }
}

export function usePartners(): [Remote<PartnersMe> | null, () => void] {
  const { status } = useOpenfundSession()
  const [state, reload] = useRemote<PartnersMe>(status === 'authenticated' ? '/partners/me' : null, [status])
  return [status === 'authenticated' ? state : null, reload]
}

const STATUS: Record<string, [string, string, 'ok' | 'warn' | 'off' | 'info']> = {
  submitted: ['Submitted', 'ثبت‌شده', 'info'], under_review: ['Under review', 'در حال بررسی', 'warn'], approved: ['Approved', 'تأییدشده', 'ok'],
  rejected: ['Rejected', 'ردشده', 'off'], suspended: ['Suspended', 'تعلیق‌شده', 'warn'],
}
export function ApplicationStatus({ app, locale }: { app: PartnersMe['applications']['ambassador']; locale: Locale }) {
  if (!app) return null
  const s = STATUS[app.status] || [app.status, app.status, 'info']
  return <div className="econ-panel"><div className="section-top"><h3>{t('Application status', 'وضعیت درخواست')[locale]}</h3><Status kind={s[2]}>{s[locale === 'fa' ? 1 : 0]}</Status></div>
    <div className="econ-list"><div><span>{t('Submitted', 'ثبت')[locale]}</span><span>{when(app.submittedAt, locale)}</span></div>{app.decidedAt && <div><span>{t('Decision', 'تصمیم')[locale]}</span><span>{when(app.decidedAt, locale)}</span></div>}</div>
    {app.note && <p className="econ-msg">{app.note}</p>}</div>
}

/** Submits a partner application; the wallet identity is taken from the session server-side. */
export function ApplicationForm({ role, locale, onDone, children, collect }: { role: 'ambassador' | 'coach'; locale: Locale; onDone: () => void; children: ReactNode; collect: (form: FormData) => Record<string, unknown> }) {
  const { status, user } = useOpenfundSession()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setBusy(true); setMsg(null)
    const r = await apiFetch('/partners/applications', { method: 'POST', body: JSON.stringify({ role, contactEmail: form.get('contactEmail'), displayName: form.get('displayName'), acceptTerms: form.get('acceptTerms') === 'on', ...collect(form) }) }).catch(() => ({ ok: false, data: null, status: 0 }))
    setBusy(false)
    if (r.ok) { setMsg({ kind: 'ok', text: t('Application submitted. Openfund reviews every application; submission is not approval.', 'درخواست ثبت شد. اوپن‌فاند همهٔ درخواست‌ها را بررسی می‌کند؛ ثبت درخواست به معنای پذیرش نیست.')[locale] }); onDone() }
    else setMsg({ kind: 'error', text: errorCopy(r.data?.error, locale) })
  }
  if (status !== 'authenticated') return <div className="econ-panel"><p className="econ-msg">{t('Connect and sign in with your wallet to apply. Your connected wallet becomes the payout identity for this role.', 'برای ارسال درخواست، کیف پول را متصل کن و وارد شو. کیف پول متصل، هویت دریافت وجه برای این نقش خواهد بود.')[locale]}</p></div>
  return <form className="econ-panel econ-form" onSubmit={submit} noValidate={false}>
    <label className="econ-field"><span>{t('Display name', 'نام نمایشی')[locale]} *</span><input name="displayName" required maxLength={80} /></label>
    <label className="econ-field"><span>{t('Contact email', 'ایمیل تماس')[locale]} *</span><input name="contactEmail" type="email" required maxLength={200} /></label>
    <label className="econ-field wide"><span>{t('Wallet address (connected account)', 'نشانی کیف پول (حساب متصل)')[locale]}</span><input value={user?.walletAddress || ''} readOnly dir="ltr" /></label>
    {children}
    <label className="econ-check wide"><input type="checkbox" name="acceptTerms" required /> <span>{role === 'ambassador'
      ? t('I accept the Openfund Brand Ambassador terms: approval is discretionary; commission is 10% of the confirmed net amount of each referred customer’s first eligible purchase only; refunds and chargebacks reverse commission; self-referral and artificial traffic void eligibility.', 'شرایط سفیر برند اوپن‌فاند را می‌پذیرم: پذیرش به تشخیص اوپن‌فاند است؛ کمیسیون ۱۰٪ مبلغ خالص تأییدشدهٔ فقط اولین خرید واجد شرایط هر مشتری معرفی‌شده است؛ بازپرداخت و برگشت وجه کمیسیون را برمی‌گرداند؛ معرفی خود و ترافیک ساختگی موجب سلب صلاحیت است.')[locale]
      : t('I accept the Verified Trading Coach terms: approval is discretionary and separate from any other role; the coach share is 10% of distributable realized net profit of eligible live trades only — never simulated accounts or unrealized PnL.', 'شرایط کوچ معاملاتی تأییدشده را می‌پذیرم: پذیرش به تشخیص اوپن‌فاند و مستقل از هر نقش دیگر است؛ سهم کوچ ۱۰٪ سود خالص تحقق‌یافتهٔ قابل‌توزیع فقط از معاملات واقعی واجد شرایط است و هرگز از حساب شبیه‌سازی‌شده یا سود تحقق‌نیافته نیست.')[locale]} *</span></label>
    <div className="econ-actions wide"><button className="button" disabled={busy}>{t('Submit application', 'ارسال درخواست')[locale]}</button>{msg && <span className={`econ-msg ${msg.kind}`} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</span>}</div>
  </form>
}
