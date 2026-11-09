/* Navigation-only browser acceptance. Uses bundled published-route contracts;
 * does not authenticate wallets or exercise terminal business behavior. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const appRequire = createRequire(path.resolve(__dirname, '../apps/web-react/package.json'));
const { buildSync } = appRequire('esbuild');
const BASE = (process.env.TEST_FRONTEND_URL || 'http://127.0.0.1:5187/').replace(/\/?$/, '/');
function loadLibrary() {
  const bundle = buildSync({entryPoints:[path.resolve(__dirname,'../apps/web-react/src/cms/siteContent.ts')],bundle:true,platform:'node',format:'cjs',packages:'external',write:false});
  const mod = {exports:{}};
  new Function('require','module','exports',bundle.outputFiles[0].text)(appRequire,mod,mod.exports);
  return mod.exports.bundledLibrary;
}

/* Language switching uses the five-language selector (fa, en, ar, ru, zh-CN);
   toggleLanguage keeps the previous fa <-> en intent of these steps. */
async function toggleLanguage(page) {
  const select = page.locator('.of-language-select select').first();
  await select.waitFor({ state: 'attached' });
  await select.selectOption((await select.inputValue()) === 'fa' ? 'en' : 'fa');
}

async function desktop(page) {
 const results = [];
 const assert = (condition, message) => { if (!condition) throw new Error(message); };
 const base = BASE;
 const pages = ['home','challenges','markets','rulebook','transparency','faq','faq/q/what-is-openfund','learn','learn/paths/perpetual-futures-mechanics','learn/lessons/perps-how-they-work','learn/glossary','tools','tools/position-size','referral'];
 for (const locale of ['en','fa']) {
  for (const source of pages) {
   await page.goto(base + locale + '/' + source);
   if(source==='home'){await page.locator('.home-gateway').waitFor();assert(await page.locator('header #navigation').count()===0,'Home gateway nav hidden');results.push({locale,source,gateway:true});continue;}
   await page.locator('.resources-toggle[aria-controls="website-resources"]').waitFor({state:'attached'});
   await page.waitForTimeout(source === 'challenges' ? 1800 : 200);
   assert(new URL(page.url()).pathname === '/' + locale + '/' + source, 'redirect ' + source);
   await page.locator('.resources-toggle[aria-controls="website-resources"]').click();
   const header = await page.locator('header a').evaluateAll(as => as.map(a => ({href:a.getAttribute('href'),text:a.textContent})));
   assert(header.length === 12, 'header count ' + source + ': ' + header.length);
   const footer = await page.locator('footer a').evaluateAll(as => as.map(a => ({href:a.getAttribute('href'),text:a.textContent})));
   assert(footer.length >= 15, 'footer count ' + source + ': ' + footer.length);
   for (const link of [...header,...footer]) assert(link.href && link.href !== '#' && !link.href.startsWith('#/#'), 'placeholder ' + JSON.stringify(link));
   assert(await page.locator('html').getAttribute('dir') === (locale === 'fa' ? 'rtl':'ltr'), 'direction ' + source);
   results.push({locale,source,header,footer});
   // Exercise every website destination in both chrome areas from each page.
   for (const area of ['header','footer']) {
    const links = (area === 'header' ? header : footer).filter(a=>a.href.startsWith(base) && !a.href.includes('/prop/'));
    for (const {href} of links) {
     await page.goto(base + locale + '/' + source);
     await page.locator('.resources-toggle[aria-controls="website-resources"]').waitFor({state:'attached'});
     await page.waitForTimeout(source === 'challenges' ? 500 : 220);
     const link = page.locator(area + ' a[href="'+href+'"]');
     if (area === 'header' && await link.locator('xpath=ancestor::*[contains(@class,"nav-dropdown")]').count()) await page.locator('.resources-toggle[aria-controls="website-resources"]').click();
     await link.click();
     await page.waitForURL(new URL(href, base).href);
     await page.waitForTimeout(href.includes('/challenges') || source === 'challenges' ? 500 : 60);
     assert(new URL(page.url()).pathname + new URL(page.url()).search === href, 'wrong click ' + source + ' ' + href);
     if (href.includes('section=team')) {
      await page.waitForTimeout(1800);
      const top = await page.locator('#team').evaluate(el=>el.getBoundingClientRect().top);
      assert(top >= 0 && top < 250, 'team not reached ' + top);
     }
    }
   }
  }
 }
 return results;
}

