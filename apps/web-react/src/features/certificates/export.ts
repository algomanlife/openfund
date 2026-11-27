import QRCode from 'qrcode'
import { pickRecord, type AppLocale } from '../../i18n/locales'
import { certificateCopy as copy, type Certificate, type CertificateKind } from './content'
export const verificationUrl = (serial: string, locale: AppLocale) => new URL(`/${locale}/certificate-verification?serial=${encodeURIComponent(serial)}`, window.location.origin).href
let certificateFont: Promise<void> | undefined
const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src })
let markImage: Promise<HTMLImageElement> | undefined
/* The Persian face (Dastkhat, variable) is limited to the Arabic script; Latin text and every digit
   in an LTR string (amounts, serials, dates) fall through to Ubuntu, as on the site. */
const ARABIC_RANGE = 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F, U+066B-066C'
const loadFont = () => certificateFont ??= Promise.all([
  new FontFace('Dastkhat Certificate', `url(${import.meta.env.BASE_URL}assets/fonts/dastkhat/Dastkhat-Variable.woff2)`, { weight: '100 900', unicodeRange: ARABIC_RANGE }).load(),
  ...[400, 700].map(weight => new FontFace('Ubuntu Certificate', `url(${import.meta.env.BASE_URL}assets/ubuntu-${weight}.ttf)`, { weight: String(weight) }).load()),
]).then(fonts => { fonts.forEach(font => document.fonts.add(font)) }).catch(error => { certificateFont = undefined; throw error })

export const CERTIFICATE_SIZE = 2000
type Palette = { top: string; mid: string; glow: string; accent: string; soft: string; metal: string[] }
/* One square composition, one finish per kind: silver (purchase), mint (completion), lime (payout), and the ADR 0062 kinds below. */
const PALETTES: Record<CertificateKind, Palette> = {
  purchase: { top: '#4a4f4c', mid: '#0b1a16', glow: '#9fd9c0', accent: '#82e7bd', soft: '#b9cbc2', metal: ['#f8fffb', '#a9b8b1', '#ffffff', '#6f8a7f', '#e9fff5', '#b4c9c0', '#f3fff9'] },
  completion: { top: '#24463a', mid: '#061511', glow: '#82e7bd', accent: '#82e7bd', soft: '#b9cbc2', metal: ['#effff7', '#82e7bd', '#ffffff', '#3c8f6c', '#d9fff0', '#82e7bd', '#f4fffa'] },
  payout: { top: '#3f4a17', mid: '#0c1206', glow: '#c6ff52', accent: '#c6ff52', soft: '#cfd9b8', metal: ['#fbffef', '#c6ff52', '#ffffff', '#6d8a2a', '#f4ffd6', '#b9f04a', '#fdfff4'] },
  /* ADR 0062: Free Trial start (sky), phase pass (teal), Free Trial pass (violet) */
  trial: { top: '#1f3a4a', mid: '#061019', glow: '#8fd3ff', accent: '#8fd3ff', soft: '#b8cad6', metal: ['#f2fbff', '#8fd3ff', '#ffffff', '#3f7a9c', '#dff4ff', '#9bd8ff', '#f6fcff'] },
  stage_pass: { top: '#1d4446', mid: '#051314', glow: '#6fe3d6', accent: '#6fe3d6', soft: '#b5d0cd', metal: ['#effffd', '#6fe3d6', '#ffffff', '#2f8a80', '#d6fffa', '#7be9dd', '#f4fffe'] },
  trial_pass: { top: '#352a4d', mid: '#0d0918', glow: '#c3a6ff', accent: '#c3a6ff', soft: '#cbc2db', metal: ['#f8f3ff', '#c3a6ff', '#ffffff', '#6d55a3', '#ece2ff', '#c9b0ff', '#fbf8ff'] },
}

