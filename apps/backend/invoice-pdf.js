/**
 * Minimal, dependency-free PDF generator for Openfund invoices.
 *
 * Produces a single-page A4 PDF (PDF 1.4, Helvetica, WinAnsi) with the
 * invoice header, billed wallet identity and the challenge purchase line
 * items. English + Latin numerals only (financial document of record);
 * Persian product localization remains in the application UI.
 *
 * This is intentionally hand-rolled: the backend keeps zero new runtime
 * dependencies (AGENTS.md engineering rules; ENVIRONMENT.md documents none).
 */

const PAGE_W = 595.28 // A4 width (pt)
const PAGE_H = 841.89

function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function text(x, y, size, str, { bold = false, gray = 0 } = {}) {
  const font = bold ? '/F2' : '/F1'
  const color = gray === 0 ? '' : `${gray} ${gray} ${gray} rg\n`
  return `${color}BT ${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${esc(str)}) Tj ET\n`
}

function money(v) {
  const n = Number(v)
  return `$${n.toFixed(2)}`
}

/**
 * @param {object} inv
 * @param {string} inv.number        invoice number, e.g. OF-2026-000001
 * @param {string} inv.issuedAt      ISO timestamp
 * @param {string} inv.walletAddress payer wallet (lowercase hex)
 * @param {string|null} inv.displayName
 * @param {string} inv.planName      challenge plan display name
 * @param {string|number} inv.accountSizeUsd
 * @param {string|number} inv.priceUsd
 * @param {string} inv.orderId       purchase order id
 * @returns {Buffer} PDF bytes
 */
export function invoicePdf(inv) {
  const issued = new Date(inv.issuedAt)
  const dateStr = issued.toISOString().slice(0, 10)

  let stream = ''
  // Header
  stream += text(50, PAGE_H - 70, 26, 'Openfund', { bold: true })
  stream += text(50, PAGE_H - 92, 11, 'CHALLENGE PURCHASE INVOICE', { gray: 0.45 })
  stream += text(PAGE_W - 50 - 130, PAGE_H - 70, 16, inv.number, { bold: true })

  // Meta block
  let y = PAGE_H - 150
  const meta = [
    ['Invoice date', dateStr],
    ['Billed to', inv.displayName ? `${inv.displayName} (${inv.walletAddress})` : inv.walletAddress],
    ['Purchase order', inv.orderId],
  ]
  for (const [k, v] of meta) {
    stream += text(50, y, 10, k.toUpperCase(), { gray: 0.55 })
    stream += text(180, y, 10, v)
    y -= 18
  }

  // Items table (single line item)
  y -= 20
  stream += text(50, y, 10, 'ITEM', { bold: true, gray: 0.25 })
  stream += text(320, y, 10, 'ACCOUNT SIZE', { bold: true, gray: 0.25 })
  stream += text(465, y, 10, 'AMOUNT', { bold: true, gray: 0.25 })
  y -= 8
  // rule
  stream += `0.75 0.75 0.75 RG 0.7 w 50 ${y} m ${PAGE_W - 50} ${y} l S\n`
  y -= 22
  stream += text(50, y, 11, inv.planName)
  stream += text(325, y, 11, money(inv.accountSizeUsd))
  stream += text(465, y, 11, money(inv.priceUsd))
  y -= 8
  stream += `0.75 0.75 0.75 RG 0.7 w 50 ${y} m ${PAGE_W - 50} ${y} l S\n`
  y -= 30
  stream += text(350, y, 11, 'TOTAL', { bold: true })
  stream += text(465, y, 14, money(inv.priceUsd), { bold: true })
  y -= 26
  stream += text(465, y, 9, 'PAID', { gray: 0.45 })

  // Footer
  stream += text(50, 60, 9, 'This invoice was generated automatically by Openfund for a paid challenge purchase.', { gray: 0.55 })
  stream += text(50, 46, 9, 'Virtual challenge accounts carry no withdrawal rights until evaluation terms are met.', { gray: 0.55 })

  const objects = []
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'
  objects[3] =
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
    `/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  objects[6] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream`

  let out = '%PDF-1.4\n'
  const offsets = [0]
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(out, 'latin1')
    out += `${i} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xref = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let i = 1; i < objects.length; i++) {
    out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