async function interactions(page) {
 const base = BASE;
 const check = (v,m) => {if(!v) throw new Error(m)};
 const results=[];
 for (const locale of ['en','fa']) {
  for (const route of ['faq','challenges','learn/lessons/perps-how-they-work','tools/position-size','learn/glossary']) {
   await page.setViewportSize({width:1440,height:900});
   await page.goto(base+locale+'/'+route);
   await page.locator('.resources-toggle[aria-controls="website-resources"]').waitFor({state:'attached'});
   await page.waitForTimeout(700);
   if(route==='challenges') await page.waitForTimeout(1800);
   await page.locator('.resources-toggle[aria-controls="website-resources"]').focus();
   await page.keyboard.press('ArrowDown');
   await page.waitForFunction(()=>document.querySelector('.nav-dropdown a')===document.activeElement,null,{timeout:3000}).catch(async error=>{ console.log(await page.evaluate(()=>({focus:document.activeElement.outerHTML,group:document.querySelector('.nav-account').outerHTML,dropdownStyle:{visibility:getComputedStyle(document.querySelector('.nav-dropdown')).visibility,display:getComputedStyle(document.querySelector('.nav-dropdown')).display}})));throw error; });
   await page.keyboard.press('End');
   check(await page.locator('.nav-dropdown a').last().evaluate(el=>el===document.activeElement), 'End '+route);
   await page.keyboard.press('Escape');
   check(await page.locator('.resources-toggle[aria-controls="website-resources"]').evaluate(el=>el===document.activeElement), 'Escape focus '+route);
   check(await page.locator('.resources-toggle[aria-controls="website-resources"]').getAttribute('aria-expanded')==='false','Escape aria');
   await page.locator('.resources-toggle[aria-controls="website-resources"]').hover();
   await page.locator('.nav-dropdown a[href$="/learn"]').hover();
   check(await page.locator('.nav-dropdown a[href$="/learn"]').isVisible(), 'hover bridge');
   await toggleLanguage(page);
   const other=locale==='en'?'fa':'en';
   await page.waitForURL(base+other+'/'+route);
   await page.waitForFunction(dir=>document.documentElement.dir===dir,other==='fa'?'rtl':'ltr');
   for(const width of [900,390]) {
    await page.setViewportSize({width,height:844});
    await page.locator('.menu').click();
    check(await page.locator('.menu').getAttribute('aria-expanded')==='true', 'mobile open '+route);
    const target=page.locator('.nav-dropdown a[href$="/tools"]');
    check(await target.isVisible(),'mobile resources visible '+width+' '+route);
    await target.click();
    await page.waitForURL(base+other+'/tools');
    check(await page.locator('.menu').getAttribute('aria-expanded')==='false','mobile closed');
    await page.waitForTimeout(300);
    await page.goto(base+other+'/'+route);
    await page.locator('.resources-toggle[aria-controls="website-resources"]').waitFor({state:'attached'});
   await page.waitForTimeout(700);
    if(route==='challenges') await page.waitForTimeout(1800);
   }
   results.push({locale,route,keyboard:true,hover:true,language:true,mobile:[900,390]});
  }
 }
 await page.setViewportSize({width:1440,height:900});
 await page.goto(base+'en/faq');
 await page.locator('.resources-toggle[aria-controls="website-resources"]').waitFor({state:'attached'});
   await page.waitForTimeout(700);
 await page.locator('.resources-toggle[aria-controls="website-resources"]').click();
 await page.screenshot({path:'output/playwright/navigation-en-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+'fa/learn');
 await page.locator('.menu').click();
 await page.screenshot({path:'output/playwright/navigation-fa-mobile.png'});
 return results;
}


async function touch(page) {
  const context = await page.context().browser().newContext({hasTouch:true,viewport:{width:390,height:844}});
  const touchPage = await context.newPage();
  const records=[];
  try {
    for(const locale of ['fa','en']) for(const route of ['home','challenges','faq','learn/lessons/perps-how-they-work','tools/position-size','referral']) {
      if(route==='home')continue; // The gateway deliberately has no resources menu.
      await touchPage.goto(BASE+locale+'/'+route);
      await touchPage.locator('.resources-toggle[aria-controls="website-resources"]').waitFor({state:'attached'});
      await touchPage.waitForTimeout(route==='challenges'?1800:700);
      await touchPage.locator('.menu').tap();
      await touchPage.locator('.nav-dropdown a[href$="/learn/glossary"]').tap();
      await touchPage.waitForURL(BASE+locale+'/learn/glossary');
      await touchPage.waitForTimeout(300);
      records.push({locale,route,touch:true});
    }
    for(const locale of ['en','fa']) {
      await touchPage.setViewportSize({width:1440,height:900});
      await touchPage.goto(BASE+locale+'/faq');
      await touchPage.waitForTimeout(700);
      const trigger=touchPage.locator('.resources-toggle[aria-controls="website-resources"]');
      await trigger.focus();
      await touchPage.keyboard.press('Enter');
      if(await trigger.getAttribute('aria-expanded')!=='true') throw new Error('Enter disclosure');
      await touchPage.keyboard.press('Space');
      if(await trigger.getAttribute('aria-expanded')!=='false') throw new Error('Space disclosure');
      await trigger.tap();
      await touchPage.locator('.nav-dropdown a[href$="/learn"]').tap();
      await touchPage.waitForURL(BASE+locale+'/learn');
      await touchPage.goto(BASE+locale+'/challenges?section=team');
      await touchPage.waitForTimeout(2200);
      await toggleLanguage(touchPage);
      const other=locale==='en'?'fa':'en';
      await touchPage.waitForURL(BASE+other+'/challenges?section=team');
      records.push({locale,desktopTouch:true,enterSpace:true,localizedSection:true});
    }
  } finally { await context.close(); }
  return records;
}

async function ancillary(page) {
  const records=[];
  for(const locale of ['fa','en']) for(const route of ['faq','challenges']) {
    await page.setViewportSize({width:1440,height:900});
    await page.goto(BASE+locale+'/'+route);
    await page.waitForTimeout(route==='challenges'?2200:700);
    const externals=await page.locator('footer a[href^="https:"]').evaluateAll(as=>as.map(a=>({href:a.href,target:a.target,rel:a.rel})));
    for(const link of externals) if(link.target!=='_blank'||!link.rel.includes('noopener')) throw new Error('External behavior changed '+link.href);
    await page.locator('footer a[href="#top"]').click();
    await page.waitForFunction(()=>scrollY<50);
    await page.locator('.nav-cta').click();
    await page.waitForURL(BASE+locale+'/prop/trade');
    records.push({locale,route,externalAttributes:true,backToTop:true,terminalDestinationOnly:true});
  }
  await page.goto(BASE+'en/tools/position-size?nav-check=1');
  await page.waitForTimeout(700);
  await toggleLanguage(page);
  await page.waitForURL(BASE+'fa/tools/position-size?nav-check=1');
  records.push({nestedQueryPreserved:true});
  return records;
}

async function auditRoutes(page) {
  const library = loadLibrary();
  const routes = ['home','challenges','markets','rulebook','transparency','revenue-model','live-market-access','ambassador','coach','faq','learn','learn/glossary','tools','referral',
    ...library.faqItems.map(item=>'faq/q/'+item.key),
    ...library.paths.flatMap(p=>['learn/paths/'+p.slug,...p.lessons.map(l=>'learn/lessons/'+l.slug)]),
    ...library.glossary.map(t=>'learn/glossary/'+t.slug),...library.tools.map(t=>'tools/'+t.slug)];
  const allowed = new Set(['/',...['en','fa'].flatMap(locale=>routes.map(route=>'/'+locale+'/'+route))]);
  const records=[];
  for(const locale of ['en','fa']) for(const route of routes) {
    await page.goto(BASE+locale+'/'+route);
    if(route==='home') await page.locator('.home-gateway').waitFor();
    else await page.locator('.resources-toggle[aria-controls="website-resources"]').waitFor({state:'attached'});
    await page.waitForTimeout(route==='challenges'?1800:300);
    const path = new URL(page.url()).pathname;
    if(path!=='/'+locale+'/'+route) throw new Error('Unexpected redirect '+route+' '+path);
    const links = await page.locator('a[href]').evaluateAll(links=>links.map(a=>a.getAttribute('href')));
    for(const href of links) {
      if(href==='#') { if(await page.locator('header a[href="#"],footer a[href="#"]').count()) throw new Error('Chrome placeholder on '+route); continue; }
      if(href.startsWith('/') && !/^\/(assets|downloads)\//.test(href)) {
        const target=href.split('?')[0];
        if(!allowed.has(target) && !/^\/(en|fa)\/(prop|perpetual)\/(trade|dashboard)$/.test(target) && target!=='/terminal') throw new Error('Unknown route '+href+' on '+route);
      } else if(href.startsWith('#') && href!=='#' && !href.startsWith('#/') && !await page.evaluate(id=>!!document.getElementById(id),decodeURIComponent(href.slice(1)))) throw new Error('Missing anchor '+href+' on '+route);
    }
    if(/not found|پیدا نشد/.test(await page.locator('h1').innerText())) throw new Error('Missing content '+route);
    records.push({locale,route,links:links.length,bodyPlaceholders:links.filter(href=>href==='#').length});
  }
  return records;
}
(async()=>{
  fs.mkdirSync(path.resolve(__dirname,'../output/playwright'),{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  const results={};
  try {
    for(const [name,run] of [['desktop',desktop],['interactions',interactions],['routes',auditRoutes],['touch',touch],['ancillary',ancillary]]) {
      if (process.env.NAVIGATION_PHASE && process.env.NAVIGATION_PHASE !== name) continue;
      console.log('Running '+name);
      results[name]=await run(page);
      fs.writeFileSync(path.resolve(__dirname,'../output/playwright/navigation-'+(process.env.NAVIGATION_PHASE || 'all')+'-results.json'),JSON.stringify(results,null,2));
      console.log(name+': '+results[name].length+' source/locale cases passed');
    }
    const book=page.locator('footer a[href$=".zip"]');
    await page.setViewportSize({width:1440,height:900});
    await page.goto(BASE+'en/faq');
    await book.waitFor();
    const response=await page.request.get(new URL(await book.getAttribute('href'),BASE).href);
    if(response.status()!==200 || (await response.body()).subarray(0,2).toString()!=='PK') throw new Error('Brandbook download failed');
    results.download={status:response.status(),zip:true};
    fs.writeFileSync(path.resolve(__dirname,'../output/playwright/navigation-'+(process.env.NAVIGATION_PHASE || 'all')+'-results.json'),JSON.stringify(results,null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
