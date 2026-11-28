/* Responsive launch matrix over the BUILT web application (repo-root react/).
 *
 * Every public and terminal route is loaded in every locale (fa, ar RTL; en,
 * ru, zh-CN LTR) and both themes, then resized through ten widths. At each
 * width it asserts:
 *   - no document-level horizontal overflow (also with every <details> open);
 *   - no visible interactive control clipped by the viewport or by an ancestor
 *     that hides overflow, and no control label clipped inside its own box;
 *   - document direction and language match the locale;
 * once per route/locale/theme it asserts no critical console error (uncaught
 * exceptions, React route errors) and no serious/critical axe-core violation
 * at a phone and a desktop width; and wherever a menu trigger is visible it
 * (on /markets and /prop/trade) opens the off-canvas drawer and asserts the side (right for RTL, left for
 * LTR), Escape, outside click and route-change closing.
 *
 * It starts its own static host (e2e/helpers/static-site.cjs) with a stub
 * /runtime-config.js and a 503 backend, so it needs only `npm run build:web`.
 * The browser is offline apart from that host: Gains REST/WS is served from
 * documented fixtures (e2e/helpers/market-fixtures.cjs) and every other
 * external origin is aborted, so a third-party outage cannot fail a layout
 * check. Live upstream availability is tested separately (Upstream guard).
 *   node e2e/test-responsive-matrix.cjs
 * Options (environment):
 *   TEST_FRONTEND_URL  test an already running frontend instead
 *   MATRIX_SHARD=i/n   run one shard of the locale × theme combinations
 *   MATRIX_LOCALES / MATRIX_THEMES / MATRIX_WIDTHS / MATRIX_ROUTES  comma lists
 *   MATRIX_CAPTURE=1   write the curated screenshots to MATRIX_OUTPUT
 *   MATRIX_OUTPUT      screenshot/report directory (default output/playwright/responsive-matrix)
 * A JSON report of every failure is written to <MATRIX_OUTPUT>/report.json. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { startStaticSite } = require('./helpers/static-site.cjs');
const { installMarketFixtures } = require('./helpers/market-fixtures.cjs');

const list = (name, fallback) => (process.env[name] ? process.env[name].split(',').map(s => s.trim()).filter(Boolean) : fallback);
const WIDTHS = list('MATRIX_WIDTHS', ['320', '360', '375', '390', '430', '768', '1024', '1280', '1440', '1920']).map(Number);
const LOCALES = list('MATRIX_LOCALES', ['fa', 'ar', 'en', 'ru', 'zh-CN']);
const THEMES = list('MATRIX_THEMES', ['dark', 'light']);
const RTL = new Set(['fa', 'ar']);
const PUBLIC = ['home', 'challenges', 'markets', 'rulebook', 'transparency', 'whitepaper', 'roadmap', 'checkout'];
const TERMINAL = ['prop/dashboard', 'prop/trade', 'prop/chart', 'prop/radar', 'prop/heatmap', 'prop/portfolio', 'prop/journal', 'perpetual/trade'];
const ROUTES = list('MATRIX_ROUTES', [...PUBLIC, ...TERMINAL]);
const OUT = path.resolve(process.env.MATRIX_OUTPUT || 'output/playwright/responsive-matrix');
const CAPTURE = process.env.MATRIX_CAPTURE === '1';
/* axe runs at one phone and one desktop width per route/locale/theme */
const AXE_WIDTHS = new Set([375, 1280].filter(w => WIDTHS.includes(w)));
/* the curated screenshot set (genuine captures of the built app; market data
   comes from the illustrative fixtures in helpers/market-fixtures.cjs) */
const SHOTS = new Set([
  'home fa dark 375', 'home en light 375', 'home ar dark 768', 'home zh-CN light 1440',
  'challenges fa light 390', 'challenges ru dark 320', 'markets en dark 360', 'markets fa light 1024',
  'transparency fa dark 375', 'transparency en light 1280', 'whitepaper ar light 375', 'whitepaper en dark 1920',
  'roadmap ru light 430', 'rulebook zh-CN dark 390', 'checkout fa dark 375', 'checkout en light 768',
  'prop/trade fa dark 390', 'prop/trade en light 1280', 'prop/dashboard ar dark 375', 'prop/heatmap en dark 768',
  'prop/radar fa light 1440', 'perpetual/trade ru dark 1024',
]);
/* captures scroll to the area each check is about (the viewport otherwise shows the hero) */
const SHOT_FOCUS = { challenges: '.market-tabs', markets: '.mk-toolbar, .market-tabs, [role=tablist]', whitepaper: '.wp-chapter-num', transparency: '.econ-state' };
const DRAWER_SHOTS = new Set(['markets fa dark 375', 'markets en light 375', 'prop/trade ar dark 390', 'prop/trade en dark 390']);
/* drawer behaviour is exercised at every width on one public page with the site
   navigation and on the trading terminal */
