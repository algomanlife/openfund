/* Landing-only acceptance. CMS fixtures, when requested, use the repository
 * editorial seed and never simulate wallets, executions or market records. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:5186').replace(/\/$/, '');
const OUT = path.resolve(process.env.LANDING_OUTPUT || 'output/playwright/landing-motion');
fs.mkdirSync(OUT, { recursive: true });
const checks = [], matrix = [], errors = [];
const originalCards = [...fs.readFileSync('apps/web-react/src/pages/landing-body.html','utf8').matchAll(/<article class="feature-card">([\s\S]*?)<\/article>/g)].slice(0,4);
const originalCopies = originalCards.map(m=>m[1].match(/<p>([\s\S]*?)<\/p>/)[1]);

/* Language switching uses the five-language selector (fa, en, ar, ru, zh-CN);
   toggleLanguage keeps the previous fa <-> en intent of these steps. */
async function toggleLanguage(page) {
  const select = page.locator('.of-language-select select').first();
  await select.waitFor({ state: 'attached' });
  await select.selectOption((await select.inputValue()) === 'fa' ? 'en' : 'fa');
}

function check(name, value) { assert.ok(value, name); checks.push(name); }
async function fixture(context) {
  if (process.env.GITHUB_ACTIONS !== 'true' && process.env.LANDING_CMS_FIXTURE !== '1') return;
  const built = require('../apps/web-react/node_modules/esbuild').buildSync({entryPoints: ['apps/web-react/src/cms/seed/homeContent.ts'], bundle:true, write:false, platform:'node', format:'cjs'});
  const mod = {exports:{}}; new Function('module','exports',built.outputFiles[0].text)(mod, mod.exports);
  const s = mod.exports.homeSeed;
  await context.route('**/items/home_content**', route => route.fulfill({json:{data:{prop_cta_destination:s.propCtaDestination,perpetual_cta_destination:s.perpetualCtaDestination,prop_image:null,perpetual_image:null,translations:['fa','en'].map(language_code => ({language_code,...Object.fromEntries(Object.entries(s.translations[language_code]).map(([k,v]) => [k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),v]))}))}}}));
}
(async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({colorScheme:'dark'}); await fixture(context);
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    if (process.env.LANDING_BEFORE_URL) {
      for (const [width,height] of [[1440,900],[375,667]]) {
        await page.setViewportSize({width,height}); await page.goto(process.env.LANDING_BEFORE_URL+'/fa/home');
        await page.locator('.home-products').waitFor(); await page.evaluate(()=>document.fonts.ready);
        await page.screenshot({path:path.join(OUT,`before-${width}x${height}.png`),fullPage:true,animations:'disabled'});
      }
    }
    for (const [width,height] of [[1920,1080],[1440,900],[1366,768],[1280,720],[1024,768],[768,1024],[390,844],[375,667]]) {
      await page.setViewportSize({width,height}); await page.goto(BASE+'/fa/home');
      await page.locator('.technical-feature').last().waitFor(); await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(() => Math.abs(parseFloat(getComputedStyle(document.querySelector('.home-gateway')).minHeight) - (innerHeight - document.querySelector('header').getBoundingClientRect().height)) <= 1 && getComputedStyle(document.querySelector('.home-stage')).display === 'flex');
      const geometry = await page.evaluate(() => {
        const visible = [...document.querySelectorAll('.home-gateway h1,.home-panel h2,.home-product-note,.home-panel .button,.home-community .telegram-community,.technical-heading,.technical-feature,.made-by-humans,header a,header button')].filter(e=>e.getBoundingClientRect().width);
        const gateway = document.querySelector('.home-gateway').getBoundingClientRect();
        const footerCount = document.querySelectorAll('footer').length;
        return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,gatewayBottom:gateway.bottom,footerCount,
          outside:visible.filter(e=>{const r=e.getBoundingClientRect();return r.left<-.5||r.top<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5}).map(e=>e.textContent),
          /* phones scroll vertically; nothing may leave the viewport sideways */
          outsideX:visible.filter(e=>{const r=e.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5}).map(e=>e.textContent),
          // Decorative button shine intentionally extends scrollWidth. Inspect
          // button text horizontally; unconstrained font ascenders are not clipping.
          clipped:visible.filter(e=>{
            if(!e.matches('.button'))return e.scrollWidth>e.clientWidth+1;
            const box=e.getBoundingClientRect(),walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;
            while(n=walker.nextNode()){if(!n.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(n);const r=range.getBoundingClientRect();if(r.width&&r.height&&(r.left<box.left-1||r.right>box.right+1))return true;}return false;
          }).map(e=>e.textContent),
          targets:[...document.querySelectorAll('.home-panel .button,.technical-feature')].map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})),
          rtl:document.documentElement.dir};
      });
      matrix.push(geometry); console.log(JSON.stringify(geometry));
      // Desktop/tablet: the gateway fits the usable viewport. Phones (≤700px)
      // keep readable sizes and may scroll vertically, never horizontally.
      if (width > 700) check(`${width}x${height} gateway fits usable viewport`,geometry.scrollWidth<=width+1&&geometry.scrollHeight<=height+1&&geometry.gatewayBottom<=height+1&&geometry.outside.length===0&&geometry.clipped.length===0);
      else check(`${width}x${height} phone gateway has no horizontal overflow or clipping`,geometry.scrollWidth<=width+1&&geometry.outsideX.length===0&&geometry.clipped.length===0);
      check(`${width}x${height} Persian gateway has no footer`,geometry.footerCount===0);
      check(`${width}x${height} 44px product/feature targets`,geometry.targets.every(r=>r.w>=44&&r.h>=44));
      check(`${width}x${height} RTL`,geometry.rtl==='rtl');
      check('four proposed features with original SVGs',await page.locator('.technical-feature').count()===4&&await page.locator('.technical-art svg').count()===4);
      check('Prop vector replaces cartoon',await page.locator('.landing-terminal').count()===1&&await page.locator('img[src*="prop-trading"]').count()===0);
      check('new leveraged-market vector replaces the previous machine',await page.locator('.leveraged-market').count()===1&&await page.locator('.home-perpetual-art img,.perpetual-vector').count()===0);
      check('MADE BY HUMANS badge removed',await page.locator('.made-by-humans').count()===0&&!(await page.locator('.home-gateway').innerText()).includes('MADE BY HUMANS'));
      for (let i=0;i<4;i++) {
        const trigger=page.locator('.technical-feature').nth(i); await trigger.focus(); await page.keyboard.press('Enter');
        await page.locator('dialog[open]').waitFor();
        check('detail description and focus',await page.locator('#feature-dialog-detail').innerText()!==''&&await page.locator('dialog blockquote').innerText()!==''&&await page.locator('dialog button').evaluate(e=>e===document.activeElement));
        check('original Persian source copy preserved',await page.locator('dialog blockquote').innerText()===originalCopies[i]);
        await page.keyboard.press('Tab'); check('dialog focus trapped',await page.evaluate(()=>!!document.activeElement.closest('dialog')));
        await page.keyboard.press('Escape'); await page.waitForFunction(index=>document.activeElement===document.querySelectorAll('.technical-feature')[index],i); check('Escape restores feature focus',await trigger.evaluate(e=>e===document.activeElement));
      }
      await page.locator('.eyebrow').click();
      await page.screenshot({path:path.join(OUT,`after-${width}x${height}.png`),fullPage:true,animations:'disabled'});
    }
    await page.setViewportSize({width:1440,height:900});
    await page.mouse.move(900,400); await page.waitForTimeout(850);
    check('pointer parallax updates',await page.locator('.landing-motion').evaluate(e=>e.style.getPropertyValue('--pointer-x')!=='0px'));
    check('decoration never captures pointer',await page.locator('.landing-motion').evaluate(e=>getComputedStyle(e).pointerEvents==='none'));
    const theme=await page.locator('html').getAttribute('data-theme'); await page.locator('#theme-toggle').click();
    check('theme control changes',await page.locator('html').getAttribute('data-theme')!==theme);
    await page.screenshot({path:path.join(OUT,'after-light-1440x900.png'),fullPage:true,animations:'disabled'});
    await page.locator('#theme-toggle').click();
    await page.locator('header .rk-chip-connect').click(); await page.getByRole('dialog').filter({hasNot:page.locator('#feature-dialog-title')}).first().waitFor();
    check('existing wallet modal opens',await page.locator('.technical-dialog[open]').count()===0&&await page.getByRole('dialog').count()>0);
    await page.keyboard.press('Escape');
    await page.emulateMedia({reducedMotion:'reduce'}); await page.mouse.move(100,200); await page.waitForTimeout(50);
    check('reduced motion resets parallax',await page.locator('.landing-motion').evaluate(e=>e.style.getPropertyValue('--pointer-x')==='0px'));
    check('reduced motion stops all decorative animation',await page.locator('.home-gateway').evaluate(e=>[...e.querySelectorAll('*')].every(n=>getComputedStyle(n).animationName==='none')));
    await page.emulateMedia({reducedMotion:'no-preference'});
    // Visibility lifecycle: override the read-only getter in this test document only.
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))});
    check('hidden document pauses decoration',await page.locator('.terminal-price').evaluateAll(es=>es.length===2&&es.every(e=>getComputedStyle(e).animationPlayState==='paused')));
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});
    check('visible document resumes',await page.locator('.home-gateway').getAttribute('data-paused')==='false');
    for (const [i,target] of [[0,/\/fa\/(challenges|prop\/trade)$/],[1,/\/fa\/(perpetual\/trade|challenges)$/]]) {
      await page.goto(BASE+'/fa/home'); await page.locator('.home-panel .button').nth(i).click(); await page.waitForURL(target);
      check('product '+i+' follows existing destination',target.test(page.url()));
    }
    await page.goto(BASE+'/fa/home');
    await page.reload();
    await page.locator('.of-language-select select').first().waitFor({ state: 'attached' });
    await toggleLanguage(page); await page.locator('#builder').waitFor(); await page.waitForFunction(()=>window.__ofLandingKicked&&window.ofTranslations&&document.documentElement.lang==='en');
    check('English uses existing challenge builder',await page.locator('.home-products').count()===0&&await page.locator('#builder').count()===1);
    await toggleLanguage(page); await page.waitForFunction(()=>!window.__ofLegacyLandingLoaded&&document.querySelector('.technical-features'));
    check('language round trip returns Persian gateway',page.url().includes('/fa/home'));
    const touch = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await fixture(touch);
    const mobile = await touch.newPage();await mobile.goto(BASE+'/fa/home');await mobile.locator('.technical-feature').first().tap();await mobile.locator('dialog[open]').waitFor();await mobile.locator('dialog button').tap();
    check('touch can open/close details',await mobile.locator('dialog[open]').count()===0);
    await mobile.mouse.move(80,200);
    check('touch disables parallax',await mobile.locator('.landing-motion').evaluate(e=>['','0px'].includes(e.style.getPropertyValue('--pointer-x'))));
    await touch.close();
    check('no browser exceptions',errors.length===0);
    fs.writeFileSync(path.join(OUT,'validation.json'),JSON.stringify({source:process.env.LANDING_CMS_FIXTURE==='1'||process.env.GITHUB_ACTIONS==='true'?'repository CMS editorial seed fixture':'local Directus',checks,matrix,errors},null,2));
    console.log(`PASS ${checks.length} landing checks`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
