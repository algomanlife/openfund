import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import InformationShell, { useInformationLocale } from '../information/InformationShell'
import { tx, type Locale } from '../information/content'
import { apiFetch } from '../../session/useOpenfundSession'
import { fetchCmsContactEmails, type CmsContactEmails, type ContactDepartment } from '../../cms/client'
import { OFFICIAL_TELEGRAM_URL } from '../community/TelegramCommunity'
import { contactHero, contactMeta, contactUi, departments, formCopy as F, formErrors as E, helpCopy, locationCopy } from './contactContent'
import ShirazMap from './ShirazMap'
import './company.css'

/* limits mirror apps/backend/support.js (the server re-validates everything) */
export const FORM_LIMITS = { name: [2, 120], subject: [3, 160], message: [20, 5000], email: 254, ref: 64 } as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REF_RE = /^[A-Za-z0-9_-]{1,64}$/
type Field = 'fullName' | 'email' | 'department' | 'subject' | 'message' | 'orderId' | 'challengeId' | 'privacyConsent'
type Errors = Partial<Record<Field, keyof typeof E>>

/** Client-side validation (same rules as the server; the server is authoritative). */
export function validateContact(v: Record<Field, string | boolean>): Errors {
  const e: Errors = {}
  const len = (s: string) => [...s.trim()].length
  const name = String(v.fullName), subject = String(v.subject), message = String(v.message), email = String(v.email).trim()
  if (!len(name)) e.fullName = 'required'; else if (len(name) < FORM_LIMITS.name[0]) e.fullName = 'too_short'; else if (len(name) > FORM_LIMITS.name[1]) e.fullName = 'too_long'
  if (!email) e.email = 'required'; else if (email.length > FORM_LIMITS.email || !EMAIL_RE.test(email)) e.email = 'invalid_email'
  if (!['support', 'legal', 'technical', 'community'].includes(String(v.department))) e.department = 'invalid_department'
  if (!len(subject)) e.subject = 'required'; else if (len(subject) < FORM_LIMITS.subject[0]) e.subject = 'too_short'; else if (len(subject) > FORM_LIMITS.subject[1]) e.subject = 'too_long'
  if (!len(message)) e.message = 'required'; else if (len(message) < FORM_LIMITS.message[0]) e.message = 'too_short'; else if (len(message) > FORM_LIMITS.message[1]) e.message = 'too_long'
  for (const k of ['orderId', 'challengeId'] as const) { const s = String(v[k]).trim(); if (s && !REF_RE.test(s)) e[k] = 'invalid_reference' }
  if (v.privacyConsent !== true) e.privacyConsent = 'consent_required'
  return e
}

function DepartmentIcon({ name }: { name: string }) {
  const d: Record<string, string> = {
    support: 'M4 13a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-2v-6h4M4 13v4a2 2 0 0 0 2 2h2v-6H4',
    legal: 'M12 3v18M5 7h14M7 7l-3 7h6zM17 7l-3 7h6zM8 21h8',
    technical: 'M8 9l-4 3 4 3m8-6 4 3-4 3M14 5l-4 14',
    community: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20a6 6 0 0 1 12 0m-2 0a6 6 0 0 1 10 0',
  }
  return <svg className="co-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={d[name]} /></svg>
}

function CopyButton({ value, locale }: { value: string; locale: Locale }) {
  const [done, setDone] = useState(false)
  return <button type="button" className="co-copy" aria-label={`${tx(locale, contactUi.copyLabel)}: ${value}`} onClick={async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1800) } catch { /* clipboard unavailable: the address stays selectable */ }
  }}>{done ? tx(locale, contactUi.copied) : tx(locale, contactUi.copy)}<span className="sr-only" aria-live="polite">{done ? tx(locale, contactUi.copied) : ''}</span></button>
}

