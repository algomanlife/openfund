import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
const output = buildSync({ entryPoints: ['src/i18n/interfaceContent.ts'], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text
const module = { exports: {} }; new Function('module', 'exports', output)(module, module.exports)
const { interfaceKey, installInterfaceContent, interfaceOverride } = module.exports
const row = (status = 'published', translations = [{ language_code: 'fa', value: 'عنوان تازه' }, { language_code: 'en', value: 'Updated title' }]) => ({ key: interfaceKey('عنوان', 'Title'), namespace: 'react', status, translations })
test('only published validated interface records override either language independently', () => {
  installInterfaceContent([row()])
  assert.equal(interfaceOverride('fa', 'عنوان', 'Title'), 'عنوان تازه')
  assert.equal(interfaceOverride('en', 'عنوان', 'Title'), 'Updated title')
  assert.equal(interfaceOverride('ru', 'عنوان', 'Title'), undefined)
  installInterfaceContent([row('draft')])
  assert.equal(interfaceOverride('fa', 'عنوان', 'Title'), undefined)
})
test('unpublishing and unavailable snapshots clear previous overrides', () => {
  installInterfaceContent([row()]); installInterfaceContent([])
  assert.equal(interfaceOverride('en', 'عنوان', 'Title'), undefined)
  installInterfaceContent([row()]); installInterfaceContent(null)
  assert.equal(interfaceOverride('en', 'عنوان', 'Title'), undefined)
})
test('invalid locales, empty text and unsafe placeholder substitutions fall back', () => {
  installInterfaceContent([row('published', [{ language_code: 'en', value: '{balance}' }, { language_code: 'fa', value: ' ' }, { language_code: 'xx', value: 'invalid' }])])
  assert.equal(interfaceOverride('en', 'عنوان', 'Title'), undefined)
  assert.equal(interfaceOverride('fa', 'عنوان', 'Title'), undefined)
  assert.equal(interfaceOverride('xx', 'عنوان', 'Title'), undefined)
})
test('source pairs have stable distinct identifiers and are never interpolated by CMS', () => {
  assert.equal(interfaceKey('عنوان', 'Title'), interfaceKey('عنوان', 'Title'))
  assert.notEqual(interfaceKey('عنوان', 'Title'), interfaceKey('عنوان دیگر', 'Title'))
  assert.notEqual(interfaceKey('عنوان', 'Title'), interfaceKey('عنوان', 'Title 2'))
  installInterfaceContent([row()])
  assert.equal(interfaceOverride('en', 'عنوان', 'Title 123'), undefined)
})
const templateCode = buildSync({ entryPoints: ['src/i18n/template.ts'], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text
const templateModule = { exports: {} }; new Function('module', 'exports', templateCode)(templateModule, templateModule.exports)
const { compileTranslationTemplate, applyTranslationTemplate } = templateModule.exports
test('translated placeholders may reorder without swapping financial values', () => {
  const template = compileTranslationTemplate('Period ${days} days, profit ${profit}', '利润 ${profit}，周期 ${days} 天')
  assert.equal(applyTranslationTemplate(template, 'Period 30 days, profit 2%'), '利润 2%，周期 30 天')
  assert.equal(compileTranslationTemplate('Profit ${profit}', '利润 ${wrong}'), null)
})
test('repository record getters resolve published copy without modifying source identity', () => {
  const record = module.exports.interfaceRecord({ fa: 'عنوان', en: 'Title' })
  installInterfaceContent([row()])
  assert.equal(record.fa, 'عنوان تازه')
  assert.equal(record.en, 'Updated title')
  installInterfaceContent([])
  assert.equal(record.en, 'Title')
})
test('repository record preserves original English source after English CMS edits', () => {
  const record = module.exports.interfaceRecord({ fa: 'عنوان', en: 'Title' })
  installInterfaceContent([row()])
  assert.equal(record.en, 'Updated title')
  assert.deepEqual(module.exports.interfaceSource(record), { fa: 'عنوان', en: 'Title' })
  assert.equal(interfaceOverride('ar', module.exports.interfaceSource(record).fa, module.exports.interfaceSource(record).en), undefined)
})
const integratedCode = buildSync({ stdin: { contents: "export * from './src/i18n/interfaceContent'; export { pickRecord } from './src/i18n/locales'; export { localizeRecords } from './src/i18n/localize';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text
const integratedModule = { exports: {} }; new Function('module', 'exports', integratedCode)(integratedModule, integratedModule.exports)
test('English overrides retain Arabic source fallback and independent Arabic publishing', () => {
  const api = integratedModule.exports
  const record = api.localizeRecords(api.interfaceRecord({ fa: 'بستن', en: 'Close' }))
  const key = api.interfaceKey('بستن', 'Close')
  api.installInterfaceContent([{ key, namespace: 'react', status: 'published', translations: [{ language_code: 'en', value: 'Dismiss' }] }])
  assert.equal(api.pickRecord('en', record), 'Dismiss')
  assert.equal(api.pickRecord('ar', record), 'إغلاق')
  assert.equal(record.ar, 'إغلاق')
  api.installInterfaceContent([{ key, namespace: 'react', status: 'published', translations: [{ language_code: 'en', value: 'Dismiss' }, { language_code: 'ar', value: 'إنهاء' }] }])
  assert.equal(api.pickRecord('ar', record), 'إنهاء')
  assert.equal(record.ar, 'إنهاء')
})
