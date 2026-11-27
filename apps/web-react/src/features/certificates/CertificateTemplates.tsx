import { useEffect, useState } from 'react'
import { pickRecord, type AppLocale } from '../../i18n/locales'
import { certificateCopy as copy, type Certificate, type CertificateKind } from './content'
import { certificateTemplate } from './export'

const KINDS: CertificateKind[] = ['purchase', 'trial', 'stage_pass', 'trial_pass', 'completion', 'payout']

/** Anonymous template image: painted once per kind and locale, never carries data. */
function TemplateImage({ kind, locale }: { kind: CertificateKind; locale: AppLocale }) {
  const [src, setSrc] = useState('')
  const t = (key: keyof typeof copy) => pickRecord(locale, copy[key])
  useEffect(() => {
    let active = true; setSrc('')
    void certificateTemplate(kind, locale).then(url => { if (active) setSrc(url) }).catch(() => {})
    return () => { active = false }
  }, [kind, locale])
  return <div className="of-cert-template-art">
    {src ? <img src={src} alt={`${t(`${kind}Title`)} — ${t('previewAlt')}`} width={2000} height={2000} decoding="async" /> : <span className="of-cert-template-skeleton" aria-hidden="true" />}
  </div>
}

/**
 * Every certificate design, visible to everyone. `issued` is the
 * signed-in user's own server-issued list (or null when signed out); it only
 * drives the status chip — the artwork is always the anonymous template.
 */
export default function CertificateTemplates({ locale, issued, heading = true }: { locale: AppLocale; issued?: Certificate[] | null; heading?: boolean }) {
  const t = (key: keyof typeof copy) => pickRecord(locale, copy[key])
  return <section className="of-cert-templates" aria-labelledby={heading ? 'certificate-templates' : undefined}>
    {heading && <header className="of-cert-section-head"><h2 id="certificate-templates">{t('templates')}</h2><p>{t('templatesIntro')}</p></header>}
    <ul>
      {KINDS.map(kind => {
        const count = issued?.filter(c => c.kind === kind && c.status === 'valid').length ?? 0
        const state = issued == null ? 'signed-out' : count ? 'issued' : 'pending'
        return <li key={kind} className={`of-cert-template of-cert-template--${kind}`} data-state={state}>
          <TemplateImage kind={kind} locale={locale} />
          <div className="of-cert-template-meta">
            <h3>{t(kind)}</h3>
            <span className="of-cert-chip" data-state={state}>
              {state === 'signed-out' ? t('statusSignedOut') : state === 'issued' ? <>{t('issuedCount')} · <bdi>{count}</bdi></> : t('notIssued')}
            </span>
            <p>{t(`${kind}Eligibility`)}</p>
          </div>
        </li>
      })}
    </ul>
  </section>
}
