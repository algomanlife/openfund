#!/usr/bin/env node
/**
 * Cloudflare drift check (ADR 0043): live zones vs infra/cloudflare/policy.mjs.
 *
 *   CLOUDFLARE_API_TOKEN=… node scripts/cloudflare/check-live.mjs      # read-only API calls
 *   node scripts/cloudflare/check-live.mjs --from-file live.json        # a snapshot taken elsewhere
 *
 * Compares DNS records (type, target, proxied), the TLS settings, and every
 * Openfund redirect rule (expression, status, enabled). Exit 1 on drift.
 * Snapshot shape: { zones: { "<zone>": { dns: [{name,type,content,proxied}],
 * settings: {ssl,min_tls_version,always_use_https}, rules: [{ref,enabled,expression,status}] } } }
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ZONES, DNS, SETTINGS, canonicalRule, geoRule } from '../../infra/cloudflare/policy.mjs'

/** the rules each zone must carry, with their expected enabled state */
export function expectedRules() {
  return {
    'openfi.cloud': [canonicalRule('openfi.cloud'), geoRule({ enabled: false })],
    'openfund.cloud': [canonicalRule('openfund.cloud')],
  }
}

export function compare(live) {
  const drift = []
  const rules = expectedRules()
  for (const zone of Object.keys(ZONES)) {
    const z = live.zones?.[zone]
    if (!z) { drift.push(`${zone}: missing from the live snapshot`); continue }
    for (const [name, want] of Object.entries(DNS).filter(([n]) => n === zone || n.endsWith(`.${zone}`))) {
      const rec = z.dns.find(r => r.name === name && r.type === want.type)
      if (!rec) { drift.push(`${zone}: DNS ${want.type} ${name} missing`); continue }
      if (rec.content !== want.content) drift.push(`${zone}: DNS ${name} → ${rec.content}, policy says ${want.content}`)
      if (rec.proxied !== want.proxied) drift.push(`${zone}: DNS ${name} proxied=${rec.proxied}, policy says ${want.proxied}`)
    }
    for (const [k, v] of Object.entries(SETTINGS)) if (z.settings?.[k] !== v) drift.push(`${zone}: setting ${k}=${z.settings?.[k]}, policy says ${v}`)
    for (const want of rules[zone]) {
      const got = z.rules.find(r => r.ref === want.ref)
      if (!got) { drift.push(`${zone}: rule ${want.ref} missing`); continue }
      if (got.enabled !== want.enabled) drift.push(`${zone}: rule ${want.ref} enabled=${got.enabled}, policy says ${want.enabled}`)
      if (got.status !== want.action_parameters.from_value.status_code) drift.push(`${zone}: rule ${want.ref} status ${got.status}, policy says ${want.action_parameters.from_value.status_code}`)
      if (got.expression !== want.expression) drift.push(`${zone}: rule ${want.ref} expression differs from the reviewed policy`)
    }
    for (const r of z.rules) if (!rules[zone].some(w => w.ref === r.ref)) drift.push(`${zone}: unmanaged redirect rule ${r.ref || r.id} (${r.description ?? ''})`)
  }
  return drift
}

async function fetchLive(token) {
  const api = async path => {
    const r = await fetch(`https://api.cloudflare.com/client/v4${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) })
    const body = await r.json()
    if (!body.success) throw Error(`GET ${path}: ${JSON.stringify(body.errors)}`)
    return body.result
  }
  const zones = {}
  for (const [name, { id }] of Object.entries(ZONES)) {
    const dns = (await api(`/zones/${id}/dns_records?per_page=100`)).map(r => ({ name: r.name, type: r.type, content: r.content, proxied: r.proxied }))
    const settings = {}
    for (const k of Object.keys(SETTINGS)) settings[k] = (await api(`/zones/${id}/settings/${k}`)).value
    let rules = []
    try {
      const rs = await api(`/zones/${id}/rulesets/phases/http_request_dynamic_redirect/entrypoint`)
      rules = (rs.rules ?? []).map(r => ({ ref: r.ref, id: r.id, description: r.description, enabled: r.enabled, expression: r.expression, status: r.action_parameters?.from_value?.status_code }))
    } catch { /* no entrypoint yet */ }
    zones[name] = { dns, settings, rules }
  }
  return { zones }
}

async function main() {
  const i = process.argv.indexOf('--from-file')
  const live = i > 0 ? JSON.parse(readFileSync(process.argv[i + 1], 'utf8'))
    : process.env.CLOUDFLARE_API_TOKEN ? await fetchLive(process.env.CLOUDFLARE_API_TOKEN)
    : (() => { throw Error('set CLOUDFLARE_API_TOKEN (read-only: Zone Read, DNS Read, Zone Settings Read, Rulesets Read) or pass --from-file') })()
  const drift = compare(live)
  for (const d of drift) console.log(`DRIFT  ${d}`)
  console.log(drift.length ? `${drift.length} difference(s)` : 'Cloudflare matches infra/cloudflare/policy.mjs')
  process.exit(drift.length ? 1 : 0)
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch(e => { console.error(e.message); process.exit(2) })
