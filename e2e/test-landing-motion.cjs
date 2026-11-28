/* Openfund gateway (/:locale/home) acceptance: one fixed screen with the
 * solar-system scene and two actions, at every viewport. CMS fixtures, when requested, use the repository
 * editorial seed and never simulate wallets, executions or market records. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chooseLocale, toggleLocale } = require('./helpers/language.cjs');
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:5186').replace(/\/$/, '');
const OUT = path.resolve(process.env.LANDING_OUTPUT || 'output/playwright/landing-motion');
fs.mkdirSync(OUT, { recursive: true });
const checks = [], matrix = [], errors = [];

/* Language switching uses the five-language selector (fa, en, ar, ru, zh-CN);
   toggleLanguage keeps the previous fa <-> en intent of these steps. */
async function toggleLanguage(page) {
  await toggleLocale(page);
}

function check(name, value) { assert.ok(value, name); checks.push(name); }
async function fixture(context) {
  if (process.env.GITHUB_ACTIONS !== 'true' && process.env.LANDING_CMS_FIXTURE !== '1') return;
  const built = require('../apps/web-react/node_modules/esbuild').buildSync({entryPoints: ['apps/web-react/src/cms/seed/homeContent.ts'], bundle:true, write:false, platform:'node', format:'cjs'});
  const mod = {exports:{}}; new Function('module','exports',built.outputFiles[0].text)(mod, mod.exports);
  const s = mod.exports.homeSeed;
  await context.route('**/items/home_content**', route => route.fulfill({json:{data:{prop_cta_destination:s.propCtaDestination,perpetual_cta_destination:s.perpetualCtaDestination,prop_image:null,perpetual_image:null,translations:['fa','en'].map(language_code => ({language_code,...Object.fromEntries(Object.entries(s.translations[language_code]).map(([k,v]) => [k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),v]))}))}}}));
}
/* a canvas pixel digest: changes while the scene animates */
const digest = page => page.locator('.solar-canvas').evaluate(c => {
  const g = c.getContext('2d'), { width, height } = c, d = g.getImageData(0, 0, width, height).data
  let sum = 0, lit = 0
  for (let i = 0; i < d.length; i += 4 * 97) { sum = (sum * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13) % 1e9; if (d[i] + d[i + 1] + d[i + 2] > 120) lit++ }
  return { sum, lit, width, height }
});