const DRAWER_ROUTES = new Set(['markets', 'prop/trade']);

const [shardIndex, shardCount] = (process.env.MATRIX_SHARD || '1/1').split('/').map(Number);
const COMBOS = LOCALES.flatMap(locale => THEMES.map(theme => ({ locale, theme }))).filter((_, i) => i % shardCount === shardIndex - 1);

const failures = [];
const blockedOrigins = new Set();
let passed = 0;
function check(tag, name, ok, detail = '') {
  if (ok) passed++;
  else failures.push({ tag, check: name, detail: String(detail).slice(0, 600) });
}

/* Resource fetch failures are expected: the static host has no backend or CMS.
   Uncaught exceptions and route errors are the critical ones. */
const BENIGN = [/Failed to load resource/i, /net::ERR_/i, /status of 50\d/i, /status of 404/i, /Failed to fetch/i, /NetworkError/i,
  /WebSocket/i, /Load failed/i, /AbortError/i, /\b503\b/, /\/api\//, /ResizeObserver loop/i];
const critical = text => !BENIGN.some(re => re.test(text));

/* A navigation can replace the document while a script runs (the legacy landing
   may reload itself shortly after a route change): retry once on the new one. */
async function evaluateSettled(page, fn, arg) {
  try { return await page.evaluate(fn, arg); } catch (error) {
    if (!/Execution context was destroyed|navigat/i.test(String(error && error.message))) throw error;
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    return page.evaluate(fn, arg);
  }
}

async function settle(page, ms = 250) {
  await evaluateSettled(page, () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(ms);
}

/** Layout audit at the current viewport. */
function layoutAudit() {
  const vw = document.documentElement.clientWidth;
  const doc = { scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, vw };
  /* RTL overflow extends to the left and does not grow scrollWidth in every engine:
     measure content extent on both sides as well */
  const shown = el => {
    if (!el.checkVisibility || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return false;
    if (el.closest('[aria-hidden="true"], [inert], .sr-only, .visually-hidden')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };
  const describe = el => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
    const label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    return `${el.tagName.toLowerCase()}${id}${cls}${label ? ` "${label}"` : ''}`;
  };
  /* scroll containers legitimately hold content beyond their box (tables, tab strips) */
  const scroller = s => /(auto|scroll)/.test(s.overflowX);
  const clips = s => /(hidden|clip)/.test(s.overflowX) || /(hidden|clip)/.test(s.overflow);
  const fixedLike = el => { for (let x = el; x; x = x.parentElement) { const p = getComputedStyle(x).position; if (p === 'fixed' || p === 'sticky') return x; } return null; };

  /* document-level overflow offenders: visible boxes outside [0, vw] not inside a scroller */
  const outside = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    if (!shown(el)) continue;
    let contained = false;
    for (let x = el.parentElement; x && x !== document.body; x = x.parentElement) {
      const s = getComputedStyle(x);
      if (scroller(s) || clips(s)) { contained = true; break; }
    }
    if (contained) continue;
    /* only report the outermost offender */
    if (outside.some(o => o.el.contains(el))) continue;
    outside.push({ el, left: Math.round(r.left), right: Math.round(r.right) });
  }

  const controls = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link], [role=menuitem], [role=switch], [role=checkbox]')]
    .filter(shown);
  const clipped = [];
  const labelClipped = [];
  const meet = (a, b) => ({ left: Math.max(a.left, b.left), right: Math.min(a.right, b.right), top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) });
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    /* `reach` is the part a user can bring into view; `visible` what is painted of it.
       Inside a scroll container the reachable part is bounded by that container's box. */
    let reach = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    let visible = reach;
    let scrolledAway = false;
    for (let x = el.parentElement; x && x !== document.documentElement; x = x.parentElement) {
      const s = getComputedStyle(x);
      if (!clips(s) && !scroller(s)) continue;
      const b = x.getBoundingClientRect();
      if (scroller(s) || /(auto|scroll)/.test(s.overflowY)) {
        if (r.right <= b.left + 1 || r.left >= b.right - 1 || r.bottom <= b.top + 1 || r.top >= b.bottom - 1) { scrolledAway = true; break; }
        reach = meet(reach, b); visible = meet(visible, b);
        continue;
      }
      visible = meet(visible, b);
    }
    if (scrolledAway) continue;
    /* fixed/sticky chrome cannot be scrolled into view: it must sit inside the viewport */
    const pinned = fixedLike(el);
    const horizontallyOut = reach.left < -1 || reach.right > vw + 1;
    const fullyHidden = visible.right - visible.left <= 0 || visible.bottom - visible.top <= 0;
    if (fullyHidden) continue; /* collapsed panels, closed carousels and marquee copies */
    const cut = visible.right - visible.left < reach.right - reach.left - 2 || visible.bottom - visible.top < reach.bottom - reach.top - 2;
    if (horizontallyOut || cut) clipped.push(`${describe(el)} [${Math.round(r.left)},${Math.round(r.right)}]${pinned ? ' pinned' : ''}${cut ? ' cut' : ''}`);
    /* label ink wider than the control (no ellipsis) */
    const cs = getComputedStyle(el);
    if (cs.textOverflow !== 'ellipsis' && el.children.length === 0 && el.textContent.trim()) {
      const range = document.createRange(); range.selectNodeContents(el);
      const ink = range.getBoundingClientRect();
      if (ink.width > 0 && (ink.left < r.left - 2 || ink.right > r.right + 2)) labelClipped.push(describe(el));
    }
  }
  return {
    ...doc,
    overflow: doc.scrollWidth > vw + 1,
    outside: outside.slice(0, 6).map(o => `${describe(o.el)} [${o.left},${o.right}]`),
    clipped: [...new Set(clipped)].slice(0, 8),
    labelClipped: [...new Set(labelClipped)].slice(0, 8),
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
  };
}

