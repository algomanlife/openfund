/**
 * Unicode-aware search normalization for Persian and English text.
 *
 * Persian text typed by users arrives in many encodings of the same visual
 * letter: Persian vs Arabic yeh/kaf, hamza variants, ZWNJ vs space, Persian vs
 * Latin digits, Arabic diacritics and tatweel. Everything is folded to one
 * canonical form before matching, so a word spelled with Arabic yeh, with a
 * ZWNJ removed or with Persian digits still finds its Persian haystack and
 * vice versa. Pure module — unit tested from Node.
 */

const DIACRITICS = /[\u064B-\u0652\u0670\u06D6-\u06ED]/g
const TATWEEL = /\u0640/g
const CONTROLS = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g

const ARABIC_TO_PERSIAN: Array<[RegExp, string]> = [
  [/[\u064A\u0649]/g, 'ی'], /* Arabic yeh and alef maksura → Persian yeh */
  [/\u0643/g, 'ک'],        /* Arabic kaf → Persian kaf */
  [/\u0629/g, 'ه'],        /* teh marbuta → heh */
  [/\u0623\u0625\u0622/g, 'ا'], /* hamza-carrying alefs → plain alef */
  [/\u0626/g, 'ی'],
  [/\u0624/g, 'و'],
  [/\u0640/g, ''],
]

/** map Persian/Arabic-Indic digit characters to their Latin counterparts */
function foldDigits(value: string): string {
  let out = value
  const persian = '۰۱۲۳۴۵۶۷۸۹'
  const arabic = '٠١٢٣٤٥٦٧٨٩'
  out = out.replace(/[۰-۹]/g, ch => String(persian.indexOf(ch)))
  out = out.replace(/[٠-٩]/g, ch => String(arabic.indexOf(ch)))
  return out
}

/** canonical, comparable form of a query or a haystack string */
export function normalizeText(value: string): string {
  let out = value.toLowerCase()
  out = foldDigits(out)
  for (const [pattern, replacement] of ARABIC_TO_PERSIAN) out = out.replace(pattern, replacement)
  out = out.replace(DIACRITICS, '')
  out = out.replace(TATWEEL, '')
  out = out.replace(CONTROLS, '')
  out = out.replace(/[\u0640]/g, '')
  out = out.replace(/[\u200C\u00A0\s]+/g, ' ') /* ZWNJ, NBSP and runs of spaces → one space */
  out = out.replace(/[.,؛;:!?؟«»"'()[\]{}%٪_\-–—]/g, ' ')
  return out.trim().replace(/\s+/g, ' ')
}

/** haystack tokens for prefix matching (better Persian recall than substring only) */
export function tokenize(value: string): string[] {
  return normalizeText(value).split(' ').filter(Boolean)
}

/** does the haystack contain the query? token-wise AND, substring OR prefix */
export function matchesQuery(query: string, haystack: string): boolean {
  const q = normalizeText(query)
  if (!q) return true
  const h = normalizeText(haystack)
  if (!h) return false
  if (h.includes(q)) return true
  const queryTokens = q.split(' ')
  return queryTokens.every(token => {
    if (h.includes(token)) return true
    /* prefix match inside words finds inflected Persian forms */
    return tokenize(haystack).some(word => word.startsWith(token) && token.length >= 2)
  })
}

