/* Bug bounty program data (ADR 0057). Reward amounts are owner-edited
 * values in Directus (`bug_bounty_tiers`, Backstage → Security → Bug
 * bounty); the published hall of fame is `bug_bounty_hall_of_fame` and lists
 * only reporters who consented. Copy (labels, examples, scope) is registered
 * interface text, editable in the Content workspace. When no content source
 * answers, the published defaults below are used; the hall of fame is then
 * empty, never invented. */
import { getCmsJson } from '../../cms/client'

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']
export interface Tier { severity: Severity; minUsd: number; maxUsd: number }
export interface HallEntry { id: string; name: string; profileUrl: string | null; year: number; severity: Severity | null }

/** The owner's published defaults (the same values the CMS seed writes). */
export const DEFAULT_TIERS: Tier[] = [
  { severity: 'critical', minUsd: 2000, maxUsd: 2000 },
  { severity: 'high', minUsd: 1000, maxUsd: 1500 },
  { severity: 'medium', minUsd: 500, maxUsd: 800 },
  { severity: 'low', minUsd: 300, maxUsd: 300 },
]
export const REPORT_URL = 'https://github.com/algomanlife/openfund/security/advisories/new'

interface RawTier { severity?: string; reward_min_usd?: number | string | null; reward_max_usd?: number | string | null; status?: string | null }
interface RawHall { id: number | string; display_name?: string | null; profile_url?: string | null; year?: number | null; severity?: string | null; consent?: boolean | null }

const money = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n) : null }
export function normalizeTiers(rows: RawTier[] | null): Tier[] {
  if (!rows) return DEFAULT_TIERS
  const tiers = SEVERITIES.map(severity => {
    const row = rows.find(r => r.severity === severity && (r.status ?? 'published') === 'published')
    const min = money(row?.reward_min_usd), max = money(row?.reward_max_usd)
    return min != null && max != null && max >= min ? { severity, minUsd: min, maxUsd: max } : null
  })
  /* an incomplete published table falls back as a whole: never mix sources */
  return tiers.every(Boolean) ? tiers as Tier[] : DEFAULT_TIERS
}
const safeProfile = (url: string | null | undefined) => {
  if (!url) return null
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null } catch { return null }
}
export function normalizeHall(rows: RawHall[] | null): HallEntry[] {
  return (rows ?? [])
    .filter(r => r.consent === true && r.display_name && Number.isInteger(r.year))
    .map(r => ({ id: String(r.id), name: String(r.display_name).slice(0, 60), profileUrl: safeProfile(r.profile_url), year: r.year as number,
      severity: SEVERITIES.includes(r.severity as Severity) ? r.severity as Severity : null }))
}

export async function loadBounty(fetchList: <T>(path: string) => Promise<T | null> = getCmsJson) {
  const [tiers, hall] = await Promise.all([
    fetchList<RawTier[]>('/items/bug_bounty_tiers?fields=severity,reward_min_usd,reward_max_usd,status&filter[status][_eq]=published&limit=10'),
    fetchList<RawHall[]>('/items/bug_bounty_hall_of_fame?fields=id,display_name,profile_url,year,severity,consent&filter[status][_eq]=published&filter[consent][_eq]=true&sort=-year&limit=100'),
  ])
  return { tiers: normalizeTiers(tiers), hall: normalizeHall(hall), fromCms: tiers != null }
}