async function audit(page, tag, locale) {
  const a = await page.evaluate(layoutAudit);
  check(tag, 'no document horizontal overflow', !a.overflow && !a.outside.length, `scrollWidth ${a.scrollWidth}/${a.vw} ${a.outside.join(' | ')}`);
  check(tag, 'no clipped interactive controls', !a.clipped.length, a.clipped.join(' | '));
  check(tag, 'no clipped control labels', !a.labelClipped.length, a.labelClipped.join(' | '));
  check(tag, 'document direction', a.dir === (RTL.has(locale) ? 'rtl' : 'ltr'), a.dir);
  check(tag, 'document language', a.lang.toLowerCase() === locale.toLowerCase(), a.lang);
  /* expanded disclosures (data tables, FAQ answers) must not overflow either */
  const opened = await page.evaluate(() => { const closed = [...document.querySelectorAll('details:not([open])')]; closed.forEach(d => { d.open = true; d.dataset.matrixOpened = '1'; }); return closed.length; });
  if (opened) {
    await settle(page, 120);
    const b = await page.evaluate(layoutAudit);
    check(tag, 'no overflow with disclosures open', !b.overflow && !b.outside.length, `scrollWidth ${b.scrollWidth}/${b.vw} ${b.outside.join(' | ')}`);
    await page.evaluate(() => document.querySelectorAll('details[data-matrix-opened]').forEach(d => { d.open = false; delete d.dataset.matrixOpened; }));
  }
  return a;
}

async function axe(page, tag) {
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const result = await page.evaluate(async () => {
    /* WCAG 2.x A/AA rules; axe's experimental rules are excluded */
    const r = await window.axe.run(document, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return r.violations.filter(v => (v.impact === 'serious' || v.impact === 'critical') && !v.tags.includes('experimental'))
      .map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map(n => n.target.join(' ')) , count: v.nodes.length }));
  });
  check(tag, 'axe: no serious or critical violations', !result.length, result.map(v => `${v.id}(${v.impact}×${v.count}: ${v.nodes.join(', ')})`).join(' ; '));
  return result;
}

const TRIGGERS = '.openfund-header .menu, .of-terminal-menu-trigger';
async function visibleTrigger(page) {
  const handle = await page.evaluateHandle(sel => [...document.querySelectorAll(sel)].find(el => el.checkVisibility() && el.getBoundingClientRect().width > 0) || null, TRIGGERS);
  const el = handle.asElement();
  return el;
}

