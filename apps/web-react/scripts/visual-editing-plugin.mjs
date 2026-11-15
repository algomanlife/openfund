/** Compile-time attachment of stable Directus visual-editing keys.
 * Public renders stay plain text: cmsEditAttrs() returns {} until the
 * Directus 11.17.4 Studio confirms the editor session.
 */
import ts from 'typescript-js-api'

export function contentKey(fa, en) {
  const source = JSON.stringify([fa, en])
  let a = 2166136261, b = 5381
  for (let i = 0; i < source.length; i++) {
    a = Math.imul(a ^ source.charCodeAt(i), 16777619)
    b = Math.imul(b, 33) ^ source.charCodeAt(i)
  }
  return `react.${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`
}

const literal = node => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined
const unwrap = node => {
  while (node && ts.isParenthesizedExpression(node)) node = node.expression
  return node
}

function pickOf(node, sourceFile) {
  const call = unwrap(node)
  if (!call || !ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) return null
  const name = call.expression.text
  if (name === 'pick') {
    const fa = literal(call.arguments[1]), en = literal(call.arguments[2])
    if (fa === undefined || en === undefined || !fa.trim() || !en.trim()) return null
    return { call, key: contentKey(fa, en) }
  }
  if (name === 'pickRecord') {
    const record = unwrap(call.arguments[1])
    if (!record || !ts.isObjectLiteralExpression(record)) return null
    const fields = new Map()
    for (const property of record.properties) {
      if (!ts.isPropertyAssignment(property) || !property.name) return null
      fields.set(property.name.getText(sourceFile).replace(/['"]/g, ''), property.initializer)
    }
    const fa = literal(fields.get('fa')), en = literal(fields.get('en'))
    if (fa === undefined || en === undefined || !fa.trim() || !en.trim()) return null
    return { call, key: contentKey(fa, en) }
  }
  return null
}

export function annotateJsx(code, filename = 'file.tsx') {
  const sourceFile = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const edits = []
  const direct = []
  const attached = []
  let usesAttrs = false
  let usesText = false
  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node
      const openingText = code.slice(opening.getStart(sourceFile), opening.getEnd())
      const attributePicks = []
      for (const property of opening.attributes.properties) {
        if (!ts.isJsxAttribute(property) || !property.initializer || !ts.isJsxExpression(property.initializer)) continue
        const pick = pickOf(property.initializer.expression, sourceFile)
        if (pick) attributePicks.push(pick)
      }
      const childPicks = []
      if (ts.isJsxElement(node)) {
        for (const child of node.children) {
          if (!ts.isJsxExpression(child) || !child.expression) continue
          const pick = pickOf(child.expression, sourceFile)
          if (pick) childPicks.push(pick)
        }
      }
      for (const pick of [...attributePicks, ...childPicks]) direct.push(pick.key)
      const guarded = openingText.includes('data-of-visual-control') || openingText.includes('cmsEditAttrs(') || openingText.includes('cmsText(')
      const spread = (key) => {
        const end = opening.getEnd()
        const selfClosing = openingText.endsWith('/>')
        edits.push({ start: end - (selfClosing ? 2 : 1), end: end - (selfClosing ? 2 : 1), text: ` {...cmsEditAttrs(${JSON.stringify(key)})}` })
        usesAttrs = true
      }
      if (!guarded && childPicks.length === 1 && attributePicks.length === 0) {
        spread(childPicks[0].key)
        attached.push(childPicks[0].key)
      } else if (!guarded && childPicks.length === 0 && attributePicks.length >= 1) {
        // One host element can open one Directus field. Further attributes on
        // that host stay in the catalog and are still registered.
        spread(attributePicks[0].key)
        for (const pick of attributePicks) attached.push(pick.key)
      } else if (!guarded && childPicks.length > 0) {
        for (const pick of childPicks) {
          edits.push({ start: pick.call.getStart(sourceFile), end: pick.call.getEnd(), text: `cmsText(${code.slice(pick.call.getStart(sourceFile), pick.call.getEnd())}, ${JSON.stringify(pick.key)})` })
          attached.push(pick.key)
          usesText = true
        }
        if (attributePicks.length) {
          spread(attributePicks[0].key)
          for (const pick of attributePicks) attached.push(pick.key)
        }
      }
    }
    if (ts.isJsxFragment(node)) {
      for (const child of node.children) {
        if (!ts.isJsxExpression(child) || !child.expression) continue
        const pick = pickOf(child.expression, sourceFile)
        if (!pick) continue
        direct.push(pick.key)
        edits.push({ start: pick.call.getStart(sourceFile), end: pick.call.getEnd(), text: `cmsText(${code.slice(pick.call.getStart(sourceFile), pick.call.getEnd())}, ${JSON.stringify(pick.key)})` })
        attached.push(pick.key)
        usesText = true
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  edits.sort((a, b) => b.start - a.start)
  let next = code
  for (const edit of edits) next = next.slice(0, edit.start) + edit.text + next.slice(edit.end)
  if (usesAttrs || usesText) {
    const names = [usesAttrs ? 'cmsEditAttrs' : '', usesText ? 'cmsText' : ''].filter(Boolean).join(', ')
    const statement = `import { ${names} } from 'virtual:openfund-cms-edit'\n`
    next = statement + next
  }
  const parsed = ts.createSourceFile(filename, next, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  return { code: next, direct, attached, parseDiagnostics: parsed.parseDiagnostics?.length || 0 }
}

export function visualEditingPlugin() {
  const virtual = 'virtual:openfund-cms-edit'
  return {
    name: 'openfund-visual-editing',
    enforce: 'pre',
    resolveId(id) { return id === virtual ? '\0' + virtual : null },
    load(id) {
      if (id !== '\0' + virtual) return null
      return `export { cmsEditAttrs, cmsText } from ${JSON.stringify(new URL('../src/cms/visualEditing.ts', import.meta.url).pathname)}`
    },
    transform(code, id) {
      if (!id.includes('/src/') || !id.endsWith('.tsx') || id.includes('/node_modules/')) return null
      const result = annotateJsx(code, id)
      if (result.code === code) return null
      if (result.parseDiagnostics) this.error('Visual editing transform produced invalid syntax in ' + id)
      return { code: result.code, map: null }
    },
  }
}
