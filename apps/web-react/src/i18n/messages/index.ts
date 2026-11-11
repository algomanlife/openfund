import { ar } from './ar'
import { ru } from './ru'
import { zhCN } from './zh-CN'

type Dictionary = Record<string, string>
const DICTIONARIES: Record<'ar' | 'ru' | 'zh-CN', Dictionary> = { ar, ru, 'zh-CN': zhCN }

/* Call sites that interpolate (`Balance · ${unit}`) reach the lookup with
   the value already substituted, so keys containing `${…}` are matched as
   templates and their captured values are re-inserted in order. */
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const TEMPLATES = Object.fromEntries(Object.entries(DICTIONARIES).map(([locale, dict]) => [locale,
  Object.entries(dict).filter(([key]) => key.includes('${')).map(([key, value]) => ({
    pattern: new RegExp('^' + key.split(/\$\{[^}]+\}/).map(escape).join('(.+?)') + '$', 's'),
    parts: value.split(/\$\{[^}]+\}/),
  }))])) as Record<keyof typeof DICTIONARIES, { pattern: RegExp; parts: string[] }[]>

type Added = keyof typeof DICTIONARIES

/* ---- editorial content dictionaries (i18n/content/<locale>.json) ----
   Large, so each loads on demand; AppFrame waits for the route locale's
   dictionary before rendering, so no English flash and no false misses. */
const CONTENT: Partial<Record<Added, Dictionary>> = {}
const CONTENT_TEMPLATES: Partial<Record<Added, { pattern: RegExp; parts: string[] }[]>> = {}
const LOADERS: Record<Added, () => Promise<{ default: Dictionary }>> = {
  ar: () => import('../content/ar.json'),
  ru: () => import('../content/ru.json'),
  'zh-CN': () => import('../content/zh-CN.json'),
}
const pendingLoads: Partial<Record<Added, Promise<void>>> = {}
export const contentLoaded = (locale: string) => locale === 'fa' || locale === 'en' || Boolean(CONTENT[locale as Added])
export function ensureLocaleContent(locale: string): Promise<void> {
  if (contentLoaded(locale)) return Promise.resolve()
  const key = locale as Added
  return pendingLoads[key] ||= LOADERS[key]().then(module => {
    const dict = module.default
    CONTENT[key] = dict
    CONTENT_TEMPLATES[key] = templatesOf(dict)
  })
}
function templatesOf(dict: Dictionary) {
  return Object.entries(dict).filter(([key]) => key.includes('${')).map(([key, value]) => ({
    pattern: new RegExp('^' + key.split(/\$\{[^}]+\}/).map(escape).join('(.+?)') + '$', 's'),
    parts: value.split(/\$\{[^}]+\}/),
  }))
}
function applyTemplates(list: { pattern: RegExp; parts: string[] }[] | undefined, english: string) {
  for (const t of list || []) {
    const m = t.pattern.exec(english)
    if (m) return t.parts.reduce((out, part, i) => out + part + (i < m.length - 1 ? m[i + 1] : ''), '')
  }
  return undefined
}

export function lookup(locale: Added, english: string): string | undefined {
  const direct = DICTIONARIES[locale][english] ?? CONTENT[locale]?.[english]
  if (direct !== undefined) return direct
  const trimmed = english.trim()
  if (trimmed !== english) {
    const inner = DICTIONARIES[locale][trimmed] ?? CONTENT[locale]?.[trimmed]
    if (inner !== undefined) return english.replace(trimmed, inner)
  }
  const templated = applyTemplates(TEMPLATES[locale], english) ?? applyTemplates(CONTENT_TEMPLATES[locale], english)
  if (templated !== undefined) return templated
  /* display copy set in capitals in the markup (eyebrows, taglines) */
  if (trimmed === trimmed.toUpperCase() && /[A-Z]{3}/.test(trimmed)) {
    const hit = caseless(locale).get(trimmed.toLowerCase())
    if (hit !== undefined) return english.replace(trimmed, locale === 'ru' ? hit.toUpperCase() : hit)
  }
  return undefined
}
const caselessIndex: Partial<Record<Added, { size: number; map: Map<string, string> }>> = {}
function caseless(locale: Added) {
  const size = Object.keys(CONTENT[locale] || {}).length
  let entry = caselessIndex[locale]
  if (!entry || entry.size !== size) {
    const map = new Map<string, string>()
    for (const dict of [DICTIONARIES[locale], CONTENT[locale] || {}]) for (const [k, v] of Object.entries(dict)) map.set(k.toLowerCase(), v)
    caselessIndex[locale] = entry = { size, map }
  }
  return entry.map
}

