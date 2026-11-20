/* IP → country lookup for regions without a trusted edge country (ADR 0043).

   Liara is not behind Cloudflare, so the Iran runtime has no CF-IPCountry.
   This module looks the visitor's address up in an IP-to-country database
   (CSV rows `start,end,country`, e.g. DB-IP "IP to Country Lite", CC BY 4.0,
   or any equivalent licensed dataset; plain or .gz). IPv4 and IPv6 ranges are
   both loaded; an address the table does not list (private, reserved or
   absent) is "unknown" and gets the regional fallback language. No new
   dependency: IPv4 ranges are two typed arrays, IPv6 ranges two BigInt
   arrays, both searched by bisection. Licence and update process:
   docs/deployment/LIARA_IRAN_RUNTIME.md §Geo-IP database. */
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import net from 'node:net'

const v4 = ip => ip.split('.').reduce((n, part) => n * 256 + Number(part), 0)

/** IPv6 text → 128-bit BigInt (net.isIPv6 must already hold) */
export function ipv6ToBigInt(ip) {
  let a = ip.toLowerCase()
  const zone = a.indexOf('%'); if (zone >= 0) a = a.slice(0, zone)
  /* an embedded IPv4 tail (::ffff:1.2.3.4, 64:ff9b::1.2.3.4) becomes two groups */
  const tail = a.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (tail) { const n = v4(tail[1]); a = a.slice(0, -tail[1].length) + ((n >>> 16).toString(16)) + ':' + ((n & 0xffff).toString(16)) }
  const [head, rest] = a.includes('::') ? a.split('::') : [a, null]
  const h = head ? head.split(':') : [], r = rest ? rest.split(':') : []
  const groups = rest === null ? h : [...h, ...Array(8 - h.length - r.length).fill('0'), ...r]
  return groups.reduce((n, g) => (n << 16n) | BigInt(parseInt(g || '0', 16)), 0n)
}

/* IPv4-mapped IPv6 (::ffff:a.b.c.d) is an IPv4 visitor */
const unmap = ip => (ip.startsWith('::ffff:') && net.isIPv4(ip.slice(7)) ? ip.slice(7) : ip)

/** CSV text → sorted IPv4 and IPv6 ranges; malformed rows are skipped */
export function parseIpCsv(text) {
  const rows4 = [], rows6 = []
  for (const line of text.split('\n')) {
    const [start, end, country] = line.trim().split(',').map(s => s?.replace(/^"|"$/g, ''))
    if (!/^[A-Z]{2}$/.test(country || '')) continue
    if (net.isIPv4(start || '') && net.isIPv4(end || '')) rows4.push([v4(start), v4(end), country])
    else if (net.isIPv6(start || '') && net.isIPv6(end || '')) {
      const s = ipv6ToBigInt(start), e = ipv6ToBigInt(end)
      if (s <= e) rows6.push([s, e, country])
    }
  }
  rows4.sort((a, b) => a[0] - b[0])
  rows6.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  const starts = new Uint32Array(rows4.length), ends = new Uint32Array(rows4.length)
  rows4.forEach(([s, e], i) => { starts[i] = s; ends[i] = e })
  return {
    starts, ends, countries: rows4.map(r => r[2]), size: rows4.length,
    v6: { starts: rows6.map(r => r[0]), ends: rows6.map(r => r[1]), countries: rows6.map(r => r[2]), size: rows6.length },
  }
}
function bisect(table, n) {
  let lo = 0, hi = table.size - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (n < table.starts[mid]) hi = mid - 1
    else if (n > table.ends[mid]) lo = mid + 1
    else return table.countries[mid]
  }
  return null
}

/** country for an IPv4 address, or null (IPv6, private or unlisted) */
export function lookupIpv4(db, ip) {
  const a = unmap(String(ip || '').trim())
  if (!db || !net.isIPv4(a)) return null
  return bisect(db, v4(a))
}

/** country for an IPv4 or IPv6 address, or null (malformed, private or unlisted) */
export function lookupIp(db, ip) {
  const a = unmap(String(ip || '').trim())
  if (!db) return null
  if (net.isIPv4(a)) return bisect(db, v4(a))
  if (net.isIPv6(a) && db.v6?.size) return bisect(db.v6, ipv6ToBigInt(a))
  return null
}

export function loadIpDatabase(path) {
  const raw = readFileSync(path)
  const db = parseIpCsv((path.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8'))
  if (db.size < 1000) throw Error(`GEOIP_DB_PATH ${path}: only ${db.size} IPv4 ranges; refusing a truncated database`)
  return db
}