async function drawer(page, tag, locale, capture) {
  const trigger = await visibleTrigger(page);
  if (!trigger) return false;
  const drawerSel = '.of-offcanvas[data-state="open"] [role="dialog"]';
  await trigger.click();
  await page.waitForSelector(drawerSel, { timeout: 4000 }).catch(() => {});
  await settle(page, 380);
  const info = await page.evaluate(() => {
    const host = document.querySelector('.of-offcanvas');
    const panel = document.querySelector('.of-offcanvas-panel');
    if (!host || !panel) return null;
    const r = panel.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), vw: document.documentElement.clientWidth, dir: host.getAttribute('dir'),
      focusInside: panel.contains(document.activeElement), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
  });
  check(tag, 'drawer opens', !!info);
  if (!info) return true;
  const rtl = RTL.has(locale);
  check(tag, `drawer on the ${rtl ? 'right' : 'left'} edge`, rtl ? Math.abs(info.right - info.vw) <= 1 : Math.abs(info.left) <= 1, `${info.left}-${info.right}/${info.vw}`);
  check(tag, 'drawer direction', info.dir === (rtl ? 'rtl' : 'ltr'), info.dir);
  check(tag, 'drawer fits the viewport', info.right - info.left <= info.vw + 1 && !info.overflow, `${info.left}-${info.right}`);
  check(tag, 'focus moves into the drawer', info.focusInside);
  if (capture) await page.screenshot({ path: capture });
  await page.keyboard.press('Escape');
  await settle(page, 380);
  check(tag, 'Escape closes the drawer', await page.locator(drawerSel).count() === 0);
  check(tag, 'focus returns to the trigger', await trigger.evaluate(el => document.activeElement === el));
  /* outside click: the backdrop beside the panel */
  await trigger.click();
  await page.waitForSelector(drawerSel, { timeout: 4000 }).catch(() => {});
  await settle(page, 380);
  const panel = await page.locator('.of-offcanvas-panel').boundingBox();
  const vw = info.vw;
  if (panel && (rtl ? panel.x > 8 : panel.x + panel.width < vw - 8)) {
    await page.mouse.click(rtl ? 4 : vw - 4, Math.round(panel.y + panel.height / 2));
    await settle(page, 380);
    check(tag, 'outside click closes the drawer', await page.locator(drawerSel).count() === 0);
  } else {
    /* full-width drawer at this width: the close button is the outside-click substitute */
    await page.locator('.of-offcanvas-close').click();
    await settle(page, 380);
    check(tag, 'close button closes the full-width drawer', await page.locator(drawerSel).count() === 0);
  }
  check(tag, 'scroll lock released', await page.evaluate(() => getComputedStyle(document.documentElement).overflow !== 'hidden' && getComputedStyle(document.body).overflow !== 'hidden'));
  return true;
}

async function drawerNavigation(page, base, tag, locale, route) {
  const trigger = await visibleTrigger(page);
  if (!trigger) return;
  await trigger.click();
  await page.waitForSelector('.of-offcanvas[data-state="open"]', { timeout: 4000 }).catch(() => {});
  await settle(page, 380);
  const target = await page.evaluate(loc => {
    const here = location.pathname;
    /* collapsed mega-menu groups hide their tiles: pick a link the visitor can see */
    const link = [...document.querySelectorAll('.of-offcanvas-body a[href]')].find(a => { const u = new URL(a.href, location.href); return a.getClientRects().length > 0 && u.origin === location.origin && u.pathname.startsWith(`/${loc}/`) && u.pathname !== here && !a.target; });
    /* the same destination may also sit hidden in a collapsed group: click this exact link */
    if (link) link.setAttribute('data-matrix-pick', '');
    return link ? link.getAttribute('href') : null;
  }, locale);
  check(tag, 'drawer offers an in-app destination', !!target);
  if (!target) { await page.keyboard.press('Escape'); return; }
  await page.locator('.of-offcanvas-body a[data-matrix-pick]').click();
  await page.waitForURL(u => new URL(u).pathname !== `/${locale}/${route}`, { timeout: 8000 }).catch(() => {});
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await settle(page, 600);
  check(tag, 'navigation closes the drawer', await page.locator('.of-offcanvas[data-state="open"]').count() === 0, target);
  check(tag, 'scroll restored after navigation', await evaluateSettled(page, () => getComputedStyle(document.documentElement).overflow !== 'hidden'));
}

