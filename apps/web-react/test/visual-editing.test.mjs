import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSync } from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { annotateJsx, contentKey } from '../scripts/visual-editing-plugin.mjs'

const root = dirname(fileURLToPath(import.meta.url))
function load(entry) {
  const text = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text
  const module = { exports: {} }
  new Function('module', 'exports', text)(module, module.exports)
  return module.exports
}
const surfaces = load(join(root, '../src/cms/editorialSurfaces.ts'))
const content = load(join(root, '../src/i18n/interfaceContent.ts'))

test('public visitors receive no editing attributes', () => {
  assert.deepEqual(surfaces.attributesFor(false, { collection: 'ui_messages', item: '4', fields: ['translations'] }, 'react.abc'), {})
})

test('confirmed editors get a Directus 11.17 attribute and a stable key', () => {
  const attribute = surfaces.setAttr({ collection: 'ui_message_translations', item: '9', fields: ['value'], mode: 'popover' })
  assert.equal(attribute, 'collection:ui_message_translations;item:9;fields:value;mode:popover')
  assert.deepEqual(surfaces.parseAttr(attribute), { collection: 'ui_message_translations', item: '9', fields: ['value'], mode: 'popover' })
  const attrs = surfaces.attributesFor(true, { collection: 'ui_messages', item: '4', fields: ['translations'], mode: 'drawer' }, 'react.abc')
  assert.equal(attrs['data-of-key'], 'react.abc')
  assert.match(attrs['data-directus'], /^collection:ui_messages;item:4;fields:translations;mode:drawer$/)
})

test('financial collections cannot be targeted', () => {
  assert.equal(surfaces.isAllowedCollection('challenge_plans'), false)
  assert.equal(surfaces.isAllowedCollection('orders'), false)
  assert.equal(surfaces.attributesFor(true, { collection: 'wallets', item: '1', fields: ['balance'] }, 'react.abc')['data-directus'], undefined)
  assert.equal(surfaces.isAllowedCollection('ui_messages'), true)
  assert.equal(surfaces.isAllowedCollection('home_content_translations'), true)
})

test('language edits stay on the selected locale and drafts are not published by the preview helper', () => {
  const fa = 'خرید', en = 'Buy'
  const key = content.interfaceKey(fa, en)
  assert.equal(key, contentKey(fa, en))
  content.installInterfaceContent([{ key, namespace: 'react', status: 'published', translations: [{ language_code: 'en', value: 'Buy' }, { language_code: 'fa', value: 'خرید' }] }])
  content.setInterfacePreviewReader((locale, item) => locale === 'ar' && item === key ? 'شراء' : undefined)
  assert.equal(content.interfaceOverride('ar', fa, en), 'شراء')
  assert.equal(content.interfaceOverride('en', fa, en), 'Buy')
  assert.equal(content.interfaceOverride('fa', fa, en), 'خرید')
  content.installInterfaceContent([{ key, namespace: 'react', status: 'draft', translations: [{ language_code: 'en', value: 'Purchase' }] }])
  assert.equal(content.interfaceOverride('en', fa, en), undefined)
  content.setInterfacePreviewReader(undefined)
})

test('preview rejects placeholder changes and markup is kept as text', () => {
  const placeholders = value => (value.match(/\$\{[^}]+\}|\{\{[^}]+\}\}|\{[A-Za-z_][\w.]*\}/g) || []).sort()
  const value = surfaces.acceptPreview('<script>alert(1)</script>', 'Hello', placeholders)
  assert.equal(value, '<script>alert(1)</script>')
  assert.equal(surfaces.acceptPreview('Hello {name}', 'Hello', placeholders), undefined)
  assert.equal(surfaces.acceptPreview('Hello {name}', 'Hello {name}', placeholders), 'Hello {name}')
})

test('duplicate visible strings are not guessed', () => {
  const unique = surfaces.uniqueTargets([
    { text: 'Close', collection: 'ui_message_translations', item: '1', fields: ['value'], mode: 'popover', match: 'text', localesPresent: ['en'] },
    { text: 'Close', collection: 'ui_message_translations', item: '2', fields: ['value'], mode: 'popover', match: 'text', localesPresent: ['en'] },
    { text: 'A unique explanation', collection: 'page_translations', item: '3', fields: ['description'], mode: 'popover', match: 'text', localesPresent: ['fa', 'en'] },
  ])
  assert.equal(unique.has('Close'), false)
  assert.equal(unique.get('A unique explanation').item, '3')
})

test('missing translations are explicit for all five locales', () => {
  assert.deepEqual(surfaces.missingLocales(['fa', 'en']), ['ar', 'ru', 'zh-CN'])
  assert.deepEqual(surfaces.missingLocales(['fa', 'en', 'ar', 'ru', 'zh-CN']), [])
})

test('structured targets keep numbers out of dataset labels and map the real field', () => {
  const targets = surfaces.targetsFromSurface({
    collection: 'whitepaper_datasets', translationCollection: 'whitepaper_dataset_translations', textFields: ['title'], jsonTextFields: ['labels'],
  }, { id: 7, translations: [{ id: 8, language_code: 'en', title: 'Revenue', labels: { points: { fee: 'Fee' }, value: 650 } }] }, 'en')
  assert.deepEqual(targets.map(item => item.text), ['Revenue', 'Fee'])
  assert.equal(targets[1].fields[0], 'labels')
  assert.equal(targets[1].collection, 'whitepaper_dataset_translations')
})

test('JSX literals receive stable attributes without changing the text', () => {
  const source = `export function View({ locale }) {\n  return <button>{pick(locale, 'بستن', 'Close')}</button>\n}\n`
  const result = annotateJsx(source)
  assert.equal(result.parseDiagnostics, 0)
  assert.match(result.code, /cmsEditAttrs\("react\.[a-f0-9]{16}"\)/)
  assert.match(result.code, /pick\(locale, 'بستن', 'Close'\)/)
  assert.equal(result.direct.length, result.attached.length)
})

test('terminal iframe script does not postMessage to an opaque origin', () => {
  const source = readFileSync(new URL('../public/legacy/visual-editing.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /postMessage\([^)]*location\.origin/)
  assert.match(source, /parent\.location\.origin/)
})

test('several strings on one element stay independently addressable', () => {
  const source = `export function View({ locale }) {\n  return <p>{pick(locale, 'یک', 'One')} {pick(locale, 'دو', 'Two')}</p>\n}\n`
  const result = annotateJsx(source)
  assert.equal(result.parseDiagnostics, 0)
  assert.equal(result.code.match(/cmsText\(pick/g).length, 2)
})
