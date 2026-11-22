/* Contact page browser acceptance: compact hero with the routing animation,
 * two columns from 1024 px (side column left in RTL, right in LTR), no
 * orphan card, no empty "email not published" line, no pending help links,
 * the form title below the sticky header after choosing a team, team buttons
 * synced with the form select, required-field progress, a real submission
 * with the envelope and typed reference, mobile order, 44 px targets,
 * dark/light, RTL/LTR and reduced motion. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/contact'))
fs.mkdirSync(OUT, { recursive: true })
const results = []
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); results.push(name); console.log('PASS - ' + name) }

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const open = async (route, { width = 1440, height = 900, theme = 'dark', reducedMotion = 'no-preference', touch = false } = {}) => {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion, hasTouch: touch, isMobile: touch })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(String(e)))
    await page.goto(BASE + route, { waitUntil: 'load' })
    await page.locator('#contact-form').waitFor({ timeout: 30000 })
    return { context, page }
  }
  const scrollThrough = async page => {
    const h = await page.evaluate(() => innerHeight)
    for (let y = 0; y < 6000; y += h * 0.7) { await page.evaluate(v => scrollTo(0, v), y); await page.waitForTimeout(120) }
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(500)
  }
  try {
    for (const [route, opts, shot] of [
      ['/en/contact', { width: 1440, theme: 'dark' }, 'contact-en-dark-1440'],
      ['/fa/contact', { width: 1440, theme: 'light' }, 'contact-fa-light-1440'],
      ['/fa/contact', { width: 1024, height: 768, theme: 'dark' }, 'contact-fa-dark-1024'],
      ['/en/contact', { width: 768, height: 1024, theme: 'light' }, 'contact-en-light-768'],
      ['/fa/contact', { width: 390, height: 844, theme: 'dark', touch: true }, 'contact-fa-dark-390'],
      ['/en/contact', { width: 390, height: 844, theme: 'light', touch: true }, 'contact-en-light-390'],
    ]) {
      const { context, page } = await open(route, opts)
      const m = await page.evaluate(() => {
        const rect = s => document.querySelector(s)?.getBoundingClientRect()
        const form = rect('#contact-form'), teams = rect('.co-contact-teams'), safety = rect('.co-contact-body > .co-safety'), tele = rect('.co-telegram-card')
        const small = [...document.querySelectorAll('.co-dept-select, .co-help a, .co-field input, .co-field select, .co-form .button')].filter(e => e.getBoundingClientRect().height < 44).length
        return { overflow: document.documentElement.scrollWidth - innerWidth, hero: rect('.co-contact-hero').height, vh: innerHeight,
          twoCol: Math.abs(form.top - teams.top) < 60 && Math.abs(form.left - teams.left) > 100, teamsLeft: teams.left < form.left,
          order: [safety.top, teams.top, form.top, tele.top], route: Boolean(document.querySelector('.co-route')),
          pending: document.querySelectorAll('.co-help-pending, [aria-disabled=true]').length, emailPending: /not published yet|منتشر نشده/.test(document.body.innerText),
          tiles: document.querySelectorAll('.co-help a .co-help-icon').length, small }
      })
      const rtl = route.startsWith('/fa'), wide = (opts.width || 1440) >= 1024
      ok(`${shot}: no overflow, compact hero with routing art, no empty email line, no pending help links, 8 icon tiles`,
        m.overflow <= 0 && m.hero < m.vh * 0.9 && m.route && !m.emailPending && m.pending === 0 && m.tiles === 8, JSON.stringify(m))
      if (wide) ok(`${shot}: form and side column side by side, side column on the ${rtl ? 'left (RTL)' : 'right (LTR)'}`, m.twoCol && m.teamsLeft === rtl, JSON.stringify(m))
      else ok(`${shot}: one column in order safety, teams, form, Telegram`, m.order.every((v, i, a) => !i || v > a[i - 1]), JSON.stringify(m.order))
      if (opts.touch) ok(`${shot}: touch targets at least 44 px`, m.small === 0, String(m.small))
      await scrollThrough(page)
      await page.screenshot({ path: path.join(OUT, shot + '.png'), fullPage: true })
      await context.close()
    }
    /* team choice, header-aware scroll, progress, submission */
    {
      const { context, page } = await open('/en/contact', { width: 1280, height: 800 })
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300)
      await page.click('.co-dept-select >> nth=2'); await page.waitForTimeout(900)
      const s = await page.evaluate(() => ({ title: document.getElementById('form-title').getBoundingClientRect().top, header: document.querySelector('.openfund-header').getBoundingClientRect().bottom,
        dept: document.querySelector('select[name=department]').value, pressed: [...document.querySelectorAll('.co-dept-select')].map(b => b.getAttribute('aria-pressed')), focus: document.activeElement.name,
        node: document.querySelector('.co-route-node.is-active') !== null }))
      ok('choosing a team selects it in the form, marks it pressed, focuses the form and keeps the title below the sticky header', s.dept === 'technical' && s.pressed.filter(x => x === 'true').length === 1 && s.pressed[2] === 'true' && s.focus === 'fullName' && s.title >= s.header && s.node, JSON.stringify(s))
      await page.selectOption('select[name=department]', 'legal')
      ok('changing the form select updates the team buttons', await page.evaluate(() => document.querySelectorAll('.co-dept-select')[1].getAttribute('aria-pressed') === 'true'))
      const progress = () => page.evaluate(() => Number(document.querySelector('.co-progress').getAttribute('aria-valuenow')))
      const p0 = await progress()
      await page.fill('input[name=fullName]', 'Test Person'); await page.fill('input[name=email]', 'test.person@example.test')
      await page.fill('input[name=subject]', 'Browser acceptance'); await page.fill('textarea[name=message]', 'This is an automated acceptance message from the contact page test.')
      const p4 = await progress(); await page.check('input[name=privacyConsent]'); const p5 = await progress()
      ok('the required-fields progress counts valid required fields (0 → 4 → 5 of 5)', p0 === 0 && p4 === 4 && p5 === 5, `${p0} ${p4} ${p5}`)
      await page.waitForTimeout(3200) /* the server rejects submissions faster than 3 s */
      await page.click('.co-form button.button')
      await page.locator('.co-form-done').waitFor({ timeout: 15000 })
      const d = await page.evaluate(() => ({ envelope: Boolean(document.querySelector('.co-envelope')), sr: document.querySelector('.co-typed .sr-only').textContent, role: document.querySelector('.co-form-done').getAttribute('role') }))
      await page.waitForTimeout(2500)
      const typed = await page.evaluate(() => document.querySelector('.co-typed [aria-hidden=true]').textContent)
      ok('success shows the envelope and types out the reference, with the full reference in the status text', d.envelope && d.role === 'status' && d.sr.length > 4 && typed === d.sr, JSON.stringify({ ...d, typed }))
      await page.screenshot({ path: path.join(OUT, 'contact-success-en.png'), clip: await page.locator('.co-form-card').boundingBox() })
      await context.close()
    }
    /* reduced motion: static routing art, instant reference */
    {
      const { context, page } = await open('/fa/contact', { reducedMotion: 'reduce' })
      const r = await page.evaluate(() => ({ pulse: getComputedStyle(document.querySelector('.co-route-pulse')).animationName, glow: getComputedStyle(document.querySelector('.co-route-node.is-active .co-route-glow')).opacity }))
      ok('reduced motion: no pulse animation, the selected node stays lit', r.pulse === 'none' && Number(r.glow) > 0, JSON.stringify(r))
      await context.close()
    }
    ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log(`${results.length} contact page checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
