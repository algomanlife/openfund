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
const NEUTRAL = /^(?:OPENFUND(?: \/| ·)?|USD ·|openfund|Openfund(?: Prop| Perpetual)?|OF|OFP|Au|Ag|USD|UTC|· UTC|UTC ·|Arbitrum|Gains Network(?: ↗| · Arbitrum One)?|iran\.openfund\.cloud|@communitybuopenfund|\?c=&lt;campaign&gt;)$/
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
  /* text inside an aria-hidden="true" element is not shown to people or
     assistive technology (e.g. the contact form honeypot) */
  const hiddenFromPeople = node => {
    for (let n = node.parent; n; n = n.parent) {
      const opening = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null
      if (opening?.attributes.properties.some(a => ts.isJsxAttribute(a) && a.name.getText(source) === 'aria-hidden' &&
        a.initializer && ts.isStringLiteral(a.initializer) && a.initializer.text === 'true')) return true
    }
    return false
  }
  /* `const t = (fa, en) => pick(locale, fa, en)` (and reversed-order
     variants) defines the bilingual helper; its call sites are what the
     registry records, so the definition itself is not copy */
  const isWrapperDefinition = (a, b, node) => {
    if (!a || !b || !ts.isIdentifier(a) || !ts.isIdentifier(b) || a.text === b.text) return false
    for (let n = node.parent; n; n = n.parent) {
      if (ts.isArrowFunction(n) || ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n)) {
        const params = new Set(n.parameters.map(p => p.name.getText(source)))
        return params.has(a.text) && params.has(b.text)
      }
    }
    return false
  }
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression) ? node.expression.text : ''
      if (['pick', 'pickFormat', 't', 'tr', 'text', 'label', 'L'].includes(name)) {
        const args = [...node.arguments]
        const start = name === 'pick' || name === 'pickFormat' ? 1 : 0
        const a = value(args[start]), b = value(args[start + 1])
        if (a !== undefined && b !== undefined) {
          const reverse = name === 'text' || (!/[\u0600-\u06ff]/.test(a) && /[\u0600-\u06ff]/.test(b))
          add(reverse ? b : a, reverse ? a : b, node, name === 'text' ? 'bilingual-record' : 'pick-pipeline')
        } else if (args.length >= start + 2) {
          const entry = { ...location(node), reason: 'dynamic-pair', expression: node.getText(source).slice(0, 200) }
          if (isWrapperDefinition(args[start], args[start + 1], node)) exclusions.push({ ...entry, reason: 'helper-wrapper-definition' })
          else exceptions.push(entry)
        }
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
      else if (hiddenFromPeople(node)) exclusions.push({ ...entry, reason: 'aria-hidden-not-rendered-copy' })
      else exceptions.push(entry)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}
/* Editorial catalog for the Backstage Content workspace: routes, the
 * structured surfaces and the forbidden collections, compiled from the same
 * TypeScript sources the site uses. Each route view names the registry areas
 * (feature directories) whose interface copy it renders; an unmapped view
 * fails generation so a new route always gets an explicit decision. */
const compileModule = path => {
  const text = buildSync({ entryPoints: [join(root, path)], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text
  const mod = { exports: {} }; new Function('module', 'exports', text)(mod, mod.exports); return mod.exports
}
const { EDITORIAL_ROUTES } = compileModule('src/cms/editorialRoutes.ts')
const { EDITORIAL_SURFACES, FORBIDDEN_EDITORIAL_COLLECTIONS, EDITORIAL_LOCALES } = compileModule('src/cms/editorialSurfaces.ts')
const VIEW_AREAS = {
  'root-redirect': [], home: ['home'], challenges: ['global'], 'payout-operations': ['purchase'], checkout: ['purchase'],
  campaign: ['campaign'], markets: ['markets'], rulebook: ['rulebook'], transparency: ['transparency'],
  governance: ['governance'], 'governance-new': ['governance'], 'governance-workspace': ['governance'], 'governance-proposal': ['governance'],
  'economy-redirect': [], 'revenue-model': ['economy'], 'live-market-access': ['economy'], ambassador: ['partners'], coach: ['partners'],
  whitepaper: ['whitepaper'], 'certificate-verification': ['certificates'], applications: ['applications'], roadmap: ['roadmap'], tournament: ['tournament'], migrate: ['migration'],
  about: ['company'], contact: ['company'], developers: ['developers'], faq: ['faq'], 'faq-question': ['faq'], tools: ['tools'], tool: ['tools'],
  learn: ['learn'], 'learning-path': ['learn'], lesson: ['learn'], glossary: ['learn'], 'glossary-term': ['learn'],
  referral: ['referral'], 'referral-entry': ['referral'], 'product-shell': ['terminal'], dashboard: ['terminal'], trade: ['terminal'],
  chart: ['terminal'], radar: ['radar'], heatmap: ['radar'], portfolio: ['terminal'], journal: ['terminal'], inbox: ['inbox'],
  certificates: ['certificates'], purchases: ['purchase'], withdrawals: ['purchase'], leaderboard: ['terminal'], rewards: ['terminal'],
  'terminal-redirect': [], 'portfolio-redirect': [], 'journal-redirect': [], 'legacy-product-redirect': [], 'legacy-anchor': [], fallback: [],
}
const unmapped = EDITORIAL_ROUTES.filter(r => !Object.hasOwn(VIEW_AREAS, r.view)).map(r => r.view)
if (unmapped.length) throw Error(`Map these editorial route views to registry areas in content-registry.mjs: ${unmapped.join(', ')}`)
const editorial = {
  locales: [...EDITORIAL_LOCALES], forbidden: [...FORBIDDEN_EDITORIAL_COLLECTIONS], surfaces: EDITORIAL_SURFACES,
  sharedAreas: ['navigation', 'notice', 'community', 'global'],
  routes: EDITORIAL_ROUTES.map(r => ({ ...r, areas: VIEW_AREAS[r.view] })),
}
const result = { version: 1, scope: 'Static React bilingual calls and flat bilingual records; not an assertion of total content coverage',
  summary: { uniqueRecords: rows.size, mappedCalls: [...rows.values()].filter(r => r.locations.some(l => l.method === 'pick-pipeline')).length, exceptions: exceptions.length, validationFindings: errors.length, reviewedExclusions: exclusions.length },
  editorial,
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
  if (JSON.stringify(baseline.editorial) !== JSON.stringify(editorial)) additions.push({ reason: 'stale-editorial-catalog', fix: 'node apps/web-react/scripts/content-registry.mjs' })
  if (additions.length) { console.error(JSON.stringify(additions, null, 2)); process.exitCode = 1 }
  console.log(JSON.stringify(result.summary))
} else {
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result.summary))
}
