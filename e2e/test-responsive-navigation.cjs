/* Responsive header, off-canvas navigation, Telegram-only community, footer
 * services and platform motion — real browser viewports against a running
 * frontend (vite dev server or candidate build). No request interception.
 *   TEST_FRONTEND_URL=http://127.0.0.1:5173 node e2e/test-responsive-navigation.cjs
 * NAV_CAPTURE=1 also writes screenshots to output/playwright/responsive-navigation. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BASE = (process.env.TEST_FRONTEND_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const CAPTURE = process.env.NAV_CAPTURE === '1';
const OUT = path.resolve('output/playwright/responsive-navigation');
if (CAPTURE) fs.mkdirSync(OUT, { recursive: true });
const LOCALES = ['fa', 'ar', 'en', 'ru', 'zh-CN'];
const RTL = new Set(['fa', 'ar']);
const WIDTHS = [320, 360, 390, 430, 768, 820, 1024, 1180, 1280, 1440, 1920];
const TELEGRAM = 'https://t.me/communitybuopenfund';
const failures = [];
let passed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}
const shot = async (page, name) => { if (CAPTURE) { await page.waitForTimeout(1600); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); } };
const settle = page => page.waitForTimeout(350);

/** Geometry of the public header: every visible control inside the viewport,
 *  no two visible controls overlapping, one header row, no page overflow. */
async function headerAudit(page) {
  return page.evaluate(() => {
    const header = document.querySelector('.openfund-header');
    const nav = header.querySelector('.nav');
    const visible = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    const controls = [header.querySelector('.brand'), ...header.querySelectorAll('.nav-actions > *, #navigation > a, #navigation > .nav-account > .resources-toggle')].filter(el => el && visible(el));
    const boxes = controls.map(el => ({ name: el.id || el.className || el.tagName, r: el.getBoundingClientRect() }));
    const outside = boxes.filter(b => b.r.left < -0.5 || b.r.right > innerWidth + 0.5).map(b => b.name);
    const overlaps = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, b = boxes[j].r;
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1 && !controls[i].contains(controls[j]) && !controls[j].contains(controls[i])) overlaps.push(`${boxes[i].name}×${boxes[j].name}`);
    }
    const tops = [...new Set(boxes.map(b => Math.round(b.r.top + b.r.height / 2)))];
    const clipped = [...header.querySelectorAll('#navigation > a, .resources-toggle, .nav-cta')].filter(el => {
      if (!visible(el)) return false;
      /* text ink, not scrollWidth: decorative pseudo-elements (button shine) overflow by design */
      const range = document.createRange(); range.selectNodeContents(el);
      const text = range.getBoundingClientRect(), box = el.getBoundingClientRect();
      return text.left < box.left - 1 || text.right > box.right + 1;
    }).map(el => el.textContent.trim());
    return {
      overflow: document.documentElement.scrollWidth > innerWidth + 0.5,
      outside, overlaps, clipped,
      singleRow: Math.max(...tops) - Math.min(...tops) <= 6,
      height: Math.round(nav.getBoundingClientRect().height),
      compact: header.classList.contains('nav-overflow') || getComputedStyle(header.querySelector('#navigation')).display === 'none',
      menu: (() => { const m = header.querySelector('.menu'); return !!m && visible(m); })(),
    };
  });
}

