/** Directus 11.17.4 visual editor adapter.
 * The Studio iframe speaks { action, data } postMessage:
 * connect → confirm → checkFieldAccess → activateElements, then edit / saved.
 * Attributes are attached only after confirm from the configured CMS origin.
 * Ordinary visitors never receive that message, so they get no editing UI.
 */
import { createElement, type ReactNode } from 'react'
import { setInterfacePreviewReader, interfaceKey } from '../i18n/interfaceContent'
import { acceptPreview, attributesFor, isAllowedCollection, parseAttr, setAttr, surfacePath, targetsFromMessages, targetsFromSurface, uniqueTargets, EDITORIAL_SURFACES, type EditTarget, type MessageRow } from './editorialSurfaces'

type Saved = { key?: string; collection?: string; item?: string | number | null; payload?: Record<string, unknown> }
type Session = {
  confirmed: boolean
  origin: string
  locale: string
  messages: MessageRow[]
  targets: EditTarget[]
  preview: Map<string, Record<string, string>>
  activated: Set<string>
  sent: Set<string>
  accessUnresolved: boolean
}

const session: Session = {
  confirmed: false, origin: '', locale: 'fa', messages: [], targets: [],
  preview: new Map(), activated: new Set(), sent: new Set(), accessUnresolved: false,
}
const listeners = new Set<() => void>()
let onPublished: (() => void) | undefined
let listening = false
let domObserver: MutationObserver | undefined
let scanTimer = 0

function emit() { for (const listener of listeners) listener() }

