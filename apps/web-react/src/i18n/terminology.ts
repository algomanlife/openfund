/* Approved Persian trading terminology. Repository dictionaries already use
   these terms; this normaliser also applies them to CMS-published text (the
   website interface overrides and the terminal workspace dictionary), so a
   content edit cannot reintroduce a prohibited label. Only display text is
   rewritten — translation keys, API fields and identifiers are untouched. */
export const PERSIAN_TERMS: ReadonlyArray<readonly [prohibited: string, approved: string]> = [
  ['انتری', 'نقطه ورود'],
]
const PATTERNS = PERSIAN_TERMS.map(([bad, good]) => [new RegExp(bad, 'g'), good] as const)

export function normalizePersianTerms(value: string): string {
  let out = value
  for (const [pattern, good] of PATTERNS) out = out.replace(pattern, good)
  return out
}

/** Apply to the `fa` member of a `{ key: { fa, en, … } }` dictionary. */
export function normalizeDictionary<T extends Record<string, unknown>>(dictionary: T): T {
  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(dictionary || {})) {
    if (entry && typeof entry === 'object' && typeof (entry as { fa?: unknown }).fa === 'string')
      out[key] = { ...(entry as object), fa: normalizePersianTerms((entry as { fa: string }).fa) }
    else out[key] = entry
  }
  return out as T
}