async function drawerAudit(page, locale, scope) {
  const trigger = page.locator(scope === 'site' ? '.openfund-header .menu' : '.of-terminal-menu-trigger');
  await trigger.click();
  await settle(page);
  const drawer = page.locator('.of-offcanvas [role="dialog"]');
  const open = await drawer.count() === 1;
  if (!open) return { open };
  const info = await page.evaluate(() => {
    const panel = document.querySelector('.of-offcanvas-panel').getBoundingClientRect();
    const body = document.querySelector('.of-offcanvas-body');
    body.scrollTop = body.scrollHeight;
    const items = [...document.querySelectorAll('.of-offcanvas-body a')];
    const last = items.at(-1).getBoundingClientRect(), bodyBox = body.getBoundingClientRect();
    return {
      left: Math.round(panel.left), right: Math.round(panel.right), vw: innerWidth,
      lastReachable: last.bottom <= bodyBox.bottom + 1 && last.top >= bodyBox.top - 1,
      locked: getComputedStyle(document.documentElement).overflow === 'hidden',
      focusInside: document.querySelector('.of-offcanvas-panel').contains(document.activeElement),
      expanded: document.querySelector('[aria-controls][aria-expanded="true"]') !== null,
      links: items.length,
      dir: document.querySelector('.of-offcanvas').getAttribute('dir'),
    };
  });
  // Escape closes and returns focus to the trigger.
  await page.keyboard.press('Escape');
  await settle(page);
  const afterEscape = await drawer.count() === 0;
  const focusBack = await trigger.evaluate(el => document.activeElement === el);
  const unlocked = await page.evaluate(() => getComputedStyle(document.documentElement).overflow !== 'hidden');
  // Backdrop closes.
  await trigger.click(); await settle(page);
  await page.locator('.of-offcanvas-backdrop').click({ position: { x: RTL.has(locale) ? 5 : info.vw - 5, y: 300 }, force: true });
  await settle(page);
  const afterBackdrop = await drawer.count() === 0;
  return { open, ...info, afterEscape, focusBack, unlocked, afterBackdrop };
}

async function websiteMatrix(browser) {
  for (const locale of LOCALES) for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 740 : 900 }, locale: 'en-US' });
    const page = await context.newPage();
    await page.goto(`${BASE}/${locale}/markets`, { waitUntil: 'domcontentloaded' });
    await page.locator('.openfund-header .nav-actions').waitFor();
    await page.waitForTimeout(900);
    const tag = `site ${locale} ${width}`;
    const h = await headerAudit(page);
    check(`${tag}: no horizontal overflow`, !h.overflow);
    check(`${tag}: header controls inside viewport`, !h.outside.length, h.outside.join(','));
    check(`${tag}: no overlapping header controls`, !h.overlaps.length, h.overlaps.join(','));
    check(`${tag}: no clipped navigation labels`, !h.clipped.length, h.clipped.join(','));
    check(`${tag}: single header row`, h.singleRow, `height ${h.height}`);
    check(`${tag}: compact mode exposes the menu trigger`, !h.compact || h.menu);
    if (width <= 430) check(`${tag}: phone header is compact`, h.compact && h.menu);
    if (h.menu) {
      const d = await drawerAudit(page, locale, 'site');
      check(`${tag}: drawer opens on first click`, d.open);
      if (d.open) {
        check(`${tag}: drawer opens from the ${RTL.has(locale) ? 'right' : 'left'}`, RTL.has(locale) ? d.right === d.vw : d.left === 0, `${d.left}-${d.right}/${d.vw}`);
        check(`${tag}: drawer direction attribute`, d.dir === (RTL.has(locale) ? 'rtl' : 'ltr'));
        check(`${tag}: drawer locks page scroll`, d.locked);
        check(`${tag}: focus moves into the drawer`, d.focusInside);
        check(`${tag}: trigger reports expanded`, d.expanded);
        check(`${tag}: last drawer item reachable`, d.lastReachable);
        check(`${tag}: Escape closes`, d.afterEscape);
        check(`${tag}: focus returns to trigger`, d.focusBack);
        check(`${tag}: scroll lock released`, d.unlocked);
        check(`${tag}: backdrop closes`, d.afterBackdrop);
      }
    }
    if ([390, 820].includes(width) && ['fa', 'en'].includes(locale)) {
      await shot(page, `site-${locale}-${width}-header`);
      if (h.menu) { await page.locator('.openfund-header .menu').click(); await settle(page); await shot(page, `site-${locale}-${width}-drawer`); await page.keyboard.press('Escape'); }
    }
    await context.close();
  }
}

