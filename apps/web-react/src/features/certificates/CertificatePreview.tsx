import { useEffect, useRef, useState } from 'react'
import { pickRecord, type AppLocale } from '../../i18n/locales'
import { certificateCopy as copy, type Certificate } from './content'
import { paintCertificate, downloadPng, downloadPdf, verificationUrl } from './export'
import './certificates.css'
export default function CertificatePreview({ certificate, locale }: { certificate: Certificate; locale: AppLocale }) {
  const canvas = useRef<HTMLCanvasElement>(null), [ready, setReady] = useState(false), [message, setMessage] = useState('')
  const t = (key: keyof typeof copy) => pickRecord(locale, copy[key])
  useEffect(() => {
    let active = true; setReady(false); setMessage('')
    const render = document.createElement('canvas')
    void paintCertificate(render, certificate, locale).then(() => {
      if (!active || !canvas.current) return
      canvas.current.width = render.width; canvas.current.height = render.height
      canvas.current.getContext('2d')!.drawImage(render, 0, 0); setReady(true)
    }).catch(() => { if (active) setMessage(t('failed')) })
    return () => { active = false }
  }, [certificate, locale])
  const action = async (fn: () => void | Promise<void>) => { try { await fn() } catch { setMessage(t('failed')) } }
  const url = verificationUrl(certificate.serial, locale)
  return <article className={`of-certificate-preview of-certificate-${certificate.kind}`}>
    <header><h3>{t(certificate.kind)}</h3><span className="of-certificate-status">{t(certificate.status)}</span></header>
    <canvas ref={canvas} role="img" aria-label={`${t(certificate.kind)} — ${certificate.holder} — ${certificate.amount} ${certificate.currency}`} />
    <dl className="of-certificate-details"><div><dt>{t('holder')}</dt><dd><bdi>{certificate.holder}</bdi></dd></div><div><dt>{t('serial')}</dt><dd><bdi>{certificate.serial}</bdi></dd></div></dl>
    <p>{t('evidence')}</p>
    <div className="of-certificate-actions">
      <button className="button" disabled={!ready} onClick={() => void action(() => downloadPng(canvas.current!, certificate.serial))}>{t('png')}</button>
      <button className="button" disabled={!ready} onClick={() => void action(() => downloadPdf(canvas.current!, certificate.serial))}>{t('pdf')}</button>
      <button className="button" onClick={() => void action(async () => { await navigator.clipboard.writeText(url); setMessage(t('copied')) })}>{t('share')}</button>
      <a href={url}>{t('open')}</a>
    </div>
    <p role="status">{message || (!ready ? t('loading') : '')}</p>
  </article>
}
