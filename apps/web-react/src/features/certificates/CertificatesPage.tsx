import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch, useSession } from '../../session/useOpenfundSession'
import { dirOf, normalizeLocale, pickRecord } from '../../i18n/locales'
import { certificateCopy as copy, type Certificate } from './content'
import CertificatePreview from './CertificatePreview'
import CertificateTemplates from './CertificateTemplates'
import './certificates.css'
interface CertificateResponse { identity: { display_name: string | null } | null; certificates: Certificate[] }
export default function CertificatesPage() {
  const locale = normalizeLocale(useParams().locale, 'fa'), session = useSession()
  const t = (key: keyof typeof copy) => pickRecord(locale, copy[key])
  const [data, setData] = useState<CertificateResponse | null>(null), [name, setName] = useState(''), [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState(''), [pending, setPending] = useState(false)
  useEffect(() => {
    let active = true; setData(null); setError('')
    if (session.status !== 'authenticated') return
    void apiFetch('/certificates').then(r => { if (active) { if (r.ok) setData(r.data); else setError(t('failed')) } }).catch(() => { if (active) setError(t('failed')) })
    return () => { active = false }
  }, [session.status, session.user?.id, locale])
  const setup = async (e: FormEvent) => {
    e.preventDefault(); setPending(true); setError('')
    try {
      const result = await apiFetch('/certificates/identity', { method: 'POST', body: JSON.stringify({ displayName: name.trim() || null, confirmed }) })
      if (!result.ok) throw new Error('failed')
      const next = await apiFetch('/certificates'); if (!next.ok) throw new Error('failed'); setData(next.data)
    } catch { setError(t('failed')) } finally { setPending(false) }
  }
  const signedIn = session.status === 'authenticated'
  return <section className="of-certificates-page" dir={dirOf(locale)}>
    <header className="of-cert-hero">
      <span className="of-cert-eyebrow">{t('title')}</span>
      <h1>{t('heroTitle')}</h1>
      <p>{t('intro')}</p>
    </header>

    {!signedIn ? <div className="of-cert-panel of-cert-signin">
      <p>{t('signIn')}</p>
      <button className="button" onClick={() => (window as Window & { __ofOpenConnect?: () => void }).__ofOpenConnect?.()}>{t('connect')}</button>
    </div> : <>
      {error && <p className="of-cert-notice" role="alert">{error}</p>}
      {!data && !error && <p className="of-cert-notice" role="status">{t('loading')}</p>}
      {data && !data.identity && <form className="of-certificate-setup of-cert-panel" onSubmit={e => void setup(e)}>
        <h2>{t('setupTitle')}</h2>
        <div className="of-cert-field">
          <label htmlFor="certificate-name">{t('name')}</label>
          <input id="certificate-name" value={name} maxLength={80} onChange={e => setName(e.target.value)} autoComplete="name" aria-describedby="certificate-name-warning" />
        </div>
        <p id="certificate-name-warning" className="of-cert-warning">{t('nameWarning')}</p>
        <label className="of-certificate-consent"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} aria-describedby="certificate-name-warning" /><span>{t('confirm')}</span></label>
        <button className="button" disabled={pending || !confirmed}>{t('confirm')}</button>
      </form>}
      {data?.identity && !data.certificates.length && <p className="of-cert-notice">{t('empty')}</p>}
      {!!data?.certificates.length && <section className="of-cert-issued" aria-labelledby="certificate-issued">
        <header className="of-cert-section-head"><h2 id="certificate-issued">{t('yourCertificates')}</h2></header>
        <div className="of-cert-issued-grid">{data.certificates.map(c => <CertificatePreview key={c.serial} certificate={c} locale={locale} />)}</div>
      </section>}
    </>}

    <CertificateTemplates locale={locale} issued={signedIn ? data?.certificates ?? null : null} />
  </section>
}