async function drawerShortViewports(browser) {
  for (const [width, height] of [[320, 568], [375, 667], [667, 375], [844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto(`${BASE}/ru/rulebook`, { waitUntil: 'domcontentloaded' });
    await page.locator('.openfund-header .nav-actions').waitFor(); await page.waitForTimeout(800);
    const h = await headerAudit(page);
    check(`short ${width}x${height}: header fits`, !h.outside.length && !h.overflow, h.outside.join(','));
    if (h.menu) {
      const d = await drawerAudit(page, 'ru', 'site');
      check(`short ${width}x${height}: drawer scrolls to its last item`, d.open && d.lastReachable);
    }
    await context.close();
  }
}

async function routeClosesDrawer(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/en/markets`, { waitUntil: 'domcontentloaded' });
  await page.locator('.openfund-header .menu').waitFor(); await page.waitForTimeout(600);
  await page.locator('.openfund-header .menu').click(); await settle(page);
  await page.locator('.of-offcanvas a.of-drawer-link[href="/en/faq"]').click();
  await page.waitForURL(/\/en\/faq$/); await page.waitForTimeout(900);
  check('route selection navigates and closes the drawer', await page.locator('.of-offcanvas').count() === 0);
  check('page scroll restored after route selection', await page.evaluate(() => getComputedStyle(document.documentElement).overflow !== 'hidden'));
  // keyboard: Tab cycles inside the open drawer
  await page.locator('.openfund-header .menu').focus(); await page.keyboard.press('Enter'); await settle(page);
  let inside = true;
  for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); inside &&= await page.evaluate(() => !!document.activeElement?.closest('.of-offcanvas-panel')); }
  check('keyboard focus stays inside the open drawer', inside);
  await context.close();
}

async function challengesPage(browser) {
  for (const [locale, width] of [['fa', 1440], ['en', 1920], ['fa', 1280], ['en', 1024], ['fa', 768], ['en', 390], ['ar', 360]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/${locale}/challenges`, { waitUntil: 'domcontentloaded' });
    await page.locator('footer .credits-row').waitFor({ timeout: 30000 });
    await page.locator('footer .telegram-community').waitFor({ timeout: 30000 });
    await page.waitForTimeout(1200);
    const tag = `challenges ${locale} ${width}`;
    // Task 01: Telegram-only community CTA in hero and footer
    check(`${tag}: no Discord community action`, await page.locator('.discord-community').count() === 0);
    const telegram = page.locator('.telegram-community');
    check(`${tag}: Telegram action in hero and footer`, await telegram.count() === 2);
    check(`${tag}: Telegram destination`, (await telegram.evaluateAll(links => links.map(a => a.getAttribute('href')))).every(href => href === TELEGRAM));
    check(`${tag}: safe external link`, (await telegram.evaluateAll(links => links.every(a => a.target === '_blank' && a.rel === 'noopener noreferrer'))));
    check(`${tag}: official Telegram icon`, await page.locator('.telegram-community img[src$="telegram-logo.svg"]').count() === 2);
    // Task 02: eight providers, balanced rows
    const credits = await page.locator('.credits-row > a').evaluateAll(cards => cards.map(card => ({ name: card.querySelector('b')?.textContent, href: card.getAttribute('href'), top: Math.round(card.getBoundingClientRect().top), desc: card.querySelector('.service-description')?.textContent })));
    check(`${tag}: eight service providers`, credits.length === 8, credits.map(c => c.name).join(','));
    const hl = credits.find(c => c.name === 'Hyperliquid');
    check(`${tag}: Hyperliquid card links to hyperliquid.xyz`, hl?.href === 'https://hyperliquid.xyz');
    const expected = { fa: 'داده‌های بازار و عمق نقدینگی', en: 'Market data & liquidity depth', ar: 'بيانات السوق وعمق السيولة' }[locale];
    check(`${tag}: Hyperliquid description localized`, hl?.desc?.trim() === expected, hl?.desc);
    const rows = Object.values(credits.reduce((acc, c) => ((acc[c.top] = (acc[c.top] || 0) + 1), acc), {}));
    if (width >= 1280) check(`${tag}: one provider row on desktop`, rows.length === 1, rows.join('/'));
    check(`${tag}: no orphaned provider`, rows.length === 1 || Math.min(...rows) > 1, rows.join('/'));
    check(`${tag}: provider logos load`, await page.locator('.credits-row img').evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0)));
    // Task 03: three-platform orbs replace the static Gains mark
    const orbs = await page.locator('.platform-orbs').evaluate(el => {
      const box = el.getBoundingClientRect(), card = el.closest('article').getBoundingClientRect();
      const imgs = [...el.querySelectorAll('img')];
      return { names: imgs.map(img => img.alt), loaded: imgs.every(img => img.complete && img.naturalWidth > 0),
        inside: box.left >= card.left - 0.5 && box.right <= card.right + 0.5,
        animated: [...el.querySelectorAll('.platform-orb')].every(orb => getComputedStyle(orb).animationName === 'platform-orb-orbit'),
        logoTransform: imgs.every(img => ['none', ''].includes(getComputedStyle(img).transform)) };
    });
    check(`${tag}: three platform logos`, orbs.names.join(',') === 'Gains,Hyperliquid,GMX', orbs.names.join(','));
    check(`${tag}: orb logos load`, orbs.loaded);
    check(`${tag}: motion stays inside its card`, orbs.inside);
    check(`${tag}: orbs animate`, orbs.animated);
    check(`${tag}: logos are not rotated or distorted`, orbs.logoTransform);
    check(`${tag}: no static Gains-only mark remains`, await page.locator('.platform-flow > a > img[src$="gains-logo.svg"]').count() === 0);
    const h = await headerAudit(page);
    check(`${tag}: header fits`, !h.overflow && !h.outside.length && !h.overlaps.length, [...h.outside, ...h.overlaps].join(','));
    if (CAPTURE && width === 1440) {
      await page.locator('footer .credits-row').evaluate(el => el.scrollIntoView({ block: 'center' })); await shot(page, `footer-${locale}-${width}`);
      await page.locator('.platform-flow').evaluate(el => el.scrollIntoView({ block: 'center' })); await shot(page, `orbs-${locale}-${width}`);
      await page.locator('.hero .telegram-community').scrollIntoViewIfNeeded(); await shot(page, `telegram-${locale}-${width}`);
    }
    if (CAPTURE && width === 390) { await page.locator('footer .credits-row').evaluate(el => el.scrollIntoView({ block: 'center' })); await shot(page, `footer-${locale}-${width}`); }
    await context.close();
  }
  // reduced motion: same composition, no animation
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${BASE}/en/challenges`, { waitUntil: 'domcontentloaded' });
  await page.locator('.platform-orbs').waitFor({ timeout: 30000 }); await page.waitForTimeout(800);
  check('reduced motion: orbs static and visible', await page.locator('.platform-orb').evaluateAll(orbs => orbs.length === 3 && orbs.every(orb => getComputedStyle(orb).animationName === 'none' && orb.getBoundingClientRect().width > 0)));
  await context.close();
  // light theme readability of footer names and community action
  const light = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const lp = await light.newPage();
  await lp.addInitScript(() => { try { localStorage.setItem('of-theme', 'light') } catch {} });
  await lp.goto(`${BASE}/fa/challenges`, { waitUntil: 'domcontentloaded' });
  await lp.locator('footer .credits-row').waitFor({ timeout: 30000 }); await lp.waitForTimeout(1000);
  if (CAPTURE) { await lp.locator('footer .credits-row').evaluate(el => el.scrollIntoView({ block: 'center' })); await shot(lp, 'footer-fa-1440-light'); await lp.locator('.platform-flow').evaluate(el => el.scrollIntoView({ block: 'center' })); await shot(lp, 'orbs-fa-1440-light'); }
  await light.close();
}

async function terminal(browser) {
  for (const [locale, width, height] of [['fa', 390, 844], ['en', 390, 844], ['ar', 360, 740], ['ru', 768, 1024], ['zh-CN', 820, 1180], ['en', 1024, 768], ['fa', 1180, 820], ['en', 1440, 900]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto(`${BASE}/${locale}/prop/trade`, { waitUntil: 'domcontentloaded' });
    await page.locator('.of-terminal-header').waitFor({ timeout: 30000 });
    await page.waitForTimeout(2500);
    const tag = `terminal ${locale} ${width}x${height}`;
    const head = await page.evaluate(() => {
      const header = document.querySelector('.of-terminal-header');
      const visible = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && r.width > 0; };
      const els = [...header.querySelectorAll('.of-brand, .of-product-switch, .of-header-account, #terminal-navigation, .of-terminal-menu-trigger, .of-terminal-actions > *')].filter(visible);
      const boxes = els.map(el => ({ n: el.className || el.id, r: el.getBoundingClientRect() }));
      const overlaps = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r, b = boxes[j].r;
        if (!els[i].contains(els[j]) && !els[j].contains(els[i]) && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlaps.push(`${boxes[i].n}×${boxes[j].n}`);
      }
      const trigger = header.querySelector('.of-terminal-menu-trigger');
      return { overflow: document.documentElement.scrollWidth > innerWidth + 0.5, outside: boxes.filter(b => b.r.left < -0.5 || b.r.right > innerWidth + 0.5).map(b => b.n), overlaps,
        trigger: !!trigger && visible(trigger), inlineNav: visible(header.querySelector('#terminal-navigation')) };
    });
    check(`${tag}: no horizontal overflow`, !head.overflow);
    check(`${tag}: header controls inside viewport`, !head.outside.length, head.outside.join(','));
    check(`${tag}: no overlapping header controls`, !head.overlaps.length, head.overlaps.join(','));
    check(`${tag}: exactly one navigation mode`, head.trigger !== head.inlineNav);
    if (head.trigger) {
      const before = await page.evaluate(() => { window.__navProbe = document.querySelector('iframe'); return { url: location.href, market: document.querySelector('.of-terminal')?.innerText.match(/[A-Z0-9]{2,10}\/USD[T]?/)?.[0] || null }; });
      const d = await drawerAudit(page, locale, 'terminal');
      check(`${tag}: drawer opens`, d.open);
      if (d.open) {
        check(`${tag}: drawer from the ${RTL.has(locale) ? 'right' : 'left'}`, RTL.has(locale) ? d.right === d.vw : d.left === 0, `${d.left}-${d.right}`);
        check(`${tag}: drawer lists every terminal destination`, d.links >= 8, String(d.links));
        check(`${tag}: Escape closes, focus returns`, d.afterEscape && d.focusBack);
        check(`${tag}: backdrop closes`, d.afterBackdrop);
      }
      const after = await page.evaluate(() => ({ url: location.href, sameChart: !window.__navProbe || document.querySelector('iframe') === window.__navProbe, market: document.querySelector('.of-terminal')?.innerText.match(/[A-Z0-9]{2,10}\/USD[T]?/)?.[0] || null }));
      check(`${tag}: chart workspace not remounted`, after.sameChart);
      check(`${tag}: route, tab and account unchanged`, after.url === before.url);
      check(`${tag}: selected market unchanged`, after.market === before.market, `${before.market} → ${after.market}`);
      if (CAPTURE && [390, 768, 820].includes(width)) {
        await shot(page, `terminal-${locale}-${width}-header`);
        await page.locator('.of-terminal-menu-trigger').click(); await settle(page);
        await shot(page, `terminal-${locale}-${width}-drawer`);
        await page.keyboard.press('Escape');
      }
    }
    // theme toggle still works from the terminal header
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.locator('.of-daynight').click(); await page.waitForTimeout(200);
    check(`${tag}: theme toggle functional`, await page.evaluate(t => document.documentElement.dataset.theme !== t, theme));
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  try {
    /* NAV_ONLY=site,short,route,challenges,terminal runs a subset */
    const only = new Set((process.env.NAV_ONLY || 'site,short,route,challenges,terminal').split(','));
    if (only.has('site')) await websiteMatrix(browser);
    if (only.has('short')) await drawerShortViewports(browser);
    if (only.has('route')) await routeClosesDrawer(browser);
    if (only.has('challenges')) await challengesPage(browser);
    if (only.has('terminal')) await terminal(browser);
  } finally { await browser.close(); }
  console.log(`responsive navigation: ${passed} checks passed, ${failures.length} failed`);
  if (failures.length) { for (const f of failures) console.log('FAIL', f); assert.fail(`${failures.length} responsive navigation checks failed`); }
})().catch(error => { console.error(error); process.exit(1); });
