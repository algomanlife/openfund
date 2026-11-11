import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'

const require = createRequire(import.meta.url)
const root = new URL('../../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
function load(telegram = '', discord = '', instagram = '') {
  const result = buildSync({ entryPoints: [fileURLToPath(new URL('../src/features/community/TelegramCommunity.tsx', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', loader: { '.css': 'empty' }, jsx: 'automatic', define: {
    'import.meta.env.BASE_URL': '"/react/"',
    'import.meta.env.VITE_TELEGRAM_COMMUNITY_URL': JSON.stringify(telegram),
    'import.meta.env.VITE_DISCORD_COMMUNITY_URL': JSON.stringify(discord),
    'import.meta.env.VITE_INSTAGRAM_COMMUNITY_URL': JSON.stringify(instagram),
  } })
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, mod, mod.exports)
  return mod.exports
}
const { JSDOM } = require('jsdom')
function render(component, locale) {
  return new JSDOM(require('react-dom/server').renderToStaticMarkup(require('react').createElement(component, { locale }))).window.document
}

test('Telegram validator keeps named communities and invitation semantics', () => {
  const { communityUrl } = load()
  for (const url of ['https://t.me/ExampleCommunity', 'https://t.me/+ExampleInvite', 'https://t.me/joinchat/ExampleInvite']) assert.equal(communityUrl(url), url)
  for (const url of ['', 'https://telegram.org/', 'https://t.me/', 'https://t.me/share', 'https://t.me/proxy', 'https://t.me/login', 'https://t.me.evil.test/ExampleCommunity', 'https://user@t.me/ExampleCommunity', 'https://t.me/ExampleCommunity?x=1', 'https://t.me/ExampleCommunity#x', 'http://t.me/ExampleCommunity']) assert.equal(communityUrl(url), null)
})

test('Discord validator accepts only HTTPS invitations on authentic hosts', () => {
  const { discordCommunityUrl } = load()
  for (const url of ['https://discord.gg/ExampleInvite', 'https://discord.com/invite/ExampleInvite', 'https://discord.gg/Example-Invite/']) assert.equal(discordCommunityUrl(url), url)
  for (const url of ['', 'https://discord.gg/', 'https://discord.com/', 'https://discord.com/channels/123', 'https://discord.com/invite/', 'https://discord.gg.evil.test/ExampleInvite', 'https://user:pass@discord.gg/ExampleInvite', 'https://discord.gg:8443/ExampleInvite', 'http://discord.gg/ExampleInvite', 'javascript:alert(1)', 'https://discord.gg/ExampleInvite?x=1', 'https://discord.gg/ExampleInvite#x']) assert.equal(discordCommunityUrl(url), null)
})

test('every compatible default group renders two exact localized unavailable actions', () => {
  const mod = load()
  for (const locale of ['en', 'fa']) {
    const doc = render(mod.default, locale)
    assert.equal(doc.querySelectorAll('[role="group"]').length, 1)
    assert.equal(doc.querySelectorAll('a').length, 0)
    assert.equal(doc.querySelectorAll('button[aria-disabled="true"]').length, 2)
    assert.equal(doc.querySelector('[data-provider="instagram"]'), null)
    for (const name of ['Telegram', 'Discord']) {
      const button = doc.querySelector(`[data-provider="${name.toLowerCase()}"]`)
      assert.equal(button.querySelector('.community-copy > span').textContent, locale === 'fa' ? 'جامعه معامله‌گران' : 'Traders talk on')
      assert.equal(button.querySelector('small').textContent, locale === 'fa' ? 'به‌زودی' : 'Coming Soon')
      assert.equal(button.querySelector('img').alt, name)
      assert.ok(button.getAttribute('aria-label').includes(name))
      assert.equal(button.getAttribute('data-locale-owned'), 'react')
      assert.equal(button.getAttribute('href'), null)
    }
  }
})

test('provider availability is independent and enabled links preserve security attributes', () => {
  // Synthetic destinations exercise validation, not Openfund ownership.
  for (const [telegram, discord] of [['https://t.me/ExampleCommunity', ''], ['', 'https://discord.gg/ExampleInvite'], ['https://t.me/ExampleCommunity', 'https://discord.com/invite/ExampleInvite']]) {
    const doc = render(load(telegram, discord).default, 'en')
    assert.equal(doc.querySelectorAll('a').length, Number(Boolean(telegram)) + Number(Boolean(discord)))
    for (const link of doc.querySelectorAll('a')) {
      assert.equal(link.target, '_blank')
      assert.equal(link.rel, 'noopener noreferrer')
      assert.equal(link.querySelector('small'), null)
    }
    assert.equal(doc.querySelectorAll('.community-button').length, 2)
  }
})

test('the public page lists no unreleased app downloads and six service credits including both cloud infrastructures', () => {
  const doc = new JSDOM(read('apps/web-react/src/pages/landing-body.html')).window.document
  assert.equal(doc.querySelectorAll('#desktop, .desktop-btns').length, 0)
  assert.equal(doc.querySelectorAll('.credits-row .service-logo-slot').length, 6)
  assert.deepEqual([...doc.querySelectorAll('.credits-row > a b')].map(b => b.textContent), ['Gains', 'Vela', 'TradingView', 'DePay', 'Render', 'Liara'])
  assert.equal(doc.querySelectorAll('.credits-row img[src="assets/vela-logo.svg"]').length, 1)
  assert.equal(doc.querySelectorAll('.credits-row a[href="https://render.com"] img[src="assets/render-logo.svg"]').length, 1)
  assert.equal(doc.querySelectorAll('.credits-row a[href="https://liara.ir"] img[src="assets/liara-logo.svg"]').length, 1)
})

test('owned styles remove logo recoloring and support shared reduced motion', () => {
  const community = read('apps/web-react/src/features/community/community.css')
  assert.match(community, /prefers-reduced-motion: reduce/)
  assert.match(community, /\.community-button, \.community-button img \{ transition: none/)
  assert.ok(!/filter\s*:/.test(community))
  for (const path of ['apps/web-react/public/legacy/style.css', 'dist/style.css']) {
    const css = read(path).split('/* Public platform and service presentation; terminal styling stays separate. */')[1]
    assert.ok(css)
    assert.ok([...css.matchAll(/filter:\s*([^;]+);/g)].every(match => match[1].trim() === 'none'))
    assert.ok(!css.includes('google-play.png'))
  }
  for (const name of ['discord-logo.svg', 'instagram-logo.svg', 'instagram-logo-white.svg', 'vela-logo.svg', 'depay-logo.svg', 'tradingview-mark.svg', 'app-store-icon.svg', 'google-play-icon.svg']) assert.equal(read(`apps/web-react/public/assets/${name}`), read(`dist/assets/${name}`))
  assert.match(read('apps/web-react/public/assets/discord-logo.svg'), /#5865[Ff]2/)
  assert.match(read('apps/web-react/public/assets/gains-logo.svg'), /linearGradient/)
})


test('Instagram accepts only HTTPS profile destinations and never infers ownership', () => {
  const { instagramCommunityUrl } = load()
  for (const username of ['ExampleCommunity', 'example.community', 'example_1', 'x']) {
    assert.equal(instagramCommunityUrl(`https://instagram.com/${username}`), `https://instagram.com/${username}/`)
  }
  for (const value of ['', 'http://instagram.com/example/', 'https://www.instagram.com/example/', 'https://instagram.com.evil.test/example/', 'https://user@instagram.com/example/', 'https://instagram.com:8443/example/', 'https://instagram.com/', 'https://instagram.com/explore/', 'https://instagram.com/accounts/', 'https://instagram.com/p/123/', 'https://instagram.com/reels/', 'https://instagram.com/foo../', 'https://instagram.com/.foo/', 'https://instagram.com/foo./', 'https://instagram.com/foo/?x=1', 'https://instagram.com/foo/#x', 'https://instagram.com/' + 'x'.repeat(31), 'javascript:alert(1)']) assert.equal(instagramCommunityUrl(value), null, value)
  for (const locale of ['en', 'fa']) {
    // The Instagram promo button was retired: even a valid configured profile renders nothing.
    const doc = render(load('', '', 'https://instagram.com/ExampleCommunity/').default, locale)
    assert.equal(doc.querySelectorAll('a').length, 0)
    assert.equal(doc.querySelector('[data-provider="instagram"]'), null)
    assert.equal(doc.querySelectorAll('button[aria-disabled="true"]').length, 2)
  }
})

test('all footer marks and community glyphs are actual vectors without raster payloads', () => {
  for (const file of ['apps/web-react/src/pages/landing-body.html', 'dist/index.html']) {
    const doc = new JSDOM(read(file)).window.document
    for (const card of doc.querySelectorAll('.credits-row > a')) {
      assert.ok(card.querySelector('.service-heading > .service-logo-slot > img'))
      assert.ok(card.querySelector('.service-heading > b'))
      assert.ok(card.querySelector(':scope > .service-description'))
      const asset = card.querySelector('img').getAttribute('src')
      const svg = read(`apps/web-react/public/${asset}`)
      assert.match(svg, /<path\b/)
      assert.ok(!/<(?:image|foreignObject)\b|data:image|base64/i.test(svg), asset)
      assert.equal(svg, read(`dist/${asset}`))
    }
  }
  for (const provider of load().communityProviders) {
    const svg = read(`apps/web-react/public/assets/${provider.icon}`)
    assert.ok(!/<image\b|data:image|base64/i.test(svg), provider.id)
  }
  assert.equal((read('apps/web-react/public/assets/depay-logo.svg').match(/<path\b/g) || []).length, 23)
  const css = read('apps/web-react/src/features/community/community.css')
  assert.match(css, /height: 44px; min-height: 44px/)
  assert.match(css, /flex-wrap: wrap/)
  assert.match(css, /width: fit-content/)
  assert.match(css, /padding: 8px 12px/)
  assert.match(css, /width: 20px; height: 20px/)
  assert.match(css, /background: none; border: 0; border-radius: 0; padding: 0/)
  assert.equal(read('.env.example').includes('VITE_INSTAGRAM_COMMUNITY_URL='), true)
  assert.equal(read('render.yaml').includes('key: VITE_INSTAGRAM_COMMUNITY_URL'), true)
})
