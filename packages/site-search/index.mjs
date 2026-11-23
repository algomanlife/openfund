/* Site search core shared by the backend index (apps/backend/site-search.js),
 * the command palette and the results page (apps/web-react/src/features/search).
 * One normalization and one matcher, so the server's analytics see the same
 * query the browser searched with. Pure functions, no dependencies.
 *
 * Normalization (ADR 0052):
 *   - Arabic yeh U+064A and alef maksura U+0649 → Persian yeh U+06CC,
 *     Arabic kaf U+0643 → keheh U+06A9 (and hamza/teh marbuta variants)
 *   - ZWNJ (U+200C) and other joiners count as a space
 *   - diacritics are removed (Arabic harakat, tatweel, Latin accents)
 *   - Persian (U+06F0–U+06F9) and Arabic-Indic (U+0660–U+0669) digits become 0–9
 *   - case folded, whitespace collapsed
 */

const ARABIC_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0640]/u
const COMBINING = /\p{M}/u
const JOINERS = /[​-‍⁠﻿­]/u
const SPACE = /[\s  -   　]/u
const LETTERS = { '\u064A': '\u06CC', '\u0649': '\u06CC', '\u0626': '\u06CC', '\u0643': '\u06A9', '\u06C0': '\u0647', '\u0629': '\u0647', '\u0623': '\u0627', '\u0625': '\u0627', '\u0622': '\u0627', '\u0671': '\u0627', '\u0624': '\u0648' }

/** one source character → its normalized form ('' when it is dropped) */
function normalizeChar(c) {
  if (JOINERS.test(c) || SPACE.test(c)) return ' '
  if (ARABIC_MARKS.test(c)) return ''
  const code = c.codePointAt(0)
  if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0)
  if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660)
  if (LETTERS[c]) return LETTERS[c]
  let out = ''
  for (const d of c.normalize('NFKD')) if (!COMBINING.test(d)) out += d
  return out.toLowerCase()
}

/** Normalized text plus, for each output character, the index of the source
 *  character it came from (used to highlight matches in the original). */
export function normalizeWithMap(input) {
  const s = String(input ?? '')
  let text = '', map = [], i = 0, space = true
  for (const c of s) {
    const n = normalizeChar(c)
    for (const ch of n) {
      if (ch === ' ') { if (!space) { text += ' '; map.push(i); space = true } }
      else { text += ch; map.push(i); space = false }
    }
    i += c.length
  }
  if (text.endsWith(' ')) { text = text.slice(0, -1); map.pop() }
  return { text, map }
}

export const normalizeText = input => normalizeWithMap(input).text

/** query tokens: normalized words, punctuation split, at most 12 */
export function tokenize(input) {
  return normalizeText(input).split(/[^\p{L}\p{N}]+/u).filter(Boolean).slice(0, 12)
}

/** Damerau–Levenshtein distance with an early exit above `max` */
export function editDistance(a, b, max = 2) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  const al = a.length, bl = b.length
  let prev2 = null, prev = Array.from({ length: bl + 1 }, (_, j) => j)
  for (let i = 1; i <= al; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      cur[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev2 = prev; prev = cur
  }
  return prev[bl]
}

/** typo budget by token length: none below 4, one up to 7, two from 8 */
export const typoBudget = token => (token.length < 4 ? 0 : token.length < 8 ? 1 : 2)

/** Synonym groups (each an array of phrases) → a lookup from a normalized
 *  token to the other normalized tokens of its groups. */
export function synonymLookup(groups) {
  const lookup = new Map()
  for (const group of Array.isArray(groups) ? groups : []) {
    const terms = [...new Set((Array.isArray(group) ? group : []).map(normalizeText).filter(Boolean))]
    for (const t of terms) {
      const set = lookup.get(t) || new Set()
      for (const o of terms) if (o !== t) set.add(o)
      lookup.set(t, set)
    }
  }
  return lookup
}

function prepare(entry) {
  if (entry.__n) return entry.__n
  const title = normalizeText(entry.title), body = normalizeText([entry.snippet, ...(entry.keywords || [])].join(' '))
  const words = [...new Set((title + ' ' + body).split(/[^\p{L}\p{N}]+/u).filter(Boolean))]
  Object.defineProperty(entry, '__n', { value: { title, body, words }, enumerable: false })
  return entry.__n
}

