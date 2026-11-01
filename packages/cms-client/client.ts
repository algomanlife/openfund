/**
 * Openfund CMS client (packages/cms-client contract, bundled copy).
 *
 * Typed, minimal integration layer between the React shell and Directus.
 * Responsibilities (see docs/backstage/README.md):
 *  - fetch published ui_messages (landing + terminal namespaces) in ONE request
 *  - build the maps the legacy runtime expects:
 *      landing : { faSourceText: enValue }      — consumed by locale.js (ofT)
 *      terminal: { i18nKey: { fa, en } }        — merged into terminal.js I18N
 *  - hard timeout + silent fallback: the app stays fully usable when the
 *    backstage is unavailable (static translations.json is the base)
 *
 * NO admin tokens ever live here — only the public read endpoint.
 */
export interface CmsTranslations {
  landing: Record<string, string>
  terminal: Record<string, { fa: string; en: string }>
}

const DIRECTUS_URL = ((import.meta.env.VITE_DIRECTUS_URL as string | undefined) || 'http://localhost:8055').replace(/\/+$/, '')
const TIMEOUT_MS = 2500

export function directusUrl(): string {
  return DIRECTUS_URL
}

interface RawMessage {
  key: string
  namespace: string
  translations: { language_code: string; value: string }[] | null
}

export async function fetchCmsTranslations(timeout = TIMEOUT_MS): Promise<CmsTranslations | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const fields = 'key,namespace,translations.language_code,translations.value'
    const url = `${DIRECTUS_URL}/items/ui_messages?fields=${fields}&filter[status][_eq]=published&limit=-1`
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    const json = await res.json() as { data: RawMessage[] }
    if (!Array.isArray(json.data)) return null
    const out: CmsTranslations = { landing: {}, landingFa: {}, terminal: {} }
    for (const m of json.data) {
      const tr = { fa: '', en: '' }
      for (const t of m.translations || []) {
        if (t.language_code === 'fa') tr.fa = t.value
        else if (t.language_code === 'en') tr.en = t.value
      }
      if (m.namespace === 'landing') {
        /* ofT contract: en replacement keyed by the (current) fa source text.
           fa map lets the editor change the PERSIAN text itself too. */
        if (tr.fa && tr.en) out.landing[m.key] = tr.en
        if (tr.fa && tr.fa !== m.key) out.landingFa[m.key] = tr.fa
      } else if (m.namespace === 'terminal' || m.namespace === 'common') {
        out.terminal[m.key] = { fa: tr.fa || tr.en, en: tr.en || tr.fa }
      }
    }
    if (import.meta.env.DEV && (Object.keys(out.landing).length + Object.keys(out.terminal).length) === 0) {
      console.warn('[cms] Directus reachable but empty — using static fallback')
      return null
    }
    return out
  } catch {
    /* Directus unavailable / timeout — silent fallback to static files */
    return null
  } finally {
    clearTimeout(timer)
  }
}
