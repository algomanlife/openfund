import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch, useSession } from '../../session/useOpenfundSession'
import { dirOf, normalizeLocale, pickRecord } from '../../i18n/locales'
import { certificateCopy as copy, type Certificate, type CertificateKind } from './content'
import CertificatePreview from './CertificatePreview'
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
  return <section className="of-certificates-page" dir={dirOf(locale)}>
    <p>{t('intro')}</p>
    {session.status !== 'authenticated' ? <><p>{t('signIn')}</p><button className="button" onClick={() => (window as Window & { __ofOpenConnect?: () => void }).__ofOpenConnect?.()}>{t('connect')}</button></> : <>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">{t('loading')}</p>}
      {data && !data.identity && <form className="of-certificate-setup" onSubmit={e => void setup(e)}>
        <label htmlFor="certificate-name">{t('name')}</label><input id="certificate-name" value={name} maxLength={80} onChange={e => setName(e.target.value)} autoComplete="name" />
        <p id="certificate-name-warning">{t('nameWarning')}</p><label className="of-certificate-consent"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} aria-describedby="certificate-name-warning" />{t('confirm')}</label>
        <button className="button" disabled={pending || !confirmed}>{t('confirm')}</button>
      </form>}
      {data?.identity && !data.certificates.length && <p>{t('empty')}</p>}
      {data?.certificates.map(c => <CertificatePreview key={c.serial} certificate={c} locale={locale} />)}
    </>}
    <div className="of-certificate-eligibility">{(['purchase', 'completion', 'payout'] as CertificateKind[]).map(kind => <article key={kind}><h2>{t(kind)}</h2><p>{t(`${kind}Eligibility`)}</p></article>)}</div>
  </section>
}