/** best score of one query token (or its synonyms) against an entry */
function tokenScore(token, alternatives, n) {
  let best = 0
  for (const t of [token, ...alternatives]) {
    const syn = t !== token ? 0.9 : 1
    if (n.title === t) best = Math.max(best, 12 * syn)
    else if (n.title.startsWith(t)) best = Math.max(best, 9 * syn)
    if (new RegExp(`(^|[^\\p{L}\\p{N}])${escape(t)}`, 'u').test(n.title)) best = Math.max(best, 7 * syn)
    else if (n.title.includes(t)) best = Math.max(best, 5 * syn)
    if (n.body.includes(t)) best = Math.max(best, 3 * syn)
    if (best >= 7) continue
    const budget = typoBudget(t)
    if (budget) for (const w of n.words) {
      if (editDistance(t, w.slice(0, Math.max(t.length, w.length)), budget) <= budget || (w.length > t.length && editDistance(t, w.slice(0, t.length), budget) <= Math.min(1, budget))) {
        best = Math.max(best, 2 * syn); break
      }
    }
  }
  return best
}
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Ranked matches for `query`. Every query token must match (a synonym or a
 *  typo within budget counts). `kinds` filters by entry kind. */
export function search(entries, query, { synonyms = new Map(), kinds = null, limit = Infinity } = {}) {
  const qTokens = tokenize(query)
  if (!qTokens.length) return []
  const phrase = qTokens.join(' ')
  const out = []
  for (const entry of entries) {
    if (kinds && !kinds.includes(entry.kind)) continue
    const n = prepare(entry)
    let score = 0
    let ok = true
    for (const t of qTokens) {
      const s = tokenScore(t, [...(synonyms.get(t) || [])], n)
      if (!s) { ok = false; break }
      score += s
    }
    if (!ok) {
      /* a multi-word synonym ("prop firm" ↔ "funded") matches as a whole phrase */
      const alt = [...(synonyms.get(phrase) || [])]
      if (!alt.length) continue
      score = Math.max(...alt.map(a => tokenScore(a, [], n)))
      if (!score) continue
    }
    if (n.title.includes(phrase)) score += 4
    out.push({ entry, score: score + (entry.boost || 0) })
  }
  out.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
  return out.slice(0, limit).map(r => r.entry)
}

/** Highlight ranges [start, end) in the ORIGINAL `text` for the query tokens
 *  (exact substring matches after normalization; merged, sorted). */
export function highlightRanges(text, query) {
  const { text: norm, map } = normalizeWithMap(text)
  const ranges = []
  for (const t of tokenize(query)) {
    let from = 0, at
    while (t && (at = norm.indexOf(t, from)) !== -1) {
      const start = map[at], last = map[at + t.length - 1]
      const end = last + (String(text).codePointAt(last) > 0xFFFF ? 2 : 1)
      ranges.push([start, end]); from = at + t.length
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged = []
  for (const r of ranges) {
    const top = merged[merged.length - 1]
    if (top && r[0] <= top[1]) top[1] = Math.max(top[1], r[1]); else merged.push([...r])
  }
  return merged
}

export const MAX_QUERY_LENGTH = 80

/** The query as stored by analytics: personal identifiers masked, then
 *  normalized and capped. Returns '' when nothing searchable remains. */
export function maskQuery(input) {
  let s = String(input ?? '').slice(0, 400)
  s = s.replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu, ' [email] ')
  s = s.replace(/\b0x[0-9a-fA-F]{64}\b/g, ' [hash] ')
  s = s.replace(/\b0x[0-9a-fA-F]{40}\b/g, ' [wallet] ')
  s = s.replace(/\b0x[0-9a-fA-F]{8,}\b/g, ' [hash] ')
  s = s.replace(/\b(bc1|tb1)[02-9ac-hj-np-z]{20,}\b/gi, ' [wallet] ')
  s = s.replace(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, ' [wallet] ')
  s = s.replace(/\b[0-9a-fA-F]{32,}\b/g, ' [hash] ')
  /* phone numbers: 7+ digits in any script, optional +, spaces, dots, dashes, brackets */
  s = s.replace(/\+?[\d\u06F0-\u06F9\u0660-\u0669][\d\u06F0-\u06F9\u0660-\u0669\s().-]{5,}[\d\u06F0-\u06F9\u0660-\u0669]/gu, m => (m.replace(/[^\d\u06F0-\u06F9\u0660-\u0669]/gu, '').length >= 7 ? ' [phone] ' : m))
  const n = normalizeText(s).replace(/\[ ?(email|hash|wallet|phone) ?\]/g, '[$1]')
  return [...n].slice(0, MAX_QUERY_LENGTH).join('').trim()
}
