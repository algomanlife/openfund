/* ADR 0043: the first paint must already be in the visitor's language.
   Executes the real pre-paint script from index.html (not a copy) against
   the runtime-config geoLocale the backend derives from the trusted country,
   with storage present, absent, legacy and explicit. */
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { localeForCountry, defaultLocale } from '../../backend/geo-locale.js'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const boot = html.match(/<script>(var t;[\s\S]*?)<\/script>/)[1]

function paint({ path = '/', geoLocale, storage = {}, storageThrows = false }) {
  const root = { lang: '', dir: '', dataset: {} }
  const store = new Map(Object.entries(storage))
  const localStorage = storageThrows
    ? { getItem() { throw new Error('SecurityError') }, setItem() { throw new Error('SecurityError') } }
    : { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) }
  const window = { __OPENFUND_RUNTIME_CONFIG__: geoLocale === undefined ? undefined : { geoLocale }, matchMedia: () => ({ matches: true }) }
  const ctx = {
    window, localStorage, document: { documentElement: root, getElementById: () => null },
    location: { pathname: path, search: '', hash: '' },
    history: { replaceState() {} }, setTimeout() {},
  }
  vm.runInNewContext(boot, ctx)
  return { lang: root.lang, dir: root.dir }
}

const DIR = { fa: 'rtl', ar: 'rtl', en: 'ltr', ru: 'ltr', 'zh-CN': 'ltr' }
const COUNTRIES = { IR: 'fa', SA: 'ar', AE: 'ar', IQ: 'ar', EG: 'ar', QA: 'ar', RU: 'ru', CN: 'zh-CN',
  US: 'en', DE: 'en', FR: 'en', TJ: 'en', TR: 'en', XX: 'en', T1: 'en' }

test('fresh visit: the first paint follows the trusted country', () => {
  for (const [country, expected] of Object.entries(COUNTRIES)) {
    assert.equal(localeForCountry(country) ?? 'en', expected, country)
    const geoLocale = defaultLocale(country, 'en')
    assert.deepEqual(paint({ geoLocale }), { lang: expected, dir: DIR[expected] }, country)
  }
})

test('no runtime config or an invalid geoLocale paints English, never Persian', () => {
  assert.deepEqual(paint({}), { lang: 'en', dir: 'ltr' })
  assert.deepEqual(paint({ geoLocale: 'de' }), { lang: 'en', dir: 'ltr' })
  assert.match(html, /<html lang="en" dir="ltr">/, 'the static document default is the English fallback')
})

test('URL locale outranks every other source', () => {
  for (const seg of Object.keys(DIR))
    assert.deepEqual(paint({ path: `/${seg}/home`, geoLocale: 'ru', storage: { 'of-language-choice': 'fa' } }), { lang: seg, dir: DIR[seg] })
})

test('an explicit choice outranks Geo-IP on a locale-less visit', () => {
  assert.deepEqual(paint({ geoLocale: 'ru', storage: { 'of-language-choice': 'ar' } }), { lang: 'ar', dir: 'rtl' })
  assert.deepEqual(paint({ geoLocale: 'fa', storage: { 'of-language-choice': 'en' } }), { lang: 'en', dir: 'ltr' })
})

test('a render-tracked or legacy of-language value never overrides Geo-IP', () => {
  /* the pre-0.7 default and every rendered route wrote of-language=fa */
  assert.deepEqual(paint({ geoLocale: 'ru', storage: { 'of-language': 'fa' } }), { lang: 'ru', dir: 'ltr' })
  assert.deepEqual(paint({ geoLocale: 'zh-CN', storage: { 'of-language': 'ar' } }), { lang: 'zh-CN', dir: 'ltr' })
})

test('unavailable storage still applies the Geo-IP default', () => {
  assert.deepEqual(paint({ geoLocale: 'ar', storageThrows: true }), { lang: 'ar', dir: 'rtl' })
})

test('client resolution: only LanguageSelect persists a choice; shells never do', () => {
  const locales = readFileSync(new URL('../src/i18n/locales.ts', import.meta.url), 'utf8')
  const select = readFileSync(new URL('../src/i18n/LanguageSelect.tsx', import.meta.url), 'utf8')
  assert.match(locales, /LANGUAGE_CHOICE_KEY = 'of-language-choice'/)
  assert.match(locales, /storedLocale\(\)[^]*?getItem\(LANGUAGE_CHOICE_KEY\)/)
  assert.match(select, /saveLocaleChoice\(next\); onChange\(next\)/)
  for (const file of ['../src/features/information/InformationShell.tsx', '../src/features/terminal/TerminalShell.tsx', '../src/pages/Landing.tsx']) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.doesNotMatch(src, /of-language-choice|saveLocaleChoice/, `${file} must not turn a rendered locale into a choice`)
  }
})
