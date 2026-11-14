import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../session/useOpenfundSession'
import { dirOf, normalizeLocale, pickRecord } from '../../i18n/locales'
import { certificateCopy as copy, type Certificate } from './content'
import CertificatePreview from './CertificatePreview'
import InformationShell from '../information/InformationShell'
import './certificates.css'
interface Verification { status: 'valid' | 'revoked' | 'not_found'; certificate?: Certificate }
export default function CertificateVerificationPage() {
  const locale = normalizeLocale(useParams().locale, 'fa'), [search, setSearch] = useSearchParams()
  const t = (key: keyof typeof copy) => pickRecord(locale, copy[key])
  const [serial, setSerial] = useState(search.get('serial') || ''), [result, setResult] = useState<Verification | null>(null), [pending, setPending] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    const value = search.get('serial'); setSerial(value || ''); setResult(null); setError('')
    if (!value) { setPending(false); return }
    let active = true; setPending(true)
    void apiFetch('/certificates/verify', { method: 'POST', body: JSON.stringify({ serial: value }) }).then(r => {
      if (!active) return
      if (r.ok || r.status === 404) setResult(r.data)
      else setError(t(r.status === 429 ? 'limited' : 'failed'))
    }).catch(() => { if (active) setError(t('failed')) }).finally(() => { if (active) setPending(false) })
    return () => { active = false }
  }, [search, locale])
  const submit = (e: FormEvent) => { e.preventDefault(); setSearch({ serial: serial.trim().toLowerCase() }) }
  return <InformationShell page="certificate-verification" title={t('verification')} description={t('verificationIntro')}>
    <section id="top" className="of-certificates-page" dir={dirOf(locale)}>
      <h1>{t('verification')}</h1><p>{t('verificationIntro')}</p>
      <form className="of-certificate-lookup" onSubmit={submit}><label htmlFor="certificate-serial">{t('serial')}</label><input id="certificate-serial" dir="ltr" required pattern="[a-fA-F0-9]{32}" maxLength={32} value={serial} onChange={e => setSerial(e.target.value)} autoComplete="off" /><button className="button" disabled={pending}>{t('verify')}</button></form>
      {pending && <p role="status">{t('loading')}</p>}{error && <p role="alert">{error}</p>}
      {result && <div aria-live="polite"><h2>{t(result.status === 'not_found' ? 'notFound' : result.status)}</h2>{result.certificate && <CertificatePreview certificate={result.certificate} locale={locale} />}</div>}
    </section>
  </InformationShell>
}
