/* Campaigns and announcement bars — browser acceptance (workstreams 2 and 4).
 *
 * Real Directus 11.17.4 with the bootstrap schema, the restricted Backstage
 * editor token, the local backend and the built site:
 *  - the seeded Persian Iran bar: fa only, above the header, CTA openfi.live
 *    in a new tab, close persists for the session, no overflow on mobile;
 *  - Backstage edits and publishes a bar and a popup; the site updates with
 *    no deploy (and through the /cms snapshot used by IRAN);
 *  - the popup: delay, hidden-tab pause, focus, Escape, backdrop, focus
 *    return, session cap, not on checkout, coupon CTA into checkout;
 *  - counters, deactivation, and a refused publication for an invalid coupon;
 *  - a non-dismissible warning bar targeted at the terminal shows on the
 *    trading page with no close button, and never on the public pages.
 *
 * Env: TEST_BACKEND_URL (local site), DIRECTUS_URL, BACKSTAGE_DIRECTUS_TOKEN
 * (editor role), ADMIN_API_TOKEN, DATABASE_URL (*_test or *_ci), OUTPUT_DIR. */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createBackstage } from '../apps/backstage/operations/server.js'
import { createVerifier } from '../apps/backstage/operations/password.js'

const site = new URL(process.env.TEST_BACKEND_URL || 'http://localhost:8080')
const cms = new URL(process.env.DIRECTUS_URL || 'http://localhost:8055')
const db = new URL(process.env.DATABASE_URL || 'postgres://x@localhost/x')
const loopback = u => ['localhost', '127.0.0.1'].includes(u.hostname)
if (![site, cms, db].every(loopback) || !/(_test|_ci)$/.test(db.pathname) || !process.env.BACKSTAGE_DIRECTUS_TOKEN || !process.env.ADMIN_API_TOKEN)
  throw new Error('Campaign acceptance requires a local site, a disposable Directus and database, and test tokens')
