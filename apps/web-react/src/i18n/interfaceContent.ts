/** Published editorial overrides for the existing bilingual pick() pipeline.
 * Values are plain text; no HTML, financial values or executable links are read.
 */
export function interfaceKey(fa: string, en: string): string {
  const source = JSON.stringify([fa, en])
  let a = 2166136261, b = 5381
  for (let i = 0; i < source.length; i++) {
    a = Math.imul(a ^ source.charCodeAt(i), 16777619)
    b = Math.imul(b, 33) ^ source.charCodeAt(i)
  }
  return `react.${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`
}
export function placeholders(value: string): string[] {
  return (value.match(/\$\{[^}]+\}|\{\{[^}]+\}\}|\{[A-Za-z_][\w.]*\}/g) || []).sort()
}
let published: Record<string, Record<string, string>> = Object.create(null)
export function installInterfaceContent(rows: unknown): void {
  const next: typeof published = Object.create(null)
  if (Array.isArray(rows)) for (const row of rows) {
    if (!row || row.status !== 'published' || row.namespace !== 'react' || !/^react\.[a-f0-9]{16}$/.test(row.key)) continue
    if (!Array.isArray(row.translations)) continue
    const values: Record<string, string> = Object.create(null)
    for (const tr of row.translations) {
      if (!['fa', 'en', 'ar', 'ru', 'zh-CN'].includes(tr?.language_code) || typeof tr.value !== 'string' || !tr.value.trim() || tr.value.length > 20000) continue
      values[tr.language_code] = tr.value
    }
    next[row.key] = values
  }
  published = next // replacement also removes unpublished/archived entries
}
export function interfaceOverride(locale: string, fa: string, en: string): string | undefined {
  // Already-interpolated values are deliberately not pattern-matched: dynamic
  // account data must never be mistaken for editable content.
  const value = published[interfaceKey(fa, en)]?.[locale]
  if (value === undefined || JSON.stringify(placeholders(value)) !== JSON.stringify(placeholders(en))) return undefined
  return value
}

const recordSources = new WeakMap<object, { fa: string; en: string }>()
export const interfaceSource = (record: object) => recordSources.get(record)

/** For repository-authored bilingual records only. Dedicated editorial CMS
 * fetchers keep their own collection authority and must not call this helper.
 */
export function interfaceRecord<T extends { fa: string; en: string }>(record: T): T {
  if (recordSources.has(record)) return record
  const { fa, en } = record
  recordSources.set(record, { fa, en })
  Object.defineProperties(record, {
    fa: { configurable: true, enumerable: true, get: () => interfaceOverride('fa', fa, en) ?? fa },
    en: { configurable: true, enumerable: true, get: () => interfaceOverride('en', fa, en) ?? en },
  })
  return record
}