/** Draw the Openfund mark with a brushed-metal gradient and a soft glow. */
function metalMark(ctx: CanvasRenderingContext2D, mark: HTMLImageElement, x: number, y: number, w: number, h: number, palette: Palette, glow: boolean) {
  const layer = document.createElement('canvas'); layer.width = Math.ceil(w); layer.height = Math.ceil(h)
  const l = layer.getContext('2d')!
  const g = l.createLinearGradient(0, 0, w, h * 0.55)
  palette.metal.forEach((color, i) => g.addColorStop(i / (palette.metal.length - 1), color))
  l.fillStyle = g; l.fillRect(0, 0, w, h)
  l.globalCompositeOperation = 'destination-in'; l.drawImage(mark, 0, 0, w, h)
  ctx.save()
  if (glow) { ctx.shadowColor = palette.glow + '88'; ctx.shadowBlur = w * 0.12 }
  ctx.drawImage(layer, x, y)
  ctx.restore()
}
/** Split text into lines no wider than `max` using the browser's shaping engine. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(/\s+/), lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width > max && current) { lines.push(current); current = word } else current = next
  }
  if (current) lines.push(current)
  return lines
}
const money = (amount: string, currency: string) => {
  const value = Number(amount).toLocaleString('en-US', { minimumFractionDigits: Number(amount) % 1 ? 2 : 0, maximumFractionDigits: 2 })
  /* LRI…PDI keeps the currency sign on the correct side inside RTL lines */
  return '⁦' + (currency === 'USD' ? `$${value}` : `${value} ${currency}`) + '⁩'
}

/**
 * Paint a certificate. With `certificate` it is the issued record (holder,
 * amount, dates, serial and a QR that resolves to its verification page).
 * Without it the canvas is an anonymous template preview: placeholder bars,
 * no identity, no amount, no serial and no QR code.
 */
