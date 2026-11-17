/* Cloudflare configuration for Openfund (ADR 0043). Source of truth for the
   two Cloudflare zones; openfi.live is on Liara DNS and is not managed here.
   Rule expressions are serialized from apps/backend/redirect-policy.js, the
   tree the backend evaluates, so the edge and the origin cannot disagree.
   scripts/cloudflare/check-live.mjs compares the live zones with this file;
   scripts/cloudflare/verify-public.mjs checks behaviour over HTTPS. No
   credentials live in this file. */
import { canonicalCondition, geoCondition, toCloudflare } from '../../apps/backend/redirect-policy.js'

export const CANONICAL = Object.freeze({ GLOBAL: 'https://openfi.cloud', IRAN: 'https://openfi.live' })

export const ZONES = Object.freeze({
  'openfi.cloud': { id: 'b6dd98ace3338cf967451697ae2aca61', region: 'GLOBAL' },
  'openfund.cloud': { id: '82d2772059c9047997aa4dcaeca027cd', region: 'GLOBAL' },
})
/* zones that are NOT on Cloudflare: redirects for their aliases run in the app */
export const NOT_ON_CLOUDFLARE = Object.freeze({ 'openfi.live': 'Liara DNS (ns1/ns2.liara.zone)' })

/* Expected DNS. `proxied` decides whether Cloudflare rules can see a host. */
export const DNS = Object.freeze({
  'openfi.cloud': { type: 'CNAME', content: 'openfund-our6.onrender.com', proxied: true, role: 'GLOBAL canonical website' },
  'www.openfi.cloud': { type: 'CNAME', content: 'openfi.cloud', proxied: true, role: 'GLOBAL alias → 301' },
  'openfund.cloud': { type: 'CNAME', content: 'openfund-our6.onrender.com', proxied: true, role: 'GLOBAL alias → 301' },
  /* points at the Render origin, not at openfi.cloud: a proxied CNAME to a
     host in the other zone was processed by that zone and skipped this
     zone's redirect rule (observed 2026-11-17) */
  'www.openfund.cloud': { type: 'CNAME', content: 'openfund-our6.onrender.com', proxied: true, role: 'GLOBAL alias → 301' },
  'cms.openfi.cloud': { type: 'CNAME', content: 'openfund-cms.onrender.com', proxied: false, role: 'operational: Directus, never redirected' },
  'backstage.openfi.cloud': { type: 'CNAME', content: 'openfund-backstage.onrender.com', proxied: false, role: 'operational: Backstage, never redirected' },
  'iran.openfi.cloud': { type: 'CNAME', content: 'table-mountain.liara.cloud', proxied: false, role: 'IRAN alias, served by Liara (app redirect)' },
  'iran.openfund.cloud': { type: 'CNAME', content: 'table-mountain.liara.cloud', proxied: false, role: 'IRAN alias, served by Liara (app redirect)' },
})

export const SETTINGS = Object.freeze({ ssl: 'strict', min_tls_version: '1.2', always_use_https: 'on' })

/** zone → canonical alias rule (301, path and query kept) */
export function canonicalRule(zone) {
  const hosts = { 'openfi.cloud': ['www.openfi.cloud'], 'openfund.cloud': ['openfund.cloud', 'www.openfund.cloud'] }[zone]
  if (!hosts) throw Error(`no canonical rule for ${zone}`)
  return {
    ref: `openfund_canonical_${zone.replace('.', '_')}`,
    description: `Openfund ADR 0043: ${hosts.join(', ')} → ${CANONICAL.GLOBAL} (301)`,
    enabled: true,
    action: 'redirect',
    expression: toCloudflare(canonicalCondition(hosts)),
    action_parameters: { from_value: { status_code: 301, preserve_query_string: true,
      target_url: { expression: `concat("${CANONICAL.GLOBAL}", http.request.uri.path)` } } },
  }
}

/** IR visitors' top-level document navigations on openfi.cloud → openfi.live
 *  (302: geography changes). Disabled until the readiness gates pass. */
export function geoRule({ enabled = false } = {}) {
  return {
    ref: 'openfund_geo_iran',
    description: 'Openfund ADR 0043: IR browser navigation → https://openfi.live (302, gated)',
    enabled,
    action: 'redirect',
    expression: toCloudflare(geoCondition()),
    action_parameters: { from_value: { status_code: 302, preserve_query_string: true,
      target_url: { expression: `concat("${CANONICAL.IRAN}", http.request.uri.path)` } } },
  }
}

/** the legacy rule found on 2026-11-17: compares http.host with a literal that
 *  contains an expression, so it never matched; target was port 8443 */
export const OBSOLETE_RULES = Object.freeze([{ zone: 'openfi.cloud', id: '025b2b6238574c5c996022b6d4eb9037', description: 'Static' }])