/* ---- untranslated text is reported, never hidden ---- */
/** Text that is the same in every language: numbers, symbols, tickers, URLs, brand names. */
const LANGUAGE_NEUTRAL = /^(?:[^A-Za-z]*|[A-Z0-9]{2,10}(?:[/:-][A-Z0-9]{2,10})?|https?:\/\/\S+|\S+@\S+\.\S+|Openfund(?: (?:Prop|Perpetual))?|Gains(?: Network)?|gTrade|Vela(?: by LuxAlgo)?|LuxAlgo|WalletConnect|MetaMask|Rabby|Telegram|Discord|Instagram|Directus|Arbitrum(?: One)?|Sepolia|Ethereum|Pyth|Chainlink|USDC|USDT|DAI|ETH|BTC|EIP-\d+|SIWE|CSV|PNG|API|ID|P&L|PnL|ROI|KYC|AML|A-Book|B-Book)$/
const misses = new Map<string, Set<string>>()
let missNotify = 0
export function reportMiss(locale: string, english: string) {
  if (!contentLoaded(locale)) return
  let set = misses.get(locale)
  if (!set) misses.set(locale, set = new Set())
  if (set.has(english)) return
  set.add(english)
  if (typeof window !== 'undefined') {
    ;(window as Window & { __ofI18nMisses?: Record<string, string[]> }).__ofI18nMisses = Object.fromEntries([...misses].map(([k, v]) => [k, [...v]]))
    if (!missNotify) missNotify = requestAnimationFrame(() => { missNotify = 0; dispatchEvent(new CustomEvent('of-i18n-miss')) })
  }
}
export const missesFor = (locale: string) => [...(misses.get(locale) || [])]
/* numbers with unit letters (100x, 00y 02m, 5K), key names, the lowercase wordmark */
const NEUTRAL_EXTRA = /^(?:openfund|penfund|[\w.-]+\.trade|UTC[+-]\d{1,2}|\d\d:\d\d(?::\d\d)?\s+UTC[+-]\d{1,2}|\d{4}-\d\d-\d\dT\S+|Windows|macOS|Linux|TradingView|Render|Liara|Bitpin|DePay|S&P|Au|\/?USD|[A-Z]|App Store — iOS|Google Play — Android|[\d.,]+[a-zA-Z]{0,2}(?:\s+[\d.,]+[a-zA-Z]{0,2})*|Enter|Esc|Tab|Shift|Alt|Ctrl|Cmd|⌘[A-Z])$/
export const isLanguageNeutral = (text: string) => {
  const core = text.replace(/[↗↘↙↖→←↑↓·•|]+/g, ' ').replace(/\s+/g, ' ').trim()
  return LANGUAGE_NEUTRAL.test(core) || NEUTRAL_EXTRA.test(core) || core.split(' / ').every(part => LANGUAGE_NEUTRAL.test(part) || NEUTRAL_EXTRA.test(part))
}

/** English source → text for an added locale; misses are reported and shown in English. */
export function translateSource(locale: Added, english: string, _hint = ''): string {
  if (!english || isLanguageNeutral(english)) return english
  if (locale === 'ru' && /[А-Яа-яЁё]/.test(english) && !/[A-Za-z][a-z]{2,}(?:\s+[A-Za-z][a-z]{2,})+/.test(english)) return english
  const value = lookup(locale, english)
  if (value !== undefined) return value
  reportMiss(locale, english)
  return english
}
