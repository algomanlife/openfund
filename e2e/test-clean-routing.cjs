/* Clean-URL routing and branded-loading regression acceptance.
 * Covers the two 2026-11 routing fixes:
 *  - browser-history routes at the site root (no '/react' prefix, no '#'),
 *  - legacy '/react/#/…' bookmarks recovered client-side (hash never reaches
 *    the server), with query preservation,
 *  - the branded boot loader appears pre-React and is removed on readiness
 *    (both themes), never keeping the page hidden,
 *  - pre-paint RTL/LTR so a locale never renders in the wrong direction,
 *  - SEO head: clean canonicals, fa/en/x-default hreflang on public pages,
 *    noindex on the authenticated product app.
 * Navigation-only: no wallets, no terminal business behavior. */
const { chromium } = require('playwright');
const BASE = (process.env.TEST_FRONTEND_URL || 'http://127.0.0.1:8180').replace(/\/$/, '');
const OUT = 'output/playwright/clean-routing';

(async () => {
  require('node:fs').mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const results = [];
  const check = (name, cond, extra = '') => {
    results.push({ name, pass: !!cond, detail: extra });
    if (!cond) console.error('FAIL', name, extra);
  };

  /* initial boot at a clean URL */
  await page.goto(`${BASE}/fa/challenges`, { waitUntil: 'domcontentloaded' });
  const loaderSeen = await page.evaluate(() => !!document.getElementById('of-boot-loader'));
  check('boot loader present pre-React', loaderSeen);
  await page.waitForTimeout(2500);
  check('boot loader removed after app ready', await page.evaluate(() => !document.getElementById('of-boot-loader')));
  check('clean URL kept (no hash, no /react)', page.url() === `${BASE}/fa/challenges`, page.url());
  check('FA document rtl before paint settles', await page.evaluate(() => document.documentElement.dir) === 'rtl');
  check('landing legacy runtime booted', (await page.locator('#builder').count()) === 1);
  check('nav link is a clean path', await page.evaluate(() => document.querySelector('#navigation a[href="/fa/markets"]')?.getAttribute('href')) === '/fa/markets');

  /* in-app navigation via legacy DOM anchors (no document reload) */
  await page.locator('footer a[href="/fa/markets"]').first().click();
  await page.waitForTimeout(1200);
  check('legacy DOM link routed client-side', page.url() === `${BASE}/fa/markets`, page.url());
  check('markets page rendered', (await page.locator('.resources-toggle').count()) === 1);

  /* language switch: URL + direction swap together */
  await page.locator('.of-language-select select').first().selectOption('en');
  await page.waitForTimeout(900);
  check('language switch URL', page.url() === `${BASE}/en/markets`, page.url());
  check('language switch direction ltr', await page.evaluate(() => document.documentElement.dir) === 'ltr');

  /* legacy bookmark: /react/#/fa/faq → clean path (hash never reaches server) */
  await page.goto(`${BASE}/react/#/fa/faq`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  check('legacy hash route recovered to clean path', page.url() === `${BASE}/fa/faq`, page.url());
  check('recovered page rendered', (await page.locator('.resources-toggle').count()) === 1);

  /* legacy bookmark with in-hash query */
  await page.goto(`${BASE}/react/#/fa/challenges?section=team`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1100);
  check('legacy hash query preserved', page.url() === `${BASE}/fa/challenges?section=team`, page.url());

  /* legacy bare landing anchor: /react/#markets → markets section route */
  await page.goto(`${BASE}/react/#markets`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1100);
  check('legacy bare-anchor recovered', page.url() === `${BASE}/fa/markets`, page.url());

  /* direct deep link + refresh (server SPA fallback) */
  await page.goto(`${BASE}/en/tools/position-size`);
  await page.waitForTimeout(800);
  check('direct deep link renders', (await page.locator('.resources-toggle').count()) === 1, page.url());
  await page.reload();
  await page.waitForTimeout(800);
  check('refresh on deep link works', (await page.locator('.resources-toggle').count()) === 1, page.url());

  /* back/forward history */
  await page.goBack();
  await page.waitForTimeout(600);
  check('browser back leaves the deep link', !page.url().includes('/en/tools'), page.url());

  /* SEO head on a public page */
  await page.goto(`${BASE}/en/faq`);
  await page.waitForTimeout(800);
  const seo = await page.evaluate(() => ({
    canonical: document.querySelector('link[rel="canonical"]')?.href,
    robots: document.querySelector('meta[name="robots"]')?.content,
    alternates: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(l => l.hreflang),
  }));
  check('canonical is the clean URL', seo.canonical === `${BASE}/en/faq`, JSON.stringify(seo));
  check('public page indexable', seo.robots === 'index,follow', String(seo.robots));
  check('hreflang fa/en/x-default present', ['fa', 'en', 'x-default'].every(l => seo.alternates.includes(l)), seo.alternates.join(','));

  /* Added interface locales keep their direction while English editorial
     content remains the canonical source until translations exist. */
  await page.goto(`${BASE}/ar/faq`);
  await page.waitForTimeout(800);
  check('Arabic route keeps RTL direction', await page.evaluate(() => document.documentElement.dir) === 'rtl');
  check('Arabic editorial canonical points to English', await page.evaluate(() => document.querySelector('link[rel="canonical"]')?.href) === `${BASE}/en/faq`);
  await page.goto(`${BASE}/ar/home`);
  await page.locator('.hero').waitFor();
  await page.waitForTimeout(900);
  check('Arabic landing keeps its interface direction after classic script boot', await page.evaluate(() => document.documentElement.lang === 'ar' && document.documentElement.dir === 'rtl'));

  /* private product routes are not indexable */
  await page.goto(`${BASE}/fa/prop/dashboard`);
  await page.waitForTimeout(800);
  check('private route noindex', await page.evaluate(() => document.querySelector('meta[name="robots"]')?.content) === 'noindex');

  /* root redirect into the locale gateway */
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  check('root redirects to locale home', /\/(fa|en|ar|ru|zh-CN)\/home$/.test(page.url()), page.url());

  /* boot loader theme awareness (light) */
  await page.evaluate(() => { localStorage.setItem('of-theme-choice', 'light') });
  await page.goto(`${BASE}/en/faq`, { waitUntil: 'domcontentloaded' });
  check('boot loader light theme', await page.evaluate(() => {
    const el = document.getElementById('of-boot-loader');
    return el && getComputedStyle(el).backgroundColor === 'rgb(255, 255, 255)';
  }));
  await page.evaluate(() => { localStorage.removeItem('of-theme-choice') });

  require('node:fs').writeFileSync(`${OUT}/results.json`, JSON.stringify({ base: BASE, results }, null, 2));
  const failures = results.filter(r => !r.pass);
  console.log(`${results.length - failures.length}/${results.length} routing/loading checks passed`);
  await browser.close();
  process.exit(failures.length ? 1 : 0);
})();
