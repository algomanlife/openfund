/* Seasonal header logo: date ranges, Jalali boundaries in Tehran, the
   visitor-local Christmas range, year transitions and the DOM layer. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { buildSync } from 'esbuild'
import { JSDOM } from 'jsdom'

const src = buildSync({ entryPoints: [fileURLToPath(new URL('../src/brand/seasonalLogo.ts', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', write: false })
const mod = { exports: {} }; new Function('module', 'exports', src.outputFiles[0].text)(mod, mod.exports)
const { seasonFor, jalaliInTehran, applySeasonalLogo } = mod.exports
const at = iso => new Date(iso)

test('Yalda: 28 Azar 00:00 through the end of 1 Dey, Tehran time (UTC+3:30)', () => {
  /* 1405: 28 Azar = 19 Dec 2026, 1 Dey = 22 Dec 2026 */
  assert.equal(seasonFor(at('2026-12-18T20:29:59Z'), 'UTC'), null, '27 Azar 23:59:59 Tehran')
  assert.equal(seasonFor(at('2026-12-18T20:30:00Z'), 'UTC'), 'yalda', '28 Azar 00:00 Tehran')
  assert.equal(seasonFor(at('2026-12-20T12:00:00Z'), 'UTC'), 'yalda', '29 Azar')
  assert.equal(seasonFor(at('2026-12-21T12:00:00Z'), 'UTC'), 'yalda', '30 Azar (Yalda night)')
  assert.equal(seasonFor(at('2026-12-22T20:29:59Z'), 'UTC'), 'yalda', '1 Dey 23:59:59 Tehran')
  assert.equal(seasonFor(at('2026-12-22T20:30:00Z'), 'UTC'), null, '2 Dey 00:00 Tehran')
  assert.deepEqual(jalaliInTehran(at('2026-12-18T20:30:00Z')), { year: 1405, month: 9, day: 28 })
})

test('Yalda follows the Jalali calendar in other years (no hard-coded Gregorian dates)', () => {
  /* 1404: 28 Azar = 19 Dec 2025; 1403: 28 Azar = 18 Dec 2024 (leap-year shift) */
  assert.equal(seasonFor(at('2025-12-18T21:00:00Z'), 'UTC'), 'yalda')
  assert.deepEqual(jalaliInTehran(at('2024-12-18T12:00:00Z')), { year: 1403, month: 9, day: 28 })
  assert.equal(seasonFor(at('2024-12-18T12:00:00Z'), 'UTC'), 'yalda')
  assert.equal(seasonFor(at('2024-12-17T12:00:00Z'), 'UTC'), null)
})

test('Christmas: 25-31 December inclusive by the visitor\'s own date', () => {
  assert.equal(seasonFor(at('2026-12-24T23:59:59Z'), 'UTC'), null)
  assert.equal(seasonFor(at('2026-12-25T00:00:00Z'), 'UTC'), 'christmas')
  assert.equal(seasonFor(at('2026-12-31T23:59:59Z'), 'UTC'), 'christmas')
  assert.equal(seasonFor(at('2027-01-01T00:00:00Z'), 'UTC'), null, 'New Year\'s Day reverts')
  /* the same instant is still 24 Dec in Los Angeles and already 25 Dec in Tehran */
  assert.equal(seasonFor(at('2026-12-25T02:00:00Z'), 'America/Los_Angeles'), null)
  assert.equal(seasonFor(at('2026-12-24T21:00:00Z'), 'Asia/Tehran'), 'christmas')
  /* 31 Dec 23:30 in Auckland is already 1 Jan there */
  assert.equal(seasonFor(at('2026-12-31T11:30:00Z'), 'Pacific/Auckland'), null)
})

test('outside both ranges the normal logo shows', () => {
  for (const iso of ['2026-11-11T12:00:00Z', '2026-12-23T12:00:00Z', '2027-03-21T12:00:00Z', '2027-06-01T00:00:00Z']) assert.equal(seasonFor(at(iso), 'UTC'), null, iso)
})

test('only header/navigation logos are decorated, and removal restores them', () => {
  const dom = new JSDOM(`<header class="openfund-header"><a class="brand"><img src="assets/mark-mint.svg"><span>openfund</span></a></header>
    <header class="of-terminal-header"><a class="of-brand"><img src="assets/mark-mint.svg"></a></header>
    <footer><a class="brand"><img src="assets/mark-mint.svg"></a></footer><div class="loading"><img src="assets/mark-mint.svg"></div>`)
  const doc = dom.window.document
  for (const img of doc.querySelectorAll('img')) img.getBoundingClientRect = () => ({ left: 10, top: 5, width: 31, height: 35 })
  for (const a of doc.querySelectorAll('a')) a.getBoundingClientRect = () => ({ left: 0, top: 0, width: 120, height: 40 })
  applySeasonalLogo('christmas', doc)
  assert.equal(doc.querySelector('.openfund-header .brand').dataset.ofSeason, 'christmas')
  assert.equal(doc.querySelector('.of-terminal-header .of-brand').dataset.ofSeason, 'christmas')
  assert.equal(doc.querySelector('footer .brand').dataset.ofSeason, undefined, 'footer logo untouched')
  assert.equal(doc.querySelector('.openfund-header .brand').style.getPropertyValue('--sl-w'), '31.00px')
  assert.equal(doc.querySelectorAll('img')[0].getAttribute('src'), 'assets/mark-mint.svg', 'master logo unchanged')
  applySeasonalLogo(null, doc)
  assert.equal(doc.querySelector('.openfund-header .brand').dataset.ofSeason, undefined)
  assert.equal(doc.querySelector('.openfund-header .brand').style.getPropertyValue('--sl-w'), '')
})

test('the stylesheet carries both approved layers and never targets other logos', () => {
  const css = readFileSync(new URL('../src/brand/seasonal-logo.css', import.meta.url), 'utf8')
  assert.match(css, /\[data-of-season="christmas"\]::after/)
  assert.match(css, /\[data-of-season="yalda"\]::after/)
  assert.doesNotMatch(css, /mark-mint|footer|loading/)
})