function ContactForm({ locale, initialDepartment, onDepartment }: { locale: Locale; initialDepartment: ContactDepartment; onDepartment?: (d: ContactDepartment) => void }) {
  const blank = { fullName: '', email: '', department: initialDepartment as string, subject: '', message: '', orderId: '', challengeId: '', privacyConsent: false as boolean }
  const [v, setV] = useState(blank)
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ reference: string } | null>(null)
  const started = useRef(Date.now())
  const honeypot = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  useEffect(() => { setV(cur => ({ ...cur, department: initialDepartment })) }, [initialDepartment])
  useEffect(() => { if (done) resultRef.current?.focus() }, [done])

  const set = (k: Field, value: string | boolean) => {
    setV(cur => ({ ...cur, [k]: value }))
    if (errors[k]) setErrors(cur => { const n = { ...cur }; delete n[k]; return n })
    if (k === 'department') onDepartment?.(value as ContactDepartment)
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)
    const found = validateContact(v)
    setErrors(found)
    if (Object.keys(found).length) {
      const first = Object.keys(found)[0]
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }
    setBusy(true)
    try {
      const r = await apiFetch('/support/messages', { method: 'POST', body: JSON.stringify({
        fullName: v.fullName, email: v.email, department: v.department, subject: v.subject, message: v.message,
        orderId: v.orderId || null, challengeId: v.challengeId || null, privacyConsent: v.privacyConsent === true,
        locale, website: honeypot.current?.value || '', startedAt: started.current,
      }) })
      if (r.ok && r.data?.reference) { setDone({ reference: r.data.reference }); return }
      const code = r.data?.error as keyof typeof E | undefined
      const field = r.data?.field as string | undefined
      const formFields: readonly string[] = ['fullName', 'email', 'department', 'subject', 'message', 'orderId', 'challengeId', 'privacyConsent']
      if (field && code && E[code] && formFields.includes(field)) { setErrors({ [field as Field]: code }); return }
      setServerError(tx(locale, (code && E[code]) || E.generic))
    } catch {
      setServerError(tx(locale, E.network))
    } finally { setBusy(false) }
  }

  if (done) return <div className="co-form-done" ref={resultRef} tabIndex={-1} role="status">
    <h3>{tx(locale, F.successTitle)}</h3>
    <p>{tx(locale, F.successBody)}</p>
    <p className="co-ref"><span>{tx(locale, F.reference)}</span><strong dir="ltr">{done.reference}</strong><CopyButton value={done.reference} locale={locale} /></p>
    <button type="button" className="text-link" onClick={() => { setDone(null); setV(blank); started.current = Date.now() }}>{tx(locale, F.another)}</button>
  </div>

  const err = (k: Field) => errors[k] ? <span className="co-error" id={`cf-${k}-err`} role="alert">{tx(locale, E[errors[k]!])}</span> : null
  const a11y = (k: Field) => ({ 'aria-invalid': errors[k] ? true : undefined, 'aria-describedby': errors[k] ? `cf-${k}-err` : undefined })
  return <form ref={formRef} className="co-form" onSubmit={submit} noValidate aria-describedby="cf-intro">
    <p id="cf-intro" className="co-muted">{tx(locale, F.intro)}</p>
    {/* honeypot: hidden from people and assistive technology */}
    <div className="co-hp" aria-hidden="true"><label>Website<input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <div className="co-grid">
      <label className="co-field"><span>{tx(locale, F.name)} *</span><input name="fullName" value={v.fullName} onChange={e => set('fullName', e.target.value)} autoComplete="name" maxLength={FORM_LIMITS.name[1]} required {...a11y('fullName')} />{err('fullName')}</label>
      <label className="co-field"><span>{tx(locale, F.email)} *</span><input name="email" type="email" dir="ltr" value={v.email} onChange={e => set('email', e.target.value)} autoComplete="email" maxLength={FORM_LIMITS.email} required {...a11y('email')} />{err('email')}</label>
      <label className="co-field"><span>{tx(locale, F.department)} *</span>
        <select name="department" value={v.department} onChange={e => set('department', e.target.value)} required {...a11y('department')}>
          {departments.map(d => <option key={d.key} value={d.key}>{tx(locale, d.title)}</option>)}
        </select>{err('department')}</label>
      <label className="co-field"><span>{tx(locale, F.subject)} *</span><input name="subject" value={v.subject} onChange={e => set('subject', e.target.value)} maxLength={FORM_LIMITS.subject[1]} required {...a11y('subject')} />{err('subject')}</label>
      <label className="co-field wide"><span>{tx(locale, F.message)} *</span><textarea name="message" rows={7} value={v.message} onChange={e => set('message', e.target.value)} maxLength={FORM_LIMITS.message[1]} required {...a11y('message')} />
        <small className="co-count" aria-live="off">{[...v.message].length} / {FORM_LIMITS.message[1]} {tx(locale, F.charCount)}</small>{err('message')}</label>
      <label className="co-field"><span>{tx(locale, F.orderId)}</span><input name="orderId" dir="ltr" value={v.orderId} onChange={e => set('orderId', e.target.value)} maxLength={FORM_LIMITS.ref} {...a11y('orderId')} />{err('orderId')}</label>
      <label className="co-field"><span>{tx(locale, F.challengeId)}</span><input name="challengeId" dir="ltr" value={v.challengeId} onChange={e => set('challengeId', e.target.value)} maxLength={FORM_LIMITS.ref} {...a11y('challengeId')} />{err('challengeId')}</label>
      <p className="co-muted wide">{tx(locale, F.idHint)}</p>
      <label className="co-check wide"><input type="checkbox" name="privacyConsent" checked={v.privacyConsent} onChange={e => set('privacyConsent', e.target.checked)} {...a11y('privacyConsent')} />
        <span>{tx(locale, F.consentBefore)} <Link to={`/${locale}/challenges?section=legal`}>{tx(locale, F.consentLink)}</Link>{tx(locale, F.consentAfter)}</span></label>
      {err('privacyConsent')}
    </div>
    {serverError && <p className="co-error" role="alert">{serverError}</p>}
    <div className="co-actions start"><button className="button" disabled={busy} aria-busy={busy}>{busy ? tx(locale, F.sending) : tx(locale, F.submit)}</button></div>
  </form>
}

