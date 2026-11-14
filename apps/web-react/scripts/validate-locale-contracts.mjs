#!/usr/bin/env node
import ts from 'typescript-js-api'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tokens = value => (value.match(/\$\{[^}]+\}|\{\{[^}]+\}\}|\{[A-Za-z_][\w.]*\}/g) || []).sort()
const errors = []
for (const locale of ['ar', 'ru', 'zh-CN']) for (const path of [`src/i18n/content/${locale}.json`, `src/i18n/messages/${locale}.ts`]) {
  const source = ts.createSourceFile(path, readFileSync(join(root, path), 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('.json') ? ts.ScriptKind.JSON : ts.ScriptKind.TS)
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const seen = new Set()
      for (const property of node.properties.filter(ts.isPropertyAssignment)) {
        const key = property.name.text
        if (typeof key !== 'string') continue
        if (seen.has(key)) errors.push(`${path}: duplicate key ${JSON.stringify(key)}`)
        seen.add(key)
        if (ts.isStringLiteral(property.initializer) && JSON.stringify(tokens(key)) !== JSON.stringify(tokens(property.initializer.text))) errors.push(`${path}: placeholder mismatch ${JSON.stringify(key)}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
else console.log('Locale dictionaries: no duplicate keys or placeholder mismatches.')
