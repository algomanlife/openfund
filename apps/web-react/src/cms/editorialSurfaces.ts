/** Editorial collections an administrator may click. Financial, permission,
 * payment and trading-rule numeric configuration are intentionally absent.
 */
export const EDITORIAL_LOCALES = ['fa', 'en', 'ar', 'ru', 'zh-CN'] as const
export type EditorialLocale = typeof EDITORIAL_LOCALES[number]

export const FORBIDDEN_EDITORIAL_COLLECTIONS = [
  'challenge_plans', 'orders', 'payments', 'payment_events', 'wallets', 'positions',
  'coupons', 'directus_users', 'gov_proposals', 'gov_votes', 'payouts', 'ledger_entries',
] as const

export type Surface = {
  collection: string
  translationCollection: string
  singleton?: boolean
  textFields: string[]
  jsonTextFields?: string[]
  fileFields?: string[]
  sharedTextFields?: string[]
}

export const EDITORIAL_SURFACES: readonly Surface[] = [
  { collection: 'home_content', translationCollection: 'home_content_translations', singleton: true,
    textFields: ['headline', 'sub', 'note', 'prop_title', 'prop_description', 'prop_cta', 'perpetual_title', 'perpetual_description', 'perpetual_cta', 'seo_title', 'seo_description'],
    fileFields: ['prop_image', 'perpetual_image'] },
  { collection: 'faqs', translationCollection: 'faq_translations', textFields: ['question', 'answer'] },
  { collection: 'faq_categories', translationCollection: 'faq_category_translations', textFields: ['label', 'description'] },
  { collection: 'pages', translationCollection: 'page_translations', textFields: ['title', 'subtitle', 'description', 'seo_title', 'seo_description'] },
  { collection: 'navigation_items', translationCollection: 'navigation_item_translations', textFields: ['label', 'description'] },
  { collection: 'footer_links', translationCollection: 'footer_link_translations', textFields: ['label'] },
  { collection: 'legal_documents', translationCollection: 'legal_document_translations', textFields: ['title'], jsonTextFields: ['paragraphs'] },
  { collection: 'trading_rules', translationCollection: 'trading_rule_translations', textFields: ['title', 'explanation_title', 'explanation_body'], jsonTextFields: ['paragraphs', 'table'] },
  { collection: 'learning_paths', translationCollection: 'learning_path_translations', textFields: ['eyebrow', 'title', 'summary'], jsonTextFields: ['outcomes'] },
  { collection: 'lessons', translationCollection: 'lesson_translations', textFields: ['title', 'summary'], jsonTextFields: ['takeaways', 'blocks'] },
  { collection: 'glossary_terms', translationCollection: 'glossary_term_translations', textFields: ['term', 'short', 'definition'] },
  { collection: 'tools', translationCollection: 'tool_translations', textFields: ['name', 'tagline', 'about', 'method', 'limitations'], jsonTextFields: ['assumptions'] },
  { collection: 'developer_docs', translationCollection: 'developer_doc_translations', textFields: ['title', 'body'] },
  { collection: 'referral_content', translationCollection: 'referral_content_translations', singleton: true,
    textFields: ['hero_eyebrow', 'hero_title', 'hero_accent', 'hero_intro', 'status_notice', 'dashboard_title', 'dashboard_intro', 'cta_title', 'cta_text', 'cta_primary', 'cta_secondary', 'seo_title', 'seo_description'],
    jsonTextFields: ['benefits', 'stages', 'sections', 'faq', 'pending_decisions', 'dashboard_columns'] },
  { collection: 'governance_milestones', translationCollection: 'governance_milestone_translations', textFields: ['title', 'body'] },
  { collection: 'governance_content_blocks', translationCollection: 'governance_content_block_translations', textFields: ['body'] },
  { collection: 'whitepaper_documents', translationCollection: 'whitepaper_document_translations', textFields: ['title', 'subtitle', 'abstract', 'revision_note', 'seo_title', 'seo_description'] },
  { collection: 'whitepaper_chapters', translationCollection: 'whitepaper_chapter_translations', textFields: ['kicker', 'title', 'summary'], jsonTextFields: ['blocks'] },
  { collection: 'whitepaper_datasets', translationCollection: 'whitepaper_dataset_translations', textFields: ['title', 'caption', 'note'], jsonTextFields: ['labels'] },
  { collection: 'whitepaper_references', translationCollection: 'whitepaper_reference_translations', textFields: ['note'] },
  { collection: 'terminal_sections', translationCollection: 'terminal_section_translations', textFields: ['title', 'body'], fileFields: ['illustration'] },
  { collection: 'site_settings', translationCollection: 'site_settings', singleton: true, textFields: [], sharedTextFields: ['maintenance_message'] },
]

