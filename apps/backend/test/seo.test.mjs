import test from 'node:test'
import assert from 'node:assert/strict'
import { siteOrigin, sitemapXml, robotsTxt, securityTxt, SECURITY_TXT_EXPIRES, PUBLIC_SITE_ROUTES, SITE_LOCALES, localesFor } from '../seo.js'

test('site origin accepts public hostnames and rejects forged Host headers', () => {
  assert.equal(siteOrigin('openfi.cloud'), 'https://openfi.cloud')
  assert.equal(siteOrigin('OpenFund.Cloud'), 'https://openfund.cloud')
  assert.equal(siteOrigin('openfi.cloud', 'http'), 'https://openfi.cloud')
  assert.equal(siteOrigin('localhost:8080', 'http'), 'http://localhost:8080')
  for (const bad of ['', 'evil.test/x', 'a b', 'evil.test:80:1', 'evil.test:port', '"><x>', 'evil.test\r\nX: 1']) assert.equal(siteOrigin(bad), null, bad)
})

test('sitemap lists every public route per published locale with hreflang alternates', () => {
  const xml = sitemapXml('https://openfi.cloud')
  const expected = PUBLIC_SITE_ROUTES.reduce((n, route) => n + localesFor(route).length, 0)
  assert.equal((xml.match(/<url>/g) || []).length, expected)
  for (const locale of SITE_LOCALES) assert.ok(xml.includes(`<loc>https://openfi.cloud/${locale}/challenges</loc>`))
  assert.ok(xml.includes('<loc>https://openfi.cloud/en/whitepaper</loc>'))
  assert.ok(!xml.includes('/ar/whitepaper'), 'the whitepaper is a fa/en publication')
  assert.ok(xml.includes('<loc>https://openfi.cloud/fa/campaign</loc>') && xml.includes('<loc>https://openfi.cloud/en/campaign</loc>'))
  assert.ok(!/\/(ar|ru|zh-CN)\/campaign/.test(xml), 'the campaign landing is a fa/en page')
  assert.ok(!/\/(?:prop|perpetual)\//.test(xml), 'authenticated product routes are never listed')
})

test('robots policy excludes product routes and points at the same-origin sitemap', () => {
  const robots = robotsTxt('https://openfund.cloud')
  assert.match(robots, /^User-agent: \*$/m)
  for (const locale of SITE_LOCALES) assert.match(robots, new RegExp(`^Disallow: /${locale}/prop/$`, 'm'))
  assert.match(robots, /^Sitemap: https:\/\/openfund\.cloud\/sitemap\.xml$/m)
})

test('security.txt (RFC 9116): private advisory contact, policy on the same origin, an expiry that is renewed in time', () => {
  const txt = securityTxt('https://openfund.cloud')
  assert.match(txt, /^Contact: https:\/\/github\.com\/algomanlife\/openfund\/security\/advisories\/new$/m)
  assert.match(txt, /^Policy: https:\/\/openfund\.cloud\/en\/bug-bounty$/m)
  assert.match(txt, /^Canonical: https:\/\/openfund\.cloud\/\.well-known\/security\.txt$/m)
  const expires = Date.parse(SECURITY_TXT_EXPIRES)
  assert.match(txt, new RegExp(`^Expires: ${SECURITY_TXT_EXPIRES.replace(/\./g, '\\.')}$`, 'm'))
  assert.ok(expires - Date.now() > 60 * 86_400_000, 'security.txt expires within 60 days: renew SECURITY_TXT_EXPIRES')
  assert.ok(expires - Date.now() < 366 * 86_400_000, 'RFC 9116 recommends an expiry under a year away')
  assert.ok(PUBLIC_SITE_ROUTES.includes('bug-bounty'), 'the bounty page is in the sitemap')
})
