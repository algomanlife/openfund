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

/* Language switching uses the five-language selector (fa, en, ar, ru, zh-CN);
   toggleLanguage keeps the previous fa <-> en intent of these steps. */
async function toggleLanguage(page) {
  const select = page.locator('.of-language-select select').first();
  await select.waitFor({ state: 'attached' });
  await select.selectOption((await select.inputValue()) === 'fa' ? 'en' : 'fa');
}

function check(name, value) { assert.ok(value, name); checks.push(name); }
// These synthetic destinations test validation only; none is asserted to belong to Openfund.
function configuredCommunityChecks() {
  const { buildSync } = require('../apps/web-react/node_modules/esbuild');
  const { createRequire } = require('node:module');
  const appRequire = createRequire(path.resolve('apps/web-react/package.json'));
  for (const value of ['', 'https://telegram.org/', 'https://t.me/ExampleCommunity', 'https://t.me/+ExampleInvite', 'javascript:alert(1)', 'https://t.me.evil.test/ExampleCommunity']) {
    const result = buildSync({ entryPoints: ['apps/web-react/src/features/community/TelegramCommunity.tsx'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', loader: { '.css': 'empty' }, define: { 'import.meta.env.BASE_URL': '"/react/"', 'import.meta.env.VITE_TELEGRAM_COMMUNITY_URL': JSON.stringify(value), 'import.meta.env.VITE_DISCORD_COMMUNITY_URL': '""', 'import.meta.env.VITE_INSTAGRAM_COMMUNITY_URL': '""' }, jsx: 'automatic' });
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
async function realThemeClicks(browser) {
  const directory = path.resolve(process.env.THEME_EVIDENCE_DIR || 'output/playwright/theme-clicks');
  fs.mkdirSync(directory, { recursive: true });
  const samples = [], screenshots = [];
  async function sample(page, label, theme, screenshot = false) {
    // Legacy route exits schedule a document reload at 120 ms. Observe that
    // teardown before measuring or initiating another hash navigation.
    await page.waitForTimeout(250);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(theme => document.documentElement.dataset.theme === theme && getComputedStyle(document.body).backgroundColor === (theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(6, 8, 8)'), theme);
    for (const frame of page.frames()) {
      await frame.waitForFunction(theme => document.documentElement.dataset.theme === theme && getComputedStyle(document.body).backgroundColor === (theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(6, 8, 8)'), theme);
      const styles = await frame.evaluate(() => ({ url: location.href, theme: document.documentElement.dataset.theme, storage: localStorage.getItem('of-theme'), body: getComputedStyle(document.body).backgroundColor,
        surfaces: [...document.querySelectorAll('header,.of-panel,.of-terminal-more-links,.vela-toolbar,.vela-widget-panel')].filter(el => el.getBoundingClientRect().width && el.getBoundingClientRect().height).map(el => ({ selector: el.className, background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color })) }));
      check(`${label} ${frame.url()} persisted theme`, styles.storage === theme);
      if (theme === 'light') for (const surface of styles.surfaces) {
        const rgb = surface.background.match(/[\d.]+/g)?.map(Number);
        check(`${label} light surface ${surface.selector}`, !rgb || rgb[3] === 0 || Math.min(...rgb.slice(0, 3)) >= 230);
      }
      samples.push({ label, ...styles });
    }
    if (screenshot) {
      const file = path.join(directory, `${label}.png`);
      await page.screenshot({ path: file, animations: 'disabled' });
      screenshots.push({ file, route: page.url(), theme, capturedAt: new Date().toISOString(), session: 'anonymous', method: 'Real theme button clicks; no CSS injection, theme storage seeding or response interception' });
    }
  }
  for (const colorScheme of ['dark', 'light']) for (const locale of ['fa', 'en']) {
    const context = await browser.newContext({ colorScheme, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}/#/${locale}/home`, { waitUntil: 'domcontentloaded' });
      check(`${colorScheme}-${locale} system default`, await page.locator('html').getAttribute('data-theme') === colorScheme);
      if (colorScheme === 'dark') await page.locator('#theme-toggle').click();
      const prefix = `${colorScheme}-${locale}`;
      await sample(page, `${prefix}-public-light`, 'light', true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sample(page, `${prefix}-refresh-light`, 'light');
      for (const route of ['challenges', 'markets', 'faq', 'tools', 'learn', 'referral', 'rulebook', 'transparency']) {
        await page.goto(`${BASE}/#/${locale}/${route}`, { waitUntil: 'domcontentloaded' });
        await page.locator('.openfund-header').waitFor();
        await sample(page, `${prefix}-${route}-light`, 'light');
      }
      await page.goto(`${BASE}/#/${locale}/home`, { waitUntil: 'domcontentloaded' });
      await page.locator(`a[href="#/${locale}/prop/trade"]`).first().click();
      await page.locator('.of-terminal-top').waitFor();
      const iframe = page.frameLocator('iframe');
      await iframe.locator('#vela-tool-vela-widget-panel-dataWindow').click();
      await sample(page, `${prefix}-terminal-light`, 'light', true);
      await page.locator('button[aria-label="' + (locale === 'fa' ? 'تغییر پوسته' : 'Toggle theme') + '"]').click();
      await sample(page, `${prefix}-terminal-dark`, 'dark', true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await iframe.locator('#vela-tool-vela-widget-panel-dataWindow').waitFor();
      await sample(page, `${prefix}-terminal-refresh-dark`, 'dark');
      await page.locator(`#terminal-navigation a[href="#/${locale}/prop/dashboard"]:not(.of-compact-destination)`).click();
      await page.locator('details.of-terminal-more summary').click();
      await sample(page, `${prefix}-dashboard-dark`, 'dark', true);
      await page.locator('button[aria-label="' + (locale === 'fa' ? 'تغییر پوسته' : 'Toggle theme') + '"]').click();
      await sample(page, `${prefix}-dashboard-light`, 'light', true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sample(page, `${prefix}-dashboard-refresh-light`, 'light');
      if (locale === 'fa') {
        await page.goto(`${BASE}/#/fa/perpetual/trade`, { waitUntil: 'domcontentloaded' });
        await iframe.locator('#vela-tool-vela-widget-panel-dataWindow').click();
        await sample(page, `${prefix}-perpetual-light`, 'light', true);
      }
      const restored = await browser.newContext({ storageState: await context.storageState(), viewport: { width: 1440, height: 1000 } });
      try {
        const fresh = await restored.newPage();
        await fresh.goto(`${BASE}/#/${locale}/home`, { waitUntil: 'domcontentloaded' });
        await sample(fresh, `${prefix}-restored-light`, 'light');
        await fresh.locator('#theme-toggle').click();
        await sample(fresh, `${prefix}-public-dark`, 'dark', true);
        for (const route of ['challenges', 'markets', 'faq', 'tools', 'learn', 'referral', 'rulebook', 'transparency']) {
          await fresh.goto(`${BASE}/#/${locale}/${route}`, { waitUntil: 'domcontentloaded' });
          await fresh.locator('.openfund-header').waitFor();
          await sample(fresh, `${prefix}-${route}-dark`, 'dark');
        }
      } finally { await restored.close(); }
    } finally { await context.close(); }
  }
  fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify({ status: 'passed', base: BASE, samples, screenshots, checks }, null, 2));
}
(async () => {
  configuredCommunityChecks();
  const browser = await chromium.launch();
  try {
    await realThemeClicks(browser);
    if (process.env.P0_THEME_ONLY === '1') { console.log(`${checks.length} real-click theme checks passed`); return; }
    for (const locale of ['fa', 'en']) for (const theme of ['dark', 'light']) for (const width of [390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => localStorage.setItem('of-theme-choice', theme), theme);
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
      check(`${tag} two Discord actions`, await page.locator('.discord-community').count() === 2);
      check(`${tag} two Instagram actions`, await page.locator('.instagram-community').count() === 2);
      check(`${tag} coordinated three-provider geometry`, await page.locator('.community-group').evaluateAll(groups => groups.every(group => {
        const buttons = [...group.querySelectorAll('.community-button')];
        const boxes = buttons.map(button => button.getBoundingClientRect());
        const styles = buttons.map(button => getComputedStyle(button));
        return buttons.length === 3 && boxes.every(box => Math.abs(box.height - 44) <= 1)
          && styles.every(style => ['borderRadius', 'padding', 'fontSize', 'fontWeight', 'lineHeight', 'gap', 'transitionDuration'].every(key => style[key] === styles[0][key]))
          && styles.every(style => style.fontSize === '12px' && style.padding === '8px 12px' && style.borderRadius === '8px')
          && buttons.every(button => { const icon = getComputedStyle(button.querySelector('img')); return icon.width === '20px' && icon.height === '20px' && icon.padding === '0px' && icon.borderWidth === '0px' && icon.backgroundColor === 'rgba(0, 0, 0, 0)'; })
          && getComputedStyle(group).display === 'inline-flex'
          && (innerWidth >= 1200 ? boxes.every(box => Math.abs(box.top - boxes[0].top) <= 1) && group.getBoundingClientRect().width < group.parentElement.getBoundingClientRect().width - 50 : true)
          && (innerWidth <= 600 ? boxes[2].top > boxes[0].top : true)
          && buttons.every(button => { const text = button.querySelector('.community-copy'); return text.scrollWidth <= text.clientWidth + 1; });
      })));
      const instagram = page.locator('.hero .instagram-community');
      check(`${tag} unavailable Instagram`, await instagram.getAttribute('href') === null && await instagram.getAttribute('aria-disabled') === 'true');
      check(`${tag} exact Instagram label`, await instagram.locator('.community-copy > span').innerText() === (locale === 'fa' ? 'اخبار، آموزش و سرگرمی' : 'News, Education & Entertainment'));
      const beforeInstagram = page.url(); await instagram.dispatchEvent('click');
      check(`${tag} missing Instagram never navigates`, page.url() === beforeInstagram);
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.credits-row')).display === 'grid' && [...document.querySelectorAll('.credits-row img')].every(img => img.complete && img.naturalWidth > 0));
      await page.evaluate(() => document.fonts.ready);
      check(`${tag} aligned service tracks and name baselines`, await page.locator('.credits-row').evaluate(row => {
        const cards = [...row.children].map(card => ({ card: card.getBoundingClientRect(), description: card.querySelector('.service-description').getBoundingClientRect(), name: card.querySelector('b').getBoundingClientRect(), logo: card.querySelector('.service-logo-slot').getBoundingClientRect() }));
        return cards.every(a => a.description.top >= a.logo.bottom && cards.filter(b => Math.abs(b.card.top - a.card.top) <= 1).every(b => Math.abs(b.description.top - a.description.top) <= 1 && Math.abs(b.name.bottom - a.name.bottom) <= 1 && Math.abs(b.logo.height - a.logo.height) <= 1 && Math.abs(b.logo.width - a.logo.width) <= 1));
      }));
      for (const src of await page.locator('.credits-row img,.community-button img').evaluateAll(images => [...new Set(images.map(img => img.src))])) {
        const response = await page.request.get(src), svg = await response.text();
        check(`${tag} real vector ${src.split('/').pop()}`, response.ok() && /<svg\b/.test(svg) && /<path\b/.test(svg) && !/<(?:image|foreignObject)\b|data:image|base64/i.test(svg));
      }
      const discord = page.locator('.hero .discord-community');
      check(`${tag} unavailable Discord`, await discord.getAttribute('href') === null && await discord.getAttribute('aria-disabled') === 'true');
      check(`${tag} localized Discord`, await discord.locator('.community-copy > span').innerText() === (locale === 'fa' ? 'جامعه معامله‌گران' : 'Traders talk on'));
      check(`${tag} native compact platform icons`, await page.locator('.desktop-btns .platform-icon > svg').count() === 5 && await page.locator('.desktop-btns img').count() === 0);
      check(`${tag} no recolored service logos`, await page.locator('.credits-row img,.credits-row svg,.community-button img').evaluateAll(logos => logos.every(logo => getComputedStyle(logo).filter === 'none')));
      const telegram = page.locator('.hero .telegram-community');
      check(`${tag} unavailable community does not navigate`, await telegram.getAttribute('href') === null && await telegram.getAttribute('aria-disabled') === 'true');
      check(`${tag} localized Telegram`, (await telegram.locator('.community-copy > span').innerText()).trim() === (locale === 'fa' ? 'جامعه معامله‌گران' : 'Traders talk on'));
      check(`${tag} visible community availability`, await telegram.locator('small').innerText() === (locale === 'fa' ? 'به‌زودی' : 'Coming Soon'));
      const urlBefore = page.url(); await telegram.dispatchEvent('click'); check(`${tag} unavailable click stays on page`, page.url() === urlBefore);
      await telegram.focus();
      check(`${tag} keyboard focus`, await telegram.evaluate(el => document.activeElement === el && getComputedStyle(el).outlineStyle !== 'none'));
      check(`${tag} reduced motion`, await telegram.evaluate(el => getComputedStyle(el).transitionDuration === '0s'));
      await page.waitForFunction(() => [...document.querySelectorAll('.credits-row img,.community-button img')].every(img => img.complete && img.naturalWidth > 0));
      check(`${tag} images load`, await page.locator('.credits-row img,.community-button img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)));
      check(`${tag} official images preserve geometry`, await page.locator('.credits-row img,.community-button img').evaluateAll(images => images.every(img => getComputedStyle(img).objectFit === 'contain')));
      const destinations = await page.locator('.credits-row > a').evaluateAll(links => links.map(a => a.href));
      check(`${tag} truthful service destinations`, ['https://gains.trade/', 'https://www.tradingview.com/news/', 'https://depay.com/'].every(url => destinations.includes(url)));
      check(`${tag} DePay description`, (await page.locator('a[href="https://depay.com/"]').innerText()).includes(locale === 'fa' ? 'سیستم دریافت و پرداخت' : 'Payment & Collection System'));
      check(`${tag} Shiraz preserved`, (await page.locator('footer').innerText()).includes(locale === 'fa' ? 'شیراز' : 'Shiraz'));
      check(`${tag} no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (width === 1440 && ['dark', 'light'].includes(theme)) {
        await page.evaluate(() => scrollTo(0, 0));
        await shot(page, `challenges-${locale}-${theme}`, `/react/#/${locale}/challenges`);
        await shot(page, `downloads-${locale}-${theme}`, `/react/#/${locale}/challenges#desktop`, page.locator('#desktop'));
        await shot(page, `footer-${locale}-${theme}`, `/react/#/${locale}/challenges`, page.locator('footer'));
      }
      await context.close();
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await page.goto(`${BASE}/#/fa/home`);
    await page.locator('.home-community .telegram-community').waitFor();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.home-stage')).display === 'flex' && getComputedStyle(document.querySelector('.home-community .community-group')).flexWrap === 'nowrap');
    await page.evaluate(() => document.fonts.ready);
    check('Persian Home has no footer', await page.locator('footer').count() === 0);
    check('Persian Home hero Instagram only', await page.locator('.instagram-community').count() === 1 && await page.locator('.home-community .instagram-community').count() === 1);
    check('Persian Home desktop compact three-provider row', await page.locator('.home-community .community-button').evaluateAll(buttons => {
      const boxes = buttons.map(button => button.getBoundingClientRect());
      return boxes.length === 3 && boxes.every(box => Math.abs(box.top - boxes[0].top) <= 1 && Math.abs(box.height - 44) <= 1 && box.width < 300);
    }));
    check('Persian Home hero Discord only', await page.locator('.discord-community').count() === 1 && await page.locator('.home-community .discord-community').count() === 1);
    check('Persian Home hero community including unavailable CMS', await page.locator('.telegram-community').count() === 1 && await page.locator('.home-community .telegram-community').count() === 1);
    await shot(page, 'home-fa', '/react/#/fa/home');
    await page.close();
    const englishHome = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    try {
      await englishHome.goto(`${BASE}/#/en/home`);
      await englishHome.locator('footer .telegram-community').waitFor();
      await englishHome.waitForFunction(() => document.documentElement.lang === 'en');
      check('English Home retains shared public footer', await englishHome.locator('footer').count() === 1 && await englishHome.locator('.credits-row > a').count() === 5);
    } finally { await englishHome.close(); }
    // These are direct-entry checks, not transition checks. Isolate each entry
    // from the preceding legacy Landing teardown's scheduled document reload.
    for (const route of ['en/faq', 'fa/tools', 'en/rulebook']) {
      const entry = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
      try {
        await entry.goto(`${BASE}/#/${route}`);
        await entry.locator('footer .telegram-community').waitFor();
        check(`${route} shared public footer`, await entry.locator('.credits-row > a').count() === 5);
      } finally { await entry.close(); }
    }
    for (const route of ['en/prop/trade', 'fa/perpetual/trade', 'en/prop/dashboard']) {
      const entry = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
      try {
        await entry.goto(`${BASE}/#/${route}`);
        await entry.locator('.of-terminal-top').waitFor();
        check(`${route} no public marketing`, await entry.locator('.community-button,footer .credits-row').count() === 0);
        await shot(entry, route.replaceAll('/', '-'), `/react/#/${route}`);
      } finally { await entry.close(); }
    }
    // Exercise in-place legacy translation in a fresh direct-entry context.
    const localePage = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    try {
      // locale.js defines ofSetLanguage before its async DOMContentLoaded
      // handler wires the click listener. Its initial of-language event marks
      // completion of that handler; observing it does not change application state.
      await localePage.addInitScript(() => {
        window.__websiteLocaleReady = false;
        addEventListener('of-language', () => { window.__websiteLocaleReady = true; }, { once: true });
      });
      await localePage.goto(`${BASE}/#/fa/challenges`);
      await localePage.locator('footer .telegram-community').waitFor();
      await localePage.waitForFunction(() => window.__websiteLocaleReady && typeof window.ofSetLanguage === 'function'
        && document.documentElement.lang === 'fa' && window.ofLang === 'fa'
        && document.querySelector('.hero .telegram-community')?.textContent.includes('جامعه معامله‌گران'));
      await toggleLanguage(localePage);
      await localePage.waitForFunction(() => document.documentElement.lang === 'en' && window.ofLang === 'en' && document.querySelector('.hero .telegram-community').textContent.includes('Traders talk on'));
      check('language toggle updates Instagram portal', await localePage.locator('.hero .instagram-community .community-copy > span').innerText() === 'News, Education & Entertainment');
      check('language toggle updates Discord portal', (await localePage.locator('.hero .discord-community').innerText()).includes('Traders talk on'));
      check('language toggle updates React portal', (await localePage.locator('.hero .telegram-community').innerText()).includes('Traders talk on'));
      await toggleLanguage(localePage);
      await localePage.waitForFunction(() => document.documentElement.lang === 'fa' && window.ofLang === 'fa' && document.querySelector('.hero .telegram-community').textContent.includes('جامعه معامله‌گران'));
      check('language roundtrip restores Instagram', await localePage.locator('.hero .instagram-community .community-copy > span').innerText() === 'اخبار، آموزش و سرگرمی');
      check('language roundtrip restores portal', (await localePage.locator('.hero .telegram-community').innerText()).includes('جامعه معامله‌گران'));
      for (const locale of ['en', 'fa', 'en', 'fa']) {
        await localePage.evaluate(locale => window.ofSetLanguage(locale), locale);
        await localePage.waitForFunction(locale => document.querySelector('.hero .telegram-community').getAttribute('aria-label').startsWith(locale === 'fa' ? 'جامعه معامله‌گران' : 'Traders talk on'), locale);
        await localePage.evaluate(() => window.ofTranslate());
        check(`${locale} React-owned attributes survive translator`, (await localePage.locator('.hero .telegram-community').getAttribute('aria-label')).startsWith(locale === 'fa' ? 'جامعه معامله‌گران' : 'Traders talk on'));
        check(`${locale} portal remains singular`, await localePage.locator('.hero .telegram-community').count() === 1 && await localePage.locator('footer .telegram-community').count() === 1);
      }
    } finally { await localePage.close(); }
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
