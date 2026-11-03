/* Actual candidate UI. No market, account, payment or CMS interception. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8293/react').replace(/\/$/, '');
const capture = process.env.REFRESH_CAPTURE === '1';
const out = path.resolve('output/playwright/website-refresh');
fs.mkdirSync(out, { recursive: true });
const checks = [], captures = [];
function check(name, value) { assert.ok(value, name); checks.push(name); }
// These synthetic destinations test validation only; none is asserted to belong to Openfund.
function configuredCommunityChecks() {
  const { buildSync } = require('../apps/web-react/node_modules/esbuild');
  const { createRequire } = require('node:module');
  const appRequire = createRequire(path.resolve('apps/web-react/package.json'));
  for (const value of ['', 'https://telegram.org/', 'https://t.me/ExampleCommunity', 'https://t.me/+ExampleInvite', 'javascript:alert(1)', 'https://t.me.evil.test/ExampleCommunity']) {
    const result = buildSync({ entryPoints: ['apps/web-react/src/features/community/TelegramCommunity.tsx'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', loader: { '.css': 'empty' }, define: { 'import.meta.env.BASE_URL': '"/react/"', 'import.meta.env.VITE_TELEGRAM_COMMUNITY_URL': JSON.stringify(value) }, jsx: 'automatic' });
    const mod = { exports: {} }; new Function('require', 'module', 'exports', result.outputFiles[0].text)(appRequire, mod, mod.exports);
    const valid = value === 'https://t.me/ExampleCommunity' || value === 'https://t.me/+ExampleInvite';
    check(`community URL validation: ${value || 'unset'}`, Boolean(mod.exports.community.url) === valid);
    const markup = appRequire('react-dom/server').renderToStaticMarkup(appRequire('react').createElement(mod.exports.default, { locale: 'en' }));
    check(`community state rendering: ${value || 'unset'}`, valid ? markup.includes('rel="noopener noreferrer"') && markup.includes(`href="${value}"`) : markup.includes('aria-disabled="true"') && !/<a\b/.test(markup));
  }
}
async function shot(page, name, route, locator) {
  const file = `refresh-${name}.png`;
  const target = capture ? path.resolve('docs/assets/screenshots', file) : path.join(out, file);
  await (locator || page).screenshot({ path: target, animations: 'disabled' });
  captures.push({ file, route, viewport: page.viewportSize(), session: 'anonymous',
    state: 'Actual candidate application; live public CMS and Gains responses when available, explicit unavailable states otherwise; no request fixtures',
    baseline: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    candidate: true, source: 'website refresh working tree (unreleased)', capturedAt: new Date().toISOString() });
}
(async () => {
  configuredCommunityChecks();
  const browser = await chromium.launch();
  try {
    for (const locale of ['fa', 'en']) for (const theme of ['dark', 'light']) for (const width of [390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => localStorage.setItem('of-theme', theme), theme);
      const page = await context.newPage();
      await page.goto(`${BASE}/#/${locale}/challenges`);
      await page.locator('footer .telegram-community').waitFor();
      await page.waitForFunction(locale => document.documentElement.lang === locale, locale);
      const tag = `${locale}/${theme}/${width}`;
      check(`${tag} direction`, await page.locator('html').getAttribute('dir') === (locale === 'fa' ? 'rtl' : 'ltr'));
      check(`${tag} theme`, await page.locator('html').getAttribute('data-theme') === theme);
      check(`${tag} platforms`, await page.locator('.desktop-btns .desktop-btn').count() === 5);
      check(`${tag} truthful availability`, await page.locator('.desktop-btns a').count() === 0 && await page.locator('.desktop-btns [aria-disabled="true"]').count() === 5);
      check(`${tag} heading`, await page.locator('.desktop-title').innerText() === (locale === 'fa' ? 'دسکتاپ و موبایل' : 'Desktop & Mobile'));
      check(`${tag} localized availability`, (await page.locator('.desktop-btns small').allTextContents()).every(t => t === (locale === 'fa' ? 'به‌زودی' : 'Coming Soon')));
      check(`${tag} five services`, await page.locator('.credits-row > a').count() === 5);
      check(`${tag} attribution`, (await page.locator('footer').innerText()).includes(locale === 'fa' ? 'توسعه داده شده توسط معامله‌گران' : 'Developed by Traders'));
      check(`${tag} no obsolete label`, !/External resource|منبع خارجی|Developed in San Francisco|توسعه‌داده‌شده در سان‌فرانسیسکو/.test(await page.locator('footer').innerText()));
      check(`${tag} two Telegram actions`, await page.locator('.telegram-community').count() === 2);
      const telegram = page.locator('.hero .telegram-community');
      check(`${tag} unavailable community does not navigate`, await telegram.getAttribute('href') === null && await telegram.getAttribute('aria-disabled') === 'true');
      check(`${tag} localized Telegram`, (await telegram.locator('span').innerText()).trim() === (locale === 'fa' ? 'جامعه معامله‌گران' : 'Traders talk on'));
      check(`${tag} visible community availability`, await telegram.locator('small').innerText() === (locale === 'fa' ? 'به‌زودی' : 'Coming Soon'));
      const urlBefore = page.url(); await telegram.dispatchEvent('click'); check(`${tag} unavailable click stays on page`, page.url() === urlBefore);
      await telegram.focus();
      check(`${tag} keyboard focus`, await telegram.evaluate(el => document.activeElement === el && getComputedStyle(el).outlineStyle !== 'none'));
      check(`${tag} reduced motion`, await telegram.evaluate(el => getComputedStyle(el).transitionDuration === '0s'));
      await page.waitForFunction(() => [...document.querySelectorAll('.credits-row img,.desktop-btns img,.telegram-community img')].every(img => img.complete && img.naturalWidth > 0));
      check(`${tag} images load`, await page.locator('.credits-row img,.desktop-btns img,.telegram-community img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)));
      check(`${tag} official images preserve geometry`, await page.locator('.credits-row img,.desktop-btns img,.telegram-community img').evaluateAll(images => images.every(img => getComputedStyle(img).objectFit === 'contain')));
      const destinations = await page.locator('.credits-row > a').evaluateAll(links => links.map(a => a.href));
      check(`${tag} truthful service destinations`, ['https://gains.trade/', 'https://www.tradingview.com/news/', 'https://depay.com/'].every(url => destinations.includes(url)));
      check(`${tag} DePay description`, (await page.locator('a[href="https://depay.com/"]').innerText()).includes(locale === 'fa' ? 'سیستم دریافت و پرداخت' : 'Payment & Collection System'));
      check(`${tag} Shiraz preserved`, (await page.locator('footer').innerText()).includes(locale === 'fa' ? 'شیراز' : 'Shiraz'));
      check(`${tag} no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (width === 1440 && theme === 'dark') {
        await page.evaluate(() => scrollTo(0, 0));
        await shot(page, `challenges-${locale}`, `/react/#/${locale}/challenges`);
        await shot(page, `downloads-${locale}`, `/react/#/${locale}/challenges#desktop`, page.locator('#desktop'));
        await shot(page, `footer-${locale}`, `/react/#/${locale}/challenges`, page.locator('footer'));
      }
      await context.close();
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await page.goto(`${BASE}/#/fa/home`);
    await page.locator('footer .telegram-community').waitFor();
    const available = await page.locator('.home-products').count() > 0;
    check('Persian Home footer community', await page.locator('footer .telegram-community').count() === 1);
    check('Persian Home hero community including unavailable CMS', await page.locator('.home-community .telegram-community').count() === 1);
    await shot(page, 'home-fa', '/react/#/fa/home');
    for (const route of ['en/faq', 'fa/tools', 'en/rulebook']) {
      await page.goto(`${BASE}/#/${route}`);
      await page.locator('footer .telegram-community').waitFor();
      check(`${route} shared public footer`, await page.locator('.credits-row > a').count() === 5);
    }
    for (const route of ['en/prop/trade', 'fa/perpetual/trade', 'en/prop/dashboard']) {
      await page.goto(`${BASE}/#/${route}`);
      await page.locator('.of-terminal-top').waitFor();
      check(`${route} no public marketing`, await page.locator('.telegram-community,footer .credits-row').count() === 0);
      await shot(page, route.replaceAll('/', '-'), `/react/#/${route}`);
    }
    // Exercise in-place legacy translation after both initial locale entry cases.
    await page.goto(`${BASE}/#/fa/challenges`);
    await page.locator('footer .telegram-community').waitFor();
    await page.locator('#language-toggle').click();
    await page.waitForFunction(() => document.documentElement.lang === 'en' && document.querySelector('.hero .telegram-community').textContent.includes('Traders talk on'));
    check('language toggle updates React portal', (await page.locator('.hero .telegram-community').innerText()).includes('Traders talk on'));
    await page.locator('#language-toggle').click();
    await page.waitForFunction(() => document.documentElement.lang === 'fa' && document.querySelector('.hero .telegram-community').textContent.includes('جامعه معامله‌گران'));
    check('language roundtrip restores portal', (await page.locator('.hero .telegram-community').innerText()).includes('جامعه معامله‌گران'));
    for (const locale of ['en', 'fa', 'en', 'fa']) {
      await page.evaluate(locale => window.ofSetLanguage(locale), locale);
      await page.waitForFunction(locale => document.querySelector('.hero .telegram-community').getAttribute('aria-label').startsWith(locale === 'fa' ? 'جامعه معامله‌گران' : 'Traders talk on'), locale);
      await page.evaluate(() => window.ofTranslate());
      check(`${locale} React-owned attributes survive translator`, (await page.locator('.hero .telegram-community').getAttribute('aria-label')).startsWith(locale === 'fa' ? 'جامعه معامله‌گران' : 'Traders talk on'));
      check(`${locale} portal remains singular`, await page.locator('.hero .telegram-community').count() === 1 && await page.locator('footer .telegram-community').count() === 1);
    }
    if (capture) {
      const file = 'docs/assets/screenshots/manifest.json';
      const manifest = JSON.parse(fs.readFileSync(file));
      manifest.screenshots = manifest.screenshots.filter(e => !captures.some(c => c.file === e.file)).concat(captures);
      fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
    }
    fs.writeFileSync(path.join(out, 'validation.json'), JSON.stringify({ status: 'passed', checks, captures }, null, 2));
    console.log(`${checks.length} website checks passed; ${captures.length} actual candidate captures`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
