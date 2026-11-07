const assert = require('node:assert/strict')
const { chromium } = require('playwright')

const cms = process.env.DIRECTUS_URL
const app = process.env.TEST_FRONTEND_URL
const database = process.env.DATABASE_URL
if (!cms || !app || !database ||
    !['127.0.0.1', 'localhost'].includes(new URL(cms).hostname) ||
    !['127.0.0.1', 'localhost'].includes(new URL(app).hostname) ||
    !/(?:^|[_-])ci(?:$|[_-])/.test(new URL(database).pathname.slice(1)))
  throw Error('The CMS live-edit browser check requires a disposable local CI database and local services.')

async function request(path, token, method = 'GET', body) {
  const response = await fetch(new URL(path, cms), {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw Error(`CMS ${method} ${path.split('?')[0]} returned ${response.status}`)
  return response.json()
}

;(async () => {
  const login = await request('/auth/login', null, 'POST', {
    email: process.env.DIRECTUS_ADMIN_EMAIL,
    password: process.env.DIRECTUS_ADMIN_PASSWORD,
  })
  const token = login.data.access_token
  const home = await request('/items/home_content?fields=translations.id,translations.language_code,translations.prop_description', token)
  const persian = home.data.translations.find(t => t.language_code === 'fa')
  assert.ok(persian?.id, 'Persian Home translation missing')
  const marker = `CMS live-edit check ${Date.now()}`
  let browser
  try {
    await request(`/items/home_content_translations/${persian.id}`, token, 'PATCH', { prop_description: marker })
    browser = await chromium.launch()
    const page = await browser.newPage()
    await page.goto(`${app}/#/fa/home`)
    await page.locator('.home-products .home-product-note').first().filter({ hasText: marker }).waitFor({ timeout: 15000 })
    assert.equal(await page.locator('.home-products .home-product-note').first().textContent(), marker)
    console.log('PASS: Directus edit appeared in Persian Home without a frontend rebuild.')
  } finally {
    await browser?.close()
    await request(`/items/home_content_translations/${persian.id}`, token, 'PATCH', { prop_description: persian.prop_description || '' })
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
