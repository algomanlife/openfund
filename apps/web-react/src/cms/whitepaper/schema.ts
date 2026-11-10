/* ============================================================
   Whitepaper block schema — ONE declaration used three ways:

   1. localize(): bilingual repository edition → one Directus locale row
      (seed_whitepaper_content.mjs stores blocks per translation, like
      lesson blocks);
   2. pair(): the fa + en Directus rows → one validated bilingual block
      list (the public client). Anything that does not match the schema —
      an unknown block type, a missing translation, a non-localized field
      that differs between locales, an unsafe URL — is rejected, never
      rendered;
   3. validateBlocks(): automated tests prove the bundled edition is
      complete in both languages.

   Rendering is plain React text (no HTML injection), so sanitization
   here means structural validation plus URL allow-listing.
   ============================================================ */
import type { Bi, WpBlock } from './types'

type Locale = 'fa' | 'en'
export type Spec =
  | 'bi' | 'bi?' | 'str' | 'key' | 'bool?' | 'url'
  | { enum: readonly string[]; optional?: boolean }
  | { list: Spec; min?: number }
  | { obj: Record<string, Spec> }

export const STATUS = ['live', 'implemented', 'development', 'planned'] as const
export const MILESTONE = ['completed', 'in_progress', 'planned', 'research'] as const
const status: Spec = { enum: STATUS, optional: true }
const step: Spec = { obj: { title: 'bi', text: 'bi?', status } }

export const BLOCK_SCHEMA: Record<WpBlock['type'], Record<string, Spec>> = {
  lead: { text: 'bi' },
  p: { text: 'bi' },
  h3: { text: 'bi' },
  list: { ordered: 'bool?', items: { list: 'bi' } },
  quote: { text: 'bi' },
  callout: { tone: { enum: ['info', 'principle', 'warning', 'risk'] }, title: 'bi', text: 'bi' },
  features: { items: { list: { obj: { title: 'bi', text: 'bi', status } } } },
  stats: { items: { list: { obj: { value: 'str', label: 'bi', note: 'bi?' } } } },
  definitions: { items: { list: { obj: { term: 'bi', text: 'bi' } } } },
  table: { caption: 'bi', head: { list: 'bi' }, rows: { list: { list: 'bi' } } },
  flow: { label: 'bi', steps: { list: step, min: 2 } },
  architecture: { label: 'bi', layers: { list: { obj: { title: 'bi', nodes: { list: step } } } } },
  mapping: { head: { list: 'bi', min: 3 }, rows: { list: { list: 'bi', min: 3 } } },
  timeline: { items: { list: { obj: { phase: 'bi', title: 'bi', text: 'bi', status: { enum: MILESTONE } } } } },
  chart: { dataset: 'key', interactive: 'bool?' },
  pricing: { caption: 'bi' },
  image: { src: 'url', alt: 'bi', caption: 'bi?' },
  faq: { items: { list: { obj: { q: 'bi', a: 'bi' } } } },
  refs: { keys: { list: 'key' } },
}

export class InvalidContent extends Error {}
const fail = (path: string): never => { throw new InvalidContent(path) }

