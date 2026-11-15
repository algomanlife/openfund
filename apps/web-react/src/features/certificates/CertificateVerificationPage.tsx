import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../session/useOpenfundSession'
import { dirOf, normalizeLocale, pickRecord } from '../../i18n/locales'
import { certificateCopy as copy, type Certificate } from './content'
import CertificatePreview from './CertificatePreview'
import CertificateTemplates from './CertificateTemplates'
import InformationShell from '../information/InformationShell'
import './certificates.css'
interface Verification { status: 'valid' | 'revoked' | 'not_found'; certificate?: Certificate; serial?: string; revokedAt?: string }
/* A transport or rate-limit failure is `unavailable`, never "not found" or "invalid". */
type Outcome = Verification | { status: 'unavailable'; limited: boolean }
export default function CertificateVerificationPage() {
  const locale = normalizeLocale(useParams().locale, 'fa'), [search, setSearch] = useSearchParams()
  const t = (key: keyof typeof copy) => pickRecord(locale, copy[key])
  const [serial, setSerial] = useState(search.get('serial') || ''), [result, setResult] = useState<Outcome | null>(null), [pending, setPending] = useState(false), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const value = search.get('serial'); setSerial(value || ''); setResult(null)
    if (!value) { setPending(false); return }
    let active = true; setPending(true)
    void apiFetch('/certificates/verify', { method: 'POST', body: JSON.stringify({ serial: value }) }).then(r => {
      if (!active) return
      if (r.ok || r.status === 404) setResult(r.data?.status ? r.data : { status: 'unavailable', limited: false })
      else setResult({ status: 'unavailable', limited: r.status === 429 })
    }).catch(() => { if (active) setResult({ status: 'unavailable', limited: false }) }).finally(() => { if (active) setPending(false) })
    return () => { active = false }
  }, [search, locale, attempt])
  const submit = (e: FormEvent) => { e.preventDefault(); setSearch({ serial: serial.trim().toLowerCase() }) }
  const date = (s?: string) => s ? new Date(s).toLocaleDateString(locale === 'fa' ? 'fa-IR' : locale === 'en' ? 'en-GB' : locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '—'
  const heading = result && (result.status === 'not_found' ? t('notFound') : result.status === 'unavailable' ? t('unavailable') : t(result.status))
  const body = result && (result.status === 'valid' ? t('validBody') : result.status === 'revoked' ? t('revokedBody') : result.status === 'not_found' ? t('notFoundBody') : 'limited' in result && result.limited ? t('limited') : t('unavailableBody'))
  return <InformationShell page="certificate-verification" title={t('verification')} description={t('verificationIntro')}>
    <section id="top" className="of-certificates-page of-cert-verify" dir={dirOf(locale)}>
      <header className="of-cert-hero">
        <span className="of-cert-hero-mark" aria-hidden="true" />
        <h1>{t('verification')}</h1>
        <p>{t('verificationIntro')}</p>
      </header>
      <form className="of-certificate-lookup of-cert-panel" onSubmit={submit} role="search">
        <label htmlFor="certificate-serial">{t('serial')}</label>
        <div className="of-cert-lookup-row">
          <input id="certificate-serial" dir="ltr" required pattern="[a-fA-F0-9]{32}" maxLength={32} value={serial} onChange={e => setSerial(e.target.value)} autoComplete="off" spellCheck={false} aria-describedby="certificate-serial-hint" placeholder="0123456789abcdef0123456789abcdef" />
          <button className="button" disabled={pending}>{t('verify')}</button>
        </div>
        <small id="certificate-serial-hint">{t('serialHint')}</small>
      </form>
      <div aria-live="polite" className="of-cert-result-wrap">
        {pending && <p className="of-cert-notice" role="status">{t('loading')}</p>}
        {result && <div className="of-cert-result" data-status={result.status}>
          <span className="of-cert-result-icon" aria-hidden="true" />
          <div>
            <h2>{heading}</h2>
            <p>{body}</p>
            {result.status === 'revoked' && <dl className="of-certificate-details"><div><dt>{t('serial')}</dt><dd><bdi dir="ltr">{result.serial}</bdi></dd></div><div><dt>{t('revokedOn')}</dt><dd>{date(result.revokedAt)}</dd></div></dl>}
            {result.status === 'unavailable' && <button type="button" className="button of-cert-retry" onClick={() => setAttempt(n => n + 1)}>{t('retry')}</button>}
          </div>
        </div>}
        {result?.status === 'valid' && result.certificate && <CertificatePreview certificate={result.certificate} locale={locale} />}
      </div>
      <section className="of-cert-steps" aria-labelledby="certificate-steps">
        <h2 id="certificate-steps">{t('stepsTitle')}</h2>
        <ol>{(['step1', 'step2', 'step3'] as const).map((step, i) => <li key={step}><span className="of-cert-step-index" aria-hidden="true">{i + 1}</span><h3>{t(step)}</h3><p>{t(`${step}Body`)}</p></li>)}</ol>
      </section>
      {!result || result.status === 'valid' ? <CertificateTemplates locale={locale} /> : null}
    </section>
  </InformationShell>
}