export default function Contact() {
  const locale = useInformationLocale()
  const [params] = useSearchParams()
  const fromQuery = params.get('department') as ContactDepartment | null
  const [department, setDepartment] = useState<ContactDepartment>(fromQuery && ['support', 'legal', 'technical', 'community'].includes(fromQuery) ? fromQuery : 'support')
  const [emails, setEmails] = useState<CmsContactEmails | null>(null)
  useEffect(() => { let on = true; void fetchCmsContactEmails().then(e => { if (on) setEmails(e) }); return () => { on = false } }, [])
  const L = (path: string) => `/${locale}/${path}`
  const choose = (d: ContactDepartment) => {
    setDepartment(d)
    const form = document.getElementById('contact-form')
    form?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
    setTimeout(() => form?.querySelector<HTMLElement>('[name="fullName"]')?.focus({ preventScroll: true }), 350)
  }
  const h = helpCopy.links
  const help: Array<{ label: string; to?: string; external?: boolean }> = [
    { label: tx(locale, h.rulebook), to: L('rulebook') },
    { label: tx(locale, h.faq), to: L('faq') },
    { label: tx(locale, h.plans), to: L('challenges') },
    { label: tx(locale, h.purchase), to: L('checkout') },
    { label: tx(locale, h.payment), to: L('faq/q/how-to-pay-for-challenge') },
    { label: tx(locale, h.withdrawal), to: L('faq/q/when-payout-request') },
    { label: tx(locale, h.legal), to: L('challenges?section=legal') },
    { label: tx(locale, h.terms) }, { label: tx(locale, h.privacy) }, { label: tx(locale, h.refund) },
    { label: tx(locale, h.about), to: L('about') },
  ]

  return <InformationShell page="contact" description={tx(locale, contactMeta.description)} title={`${tx(locale, contactMeta.title)} | Openfund`}>
    <section className="container co-hero" id="top">
      <div className="co-hero-art" aria-hidden="true"><i /><i /><i /></div>
      <div className="eyebrow"><span className="tiny-mark" aria-hidden="true">✳</span> OPENFUND / {tx(locale, contactHero.eyebrow)}</div>
      <h1>{tx(locale, contactHero.title)}<br /><em>{tx(locale, contactHero.accent)}</em></h1>
      <p className="hero-intro">{tx(locale, contactHero.intro)}</p>
    </section>
    <div className="container co-body">
      <aside className="info-notice co-safety" role="note"><span className="tiny-mark" aria-hidden="true">⚠</span><p>{tx(locale, contactHero.safety)}</p></aside>

      <section className="co-section" aria-labelledby="departments-title">
        <h2 id="departments-title">{tx(locale, contactUi.departmentsTitle)}</h2>
        <div className="co-cards four">
          {departments.map(d => {
            const mail = emails?.[d.key]
            return <article className={`co-card co-dept${department === d.key ? ' active' : ''}`} key={d.key}>
              <div className="co-tech-top"><DepartmentIcon name={d.icon} /></div>
              <h3>{tx(locale, d.title)}</h3>
              <p>{tx(locale, d.body)}</p>
              {mail
                ? <p className="co-mail"><a href={`mailto:${mail}`} dir="ltr">{mail}</a><CopyButton value={mail} locale={locale} /></p>
                : emails && <p className="co-muted small">{tx(locale, contactUi.emailPending)}</p>}
              <button type="button" className="text-link" onClick={() => choose(d.key)}>{tx(locale, contactUi.writeTo)} <span aria-hidden="true">↓</span></button>
            </article>
          })}
          <article className="co-card co-dept telegram">
            <div className="co-tech-top"><img src={`${import.meta.env.BASE_URL}assets/telegram-logo.svg`} width="24" height="24" alt="" /></div>
            <h3>{tx(locale, contactUi.telegramTitle)}</h3>
            <p>{tx(locale, contactUi.telegramBody)}</p>
            <a className="text-link" href={OFFICIAL_TELEGRAM_URL} target="_blank" rel="noopener noreferrer">{tx(locale, contactUi.telegramCta)} <span dir="ltr">@communitybuopenfund</span> <span aria-hidden="true">↗</span></a>
          </article>
        </div>
      </section>

      <section className="co-section" id="contact-form" aria-labelledby="form-title">
        <h2 id="form-title">{tx(locale, F.title)}</h2>
        <ContactForm locale={locale} initialDepartment={department} onDepartment={setDepartment} />
      </section>

      <section className="co-section co-location" aria-labelledby="location-title">
        <h2 id="location-title">{tx(locale, locationCopy.title)}</h2>
        <div className="co-location-grid">
          <ShirazMap locale={locale} />
          <div className="co-address">
            <h3>{tx(locale, locationCopy.addressLabel)}</h3>
            <address>{tx(locale, locationCopy.address)}</address>
            <p className="co-muted">{tx(locale, locationCopy.approx)}</p>
            <p className="co-muted">{tx(locale, locationCopy.visits)}</p>
          </div>
        </div>
      </section>

      <section className="co-section" aria-labelledby="help-title">
        <h2 id="help-title">{tx(locale, helpCopy.title)}</h2>
        <p>{tx(locale, helpCopy.intro)}</p>
        <ul className="co-help">
          {help.map(item => <li key={item.label}>{item.to
            ? <Link to={item.to}>{item.label}<span aria-hidden="true">→</span></Link>
            : <span className="co-help-pending" aria-disabled="true">{item.label}<small>{tx(locale, helpCopy.pending)}</small></span>}</li>)}
        </ul>
      </section>
    </div>
  </InformationShell>
}
