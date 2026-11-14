#!/usr/bin/env node
import ts from 'typescript-js-api'
import { buildSync } from 'esbuild'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = join(root, '../..')
const compiled = buildSync({ entryPoints: [join(root, 'src/i18n/interfaceContent.ts')], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text
const module = { exports: {} }; new Function('module', 'exports', compiled)(module, module.exports)
const { interfaceKey, placeholders } = module.exports
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(f => f.isDirectory() ? files(join(dir, f.name)) : /\.tsx?$/.test(f.name) ? [join(dir, f.name)] : [])
const rows = new Map(), exceptions = [], errors = [], exclusions = []
const NEUTRAL = /^(?:OPENFUND(?: \/)?|openfund|Openfund(?: Prop| Perpetual)?|OF|OFP|Au|Ag|USD|UTC|· UTC|UTC ·|Arbitrum|Gains Network(?: ↗| · Arbitrum One)?|iran\.openfund\.cloud|@communitybuopenfund|\?c=&lt;campaign&gt;)$/
const value = node => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined
const routeHints = {
  terminal: '/:locale/:product/*', purchase: '/:locale/checkout; /:locale/:product/purchases', home: '/:locale/home',
  information: '/:locale/:page', markets: '/:locale/markets', certificates: '/:locale/certificate-verification; /:locale/:product/certificates',
  applications: '/:locale/apps', rulebook: '/:locale/rulebook', tools: '/:locale/tools', learning: '/:locale/learn',
}
for (const file of files(join(root, 'src')).filter(f => !f.includes('/i18n/content/') && !f.includes('/i18n/messages/'))) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const component = relative(repo, file)
  const domain = component.match(/features\/([^/]+)/)?.[1] || 'global'
  const area = domain === 'terminal' ? (/Dashboard|Accounts|Portfolio|Journal|ChallengePanel/.test(component) ? 'User Dashboard' : 'Trading Terminal') : domain === 'global' ? 'Global Content' : 'Website'
  const location = node => ({ component, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, page: domain, route: routeHints[domain] || '/:locale/*' })
  function add(fa, en, node, method) {
    if (fa === undefined || en === undefined) return
    if (!fa.trim() || !en.trim()) return
    const key = interfaceKey(fa, en), loc = location(node)
    const old = rows.get(key)
    if (old && (old.fa !== fa || old.en !== en)) throw Error(`Content key collision: ${key}`)
    if (JSON.stringify(placeholders(fa)) !== JSON.stringify(placeholders(en))) errors.push({ ...loc, reason: 'placeholder-mismatch', key })
    if (old) { old.locations.push({ ...loc, method }); return }
    rows.set(key, { key, namespace: 'react', area, owner: 'Content editor', fa, en,
      editing: 'Directus ui_messages / translations', publication: 'Published-only; browser reload; bundled fallback on failure',
      validation: method === 'pick-pipeline' ? 'mapped' : 'requires-render-path-verification', locations: [{ ...loc, method }] })
  }
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression) ? node.expression.text : ''
      if (['pick', 't', 'tr', 'text', 'label', 'L'].includes(name)) {
        const args = [...node.arguments]
        const start = name === 'pick' ? 1 : 0
        const a = value(args[start]), b = value(args[start + 1])
        if (a !== undefined && b !== undefined) {
          const reverse = name === 'text' || (!/[\u0600-\u06ff]/.test(a) && /[\u0600-\u06ff]/.test(b))
          add(reverse ? b : a, reverse ? a : b, node, name === 'text' ? 'bilingual-record' : 'pick-pipeline')
        } else if (args.length >= start + 2) exceptions.push({ ...location(node), reason: 'dynamic-pair', expression: node.getText(source).slice(0, 200) })
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      const fields = new Map(node.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(source).replace(/['"]/g, ''), p.initializer]))
      if (fields.has('fa') && fields.has('en')) add(value(fields.get('fa')), value(fields.get('en')), node, 'bilingual-record')
      const keys = node.properties.filter(ts.isPropertyAssignment).map(p => p.name.getText(source))
      const duplicates = keys.filter((key, i) => keys.indexOf(key) !== i)
      if (duplicates.length) errors.push({ ...location(node), reason: 'duplicate-object-key', keys: [...new Set(duplicates)] })
    }
    if (ts.isJsxText(node) && /[A-Za-z\u0600-\u06ff]{2}/.test(node.text)) {
      const entry = { ...location(node), reason: 'literal-jsx-review', text: node.text.trim() }
      if (NEUTRAL.test(entry.text)) exclusions.push({ ...entry, reason: 'language-neutral-brand-or-identifier' })
      else exceptions.push(entry)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}
const result = { version: 1, scope: 'Static React bilingual calls and flat bilingual records; not an assertion of total content coverage',
  summary: { uniqueRecords: rows.size, mappedCalls: [...rows.values()].filter(r => r.locations.some(l => l.method === 'pick-pipeline')).length, exceptions: exceptions.length, validationFindings: errors.length, reviewedExclusions: exclusions.length },
  records: [...rows.values()].sort((a,b) => a.key.localeCompare(b.key)), exceptions, findings: errors, exclusions }
const output = join(repo, 'apps/backstage/content-registry.json')
if (process.argv.includes('--check')) {
  const baseline = JSON.parse(readFileSync(output, 'utf8'))
  // Reject newly introduced untranslated JSX and placeholder/duplicate errors.
  // Existing findings remain visible until explicitly repaired, not hidden.
  const signature = x => JSON.stringify([x.component, x.reason, x.text || x.expression || x.key || x.keys])
  const accepted = new Set([...baseline.exceptions, ...baseline.findings].map(signature))
  const additions = [...exceptions, ...errors].filter(x => !accepted.has(signature(x)))
  const registered = new Set(baseline.records.map(row => row.key))
  for (const row of rows.values()) if (!registered.has(row.key)) additions.push({ key: row.key, reason: 'unregistered-fixed-content', locations: row.locations })
  if (additions.length) { console.error(JSON.stringify(additions, null, 2)); process.exitCode = 1 }
  console.log(JSON.stringify(result.summary))
} else {
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result.summary))
}