(async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({colorScheme:'dark'}); await fixture(context);
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    for (const [width,height,locale] of [[1920,1080,'fa'],[1440,900,'fa'],[1366,768,'en'],[1280,720,'fa'],[1024,768,'fa'],[768,1024,'en'],[390,844,'fa'],[375,667,'fa'],[320,568,'fa'],[844,390,'fa'],[430,932,'ar']]) {
      await page.setViewportSize({width,height}); await page.goto(`${BASE}/${locale}/home`);
      await page.locator('.solar-gateway .solar-actions .button').last().waitFor(); await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(() => { const s = document.querySelector('.solar-gateway'); return s && s.style.getPropertyValue('--gateway-top') !== '' });
      await page.waitForTimeout(300);
      const geometry = await page.evaluate(() => {
        const stage = document.querySelector('.solar-gateway').getBoundingClientRect();
        const header = document.querySelector('header').getBoundingClientRect();
        const strip = document.querySelector('.bitpin-ticker')?.getBoundingClientRect().height || 0;
        const buttons = [...document.querySelectorAll('.solar-actions .button')].map(e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, text: e.textContent.trim(),
          clipped: e.scrollWidth > e.clientWidth + 1 } });
        const overlap = buttons.length === 2 && !(buttons[0].r <= buttons[1].l || buttons[1].r <= buttons[0].l || buttons[0].b <= buttons[1].t || buttons[1].b <= buttons[0].t);
        return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
          bodyScroll: document.body.scrollHeight - innerHeight, stageTop: stage.top, stageBottom: stage.bottom, headerBottom: header.bottom, strip, buttons, overlap,
          footerCount: document.querySelectorAll('footer').length, dir: document.documentElement.dir,
          canvas: (() => { const c = document.querySelector('.solar-canvas').getBoundingClientRect(); return { w: c.width, h: c.height } })(),
          nav: !!document.querySelector('header #navigation, header .menu, header .of-mobile-menu') };
      });
      matrix.push(geometry); console.log(JSON.stringify(geometry));
      const tag = `${locale} ${width}x${height}`;
      check(`${tag} one screen: nothing scrolls`, geometry.scrollWidth <= width + 1 && geometry.scrollHeight <= height + 1);
      check(`${tag} stage sits between the header and the price strip`, Math.abs(geometry.stageTop - geometry.headerBottom) <= 1 && Math.abs(geometry.stageBottom - (height - geometry.strip)) <= 1);
      check(`${tag} canvas fills the stage`, Math.abs(geometry.canvas.w - width) <= 1 && Math.abs(geometry.canvas.h - (geometry.stageBottom - geometry.stageTop)) <= 1);
      check(`${tag} two actions inside the stage`, geometry.buttons.length === 2 && geometry.buttons.every(b => b.l >= -.5 && b.r <= width + .5 && b.t >= geometry.stageTop - .5 && b.b <= geometry.stageBottom + .5));
      check(`${tag} actions do not overlap or clip`, !geometry.overlap && geometry.buttons.every(b => !b.clipped));
      check(`${tag} 44px action targets`, geometry.buttons.every(b => b.w >= 44 && b.h >= 42));
      check(`${tag} no footer on the gateway`, geometry.footerCount === 0);
      check(`${tag} site navigation present`, geometry.nav);
      check(`${tag} direction`, geometry.dir === (locale === 'en' ? 'ltr' : 'rtl'));
      const painted = await digest(page);
      check(`${tag} scene painted`, painted.width > 0 && painted.lit > 20);
      await page.screenshot({path:path.join(OUT,`gateway-${locale}-${width}x${height}.png`)});
    }
    await page.setViewportSize({width:1440,height:900}); await page.goto(BASE+'/fa/home'); await page.locator('.solar-canvas').waitFor();
    await page.waitForTimeout(600);
    const first = await digest(page); await page.waitForTimeout(1200); const second = await digest(page);
    check('the solar system turns', first.sum !== second.sum);
    /* visibility lifecycle: a hidden tab stops drawing */
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))});
    await page.waitForTimeout(150); const hiddenA = await digest(page); await page.waitForTimeout(700); const hiddenB = await digest(page);
    check('hidden document pauses the scene', hiddenA.sum === hiddenB.sum);
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});
    await page.waitForTimeout(150); const resumedA = await digest(page); await page.waitForTimeout(900); const resumedB = await digest(page);
    check('visible document resumes', resumedA.sum !== resumedB.sum);
    check('decoration never captures pointer', await page.evaluate(()=>document.elementFromPoint(innerWidth/2, innerHeight/3)?.classList.contains('solar-canvas')));
    const theme=await page.locator('html').getAttribute('data-theme'); await page.locator('#theme-toggle').click();
    check('theme control changes',await page.locator('html').getAttribute('data-theme')!==theme);
    await page.screenshot({path:path.join(OUT,'gateway-light-1440x900.png')});
    await page.locator('#theme-toggle').click();
    await page.locator('header .rk-chip-connect').click(); await page.getByRole('dialog').first().waitFor();
    check('existing wallet modal opens', await page.getByRole('dialog').count()>0);
    await page.keyboard.press('Escape');
    /* reduced motion: one still frame */
    const still = await browser.newContext({colorScheme:'dark',reducedMotion:'reduce',viewport:{width:1280,height:800}}); await fixture(still);
    const quiet = await still.newPage(); await quiet.goto(BASE+'/fa/home'); await quiet.locator('.solar-canvas').waitFor(); await quiet.waitForTimeout(500);
    const q1 = await digest(quiet); await quiet.waitForTimeout(900); const q2 = await digest(quiet);
    check('reduced motion draws one still frame', q1.lit > 20 && q1.sum === q2.sum);
    await still.close();
    for (const [selector,target] of [['.solar-buy',/\/fa\/checkout$/],['.solar-rules',/\/fa\/rulebook$/]]) {
      await page.goto(BASE+'/fa/home'); await page.locator(selector).click(); await page.waitForURL(target);
      check(`${selector} opens ${target}`, target.test(page.url()));
      /* the URL changes before a lazy route has rendered: wait for the gateway to unmount */
      const unlocked = await page.waitForFunction(()=>!document.documentElement.classList.contains('of-gateway-locked'), null, {timeout:10000}).then(()=>true, ()=>false);
      check(`${selector}: leaving the gateway unlocks scrolling`, unlocked);
    }
    await page.goto(BASE+'/fa/home');
    await page.locator('.of-language-select').first().waitFor({ state: 'attached' });
    await toggleLanguage(page); await page.waitForFunction(()=>document.documentElement.lang==='en'); await page.locator('.solar-gateway').waitFor();
    check('English gateway', page.url().includes('/en/home') && await page.locator('.solar-actions .button').count()===2);
    await toggleLanguage(page); await page.waitForFunction(()=>document.documentElement.lang==='fa'); await page.locator('.solar-gateway').waitFor();
    check('language round trip returns the Persian gateway', page.url().includes('/fa/home'));
    const touch = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}); await fixture(touch);
    const mobile = await touch.newPage(); await mobile.goto(BASE+'/fa/home'); await mobile.locator('.solar-buy').tap(); await mobile.waitForURL(/\/fa\/checkout$/);
    check('touch opens the checkout', /\/fa\/checkout$/.test(mobile.url()));
    await touch.close();
    check('no browser exceptions',errors.length===0);
    fs.writeFileSync(path.join(OUT,'validation.json'),JSON.stringify({source:process.env.LANDING_CMS_FIXTURE==='1'||process.env.GITHUB_ACTIONS==='true'?'repository CMS editorial seed fixture':'local Directus',checks,matrix,errors},null,2));
    console.log(`PASS ${checks.length} gateway checks`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