export function subscribeVisualEditing(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export function isVisualEditingActive(): boolean { return session.confirmed }

function previewValue(locale: string, key: string): string | undefined {
  if (!session.confirmed) return undefined
  return session.preview.get(key)?.[locale]
}

function resolveMessageEdit(contentKey: string): { collection: string; item: string; fields: string[]; mode: 'popover' | 'drawer' } | null {
  const row = session.messages.find(item => item.key === contentKey && item.id != null)
  if (!row || row.id == null) return null
  const translations = row.translations || []
  const current = translations.find(item => item.language_code === session.locale)
  if (current?.id != null) return { collection: 'ui_message_translations', item: String(current.id), fields: ['value'], mode: 'popover' }
  return { collection: 'ui_messages', item: String(row.id), fields: ['translations'], mode: 'drawer' }
}

export function cmsEditAttrs(contentKey: string): Record<string, string> {
  if (!session.confirmed) return {}
  return attributesFor(true, resolveMessageEdit(contentKey), contentKey)
}

export function cmsText(text: ReactNode, contentKey: string): ReactNode {
  const attrs = cmsEditAttrs(contentKey)
  if (!attrs['data-directus']) return text
  return createElement('span', attrs, text)
}

function send(action: string, data?: unknown) {
  if (!session.origin || window.parent === window) return
  window.parent.postMessage({ action, data }, session.origin)
}

function editKey(edit: { collection: string; item: string; fields?: string[] }, contentKey = ''): string {
  return `of:${edit.collection}:${edit.item}:${(edit.fields || []).join(',')}:${contentKey}`
}

function queueAccess(items: Array<{ key: string; collection: string; item: string; fields: string[] }>) {
  const fresh = items.filter(item => item.collection && item.item && !session.sent.has(item.key) && isAllowedCollection(item.collection))
  if (!fresh.length) return
  for (const item of fresh) session.sent.add(item.key)
  send('checkFieldAccess', fresh.map(item => ({ key: item.key, collection: item.collection, item: item.item, fields: item.fields })))
}

function rememberTarget(target: EditTarget) {
  const key = editKey(target, target.contentKey || '')
  queueAccess([{ key, collection: target.collection, item: target.item, fields: target.fields }])
  return key
}

export function editTarget(target: EditTarget) {
  if (!session.confirmed || !isAllowedCollection(target.collection)) return
  const key = rememberTarget(target)
  if (!session.activated.has(key) && !session.accessUnresolved) return
  send('edit', { key, editConfig: { collection: target.collection, item: target.item, fields: target.fields, mode: target.mode }, rect: { x: 16, y: 16, width: 320, height: 48, top: 16, left: 16, right: 336, bottom: 64 } })
}

function catalogTargets(): EditTarget[] {
  const seen = new Set<string>()
  const list: EditTarget[] = []
  for (const target of [...targetsFromMessages(session.messages, session.locale), ...session.targets]) {
    const id = `${target.collection}:${target.item}:${target.fields.join(',')}:${target.contentKey || target.text}`
    if (seen.has(id)) continue
    seen.add(id)
    list.push(target)
  }
  return list
}

export function visualCatalog(): EditTarget[] { return session.confirmed ? catalogTargets() : [] }

function bindText(root: ParentNode, unique: Map<string, EditTarget>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const norm = (value: string) => value.replace(/\s+/g, ' ').trim()
  let node = walker.nextNode()
  while (node) {
    const text = norm(node.textContent || '')
    const parent = node.parentElement
    const target = unique.get(text)
    if (parent && target && target.match === 'text' && !parent.closest('[data-directus],[data-of-key],[data-of-visual-control],script,style,textarea,canvas,svg')) {
      if (norm(parent.textContent || '') === text) {
        parent.setAttribute('data-directus', setAttr(target))
        if (target.contentKey) parent.setAttribute('data-of-key', target.contentKey)
        parent.setAttribute('data-of-edit-key', editKey(target, target.contentKey || ''))
      }
    }
    node = walker.nextNode()
  }
  root.querySelectorAll?.('img').forEach(img => {
    if (img.closest('[data-of-visual-control]') || img.hasAttribute('data-directus')) return
    for (const target of unique.values()) {
      if (target.match === 'file' && img.getAttribute('src')?.includes(target.text)) {
        img.setAttribute('data-directus', setAttr(target))
        img.setAttribute('data-of-edit-key', editKey(target))
      }
    }
  })
}

function scanDom() {
  if (!session.confirmed) return
  const unique = uniqueTargets([...targetsFromMessages(session.messages, session.locale), ...session.targets].filter(target => target.match === 'text' || target.match === 'file'))
  bindText(document.body, unique)
  const items: Array<{ key: string; collection: string; item: string; fields: string[] }> = []
  document.querySelectorAll<HTMLElement>('[data-directus]').forEach(element => {
    if (element.closest('[data-of-visual-control]')) return
    const parsed = parseAttr(element.getAttribute('data-directus') || '')
    if (!parsed || !isAllowedCollection(parsed.collection)) return
    const key = element.getAttribute('data-of-edit-key') || editKey(parsed, element.getAttribute('data-of-key') || '')
    element.setAttribute('data-of-edit-key', key)
    if (session.activated.has(key) || session.accessUnresolved) element.setAttribute('data-of-activated', 'true')
    items.push({ key, collection: parsed.collection, item: parsed.item, fields: parsed.fields })
  })
  for (const target of catalogTargets()) {
    items.push({ key: editKey(target, target.contentKey || ''), collection: target.collection, item: target.item, fields: target.fields })
  }
  queueAccess(items)
  publishFrames()
}

function scheduleScan() {
  window.clearTimeout(scanTimer)
  scanTimer = window.setTimeout(scanDom, 50)
}

function publishFrames() {
  const entries = [...uniqueTargets(session.targets.filter(target => target.text))].map(([, target]) => ({
    text: target.text, attribute: setAttr(target), match: target.match,
  })).slice(0, 4000)
  document.querySelectorAll('iframe').forEach(frame => {
    try { frame.contentWindow?.postMessage({ type: 'openfund-visual-session', entries }, location.origin) } catch { /* cross-origin frame */ }
  })
}

function applySaved(data: Saved) {
  const payload = data.payload || {}
  const item = data.item == null ? '' : String(data.item)
  const updates: Array<{ key: string; locale: string; value: string }> = []
  const fromTranslation = (locale: string, value: unknown, id = item) => {
    const row = session.messages.find(message => (message.translations || []).some(tr => String(tr.id) === id && (!locale || tr.language_code === locale)))
    const tr = row?.translations?.find(entry => String(entry.id) === id)
    const language = locale || tr?.language_code || ''
    if (!row?.key || !language || typeof value !== 'string') return
    updates.push({ key: row.key, locale: language, value })
  }
  if (data.collection === 'ui_message_translations' && typeof payload.value === 'string') fromTranslation('', payload.value)
  if (Array.isArray(payload.translations)) {
    for (const tr of payload.translations) {
      if (!tr || typeof tr !== 'object') continue
      const record = tr as { id?: string | number; language_code?: string; value?: string }
      if (record.language_code && typeof record.value === 'string' && data.collection === 'ui_messages') {
        const row = session.messages.find(message => String(message.id) === item)
        if (row?.key) updates.push({ key: row.key, locale: record.language_code, value: record.value })
      }
    }
  }
  for (const update of updates) {
    const row = session.messages.find(message => message.key === update.key)
    const english = row?.translations?.find(tr => tr.language_code === 'en')?.value || update.value
    const accepted = acceptPreview(update.value, english, value => (value.match(/\$\{[^}]+\}|\{\{[^}]+\}\}|\{[A-Za-z_][\w.]*\}/g) || []).sort())
    if (!accepted) continue
    const bucket = session.preview.get(update.key) || {}
    bucket[update.locale] = accepted
    session.preview.set(update.key, bucket)
  }
  if (payload.status === 'published' || data.collection) onPublished?.()
  emit()
  void refreshContent()
}