export async function paintCertificate(canvas: HTMLCanvasElement, certificate: Certificate | null, locale: AppLocale, previewKind?: CertificateKind) {
  const kind = certificate?.kind ?? previewKind ?? 'purchase'
  await loadFont()
  const mark = await (markImage ??= loadImage(`${import.meta.env.BASE_URL}assets/mark.svg`).catch(error => { markImage = undefined; throw error }))
  let qr: HTMLCanvasElement | null = null
  if (certificate) {
    qr = document.createElement('canvas')
    await QRCode.toCanvas(qr, verificationUrl(certificate.serial, locale), { width: 300, margin: 2, errorCorrectionLevel: 'M' })
  }
  const S = CERTIFICATE_SIZE, u = S / 100, p = PALETTES[kind]
  canvas.width = S; canvas.height = S
  const ctx = canvas.getContext('2d')!
  const rtl = locale === 'fa' || locale === 'ar'
  const t = (key: keyof typeof copy) => pickRecord(locale, copy[key])
  const font = (size: number, weight = 500) => `${weight} ${size}px 'Dastkhat Certificate', 'Ubuntu Certificate', system-ui, sans-serif`
  ctx.direction = rtl ? 'rtl' : 'ltr'

  // background: vertical wash, glow behind the emblem, faint engineering grid
  const bg = ctx.createLinearGradient(0, 0, 0, S)
  bg.addColorStop(0, p.top); bg.addColorStop(0.46, p.mid); bg.addColorStop(1, '#030504')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S)
  const glow = ctx.createRadialGradient(S / 2, 30 * u, 0, S / 2, 30 * u, 52 * u)
  glow.addColorStop(0, p.glow + '3a'); glow.addColorStop(1, p.glow + '00')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, S, S)
  ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2
  for (let i = 6 * u; i < S; i += 6 * u) {
    const fade = Math.max(0, 1 - Math.hypot(i - S / 2, 0) / (55 * u))
    ctx.globalAlpha = 0.035 * fade
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 70 * u); ctx.stroke()
    if (i < 70 * u) { ctx.globalAlpha = 0.035 * Math.max(0, 1 - Math.abs(i - 30 * u) / (40 * u)); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(S, i); ctx.stroke() }
  }
  ctx.restore()

  // corners mirror with the reading direction: emblem at the start, QR at the end
  const start = (x: number, w: number) => rtl ? S - x - w : x
  const box = 9.5 * u, bx = start(6.5 * u, box), by = 6 * u
  ctx.strokeStyle = '#ffffff2e'; ctx.lineWidth = 3; ctx.strokeRect(bx, by, box, box)
  ctx.fillStyle = '#ffffff08'; ctx.fillRect(bx, by, box, box)
  metalMark(ctx, mark, bx + (box - 5.6 * u) / 2, by + (box - 6.2 * u) / 2, 5.6 * u, 6.2 * u, PALETTES.purchase, false)
  const qs = 11.5 * u, qx = rtl ? 6.5 * u : S - 6.5 * u - qs, qy = 6 * u
  if (qr) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(qx, qy, qs, qs); ctx.drawImage(qr, qx, qy, qs, qs)
    ctx.fillStyle = p.soft; ctx.font = font(1.7 * u); ctx.textAlign = 'center'
    ctx.save(); ctx.direction = 'ltr'
    ctx.fillText(certificate!.serial.slice(0, 8).toUpperCase().split('').join(' '), qx + qs / 2, qy + qs + 3 * u)
    ctx.restore()
  } else {
    ctx.save(); ctx.setLineDash([12, 10]); ctx.strokeStyle = '#ffffff44'; ctx.strokeRect(qx, qy, qs, qs); ctx.setLineDash([])
    const cell = (qs - 4.2 * u) / 2
    for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { ctx.strokeStyle = '#ffffff30'; ctx.lineWidth = 0.6 * u; ctx.strokeRect(qx + 1.4 * u + cx * (cell + 1.4 * u), qy + 1.4 * u + cy * (cell + 1.4 * u), cell, cell) }
    ctx.restore()
  }

  // hero emblem
  const mw = 25 * u, mh = mw * 644 / 581
  metalMark(ctx, mark, (S - mw) / 2, 8 * u, mw, mh, p, true)

  const bar = (cx: number, y: number, w: number, h: number, color = '#ffffff26') => {
    ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(cx - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.restore()
  }
  const line = (text: string, y: number, size: number, color: string, weight = 500, max = 84 * u) => {
    ctx.font = font(size, weight); let actual = size
    while (ctx.measureText(text).width > max && actual > 16) ctx.font = font(--actual, weight)
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(text, S / 2, y)
  }
  const paragraph = (text: string, y: number, size: number, color: string, weight: number, max: number, lh = 1.55) => {
    ctx.font = font(size, weight); ctx.fillStyle = color; ctx.textAlign = 'center'
    const lines = wrap(ctx, text, max)
    lines.forEach((l, i) => ctx.fillText(l, S / 2, y + i * size * lh))
    return y + lines.length * size * lh
  }
  const titleColor = kind === 'payout' ? '#e9ffc4' : '#cdf5e3'
  const payout = kind === 'payout'
  let y = payout ? 47 * u : 45 * u
  line(t(`${kind}Title`), y, payout ? 5 * u : 4.4 * u, titleColor, 500)
  y += payout ? 4.5 * u : 4.6 * u
  if (!payout) { line(t('lead'), y, 2.6 * u, p.soft); y += 6.5 * u } else y += 4 * u
  if (certificate) line(certificate.holder, y, 6.6 * u, '#f7faf8', 700)
  else bar(S / 2, y - 2.2 * u, 34 * u, 5 * u)
  y += payout ? 9 * u : 5.6 * u
  if (!payout) {
    y = paragraph(t(`${kind}Body`), y, 2.25 * u, '#eef5f1', 700, 74 * u) + 1.8 * u
    const label = `${t('accountSize')}:`
    ctx.font = font(3.4 * u)
    if (certificate) line(`${label} ${money(certificate.amount, certificate.currency)}  ·  ⁨${certificate.plan}⁩`, y, 3.2 * u, p.soft)
    else { line(label, y, 3.4 * u, p.soft); bar(S / 2, y + 4.2 * u, 16 * u, 3.6 * u, p.accent + '44') }
  } else {
    line(t('totalPayout'), y, 4.2 * u, p.soft)
    y += 10 * u
    if (certificate) line(money(certificate.amount, certificate.currency), y, 10 * u, p.accent, 700)
    else bar(S / 2, y - 3.4 * u, 26 * u, 8 * u, p.accent + '44')
    if (certificate) line(certificate.plan, y + 5 * u, 2.6 * u, p.soft)
  }

  // disclaimer, serial and footer
  // the disclaimer is anchored above the serial, however many lines it wraps to
  ctx.font = font(1.6 * u); const legalLines = wrap(ctx, t('legal'), 82 * u).length
  paragraph(t('legal'), 86.4 * u - (legalLines - 1) * 1.6 * u * 1.6, 1.6 * u, '#ffffff8c', 500, 82 * u, 1.6)
  const fy = 94 * u
  ctx.strokeStyle = '#ffffff30'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(S / 2, fy - 3 * u); ctx.lineTo(S / 2, fy + 2 * u); ctx.stroke()
  ctx.font = font(2.2 * u); ctx.fillStyle = '#ffffffcc'
  ctx.textAlign = rtl ? 'right' : 'left'
  ctx.save(); ctx.direction = 'ltr'; ctx.textAlign = rtl ? 'right' : 'left'; ctx.fillText('openfund.cloud', rtl ? S - 7 * u : 7 * u, fy); ctx.restore()
  const date = (s: string) => new Date(s).toLocaleDateString(locale === 'fa' ? 'fa-IR' : locale === 'en' ? 'en-GB' : locale, { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' })
  ctx.textAlign = rtl ? 'left' : 'right'
  const dateX = rtl ? 7 * u : S - 7 * u
  if (certificate) ctx.fillText(`${t('issueDate')}: ${date(certificate.issuedAt)}`, dateX, fy)
  else {
    const label = `${t('issueDate')}:`; ctx.fillText(label, rtl ? dateX + 14 * u : dateX - 14 * u, fy)
    bar(rtl ? dateX + 6.5 * u : dateX - 6.5 * u, fy - 0.8 * u, 13 * u, 2.2 * u)
  }
  if (certificate) { ctx.font = font(1.45 * u); ctx.fillStyle = '#ffffff6b'; ctx.textAlign = 'center'; ctx.save(); ctx.direction = 'ltr'; ctx.fillText(certificate.serial, S / 2, 89.6 * u); ctx.restore() }

  if (certificate?.status === 'revoked') {
    ctx.save(); ctx.translate(S / 2, 62 * u); ctx.rotate(-0.18)
    ctx.strokeStyle = '#eeb2a4'; ctx.lineWidth = 8; ctx.font = font(9 * u, 700)
    const w = ctx.measureText(t('revoked')).width + 8 * u
    ctx.strokeRect(-w / 2, -8 * u, w, 11 * u); ctx.fillStyle = '#eeb2a4'; ctx.textAlign = 'center'; ctx.fillText(t('revoked'), 0, 0); ctx.restore()
  }
}

const previewCache = new Map<string, Promise<string>>()
/** Anonymous template preview as an image URL (cached per kind and locale). */
export function certificateTemplate(kind: CertificateKind, locale: AppLocale) {
  const key = `${kind}:${locale}`
  let cached = previewCache.get(key)
  if (!cached) {
    cached = (async () => { const c = document.createElement('canvas'); await paintCertificate(c, null, locale, kind); return c.toDataURL('image/webp', 0.86) })()
    cached.catch(() => previewCache.delete(key))
    previewCache.set(key, cached)
  }
  return cached
}
const download = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000) }
export async function downloadPng(canvas: HTMLCanvasElement, serial: string) {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('image_export_failed')), 'image/png'))
  download(blob, `openfund-${serial}.png`)
}
/** Embed the same rendered image in a square PDF page; preserves RTL shaping. */
export function downloadPdf(canvas: HTMLCanvasElement, serial: string) {
  const raw = atob(canvas.toDataURL('image/jpeg', 0.98).split(',')[1])
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0)), encoder = new TextEncoder()
  const parts: Uint8Array[] = [], offsets = [0]; let length = 0
  const add = (v: string | Uint8Array) => { const b = typeof v === 'string' ? encoder.encode(v) : v; parts.push(b); length += b.length }
  const object = (id: number, body: string) => { offsets[id] = length; add(`${id} 0 obj\n${body}\nendobj\n`) }
  add('%PDF-1.4\n')
  object(1, '<< /Type /Catalog /Pages 2 0 R >>')
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  object(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 720 720] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>')
  offsets[4] = length
  add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`)
  add(bytes); add('\nendstream\nendobj\n')
  const stream = 'q 720 0 0 720 0 0 cm /Im0 Do Q\n'
  object(5, `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`)
  const xref = length
  add('xref\n0 6\n0000000000 65535 f \n')
  offsets.slice(1).forEach(offset => add(`${String(offset).padStart(10, '0')} 00000 n \n`))
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  download(new Blob(parts as BlobPart[], { type: 'application/pdf' }), `openfund-${serial}.pdf`)
}