const SKIP_JSON_KEYS = new Set(['slug', 'id', 'key', 'href', 'url', 'icon', 'image', 'type', 'kind', 'status', 'format', 'symbol', 'ticker', 'code', 'target', 'anchor', 'unit', 'value', 'values', 'role', 'variant', 'tone'])

export type EditMode = 'drawer' | 'modal' | 'popover'
export type EditTarget = {
  text: string
  collection: string
  item: string
  fields: string[]
  mode: EditMode
  match: 'text' | 'file'
  localesPresent: string[]
  contentKey?: string
  page?: string
  route?: string
}

export function surfacePath(surface: Surface): string {
  const translated = [...surface.textFields, ...(surface.jsonTextFields || [])]
  const translationFields = translated.length ? ['id', 'language_code', ...translated].map(field => `translations.${field}`) : []
  const fields = ['id', ...(surface.fileFields || []), ...(surface.sharedTextFields || []), ...translationFields]
  const filter = surface.singleton ? '' : '&filter[status][_eq]=published'
  return `/items/${surface.collection}?fields=${fields.join(',')}${filter}&limit=-1`
}

export function stringsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    const text = value.trim()
    if (text) out.push(text)
    return out
  }
  if (Array.isArray(value)) {
    for (const item of value) stringsIn(item, out)
    return out
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SKIP_JSON_KEYS.has(key)) continue
      stringsIn(item, out)
    }
  }
  return out
}

type Row = { id?: string | number; translations?: Array<Record<string, unknown>> | null } & Record<string, unknown>

function rowsOf(data: unknown): Row[] {
  if (Array.isArray(data)) return data.filter(row => row && typeof row === 'object') as Row[]
  if (data && typeof data === 'object') return [data as Row]
  return []
}

export function targetsFromSurface(surface: Surface, data: unknown, locale: string): EditTarget[] {
  const targets: EditTarget[] = []
  for (const row of rowsOf(data)) {
    if (row.id == null) continue
    const parentId = String(row.id)
    const translations = Array.isArray(row.translations) ? row.translations : []
    const localesPresent = translations.map(item => String(item.language_code || '')).filter(Boolean)
    const current = translations.find(item => item.language_code === locale) || null
    if (current?.id != null) {
      const item = String(current.id)
      for (const field of surface.textFields) {
        if (typeof current[field] !== 'string' || !current[field].trim()) continue
        targets.push({ text: current[field].trim(), collection: surface.translationCollection, item, fields: [field], mode: 'popover', match: 'text', localesPresent })
      }
      for (const field of surface.jsonTextFields || []) {
        for (const text of stringsIn(current[field])) {
          targets.push({ text, collection: surface.translationCollection, item, fields: [field], mode: 'drawer', match: 'text', localesPresent })
        }
      }
    }
    for (const field of surface.sharedTextFields || []) {
      if (typeof row[field] !== 'string' || !row[field].trim()) continue
      targets.push({ text: row[field].trim(), collection: surface.collection, item: parentId, fields: [field], mode: 'popover', match: 'text', localesPresent: [] })
    }
    for (const field of surface.fileFields || []) {
      const fileId = row[field]
      if (typeof fileId !== 'string' || !/^[0-9a-f-]{36}$/i.test(fileId)) continue
      targets.push({ text: fileId, collection: surface.collection, item: parentId, fields: [field], mode: 'modal', match: 'file', localesPresent })
    }
  }
  return targets
}

export type MessageRow = {
  id?: string | number
  key?: string
  namespace?: string
  status?: string
  content_page?: string
  content_routes?: string
  translations?: Array<{ id?: string | number; language_code?: string; value?: string }> | null
}