const KEY = /^[a-z0-9][a-z0-9-]{0,63}$/
/** internal routes, bundled assets or https only — never javascript:, data: or protocol-relative */
export function safeUrl(value: string): boolean {
  if (/^\/(?!\/)[\w\-./~%?=&#]*$/.test(value)) return true
  if (/^assets\/[\w\-./]+$/.test(value)) return true
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password } catch { return false }
}

const isBi = (v: unknown): v is Bi => !!v && typeof v === 'object' && typeof (v as Bi).fa === 'string' && typeof (v as Bi).en === 'string'
const filled = (s: unknown) => typeof s === 'string' && s.trim().length > 0
const absent = (v: unknown) => v === undefined || v === null || v === ''

/** bilingual value → the value one locale row stores */
export function localize(spec: Spec, value: unknown, locale: Locale): unknown {
  if (value === undefined || value === null) return value
  if (spec === 'bi' || spec === 'bi?') return isBi(value) ? value[locale] : value
  if (typeof spec === 'object' && 'list' in spec) return (value as unknown[]).map(v => localize(spec.list, v, locale))
  if (typeof spec === 'object' && 'obj' in spec) {
    const out: Record<string, unknown> = {}
    for (const [k, s] of Object.entries(spec.obj)) {
      const v = localize(s, (value as Record<string, unknown>)[k], locale)
      if (v !== undefined) out[k] = v
    }
    return out
  }
  return value
}

/** fa row value + en row value → one validated bilingual value (throws on mismatch) */
export function pair(spec: Spec, fa: unknown, en: unknown, path = '$'): unknown {
  if (spec === 'bi') return filled(fa) && filled(en) ? { fa: fa as string, en: en as string } : fail(path)
  if (spec === 'bi?') {
    if (absent(fa) && absent(en)) return undefined
    return filled(fa) && filled(en) ? { fa: fa as string, en: en as string } : fail(path)
  }
  if (spec === 'str') return filled(fa) && fa === en ? fa : fail(path)
  if (spec === 'key') return typeof fa === 'string' && fa === en && KEY.test(fa) ? fa : fail(path)
  if (spec === 'url') return typeof fa === 'string' && fa === en && safeUrl(fa) ? fa : fail(path)
  if (spec === 'bool?') {
    if (absent(fa) && absent(en)) return undefined
    return typeof fa === 'boolean' && fa === en ? fa : fail(path)
  }
  if ('enum' in spec) {
    if (spec.optional && absent(fa) && absent(en)) return undefined
    return typeof fa === 'string' && fa === en && spec.enum.includes(fa) ? fa : fail(path)
  }
  if ('list' in spec) {
    if (!Array.isArray(fa) || !Array.isArray(en) || fa.length !== en.length || fa.length < (spec.min ?? 1)) fail(path)
    return (fa as unknown[]).map((v, i) => pair(spec.list, v, (en as unknown[])[i], `${path}[${i}]`))
  }
  if (!fa || !en || typeof fa !== 'object' || typeof en !== 'object') fail(path)
  const out: Record<string, unknown> = {}
  for (const [k, s] of Object.entries(spec.obj)) {
    const v = pair(s, (fa as Record<string, unknown>)[k], (en as Record<string, unknown>)[k], `${path}.${k}`)
    if (v !== undefined) out[k] = v
  }
  return out
}

/** one locale's block row */
export function localizeBlock(block: WpBlock, locale: Locale): Record<string, unknown> {
  return { type: block.type, ...(localize({ obj: BLOCK_SCHEMA[block.type] }, block, locale) as object) }
}

/** paired fa/en block rows → validated bilingual blocks, or null if ANY block is invalid */
export function pairBlocks(faRaw: unknown, enRaw: unknown): WpBlock[] | null {
  const fa = asArray(faRaw), en = asArray(enRaw)
  if (!fa.length || fa.length !== en.length) return null
  try {
    return fa.map((a, i) => {
      const b = en[i] as Record<string, unknown>
      const type = (a as Record<string, unknown>)?.type as WpBlock['type']
      if (!type || type !== b?.type || !Object.hasOwn(BLOCK_SCHEMA, type)) fail(`blocks[${i}].type`)
      return { type, ...(pair({ obj: BLOCK_SCHEMA[type] }, a, b, `blocks[${i}]`) as object) } as WpBlock
    })
  } catch (error) {
    if (error instanceof InvalidContent) return null
    throw error
  }
}

/** test helper: the bilingual edition survives a localize → pair round trip */
export function validateBlocks(blocks: WpBlock[]): string[] {
  const errors: string[] = []
  blocks.forEach((block, i) => {
    if (!Object.hasOwn(BLOCK_SCHEMA, block.type)) { errors.push(`blocks[${i}] unknown type ${block.type}`); return }
    try { pair({ obj: BLOCK_SCHEMA[block.type] }, localizeBlock(block, 'fa'), localizeBlock(block, 'en'), `blocks[${i}]`) }
    catch (error) { errors.push(`${(error as Error).message} (${block.type})`) }
  })
  return errors
}

export function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] } }
  return []
}

/** every reference key a block list points at (refs blocks) */
export function referencedKeys(blocks: WpBlock[]): string[] {
  return blocks.flatMap(block => block.type === 'refs' ? block.keys : [])
}