async function refreshContent() {
  if (!session.origin) return
  try {
    const response = await fetch(`${session.origin}/items/ui_messages?fields=id,key,namespace,status,content_page,content_routes,translations.id,translations.language_code,translations.value&filter[status][_eq]=published&limit=-1`)
    if (response.ok) {
      const json = await response.json() as { data?: MessageRow[] }
      session.messages = Array.isArray(json.data) ? json.data : []
    }
    const collected: EditTarget[] = []
    for (const surface of EDITORIAL_SURFACES) {
      const result = await fetch(`${session.origin}${surfacePath(surface)}`)
      if (!result.ok) continue
      const json = await result.json() as { data?: unknown }
      collected.push(...targetsFromSurface(surface, json.data, session.locale))
    }
    session.targets = collected
  } catch {
    /* CMS unavailable: bundled copy remains */
  }
  scheduleScan()
  emit()
}

function onMessage(event: MessageEvent) {
  if (session.origin && event.origin === session.origin && event.source === window.parent) {
    const message = event.data as { action?: string; data?: unknown }
    if (!message || typeof message.action !== 'string') return
    if (message.action === 'confirm') {
      session.confirmed = true
      ensureStyles()
      void refreshContent()
      emit()
      window.setTimeout(() => { if (session.activated.size === 0) session.accessUnresolved = true; scheduleScan() }, 1200)
    }
    if (message.action === 'activateElements' && Array.isArray(message.data)) {
      for (const key of message.data) if (typeof key === 'string') session.activated.add(key)
      session.accessUnresolved = false
      scheduleScan()
    }
    if (message.action === 'saved') applySaved((message.data || {}) as Saved)
    return
  }
  if (event.origin !== location.origin) return
  const data = event.data as { type?: string; attribute?: string; rect?: Record<string, number> }
  if (data?.type === 'openfund-visual-hello') { publishFrames(); return }
  if (data?.type !== 'openfund-visual-edit' || !session.confirmed || typeof data.attribute !== 'string') return
  const parsed = parseAttr(data.attribute)
  if (!parsed || !isAllowedCollection(parsed.collection)) return
  const key = editKey(parsed)
  if (!session.activated.has(key) && !session.accessUnresolved) return
  const frame = [...document.querySelectorAll('iframe')].find(item => item.contentWindow === event.source)
  const box = frame?.getBoundingClientRect()
  const rect = data.rect || { x: 0, y: 0, width: 0, height: 0 }
  const left = (box?.left || 0) + (rect.left || rect.x || 0)
  const top = (box?.top || 0) + (rect.top || rect.y || 0)
  send('edit', {
    key, editConfig: parsed, rect: { x: left, y: top, width: rect.width || 0, height: rect.height || 0, top, left, right: left + (rect.width || 0), bottom: top + (rect.height || 0) },
  })
}

function onClick(event: MouseEvent) {
  if (!session.confirmed) return
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('[data-of-visual-control]')) return
  const element = target.closest<HTMLElement>('[data-directus]')
  if (!element) return
  const parsed = parseAttr(element.getAttribute('data-directus') || '')
  if (!parsed || !isAllowedCollection(parsed.collection)) return
  const key = element.getAttribute('data-of-edit-key') || editKey(parsed, element.getAttribute('data-of-key') || '')
  if (!session.activated.has(key) && !session.accessUnresolved) return
  event.preventDefault()
  event.stopPropagation()
  const rect = element.getBoundingClientRect()
  send('edit', { key, editConfig: { collection: parsed.collection, item: parsed.item, fields: parsed.fields, mode: parsed.mode }, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom } })
}

function ensureStyles() {
  if (document.getElementById('of-visual-editing-style')) return
  const style = document.createElement('style')
  style.id = 'of-visual-editing-style'
  style.textContent = '[data-of-activated]{cursor:pointer}[data-of-activated]:hover{outline:1px dashed #6644ff;outline-offset:2px}'
  document.head.appendChild(style)
}

export function syncVisualLocale(locale: string) {
  if (session.locale === locale) return
  session.locale = locale
  if (session.confirmed) void refreshContent()
}

export function startVisualEditing(options: { directusUrl: string; locale: string; onPublished?: () => void }) {
  session.locale = options.locale
  onPublished = options.onPublished
  setInterfacePreviewReader(previewValue)
  if (listening || window.parent === window) return
  let origin = ''
  try { origin = new URL(options.directusUrl).origin } catch { return }
  if (!origin || origin === 'null') return
  session.origin = origin
  listening = true
  window.addEventListener('message', onMessage)
  document.addEventListener('click', onClick, true)
  domObserver = new MutationObserver(() => scheduleScan())
  domObserver.observe(document.body, { childList: true, subtree: true })
  send('connect')
  const navigation = () => send('navigation', { url: location.href, title: document.title })
  navigation()
  window.addEventListener('popstate', navigation)
}

export function renderedContentKey(fa: string, en: string): string {
  return interfaceKey(fa, en)
}
