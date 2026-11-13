/**
 * Campaign attribution without personal data.
 *
 * Only the standard utm_* parameters are kept, each limited to a short safe
 * charset, in sessionStorage for the current visit, and carried on every
 * link into the shared checkout. Events are dispatched in the page as
 * `openfund:campaign` and pushed to `window.dataLayer` when the operator has
 * installed a tag manager. No wallet address, email, order id or other
 * identifier is ever included.
 */
export type Utm = Partial<Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term', string>>
const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
const STORE = 'of.campaign.utm'
const SAFE = /^[A-Za-z0-9._~-]{1,64}$/

export function sanitizeUtm(input: Record<string, string | null | undefined>): Utm {
  const out: Utm = {}
  for (const k of KEYS) { const v = input[k]; if (typeof v === 'string' && SAFE.test(v)) out[k] = v }
  return out
}

/** utm from the URL, else from this visit's earlier landing (sessionStorage) */
export function campaignUtm(params: URLSearchParams): Utm {
  const fromUrl = sanitizeUtm(Object.fromEntries(KEYS.map(k => [k, params.get(k)])))
  try {
    if (Object.keys(fromUrl).length) { sessionStorage.setItem(STORE, JSON.stringify(fromUrl)); return fromUrl }
    return sanitizeUtm(JSON.parse(sessionStorage.getItem(STORE) || '{}'))
  } catch { return fromUrl }
}

/** the one shared checkout route, with the selection and the campaign attribution */
export function checkoutHref(locale: 'fa' | 'en', utm: Utm, plan?: string, size?: number): string {
  const q = new URLSearchParams()
  if (plan) q.set('plan', plan)
  if (plan && size) q.set('size', String(size))
  for (const [k, v] of Object.entries(utm)) if (v) q.set(k, v)
  const s = q.toString()
  return `/${locale}/checkout${s ? `?${s}` : ''}`
}

type Win = Window & { dataLayer?: unknown[] }
export function trackCampaign(event: 'campaign_view' | 'campaign_cta', detail: Record<string, string | undefined>): void {
  const clean = Object.fromEntries(Object.entries(detail).filter(([, v]) => typeof v === 'string' && SAFE.test(v)))
  try {
    window.dispatchEvent(new CustomEvent('openfund:campaign', { detail: { event, ...clean } }))
    const w = window as Win
    if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event: `openfund_${event}`, ...clean })
  } catch { /* tracking is optional */ }
}
