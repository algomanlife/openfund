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

export function lookup(locale: keyof typeof DICTIONARIES, english: string): string | undefined {
  const direct = DICTIONARIES[locale][english]
  if (direct !== undefined) return direct
  for (const t of TEMPLATES[locale]) {
    const m = t.pattern.exec(english)
    if (m) return t.parts.reduce((out, part, i) => out + part + (i < m.length - 1 ? m[i + 1] : ''), '')
  }
  return undefined
}