const OUT = process.env.OUTPUT_DIR || 'output/playwright/campaigns'
await mkdir(OUT, { recursive: true })
const owner = 'campaign-owner', password = randomBytes(18).toString('base64url'), port = Number(process.env.BACKSTAGE_TEST_PORT || 8318)
const origin = `http://127.0.0.1:${port}`
const server = createBackstage({ origin, backend: site.origin, cms: cms.origin, owner, realSettlement: false,
  verifier: await createVerifier(password), credential: process.env.ADMIN_API_TOKEN, contentToken: process.env.BACKSTAGE_DIRECTUS_TOKEN }, { audit: () => {} })
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
const tag = randomBytes(3).toString('hex')
const results = []
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); results.push(name); console.log('PASS - ' + name) }
const adminApi = (path, body) => fetch(new URL('/admin' + path, site), { method: body ? 'POST' : 'GET',
  headers: { authorization: `Bearer ${process.env.ADMIN_API_TOKEN}`, 'x-admin-actor': 'campaign-acceptance', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(r => r.json())

/* archive what earlier runs of this test published (editor token: no deletes) */
{
  const auth = { Authorization: `Bearer ${process.env.BACKSTAGE_DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' }
  const listed = await (await fetch(new URL('/items/site_campaigns?fields=id,internal_name&limit=-1&filter[status][_neq]=archived', cms), { headers: auth })).json()
  for (const c of listed.data ?? []) if (/^(en-notice|spring|terminal-warning)-/.test(c.internal_name))
    await fetch(new URL(`/items/site_campaigns/${c.id}`, cms), { method: 'PATCH', headers: auth, body: JSON.stringify({ status: 'archived' }) })
}
const browser = await chromium.launch()
const errors = []
const fresh = async (viewport = { width: 1280, height: 860 }) => {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(String(e)))
  return { context, page }
}
const shot = (page, name) => page.screenshot({ path: join(OUT, name + '.png') })
/* submit a Backstage dialog and wait until it closes; surface its error otherwise */
async function submit(dialogLocator, buttonName) {
  await dialogLocator.getByRole('button', { name: buttonName, exact: true }).click()
  const closed = await dialogLocator.waitFor({ state: 'hidden', timeout: 15000 }).then(() => true, () => false)
  if (!closed) throw new Error(`${buttonName} refused: ${await dialogLocator.locator('[role=alert]').last().innerText()}`)
}
const bar = page => page.locator('aside.of-announcement')
async function openSite(page, path) { await page.goto(new URL(path, site).href, { waitUntil: 'load' }); await page.waitForTimeout(1500) }

try {
  /* ---------- A. the seeded Persian Iran-access bar ---------- */
  {
    const { context, page } = await fresh()
    await openSite(page, '/fa/home')
    await bar(page).waitFor({ timeout: 15000 })
    const cta = bar(page).getByRole('link', { name: 'ورود به اوپن‌فاند ایران' })
    ok('fa: bar shows the Iran CTA', await cta.count() === 1)
    ok('fa: CTA opens https://openfi.live/ in a new tab safely', await cta.getAttribute('href') === 'https://openfi.live/' && await cta.getAttribute('target') === '_blank' && (await cta.getAttribute('rel')).includes('noopener'))
    const box = await bar(page).boundingBox(), header = await page.locator('header').first().boundingBox()
    ok('fa: bar sits above the header without overlapping it', box && header && box.y + box.height <= header.y + 1, `${box?.y}+${box?.height} vs ${header?.y}`)
    ok('fa: bar is right-to-left', await bar(page).getAttribute('dir') === 'rtl')
    await shot(page, 'announcement-fa-desktop')
    for (const locale of ['en', 'ar', 'ru', 'zh-CN']) {
      await openSite(page, `/${locale}/home`)
      /* other announcements may exist for this locale; the Persian bar must not */
      const leaked = await page.evaluate(() => [...document.querySelectorAll('aside.of-announcement')].some(a => a.lang === 'fa' || a.querySelector('a[href="https://openfi.live/"]')))
      ok(`${locale}: the fa-only bar is not shown`, !leaked)
    }
    await shot(page, 'announcement-hidden-en-desktop')
    await openSite(page, '/fa/challenges')
    await bar(page).getByRole('button', { name: 'بستن' }).click()
    ok('close hides the bar', await bar(page).count() === 0)
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1500)
    ok('closed bar stays hidden for the session', await bar(page).count() === 0)
    await context.close()
  }
  for (const width of [375, 390, 430, 768]) {
    const { context, page } = await fresh({ width, height: 820 })
    await openSite(page, '/fa/home')
    await bar(page).waitFor({ timeout: 15000 })
    const m = await page.evaluate(() => {
      const b = document.querySelector('aside.of-announcement').getBoundingClientRect(), h = document.querySelector('header').getBoundingClientRect()
      const close = document.querySelector('.of-announcement-close').getBoundingClientRect()
      return { overflow: document.documentElement.scrollWidth - innerWidth, below: h.top >= b.bottom - 1, close: Math.min(close.width, close.height), headerVisible: h.height > 0 }
    })
    ok(`fa ${width}px: no horizontal overflow, header intact below the bar, 36px close target`, m.overflow <= 0 && m.below && m.headerVisible && m.close >= 36, JSON.stringify(m))
    if (width === 375) await shot(page, 'announcement-fa-mobile')
    await context.close()
  }

  /* ---------- B. Backstage: edit and publish the bar (no deploy) ---------- */
  const { context: bsContext, page: bs } = await fresh({ width: 1360, height: 900 })
  await bs.goto(origin)
  await bs.getByLabel('Owner identity').fill(owner)
  await bs.getByLabel('Password', { exact: true }).fill(password)
  await bs.getByRole('button', { name: 'Sign in', exact: true }).click()
  await bs.getByRole('heading', { name: 'Overview' }).waitFor()
  const nav = name => bs.locator('aside').getByRole('link', { name, exact: true }).click()
  const dialog = bs.getByRole('dialog')
  await nav('Announcement banners')
  await bs.getByRole('heading', { name: 'Announcement banners', level: 1 }).waitFor()
  const row = bs.getByRole('row').filter({ hasText: 'iran-access-fa' })
  await row.waitFor()
  ok('Backstage lists the seeded bar as published and live', /Published/.test(await row.innerText()) && /Live/.test(await row.innerText()))
  await row.getByRole('button', { name: 'Edit' }).click()
  const faCopy = dialog.locator('fieldset.locale-copy[data-locale="fa"]')
  const newText = `اطلاعیهٔ آزمایشی ${tag}: نسخهٔ ایرانی اوپن‌فاند در دسترس است.`
  await faCopy.getByLabel('Headline').fill(newText)
  ok('Backstage preview renders the bar RTL with the new copy', (await dialog.locator('.pv-bar[dir="rtl"]').innerText()).includes(tag))
  await shot(bs, 'backstage-announcement-edit')
  await dialog.getByLabel('Password', { exact: true }).fill(password)
  await submit(dialog, 'Publish')
  {
    const { context, page } = await fresh()
    await openSite(page, '/fa/home')
    await bar(page).waitFor({ timeout: 15000 })
    ok('the site shows the edited bar without a deploy', (await bar(page).innerText()).includes(tag))
    const snapshot = await (await fetch(new URL('/cms/items/site_campaigns?fields=internal_name,translations.headline', site))).json()
    ok('the IRAN content path (/cms snapshot) serves the published bar', JSON.stringify(snapshot).includes(tag))
    await context.close()
  }

  /* an English-only neutral announcement: shown in en, never in fa */
  await bs.getByRole('button', { name: 'New announcement' }).click()
  await dialog.getByLabel('Internal name (a-z, 0-9, -)').fill(`en-notice-${tag}`)
  await dialog.getByLabel('Style').selectOption('neutral')
  await dialog.locator('fieldset.choices').filter({ hasText: 'Languages' }).getByLabel('فارسی').uncheck()
  await dialog.locator('fieldset.choices').filter({ hasText: 'Languages' }).getByLabel('English').check()
  await dialog.locator('fieldset.locale-copy[data-locale="en"]').getByLabel('Headline').fill(`Scheduled maintenance notice ${tag}`)
  await dialog.getByLabel('Password', { exact: true }).fill(password)
  await submit(dialog, 'Publish')
  {
    const { context, page } = await fresh()
    await openSite(page, '/en/home'); await bar(page).waitFor({ timeout: 15000 })
    ok('en: the English-only announcement appears', (await bar(page).innerText()).includes(`maintenance notice ${tag}`))
    await openSite(page, '/fa/home'); await bar(page).waitFor({ timeout: 15000 })
    ok('fa: still the Persian bar, never the English one', !(await bar(page).innerText()).includes('maintenance'))
    await context.close()
  }

  /* ---------- C. popup with a coupon ---------- */
  const code = `OPENFUND20-${tag.toUpperCase()}`
  const created = await adminApi('/coupons', { code, kind: 'percent', value: 20, maxRedemptions: 100 })
  await adminApi(`/coupons/${created.coupon.id}`, { status: 'active' })
  await nav('Promotional campaigns')
  await bs.getByRole('heading', { name: 'Promotional campaigns', level: 1 }).waitFor()
  await bs.getByRole('button', { name: 'New campaign' }).click()
  await dialog.getByLabel('Internal name (a-z, 0-9, -)').fill(`spring-${tag}`)
  const langs = dialog.locator('fieldset.choices').filter({ hasText: 'Languages' })
  await langs.getByLabel('English').check()
  await dialog.locator('fieldset.choices').filter({ hasText: 'Regions' }).getByLabel('IRAN').uncheck()
  await dialog.getByLabel('Button destination (https:// or /path)').fill('/en/checkout?plan=standard')
  await dialog.getByLabel('Coupon code (reference)').fill(code)
  await dialog.getByLabel('Coupon code (reference)').blur()
  await dialog.getByText('valid for promotion').waitFor()
  await dialog.getByLabel('Delay (seconds)').fill('3')
  await dialog.locator('input[type=file]').first().setInputFiles('docs/assets/screenshots/website-tool-risk-en.jpg')
  await dialog.getByText('Uploaded to the media library').first().waitFor({ timeout: 20000 })
  const en = dialog.locator('fieldset.locale-copy[data-locale="en"]'), fa = dialog.locator('fieldset.locale-copy[data-locale="fa"]')
  await en.getByLabel('Headline').fill('20% off your first challenge'); await en.getByLabel('Text').fill('Apply the code at checkout. Terms apply.')
  await en.getByLabel('Button label').fill('Choose a challenge'); await en.getByLabel('Image description').fill('Openfund risk tool')
  await fa.getByLabel('Headline').fill('۲۰٪ تخفیف اولین چالش'); await fa.getByLabel('Text').fill('کد را هنگام پرداخت وارد کنید.')
  await fa.getByLabel('Button label').fill('انتخاب چالش'); await fa.getByLabel('Image description').fill('ابزار ریسک اوپن‌فاند')
  ok('Backstage preview shows the image, copy and coupon', await dialog.locator('.pv-modal img').count() === 1 && (await dialog.locator('.pv-modal').innerText()).includes(code))
  await shot(bs, 'backstage-campaign-create')
  await dialog.getByLabel('Password', { exact: true }).fill(password)
  await submit(dialog, 'Publish')
  {
    const { context, page } = await fresh()
    await openSite(page, '/en/home')
    const t0 = Date.now()
    const popup = page.getByRole('dialog')
    await popup.waitFor({ timeout: 15000 })
    ok('popup opens after its delay (≥ 3 s of visible time)', Date.now() - t0 >= 1400, `${Date.now() - t0} ms after load+1.5 s`)
    ok('popup is a labelled modal with the coupon', await popup.getAttribute('aria-modal') === 'true' && (await popup.innerText()).includes(code))
    ok('focus moves into the popup (close button)', await page.evaluate(() => document.activeElement?.classList.contains('of-promo-close')))
    ok('background scroll is locked', await page.evaluate(() => getComputedStyle(document.body).overflow === 'hidden'))
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab')
    ok('Tab stays inside the popup', await page.evaluate(() => Boolean(document.activeElement?.closest('.of-promo'))))
    await page.waitForFunction(() => document.querySelector('.of-promo img')?.complete, null, { timeout: 15000 })
    ok('the campaign image loads from the public media folder', await page.evaluate(() => document.querySelector('.of-promo img').naturalWidth > 0))
    await shot(page, 'popup-en-desktop')
    await page.keyboard.press('Escape')
    ok('Escape closes it and unlocks scroll', await popup.count() === 0 && await page.evaluate(() => getComputedStyle(document.body).overflow !== 'hidden'))
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(5000)
    ok('not shown again in the same session (also on another route)', await page.getByRole('dialog').count() === 0)
    await openSite(page, '/en/challenges'); await page.waitForTimeout(4000)
    ok('no popup on route change in the same session', await page.getByRole('dialog').count() === 0)
    await context.close()
  }
  {
    const { context, page } = await fresh()
    await page.addInitScript(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hidden === true }); window.__hidden = true })
    await openSite(page, '/en/home'); await page.waitForTimeout(5000)
    ok('the delay does not run while the tab is hidden', await page.getByRole('dialog').count() === 0)
    await page.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')) })
    await page.getByRole('dialog').waitFor({ timeout: 8000 })
    ok('it resumes when the tab is visible again', true)
    await page.locator('.of-promo-backdrop').click({ position: { x: 5, y: 5 } })
    ok('backdrop click closes it', await page.getByRole('dialog').count() === 0)
    await context.close()
  }
  {
    const { context, page } = await fresh()
    await openSite(page, '/en/checkout?plan=standard'); await page.waitForTimeout(5000)
    ok('never on checkout', await page.getByRole('dialog').count() === 0)
    await openSite(page, '/en/home')
    const popup = page.getByRole('dialog'); await popup.waitFor({ timeout: 15000 })
    await popup.getByRole('link', { name: 'Choose a challenge' }).click()
    await page.waitForURL(u => u.pathname === '/en/checkout')
    const url = new URL(page.url())
    ok('the CTA opens checkout with the coupon applied to the URL', url.searchParams.get('coupon') === code && url.searchParams.get('plan') === 'standard', url.search)
    await context.close()
  }
  for (const [width, locale, name] of [[390, 'en', 'popup-en-mobile'], [1280, 'fa', 'popup-fa-desktop'], [768, 'fa', 'popup-fa-tablet']]) {
    const { context, page } = await fresh({ width, height: 860 })
    await openSite(page, `/${locale}/home`)
    const popup = page.getByRole('dialog'); await popup.waitFor({ timeout: 15000 })
    const m = await page.evaluate(() => {
      const p = document.querySelector('.of-promo').getBoundingClientRect(), c = document.querySelector('.of-promo-close').getBoundingClientRect()
      return { inside: p.left >= 0 && p.right <= innerWidth + 0.5, closeVisible: c.top >= 0 && c.right <= innerWidth + 0.5 && c.width >= 40, overflow: document.documentElement.scrollWidth - innerWidth, dir: document.querySelector('.of-promo').getAttribute('dir') }
    })
    ok(`${locale} ${width}px: popup fits, close reachable, no overflow, ${locale === 'fa' ? 'RTL' : 'LTR'}`, m.inside && m.closeVisible && m.overflow <= 0 && m.dir === (locale === 'fa' ? 'rtl' : 'ltr'), JSON.stringify(m))
    await shot(page, name)
    await context.close()
  }

  /* ---------- D. counters, deactivation, invalid coupon ---------- */
  await bs.getByRole('button', { name: 'Refresh', exact: true }).click(); await bs.getByRole('heading', { name: 'Promotional campaigns', level: 1 }).waitFor()
  const promoRow = bs.getByRole('row').filter({ hasText: `spring-${tag}` })
  await promoRow.waitFor()
  const cells = await promoRow.locator('td').allInnerTexts()
  ok('Backstage shows impressions, clicks, closes and CTR', Number(cells[7].replace(/\D/g, '')) >= 5 && Number(cells[8].replace(/\D/g, '')) >= 1 && Number(cells[9].replace(/\D/g, '')) >= 2 && /%/.test(cells[10]), cells.slice(7, 11).join(' | '))
  await shot(bs, 'backstage-campaign-list')
  await promoRow.getByRole('button', { name: 'Deactivate' }).click()
  await dialog.getByLabel('Password', { exact: true }).fill(password)
  await submit(dialog, 'Confirm decision')
  {
    const { context, page } = await fresh()
    await openSite(page, '/en/home'); await page.waitForTimeout(5000)
    ok('a deactivated campaign disappears from the site immediately', await page.getByRole('dialog').count() === 0)
    await context.close()
  }
  const coupon = (await adminApi('/coupons')).coupons.find(c => c.code === code)
  await adminApi(`/coupons/${coupon.id}`, { status: 'inactive' })
  await promoRow.getByRole('button', { name: 'Activate' }).click()
  await dialog.getByLabel('Password', { exact: true }).fill(password)
  await dialog.getByRole('button', { name: 'Confirm decision' }).click()
  await dialog.getByText('the coupon is not valid for promotion now').waitFor()
  ok('reactivation is refused while its coupon is disabled (no invalid discount promise)', true)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await bsContext.close()

  /* ---------- terminal targeting, tone and the non-dismissible switch ---------- */
  {
    const auth = { Authorization: `Bearer ${process.env.BACKSTAGE_DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' }
    const created = await fetch(new URL('/items/site_campaigns', cms), { method: 'POST', headers: auth, body: JSON.stringify({
      internal_name: `terminal-warning-${tag}`, placement: 'announcement_bar', status: 'published', active: true, style: 'warning', dismissible: false, priority: 900,
      locales: ['en'], regions: ['GLOBAL', 'IRAN'], pages: ['terminal'], frequency: 'session',
      translations: [{ language_code: 'en', headline: `Scheduled maintenance ${tag}` }] }) })
    ok('the editor role can create a terminal-targeted warning bar', created.ok, String(created.status))
    const { context, page } = await fresh()
    await openSite(page, '/en/prop/trade'); await page.waitForTimeout(1500)
    const terminalBar = page.locator('aside.of-announcement', { hasText: `Scheduled maintenance ${tag}` })
    await terminalBar.waitFor({ timeout: 15000 })
    ok('terminal: the warning bar shows above the terminal header', await terminalBar.evaluate(a => a.classList.contains('of-announcement-warning') && a.getAttribute('role') === 'alert'
      && a.getBoundingClientRect().bottom <= document.querySelector('.of-terminal-header').getBoundingClientRect().top + 1))
    ok('terminal: a non-dismissible bar has no close button', await terminalBar.locator('.of-announcement-close').count() === 0)
    await shot(page, 'terminal-warning-bar')
    await openSite(page, '/en/home')
    ok('a terminal-only bar never shows on the public pages', await page.locator('aside.of-announcement', { hasText: `Scheduled maintenance ${tag}` }).count() === 0)
    await context.close()
  }
  ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  console.log(`${results.length} campaign checks passed`)
} finally {
  await browser.close()
  server.close()
}
