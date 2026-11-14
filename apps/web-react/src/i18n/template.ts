/** Named interpolation keeps translated word order independent of source order. */
export interface TranslationTemplate { pattern: RegExp; names: string[]; translation: string }
const tokens = (value: string) => [...value.matchAll(/\$\{([^}]+)\}/g)].map(m => m[1])
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export function compileTranslationTemplate(source: string, translation: string): TranslationTemplate | null {
  const names = tokens(source), translated = tokens(translation)
  if (!names.length || JSON.stringify([...names].sort()) !== JSON.stringify([...translated].sort())) return null
  return { pattern: new RegExp('^' + source.split(/\$\{[^}]+\}/).map(escape).join('(.+?)') + '$', 's'), names, translation }
}
export function applyTranslationTemplate(template: TranslationTemplate, source: string): string | undefined {
  const match = template.pattern.exec(source)
  if (!match) return undefined
  const values = new Map(template.names.map((name, i) => [name, match[i + 1]]))
  return template.translation.replace(/\$\{([^}]+)\}/g, (_, name) => values.get(name) ?? '')
}