async function run(browser, base) {
  if (CAPTURE) fs.mkdirSync(OUT, { recursive: true });
  for (const { locale, theme } of COMBOS) {
    const context = await browser.newContext({ viewport: { width: WIDTHS[0], height: 800 }, colorScheme: theme, locale: 'en-US', reducedMotion: 'reduce' });
    const fixtures = await installMarketFixtures(context, { allow: [base] });
    await context.addInitScript(([t, l]) => { try { localStorage.setItem('of-theme-choice', t); localStorage.setItem('of-language-choice', l); } catch {} }, [theme, locale]);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && critical(m.text())) errors.push(m.text().split('\n')[0]); });
    for (const route of ROUTES) {
      const terminal = TERMINAL.includes(route);
      errors.length = 0;
      await page.setViewportSize({ width: WIDTHS[0], height: 800 });
      await page.goto(`${base}/${locale}/${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(terminal ? '.of-terminal-header, .of-terminal' : 'main, footer', { timeout: 30000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
      await settle(page, 600);
      const routeTag = `${route} ${locale} ${theme}`;
      check(routeTag, 'route renders (no redirect away)', new URL(page.url()).pathname.startsWith(`/${locale}/${route.split('/')[0]}`), page.url());
      check(routeTag, 'theme applied', await page.evaluate(t => document.documentElement.dataset.theme === t, theme));
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
        await settle(page, terminal ? 450 : 250);
        const tag = `${routeTag} ${width}`;
        await audit(page, tag, locale);
        if (AXE_WIDTHS.has(width)) await axe(page, tag);
        const key = `${route} ${locale} ${theme} ${width}`;
        if (CAPTURE && SHOTS.has(key)) {
          const focus = SHOT_FOCUS[route];
          if (focus) await page.evaluate(sel => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), focus);
          await settle(page, 200);
          await page.screenshot({ path: path.join(OUT, `${key.replace(/[ /]/g, '-')}.png`) });
          await page.evaluate(() => scrollTo(0, 0));
        }
        if (DRAWER_ROUTES.has(route)) {
          const exercised = await drawer(page, tag, locale, CAPTURE && DRAWER_SHOTS.has(key) ? path.join(OUT, `${key.replace(/[ /]/g, '-')}-drawer.png`) : null);
          if (width <= 430) check(tag, 'phone width exposes the menu trigger', exercised);
        }
      }
      /* added locales: a visible fallback notice means some copy on the page fell back to English */
      if (!['fa', 'en'].includes(locale)) check(routeTag, 'no untranslated-copy notice', await page.locator('[data-untranslated-notice]').count() === 0);
      check(routeTag, 'no critical console errors', !errors.length, [...new Set(errors)].slice(0, 4).join(' || '));
      /* route change closes the drawer (phone width) */
      if (DRAWER_ROUTES.has(route)) {
        await page.setViewportSize({ width: 375, height: 800 });
        await settle(page, 300);
        await drawerNavigation(page, base, `${routeTag} 375 navigation`, locale, route);
      }
    }
    for (const origin of fixtures.blocked) blockedOrigins.add(origin);
    await context.close();
  }
}

(async () => {
  const external = process.env.TEST_FRONTEND_URL;
  const site = external ? null : await startStaticSite({ root: process.env.MATRIX_ROOT || 'react' });
  const base = (external || site.url).replace(/\/$/, '');
  const browser = await chromium.launch();
  const started = Date.now();
  try { await run(browser, base); } finally { await browser.close(); if (site) await site.close(); }
  fs.mkdirSync(OUT, { recursive: true });
  const report = { generatedAt: new Date().toISOString(), base: external ? base : 'static react/ build', shard: `${shardIndex}/${shardCount}`,
    widths: WIDTHS, combos: COMBOS, routes: ROUTES, passed, failed: failures.length, seconds: Math.round((Date.now() - started) / 1000), failures };
  fs.writeFileSync(path.join(OUT, `report${shardCount > 1 ? `-${shardIndex}` : ''}.json`), JSON.stringify(report, null, 2));
  console.log(`responsive matrix (shard ${shardIndex}/${shardCount}): ${passed} checks passed, ${failures.length} failed in ${report.seconds}s`);
  console.log(`external origins blocked (offline fixtures): ${[...blockedOrigins].sort().join(', ') || 'none'}`);
  if (failures.length) {
    /* group identical findings so the log stays readable */
    const groups = new Map();
    for (const f of failures) { const k = `${f.check} :: ${f.detail.replace(/\[-?\d+,-?\d+\]/g, '[…]').replace(/\d+\/\d+/g, 'n/n').slice(0, 160)}`; const g = groups.get(k) || []; g.push(f.tag); groups.set(k, g); }
    for (const [k, tags] of groups) console.log(`FAIL ${k}\n     ${tags.length}× e.g. ${tags.slice(0, 4).join(' ; ')}`);
    process.exitCode = 1;
  }
})().catch(error => { console.error(error); process.exit(1); });
