/* Trading challenges mega-menu group, the flamingo migration banner and the
   --flamingo palette token (item C). */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'

const require = createRequire(import.meta.url)
function load(path) {
  const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, loader: { '.css': 'empty', '.zip': 'text' } })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports)
  return module.exports
}
const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const { navigationModel } = load('../src/features/information/navigation.ts')
const { MEGA_BANNERS } = load('../src/features/navigation/megaMenu.ts')
const schedule = load('../src/features/tournament/schedule.ts')

test('Trading challenges is a mega-menu group with five tiles in the agreed order', () => {
  for (const locale of ['fa', 'en', 'ar', 'ru', 'zh-CN']) {
    const model = navigationModel(locale, `/${locale}/home`, null, Date.parse('2026-11-22T12:00:00Z'))
    assert.deepEqual(model.primary.map(l => l.route), ['markets', 'rulebook'], 'the challenges link moved into the group')
    const group = model.groups[0]
    assert.equal(group.id, 'website-challenges')
    assert.deepEqual(group.links.map(l => l.route), ['challenges', 'checkout', 'migrate', 'tournament', 'rulebook'])
    assert.deepEqual(group.links.map(l => l.href), ['challenges', 'checkout', 'migrate', 'tournament', 'rulebook'].map(r => `/${locale}/${r}`))
    for (const link of group.links) { assert.ok(link.label, `${locale} ${link.route} label`); assert.ok(link.description, `${locale} ${link.route} description`) }
    assert.equal(group.links[0].icon, 'compare')
    assert.equal(group.banner.kind, 'flamingo')
    assert.equal(group.banner.href, `/${locale}/migrate`)
    assert.ok(group.banner.description.length > 40, 'the scene has a screen-reader description')
  }
  const en = navigationModel('en', '/en/home', null, Date.parse('2026-11-22T12:00:00Z')).groups[0]
  assert.deepEqual(en.links.map(l => l.label), ['Compare challenges', 'Buy a challenge', 'Migration to Openfund', 'Openfund Premium League', 'Trading rules'])
  assert.equal(en.links[0].description, 'Models, sizes and rules side by side.')
  assert.equal(en.banner.title, 'Migration to Openfund')
  assert.equal(en.banner.body, 'Proven funded trader? Skip evaluation with three verified payouts.')
  assert.equal(en.banner.cta, 'Start migration')
  assert.match(en.banner.description, /Maharloo Lake near Shiraz/)
})

test('the tournament tile carries a New badge and a countdown only before the start', () => {
  const before = navigationModel('en', '/en/home', null, Date.parse('2026-11-22T12:00:00Z')).groups[0].links.find(l => l.route === 'tournament')
  assert.equal(before.badge, 'New')
  assert.equal(before.countdown, 'Starts in 43 d')
  const fa = navigationModel('fa', '/fa/home', null, Date.parse('2027-01-03T12:00:00Z')).groups[0].links.find(l => l.route === 'tournament')
  assert.equal(fa.countdown, '۱ روز تا شروع')
  const after = navigationModel('en', '/en/home', null, Date.parse('2027-01-04T00:00:01Z')).groups[0].links.find(l => l.route === 'tournament')
  assert.equal(after.countdown, undefined)
  assert.equal(after.badge, 'New')
})

test('the tournament end is computed from 30 weekdays, not hard-coded', () => {
  assert.equal(schedule.PREMIUM_LEAGUE_START, '2027-01-04T00:00:00Z')
  assert.equal(schedule.tradingEnd(schedule.PREMIUM_LEAGUE_START, 30).toISOString(), '2027-02-12T23:59:59.999Z')
  assert.equal(schedule.tradingEnd('2027-01-04T00:00:00Z', 1).toISOString(), '2027-01-04T23:59:59.999Z')
  assert.equal(schedule.tradingEnd('2027-01-08T00:00:00Z', 2).toISOString(), '2027-01-11T23:59:59.999Z', 'skips the weekend')
  assert.equal(schedule.daysUntil('2027-01-04T00:00:00Z', Date.parse('2027-01-04T00:00:00Z')), null)
})

test('the flamingo banner is editable copy and the drawer variant has fewer birds', () => {
  const banner = MEGA_BANNERS['website-challenges']
  for (const key of ['title', 'body', 'cta', 'description']) { assert.ok(banner[key].en, key); assert.ok(banner[key].fa, key) }
  const art = read('../src/features/navigation/flamingoArt.ts')
  assert.match(art, /panel: \{[^}]*formation\(7,/)
  assert.match(art, /compact: \{[^}]*formation\(3,/)
  assert.doesNotMatch(art, /Math\.random/, 'deterministic drawing')
  const css = read('../src/features/navigation/flamingo.css')
  assert.match(css, /animation-play-state:paused/)
  assert.match(css, /:is\(\.resources-open,\.is-live,\[data-flamingo-live\]\) \.flamingo-scene/)
  assert.match(css, /prefers-reduced-motion:reduce\)\{\s*\.flamingo-scene :is\([^)]*\)\{animation:none\}/)
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /@keyframes[^{]*\{[^}]*(?:left|top|width|height|margin)\s*:/, 'transform and opacity only')
})

const luminance = hex => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

test('--flamingo is defined for both themes and passes WCAG AA', () => {
  const legacy = read('../public/legacy/style.css')
  const dark = legacy.match(/:root\{--ds-font-persian[^}]*--flamingo:(#[0-9a-f]{6})/)[1]
  const light = legacy.match(/html\[data-theme=light\]\{[^}]*--flamingo:(#[0-9a-f]{6})/)[1]
  assert.ok(contrast(dark, '#060808') >= 4.5, `dark ${contrast(dark, '#060808')}`)
  assert.ok(contrast(light, '#ffffff') >= 4.5, `light ${contrast(light, '#ffffff')}`)
  const ds = read('../src/styles/design-system.css')
  assert.ok(ds.includes(`--flamingo: ${dark};`) && ds.includes(`--flamingo: ${light};`), 'design-system tokens match')
  /* the accent is reserved for migration scenes */
  const uses = ['../src/features/navigation/mega-menu.css', '../src/features/navigation/flamingo.css'].map(read).join('\n')
  assert.ok(uses.includes('var(--flamingo'))
})
