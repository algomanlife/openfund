/* IP → country lookup for regions without a trusted edge country (ADR 0043).

   Liara is not behind Cloudflare, so the Iran runtime has no CF-IPCountry.
   This module looks the visitor's address up in an IP-to-country database
   (CSV rows `start,end,country`, e.g. DB-IP "IP to Country Lite", CC BY 4.0,
   or any equivalent licensed dataset; plain or .gz). IPv4 only: an IPv6
   visitor is "unknown" and gets the regional fallback language. No new
   dependency; the table is two typed arrays searched by bisection. */
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import net from 'node:net'

const v4 = ip => ip.split('.').reduce((n, part) => n * 256 + Number(part), 0)

/** CSV text → sorted IPv4 ranges; IPv6 and malformed rows are skipped */
export function parseIpv4Csv(text) {
  const rows = []
  for (const line of text.split('\n')) {
    const [start, end, country] = line.trim().split(',').map(s => s?.replace(/^"|"$/g, ''))
    if (!net.isIPv4(start || '') || !net.isIPv4(end || '') || !/^[A-Z]{2}$/.test(country || '')) continue
    rows.push([v4(start), v4(end), country])
  }
  rows.sort((a, b) => a[0] - b[0])
  const starts = new Uint32Array(rows.length), ends = new Uint32Array(rows.length)
  rows.forEach(([s, e], i) => { starts[i] = s; ends[i] = e })
  return { starts, ends, countries: rows.map(r => r[2]), size: rows.length }
}

/** country for an IPv4 address, or null (IPv6, private or unlisted) */
export function lookupIpv4(db, ip) {
  let a = String(ip || '').trim()
  if (a.startsWith('::ffff:')) a = a.slice(7)
  if (!db || !net.isIPv4(a)) return null
  const n = v4(a)
  let lo = 0, hi = db.size - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (n < db.starts[mid]) hi = mid - 1
    else if (n > db.ends[mid]) lo = mid + 1
    else return db.countries[mid]
  }
  return null
}

export function loadIpDatabase(path) {
  const raw = readFileSync(path)
  const db = parseIpv4Csv((path.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8'))
  if (db.size < 1000) throw Error(`GEOIP_DB_PATH ${path}: only ${db.size} IPv4 ranges; refusing a truncated database`)
  return db
}