export function targetsFromMessages(rows: MessageRow[], locale: string): EditTarget[] {
  const targets: EditTarget[] = []
  for (const row of rows) {
    if (row.status && row.status !== 'published') continue
    if (row.id == null || !row.key) continue
    const translations = row.translations || []
    const localesPresent = translations.map(item => item.language_code || '').filter(Boolean)
    const current = translations.find(item => item.language_code === locale)
    const text = typeof current?.value === 'string' ? current.value.trim() : ''
    if (current?.id != null && text) {
      targets.push({
        text, collection: 'ui_message_translations', item: String(current.id), fields: ['value'], mode: 'popover', match: 'text',
        localesPresent, contentKey: row.key, page: row.content_page || row.namespace || '', route: row.content_routes || '',
      })
    } else {
      targets.push({
        text, collection: 'ui_messages', item: String(row.id), fields: ['translations'], mode: 'drawer', match: 'text',
        localesPresent, contentKey: row.key, page: row.content_page || row.namespace || '', route: row.content_routes || '',
      })
    }
  }
  return targets
}

/** First unique text wins. A repeated text with a different record is omitted. */
export function uniqueTargets(targets: EditTarget[]): Map<string, EditTarget> {
  const map = new Map<string, EditTarget | null>()
  for (const target of targets) {
    if (!target.text) continue
    const previous = map.get(target.text)
    if (previous === undefined) map.set(target.text, target)
    else if (previous && (previous.collection !== target.collection || previous.item !== target.item || previous.fields.join(',') !== target.fields.join(','))) map.set(target.text, null)
  }
  const unique = new Map<string, EditTarget>()
  for (const [text, target] of map) if (target) unique.set(text, target)
  return unique
}

export function setAttr(edit: { collection: string; item: string; fields?: string[]; mode?: EditMode }): string {
  const parts: string[] = []
  const fields = edit.fields?.length ? edit.fields.join(',') : ''
  for (const [key, value] of [['collection', edit.collection], ['item', edit.item], ['fields', fields], ['mode', edit.mode || '']] as const) {
    if (value) parts.push(`${key}:${value}`)
  }
  return parts.join(';')
}

export function parseAttr(value: string): { collection: string; item: string; fields: string[]; mode?: EditMode } | null {
  const result: Record<string, string> = {}
  for (const pair of value.split(';')) {
    const index = pair.indexOf(':')
    if (index <= 0) continue
    const key = pair.slice(0, index).trim()
    const raw = pair.slice(index + 1).trim()
    if (!['collection', 'item', 'fields', 'mode'].includes(key) || !raw) continue
    result[key] = raw
  }
  if (!result.collection || !result.item) return null
  const mode = result.mode === 'drawer' || result.mode === 'modal' || result.mode === 'popover' ? result.mode : undefined
  return { collection: result.collection, item: result.item, fields: result.fields ? result.fields.split(',').map(field => field.trim()).filter(Boolean) : [], mode }
}

export function attributesFor(active: boolean, edit: { collection: string; item: string; fields?: string[]; mode?: EditMode } | null, contentKey: string): Record<string, string> {
  if (!active || !contentKey) return {}
  const attrs: Record<string, string> = { 'data-of-key': contentKey }
  if (edit && isAllowedCollection(edit.collection)) attrs['data-directus'] = setAttr(edit)
  return attrs
}

export function isAllowedCollection(collection: string): boolean {
  if ((FORBIDDEN_EDITORIAL_COLLECTIONS as readonly string[]).includes(collection)) return false
  if (collection === 'ui_messages' || collection === 'ui_message_translations') return true
  return EDITORIAL_SURFACES.some(surface => surface.collection === collection || surface.translationCollection === collection)
}

export function missingLocales(present: readonly string[]): string[] {
  return EDITORIAL_LOCALES.filter(locale => !present.includes(locale))
}

/** Plain-text preview values. Rejects placeholder drift and oversized or empty strings. */
export function acceptPreview(value: unknown, english: string, placeholders: (value: string) => string[]): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  if (!text || text.length > 20000) return undefined
  if (JSON.stringify(placeholders(text)) !== JSON.stringify(placeholders(english))) return undefined
  return text
}
