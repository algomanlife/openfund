/* Backstage → Security → Bug bounty (ADR 0057).
 *
 * Two owner-edited records in Directus, written through the server-held
 * token behind the owner session, CSRF and password re-entry (server.js):
 *  - the reward table (`bug_bounty_tiers`): whole USD amounts per severity,
 *    minimum ≤ maximum, at most 100,000; only the two amount fields change;
 *  - the hall of fame (`bug_bounty_hall_of_fame`): a name, an optional
 *    https profile link, the year and severity. An entry is published only
 *    with the reporter's recorded consent; without it, it stays a draft.
 * Payouts themselves are recorded as verified expenses in the "bug_bounty"
 * category (Finance → Expenses), never here. */
const fail = (status, code) => Object.assign(new Error(code), { status })
export const SEVERITIES = ['critical', 'high', 'medium', 'low']
const MARKUP = /<\/?[a-z!][^>]*>|javascript:/i
const STATUSES = ['draft', 'published', 'archived']
export const MAX_REWARD_USD = 100_000

export function normalizeTiers(body) {
  const rows = Array.isArray(body?.tiers) ? body.tiers : null
  if (!rows || rows.length !== SEVERITIES.length) throw fail(400, 'invalid_tiers')
  return SEVERITIES.map(severity => {
    const row = rows.find(r => r?.severity === severity)
    const min = Number(row?.reward_min_usd), max = Number(row?.reward_max_usd)
    if (!row || !Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min || max > MAX_REWARD_USD) throw fail(400, 'invalid_tiers')
    return { severity, reward_min_usd: min, reward_max_usd: max }
  })
}

export function normalizeHallEntry(b, now = new Date()) {
  if (!b || typeof b !== 'object') throw fail(400, 'invalid_request')
  const name = typeof b.display_name === 'string' ? b.display_name.trim() : ''
  if (!name || name.length > 60 || MARKUP.test(name)) throw fail(400, 'invalid_name')
  let profile = null
  if (b.profile_url) {
    let u
    try { u = new URL(String(b.profile_url)) } catch { throw fail(400, 'invalid_profile_url') }
    if (u.protocol !== 'https:' || u.username || u.password || u.href.length > 300) throw fail(400, 'invalid_profile_url')
    profile = u.href
  }
  const year = Number(b.year)
  if (!Number.isInteger(year) || year < 2025 || year > now.getUTCFullYear() + 1) throw fail(400, 'invalid_year')
  const severity = b.severity == null || b.severity === '' ? null : b.severity
  if (severity !== null && !SEVERITIES.includes(severity)) throw fail(400, 'invalid_severity')
  const status = STATUSES.includes(b.status) ? b.status : 'draft'
  const consent = b.consent === true
  /* never publish a name without the reporter's consent */
  if (status === 'published' && !consent) throw fail(409, 'consent_required')
  const ref = b.advisory_reference ? String(b.advisory_reference).trim() : null
  if (ref && !/^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/.test(ref)) throw fail(400, 'invalid_advisory')
  return { display_name: name, profile_url: profile, year, severity, status, consent, advisory_reference: ref }
}

export function createBountyApi({ cms, token, fetchImpl = fetch }) {
  async function directus(path, { method = 'GET', body } = {}) {
    if (!token) throw fail(503, 'cms_unavailable')
    const target = new URL(cms)
    const q = path.indexOf('?')
    target.pathname = q === -1 ? path : path.slice(0, q)
    if (q !== -1) target.search = path.slice(q)
    let response
    try {
      response = await fetchImpl(target, { method, redirect: 'error', signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
    } catch { throw fail(502, 'cms_unavailable') }
    if (!response.ok) { await response.body?.cancel(); throw fail(response.status === 404 ? 404 : 502, 'cms_rejected') }
    return response.status === 204 ? null : (await response.json()).data
  }
  return {
    async list() {
      const [tiers, hall] = await Promise.all([
        directus('/items/bug_bounty_tiers?fields=id,severity,reward_min_usd,reward_max_usd,status&sort=sort&limit=10'),
        directus('/items/bug_bounty_hall_of_fame?fields=*&sort=-year,-id&limit=200'),
      ])
      return { tiers, hall }
    },
    /* validate first; apply after the owner's password */
    async prepareTiers(body) {
      const tiers = normalizeTiers(body)
      return {
        target: 'tiers',
        apply: async () => {
          const current = await directus('/items/bug_bounty_tiers?fields=id,severity&limit=10')
          const ids = new Map(current.map(r => [r.severity, r.id]))
          if (SEVERITIES.some(s => !ids.has(s))) throw fail(409, 'tiers_missing')
          for (const t of tiers) await directus(`/items/bug_bounty_tiers/${ids.get(t.severity)}`, { method: 'PATCH', body: { reward_min_usd: t.reward_min_usd, reward_max_usd: t.reward_max_usd } })
          return 'tiers'
        },
      }
    },
    async prepareHall(body) {
      const id = body?.id == null ? null : Number(body.id)
      if (id !== null && (!Number.isInteger(id) || id <= 0)) throw fail(400, 'invalid_request')
      const entry = normalizeHallEntry(body?.entry)
      return {
        target: id ?? entry.display_name,
        apply: async () => id === null
          ? (await directus('/items/bug_bounty_hall_of_fame', { method: 'POST', body: entry })).id
          : (await directus(`/items/bug_bounty_hall_of_fame/${id}`, { method: 'PATCH', body: entry }), id),
      }
    },
  }
}
