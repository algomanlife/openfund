/* ============================================================
   Bilingual records → every supported locale.

   Editorial content (repository seeds and Directus rows) is authored as
   `{ fa, en }` records and read at call sites as `record[locale]`.
   `localizeRecords` gives each such record lazy, non-enumerable `ar`, `ru`
   and `zh-CN` properties resolved from:
     1. a Directus translation row for that locale, when the CMS has one;
     2. the reviewed translation of the English source (i18n/content/*.json).
   A string with neither is NOT silently replaced by English: it is reported
   as a miss (`reportMiss`), shown in English with a visible page notice, and
   fails the locale acceptance tests.
   ============================================================ */
import type { AddedLocale } from './locales'
import { translateSource } from './messages'

export const ADDED_LOCALES: readonly AddedLocale[] = ['ar', 'ru', 'zh-CN']

/** record → Directus-provided values for an added locale (same shape as `en`) */
const cmsRows = new WeakMap<object, Partial<Record<AddedLocale, unknown>>>()
const visited = new WeakSet<object>()

/** Attach CMS-provided added-locale values to a bilingual record. */
export function attachCmsTranslation(record: object, locale: AddedLocale, value: unknown) {
  const rows = cmsRows.get(record) || {}
  rows[locale] = value
  cmsRows.set(record, rows)
}

function overlay(base: unknown, override: unknown): unknown {
  if (override == null) return base
  if (typeof base === 'string') return typeof override === 'string' && override.trim() ? override : base
  if (Array.isArray(base)) return Array.isArray(override) && override.length === base.length ? base.map((v, i) => overlay(v, override[i])) : base
  if (base && typeof base === 'object' && typeof override === 'object') {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
    for (const key of Object.keys(out)) out[key] = overlay(out[key], (override as Record<string, unknown>)[key])
    return out
  }
  return base
}

/** Translate every string leaf of an English value (string / array / object). */
export function translateTree(locale: AddedLocale, value: unknown, pathHint = ''): unknown {
  if (typeof value === 'string') return translateSource(locale, value, pathHint)
  if (Array.isArray(value)) return value.map(v => translateTree(locale, v, pathHint))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value)) out[key] = NON_TEXT_KEYS.has(key) ? v : translateTree(locale, v, key)
    return out
  }
  return value
}

/* structural fields inside bilingual objects that are identifiers, not prose */
const NON_TEXT_KEYS = new Set(['slug', 'id', 'key', 'kind', 'href', 'url', 'icon', 'image', 'type', 'variant', 'tone', 'status', 'format', 'symbol', 'ticker', 'code', 'target', 'anchor', 'unit'])

const isBilingual = (o: Record<string, unknown>) =>
  Object.prototype.hasOwnProperty.call(o, 'fa') && Object.prototype.hasOwnProperty.call(o, 'en') &&
  typeof o.en === typeof o.fa && o.en !== null

/** Recursively add lazy added-locale getters to every `{fa, en}` record. Idempotent; returns `value`. */
export function localizeRecords<T>(value: T): T {
  walk(value)
  return value
}

function walk(value: unknown) {
  if (!value || typeof value !== 'object' || visited.has(value as object)) return
  visited.add(value as object)
  if (Array.isArray(value)) { value.forEach(walk); return }
  if (Object.isFrozen(value)) return
  const record = value as Record<string, unknown>
  if (isBilingual(record)) {
    for (const locale of ADDED_LOCALES) {
      if (Object.prototype.hasOwnProperty.call(record, locale)) continue
      Object.defineProperty(record, locale, {
        configurable: true, enumerable: false,
        get() { return overlay(translateTree(locale, record.en), cmsRows.get(record)?.[locale]) },
      })
    }
  }
  for (const key of Object.keys(record)) walk(record[key])
}
