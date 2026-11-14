import QRCode from 'qrcode'
import { pickRecord, type AppLocale } from '../../i18n/locales'
import { certificateCopy as copy, type Certificate } from './content'
export const verificationUrl = (serial: string, locale: AppLocale) => new URL(`/${locale}/certificate-verification?serial=${encodeURIComponent(serial)}`, window.location.origin).href
let certificateFont: Promise<void> | undefined
const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src })
/** A high-resolution canvas uses the browser's shaping engine for Persian text. */
export async function paintCertificate(canvas: HTMLCanvasElement, certificate: Certificate, locale: AppLocale) {
  certificateFont ??= new FontFace('OpenfundCertificate', `url(${import.meta.env.BASE_URL}assets/openfund-persian-500-v4.woff2)`).load().then(font => { document.fonts.add(font) }).catch(error => { certificateFont = undefined; throw error })
  await certificateFont
  const logo = await loadImage(`${import.meta.env.BASE_URL}assets/mark-mint.svg`)
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, verificationUrl(certificate.serial, locale), { width: 240, margin: 3, errorCorrectionLevel: 'M' })
  canvas.width = 2400; canvas.height = 1600
  const ctx = canvas.getContext('2d')!
  const rtl = locale === 'fa' || locale === 'ar'
  const t = (key: keyof typeof copy) => pickRecord(locale, copy[key])
  ctx.fillStyle = '#072b28'; ctx.fillRect(0, 0, 2400, 1600)
  ctx.strokeStyle = '#89c9ac'; ctx.lineWidth = 2; ctx.strokeRect(58, 58, 2284, 1484)
  ctx.strokeStyle = '#315e50'; ctx.strokeRect(78, 78, 2244, 1444)
  // Each event has a distinct geometry while preserving the approved emblem.
  ctx.save(); ctx.globalAlpha = 0.14; ctx.strokeStyle = '#befb75'; ctx.lineWidth = 3
  if (certificate.kind === 'purchase') {
    for (let i = 0; i < 5; i++) ctx.strokeRect(1640 + i * 55, 100 + i * 55, 470, 470)
  } else if (certificate.kind === 'completion') {
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(1200, 720, 500 + i * 65, 0, Math.PI * 2); ctx.stroke() }
  } else {
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(100, 230 + i * 85); ctx.lineTo(650 + i * 100, 100); ctx.stroke() }
  }
  ctx.restore()
  const payout = certificate.kind === 'payout'
  if (payout) { ctx.fillStyle = '#123c34'; ctx.fillRect(1790, 100, 510, 1400) }
  ctx.drawImage(logo, payout ? 1935 : 1090, payout ? 200 : 115, 220, 220)
  ctx.textAlign = 'center'; ctx.direction = rtl ? 'rtl' : 'ltr'
  const line = (value: string, y: number, size: number, color = '#f7faf1', max = payout ? 1580 : 2020, center = payout ? 940 : 1200) => {
    ctx.fillStyle = color; ctx.font = `${size}px OpenfundCertificate, sans-serif`
    let actual = size
    while (ctx.measureText(value).width > max && actual > 20) ctx.font = `${--actual}px OpenfundCertificate, sans-serif`
    ctx.fillText(value, center, y)
  }
  line('OPENFUND', payout ? 485 : 390, 38, '#befb75', 500, payout ? 2045 : 1200)
  line(t(certificate.kind), payout ? 440 : 515, 74)
  line(t('holder'), 625, 28, '#a8c6b8')
  line(certificate.holder, 715, 58)
  line(certificate.plan, 805, 38, '#befb75')
  line(t(certificate.kind === 'payout' ? 'amount' : 'account'), 900, 28, '#a8c6b8')
  line(`${Number(certificate.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${certificate.currency}`, 980, 64)
  const date = (s: string) => new Date(s).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  line(`${t('eventDate')}: ${date(certificate.eventAt)} · ${t('issueDate')}: ${date(certificate.issuedAt)}`, 1100, 28)
  ctx.drawImage(qr, payout ? 1925 : 1080, 1145, 240, 240)
  line(certificate.serial, 1440, 24, '#c5d7ce', payout ? 455 : 2020, payout ? 2045 : 1200)
  if (certificate.status === 'revoked') { ctx.save(); ctx.translate(1200, 780); ctx.rotate(-0.18); ctx.fillStyle = '#eeb2a4'; ctx.font = '110px OpenfundCertificate'; ctx.fillText(t('revoked'), 0, 0); ctx.restore() }
}
const download = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000) }
export async function downloadPng(canvas: HTMLCanvasElement, serial: string) {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('image_export_failed')), 'image/png'))
  download(blob, `openfund-${serial}.png`)
}
/** Embed the same rendered image in a landscape PDF; preserves RTL shaping. */
export function downloadPdf(canvas: HTMLCanvasElement, serial: string) {
  const raw = atob(canvas.toDataURL('image/jpeg', 0.98).split(',')[1])
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0)), encoder = new TextEncoder()
  const parts: Uint8Array[] = [], offsets = [0]; let length = 0
  const add = (v: string | Uint8Array) => { const b = typeof v === 'string' ? encoder.encode(v) : v; parts.push(b); length += b.length }
  const object = (id: number, body: string) => { offsets[id] = length; add(`${id} 0 obj\n${body}\nendobj\n`) }
  add('%PDF-1.4\n')
  object(1, '<< /Type /Catalog /Pages 2 0 R >>')
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  object(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 900 600] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>')
  offsets[4] = length
  add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`)
  add(bytes); add('\nendstream\nendobj\n')
  const stream = 'q 900 0 0 600 0 0 cm /Im0 Do Q\n'
  object(5, `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`)
  const xref = length
  add('xref\n0 6\n0000000000 65535 f \n')
  offsets.slice(1).forEach(offset => add(`${String(offset).padStart(10, '0')} 00000 n \n`))
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  download(new Blob(parts as BlobPart[], { type: 'application/pdf' }), `openfund-${serial}.pdf`)
}
