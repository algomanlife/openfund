/* Real integrated UI matrix. Disposable EIP-1193 connection only: no personal
 * wallets, invented trading records or blockchain writes. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const BASE=(process.env.TEST_FRONTEND_URL||'http://localhost:8080').replace(/\/$/,'');
const OUT=path.resolve(process.env.POLISH_OUTPUT||'output/playwright/ui-polish');
fs.mkdirSync(OUT,{recursive:true});
const checks=[],screenshots=[],browserErrors=[],networkErrors=[];
// CI has no Directus service. Reuse the actual published editorial seed only;
// financial/account/market endpoints remain untouched by this fixture.
const CMS_FIXTURE=process.env.GITHUB_ACTIONS==='true'||process.env.POLISH_CMS_FIXTURE==='1';
// Parent validation may supply a real disposable test-session storage state.
// Never forge /auth/me, persist auth in source, or touch the user database here.
const AUTH_STORAGE=process.env.POLISH_AUTH_STORAGE;
if(process.env.POLISH_REQUIRE_AUTH==='1')assert.ok(AUTH_STORAGE,'Protected acceptance requires disposable POLISH_AUTH_STORAGE');
let homeFixture;
if(CMS_FIXTURE){
 const built=require('../apps/web-react/node_modules/esbuild').buildSync({entryPoints:[path.resolve('apps/web-react/src/cms/seed/homeContent.ts')],bundle:true,write:false,platform:'node',format:'cjs'});
 const mod={exports:{}};new Function('module','exports',built.outputFiles[0].text)(mod,mod.exports);
 const seed=mod.exports.homeSeed;
 homeFixture={prop_cta_destination:seed.propCtaDestination,perpetual_cta_destination:seed.perpetualCtaDestination,prop_image:null,perpetual_image:null,
  translations:['fa','en'].map(language_code=>({language_code,...Object.fromEntries(Object.entries(seed.translations[language_code]).map(([key,value])=>[key.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),value]))}))};
}
console.log('Home content: '+(CMS_FIXTURE?'repository published editorial seed fixture':'existing local Directus'));
// Presentation acceptance must not exhaust the public Gains service across
// hundreds of route mounts. Use the existing recorded chart fixture in CI;
// backend/account/auth endpoints are never intercepted. Local live mode remains.
const CHART_FIXTURE=process.env.GITHUB_ACTIONS==='true'||process.env.POLISH_CHART_FIXTURE==='1';
const chartFixture=JSON.parse(fs.readFileSync(path.resolve('packages/openfund-charts/test/fixtures/gains-btc-usd.json'),'utf8'));
async function chartRoutes(context){
 if(!CHART_FIXTURE)return;
 await context.route('https://api.gains.trade/v1/arbitrum/**',async route=>{
  const url=new URL(route.request().url()),pathname=url.pathname;
  const price=chartFixture.bars.at(-1).close;
  if(!pathname.endsWith('/candles')&&!pathname.endsWith('/markets')&&!pathname.endsWith('/prices')){
   await route.fulfill({status:503,json:{error:'Presentation fixture does not provide depth or executed trades'}});return;
  }
  const data=pathname.endsWith('/candles')?chartFixture.bars:pathname.endsWith('/markets')
   ?[{...chartFixture.info,symbol:'BTC/USD',base:'BTC',quote:'USD',group:'crypto',isOpen:true}]
   :[{market:'BTC/USD',mark:price,index:price,updatedAt:Date.now()}];
  await route.fulfill({json:{data}});
 });
 await context.routeWebSocket('wss://api.gains.trade/**',socket=>socket.close());
}
console.log('Chart data: '+(CHART_FIXTURE?'recorded Gains chart fixture; no account/financial acceptance':'live public Gains'));

function check(name,value){assert.ok(value,name);checks.push(name)}
async function headerGeometry(page,terminal){
 return page.locator(terminal?'.of-terminal-top':'header .nav').evaluate(root=>{
  const rect=e=>e.getBoundingClientRect();
  const controls=[...root.querySelectorAll('a,button,select,summary')].filter(e=>{
   const r=rect(e),s=getComputedStyle(e);return r.width&&r.height&&s.visibility!=='hidden'&&!e.closest('.rk-account-controls,.nav-dropdown,.of-terminal-more-links');
  });
  const overlaps=[];
  for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
   const a=controls[i],b=controls[j];if(a.contains(b)||b.contains(a))continue;
   const x=rect(a),y=rect(b);if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1)overlaps.push([a.textContent,b.textContent]);
  }
  return {clippedWalletLabel:controls.some(e=>e.matches('button.rk-chip-connect')&&e.scrollWidth>e.clientWidth+1),overflow:document.documentElement.scrollWidth>innerWidth+1,offscreen:controls.some(e=>rect(e).left< -1||rect(e).right>innerWidth+1),overlaps};
 });
}
// Compare actual rendered surfaces, not just the theme attribute. Transparent
// wrappers are allowed; visible light panels must not retain dark backgrounds.
async function nativeSurfaces(page, selector, theme){
 // Existing header/card color transitions must settle before paint assertions.
 await page.waitForTimeout(650);
 return page.locator(selector).evaluateAll((elements,theme)=>elements.every(el=>{
  const s=getComputedStyle(el),r=el.getBoundingClientRect();
  if(!r.width||!r.height)return true;
  const native=s.filter==='none'||!/(?:invert|hue-rotate)/.test(s.filter);
  const rgb=s.backgroundColor.match(/[\d.]+/g)?.map(Number)||[];
  const light=rgb.length<3||(rgb[3]??1)<.1||(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])>150;
  return native&&(theme!=='light'||light);
 }),theme);
}
// Exact white canvas acceptance complements the broad native-surface guard.
// Resolve transparent wrappers against their real ancestor paint; never insert CSS.
async function whiteCanvas(page,selector,theme){
 if(theme!=='light')return;
 await page.waitForTimeout(650);
 const failures=await page.locator(selector).evaluateAll(elements=>elements.flatMap(el=>{
  const rect=el.getBoundingClientRect();if(!rect.width||!rect.height)return [];
  let rgb=[255,255,255],chain=[];
  for(let node=el;node;node=node.parentElement)chain.unshift(node);
  for(const node of chain){
   const style=getComputedStyle(node),paint=style.backgroundColor.match(/[\d.]+/g)?.map(Number)||[0,0,0,0];
   if(style.backgroundImage!=='none')return [{element:el.tagName+'.'+el.className,reason:'Canvas has image/gradient paint'}];
   const alpha=paint[3]??1;rgb=rgb.map((value,i)=>paint[i]*alpha+value*(1-alpha));
  }
  return rgb.every(value=>Math.abs(value-255)<.01)?[]:[{element:el.tagName+'.'+el.className,background:rgb}];
 }));
 check(`${page.url()} light canvas is exact #FFFFFF: ${JSON.stringify(failures)}`,failures.length===0);
 // Sample real public main paint, including positioned SVG/gradient layers that
 // ancestor background-color checks cannot see. No style injection or masks.
 const points=await page.locator('main:not(.of-terminal-main)').evaluateAll(elements=>elements.flatMap(el=>{
  // Native modal backdrops intentionally dim the underlying main canvas.
  if(document.querySelector('dialog[open],[aria-modal="true"]'))return [];
  const r=el.getBoundingClientRect(),top=Math.max(r.top,100),bottom=Math.min(r.bottom,innerHeight-8);
  if(bottom-top<32)return [];
  return [top+16,(top+bottom)/2,bottom-16].flatMap(y=>[4,innerWidth-5].map(x=>({x:Math.round(x),y:Math.round(y)})));
 }));
 if(points.length){
  const png=(await page.screenshot({animations:'disabled',scale:'css'})).toString('base64');
  const pixels=await page.evaluate(async({png,points})=>{
   const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
   return points.map(point=>({...point,rgba:[...ctx.getImageData(point.x,point.y,1,1).data]}));
  },{png,points});
  check(`${page.url()} main screenshot pixels are white: ${JSON.stringify(pixels)}`,pixels.every(p=>p.rgba.every(value=>value===255)));
 }
}
// WCAG sRGB contrast of actual text paint against composited ancestor surfaces.
// Target content text, not vector brand artwork, hidden nodes or disabled controls.
async function readableText(page,selector,theme){
 if(theme!=='light')return;
 const failures=await page.locator(selector).evaluateAll(roots=>{
  const parse=color=>color.match(/[\d.]+/g)?.map(Number)||[0,0,0,0];
  const blend=(fg,bg)=>bg.map((value,i)=>fg[i]*(fg[3]??1)+value*(1-(fg[3]??1)));
  const luminance=rgb=>rgb.map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((sum,value,i)=>sum+value*[.2126,.7152,.0722][i],0);
  const failures=[],seen=new Set();
  for(const root of roots)for(const el of [root,...root.querySelectorAll('*')]){
   if(seen.has(el))continue;seen.add(el);
   if(el.closest('svg,[aria-hidden="true"]')||el.matches(':disabled'))continue;
   const text=[...el.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join('').trim();
   const style=getComputedStyle(el),rect=el.getBoundingClientRect();
   if(!text||!rect.width||!rect.height||style.visibility!=='visible')continue;
   let background=[255,255,255],chain=[],hidden=false;
   for(let node=el;node;node=node.parentElement)chain.unshift(node);
   for(const node of chain){const s=getComputedStyle(node);if(Number(s.opacity)===0)hidden=true;background=blend(parse(s.backgroundColor),background);}
   if(hidden)continue;
   const fill=style.webkitTextFillColor;
   // Text clipped into a gradient requires screenshot review, not a guessed color.
   if(fill==='transparent'||parse(fill)[3]===0)continue;
   let foreground=blend(parse(fill||style.color),background);
   foreground=blend([...foreground,Number(style.opacity)],background);
   const a=luminance(foreground),b=luminance(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   if(ratio<4.5)failures.push({element:el.tagName+'.'+el.className,text:text.slice(0,90),color:fill||style.color,background,ratio:Number(ratio.toFixed(2))});
  }
  return failures;
 });
 check(`${page.url()} light text WCAG >=4.5: ${JSON.stringify(failures)}`,failures.length===0);
}
const PUBLIC_TEXT='header .brand,header .navlinks,.hero h1,.hero-intro,.home-panel-copy,.technical-heading,.technical-feature,.desktop-btns .dl,.desktop-sub,.desktop-note,footer,.info-hero,.section-heading,.model-card h3,.feature-card h3,.faq-question,.faq-answer,.tool-card h2,.learn-path-card h2,.mk-symbol,.mk-price';
const TERMINAL_TEXT='.of-brand,.of-terminal h1,.of-terminal h2,.of-panel label,.of-metric,.of-terminal p,.of-purchase-page,.of-profile,.of-checkout';
async function walletDisclosureFits(page){
 const menu=page.locator('header .rk-account-menu');
 await menu.locator('summary').click();const controls=menu.locator('.rk-account-controls');await controls.waitFor();
 const fits=await controls.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&el.scrollWidth<=el.clientWidth+1});
 await page.keyboard.press('Escape');return fits&&!await menu.evaluate(el=>el.open);
}
(async()=>{
 const browser=await chromium.launch();
 try{
 for(const connected of [false,true]){
  const context=await browser.newContext(connected&&AUTH_STORAGE?{storageState:AUTH_STORAGE}:{});
  await chartRoutes(context);
  if(CMS_FIXTURE)await context.route('**/items/home_content**',route=>route.fulfill({json:{data:homeFixture}}));
  if(process.env.POLISH_CMS_OFFLINE==='1')await context.route('**/items/**',route=>route.request().url().includes('/home_content')?route.fulfill({json:{data:homeFixture}}):route.abort('connectionrefused'));
  if(connected)await context.addInitScript(address=>{
   let chain='0xaa36a7';const events={};
   window.ethereum={isMetaMask:true,on:(n,f)=>(events[n]||=[]).push(f),removeListener:(n,f)=>events[n]=(events[n]||[]).filter(x=>x!==f),request:async({method,params})=>{
    if(['eth_accounts','eth_requestAccounts'].includes(method))return [address];
    if(method==='eth_chainId')return chain;
    if(method==='eth_getBalance')return '0x0'; // Explicit connection fixture, never financial acceptance.
    if(method==='eth_blockNumber')return '0x1';
    if(method==='wallet_switchEthereumChain'){chain=params[0].chainId;(events.chainChanged||[]).forEach(f=>f(chain));return null;}
    if(method==='wallet_requestPermissions')return [{parentCapability:'eth_accounts'}];
    if(method==='eth_sendTransaction'||method==='personal_sign')throw Error('No signing permitted in presentation matrix');
    return null;
   }};
  },process.env.POLISH_AUTH_ADDRESS||'0x0000000000000000000000000000000000000001');
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);browserErrors.push({url:page.url(),error:e.stack||e.message});console.error('BROWSER EXCEPTION',page.url(),e.stack||e.message)});
  page.on('requestfailed',request=>networkErrors.push({page:page.url(),url:request.url(),error:request.failure()?.errorText}));
  page.on('response',response=>{if(response.status()>=400)networkErrors.push({page:page.url(),url:response.url(),status:response.status()})});
  for(const locale of ['fa','en'])for(const theme of ['dark','light'])for(const width of [1440,900,390]){
   await page.setViewportSize({width,height:900});
   await page.goto(BASE+`/${locale}/home`);
   await page.evaluate(theme=>localStorage.setItem('of-theme-choice',theme),theme);
   await page.reload();
   await page.locator('header .nav-cta').waitFor();
   await page.waitForTimeout(locale==='en'?1800:350);
   if(locale==='fa')await page.locator('.home-products').waitFor();
   else await page.locator('.hero').waitFor();
   if(connected && !await page.locator('.rk-account-menu').count()){
    await page.locator('header .rk-chip-connect').click();await page.locator('.rk-account-menu').waitFor();
   }
   const prefix=`${locale}/${theme}/${width}/${connected?'test-wallet':'disconnected'}`;
   console.log('Checking '+prefix);
   check(prefix+' Home geometry',Object.values(await headerGeometry(page,false)).every(v=>Array.isArray(v)?v.length===0:!v));
   check(prefix+' Home native surfaces',await nativeSurfaces(page,'html,body,header,.home-panel,.hero-account,.account-card,.model-card,.feature-card',theme));
   await whiteCanvas(page,'html,body,#root,main,.home-gateway',theme);
   await readableText(page,PUBLIC_TEXT,theme);
   if(locale==='fa'&&width===1440&&!connected){
    await page.locator('.technical-feature').first().focus();await page.keyboard.press('Enter');
    const technical=page.locator('.technical-dialog[open]');await technical.waitFor();
    check(prefix+' technical dialog native light',await nativeSurfaces(page,'.technical-dialog[open]',theme));
    await page.keyboard.press('Escape');check(prefix+' technical dialog keyboard closes',await technical.count()===0);
   }
   check(prefix+' Home products',await page.locator('.home-panel').count()===(locale==='fa'?2:0));
   check(prefix+' Home navigation',await page.locator('header #navigation').count()===(locale==='fa'?0:1));
   if(connected)check(prefix+' wallet dropdown actions fit and Escape closes',await walletDisclosureFits(page));
   check(prefix+' terminal entry',await page.locator('header .nav-cta').isVisible());
   if(width===1440 && !connected || width===390 && connected){const file=`home-${locale}-${theme}-${width}-${connected?'test-wallet':'disconnected'}.png`;await page.screenshot({animations:'disabled',path:path.join(OUT,file),fullPage:true});screenshots.push({file,fixture:connected?'connection-only test wallet':'none'})}
   await page.goto(BASE+`/${locale}/faq`);await page.waitForTimeout(300);await page.locator('#navigation').waitFor({state:'attached'});
   check(prefix+' other-page navigation',await page.locator('#navigation a').count()===10);
   const tv=page.locator('.credits-row a[href="https://www.tradingview.com/news/"]');await tv.waitFor();
   check(prefix+' TradingView description',(await tv.innerText()).includes(locale==='fa'?'اطلاعات و اخبار بازارها':'Market Data & News'));
   check(prefix+' redundant external label removed',!(/منبع خارجی|External resource/.test(await tv.innerText())));
   check(prefix+' five service references',await page.locator('.credits-row .render-credit').count()===5);
   check(prefix+' public native surfaces',await nativeSurfaces(page,'html,body,header,.faq-item,.faq-help,.navlinks.open',theme));
   await whiteCanvas(page,'html,body,#root,main,.information-page',theme);
   await readableText(page,PUBLIC_TEXT,theme);
   if(!connected)for(const publicRoute of ['challenges','markets','tools','learn','referral','rulebook','transparency']){
    await page.goto(BASE+`/${locale}/${publicRoute}`);await page.locator('.openfund-header').waitFor();
    check(prefix+` ${publicRoute} native surfaces`,await nativeSurfaces(page,'html,body,header,.report-panel,.model-card,.tool-card,.tool-inputs,.tool-results,.learn-path-card,.referral-benefit-grid article,.referral-stage-list li,.mk-grid,.mk-card',theme));
    await whiteCanvas(page,'html,body,#root,main,.information-page',theme);
    await readableText(page,PUBLIC_TEXT,theme);
    if(publicRoute==='challenges'&&width===1440){
     await page.waitForFunction(()=>typeof window.__ofOpenCheckout==='function');
     await page.evaluate(()=>window.__ofOpenCheckout('standard',10000));
     await page.locator('.of-checkout').waitFor();
     await whiteCanvas(page,'.of-checkout',theme);await readableText(page,'.of-checkout',theme);
     await page.locator('.of-checkout-close').click();
    }
   }
   await page.goto(BASE+`/${locale}/faq`);await tv.waitFor();
   check(prefix+' DePay identification',await page.locator('.credits-row a[href="https://depay.com/"]').count()===1);
   if(width===1440&&!connected){const file=`footer-${locale}-${theme}.png`;await page.locator('.credits-row').evaluate(el=>el.scrollIntoView({behavior:'instant',block:'center'}));await page.screenshot({animations:'disabled',path:path.join(OUT,file)});screenshots.push({file,fixture:'none'})}
   for(const product of locale==='fa'?['prop','perpetual']:['prop']){
    for(const section of ['dashboard','trade','portfolio','journal','journal?section=accounts',...(product==='prop'?['purchases','withdrawals','leaderboard','certificates']:['leaderboard','rewards'])]){
     await page.goto(BASE+`/${locale}/${product}/${section}`);await page.locator('.of-terminal-top').waitFor();await page.waitForTimeout(250);await page.locator('.of-terminal-top').waitFor();
     check(prefix+` ${product}/${section} geometry`,Object.values(await headerGeometry(page,true)).every(v=>Array.isArray(v)?v.length===0:!v));
     if(connected)check(prefix+` ${product}/${section} wallet dropdown fits`,await walletDisclosureFits(page));
     check(prefix+` ${product}/${section} theme`,await page.locator('html').getAttribute('data-theme')===theme);
     check(prefix+` ${product}/${section} native surfaces`,await nativeSurfaces(page,'html,body,.of-terminal,.of-terminal-header,.of-panel,.of-metric,.of-modal,.of-terminal-more-links',theme));
     await whiteCanvas(page,'html,body,#root,.of-terminal,.of-terminal-main',theme);
     await readableText(page,TERMINAL_TEXT,theme);
     if(connected&&AUTH_STORAGE&&section==='dashboard'&&product==='prop'){
      const account=page.locator('header .rk-account-menu');await account.locator('summary').click();
      const profileButton=account.getByRole('button',{name:locale==='fa'?'حساب من':'Account',exact:true});
      await profileButton.waitFor();check(prefix+' disposable session is authenticated',await profileButton.isVisible());
      await profileButton.click();await page.locator('.of-profile[open]').waitFor();
      await whiteCanvas(page,'.of-profile',theme);await readableText(page,'.of-profile',theme);
      await page.locator('.of-profile-editbtn').click();await page.locator('.of-profile-field input').first().waitFor();
      await readableText(page,'.of-profile',theme);
      const file=`profile-${locale}-${theme}-${width}-disposable-session.png`;
      await page.screenshot({animations:'disabled',path:path.join(OUT,file)});screenshots.push({file,fixture:'parent-provided disposable authenticated session; no profile writes'});
      await page.keyboard.press('Escape');
     }
     check(prefix+` ${product}/${section} product selector`,await page.locator('.of-product-switch').count()===(locale==='fa'?1:0));
     if(width===1440&&(!connected&&['dashboard','journal'].includes(section)||connected&&AUTH_STORAGE&&['portfolio','journal','journal?section=accounts','purchases','withdrawals'].includes(section))){const file=`${section.replace(/[?=]/g,'-')}-${product}-${locale}-${theme}-${connected?'disposable-session':'anonymous'}.png`;await page.screenshot({animations:'disabled',path:path.join(OUT,file),fullPage:true});screenshots.push({file,fixture:connected?'parent-provided disposable authenticated session; no financial writes':'anonymous presentation only'})}
     if(section==='trade'){
      const frame=page.frameLocator('iframe');
      try{await frame.locator('canvas').first().waitFor()}catch(error){
       const stem=`chart-failure-${prefix.replaceAll('/','-')}-${product}`;
       await page.screenshot({path:path.join(OUT,stem+'.png')});
       fs.writeFileSync(path.join(OUT,stem+'.json'),JSON.stringify({url:page.url(),networkErrors,browserErrors,srcDoc:await page.locator('iframe').getAttribute('srcdoc'),frames:await Promise.all(page.frames().map(async child=>({url:child.url(),html:await child.content()})))},null,2));
       throw error;
      }
      const child=page.frames().find(f=>f.parentFrame());
      await child.waitForFunction(()=>!!window.__openfundChart?.chart);
      await child.evaluate(()=>Promise.race([window.__openfundChart.chart.ready(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Chart readiness timed out')),20000))]));
      await page.waitForTimeout(150);
      const state=await frame.locator('html').evaluate(el=>({theme:el.dataset.theme,filter:getComputedStyle(el).filter,bg:getComputedStyle(el.ownerDocument.body).backgroundColor,chart:window.__openfundChart?.chart?.renderer.getConfig().layout.background}));
      check(prefix+` ${product} iframe native theme`,state.chart?.toLowerCase()===(theme==='light'?'#ffffff':'#060808')&&state.theme===theme&&state.filter==='none'&&state.bg===(theme==='light'?'rgb(255, 255, 255)':'rgb(6, 8, 8)'));
      check(prefix+` ${product} workspace surfaces`,await nativeSurfaces(child,'html,body,.chart-panel,.book-panel,.trade-panel,.bottom-panel,.market-bar,.status-bar,.market-dropdown,.order-details-content',theme));
      await whiteCanvas(child,'html,body,.workspace,.chart-panel,.book-panel,.trade-panel,.bottom-panel,.market-bar,.status-bar',theme);
      await readableText(child,'.market-bar,.book-panel,.trade-panel,.bottom-panel,.status-bar',theme);
      const config=await child.evaluate(()=>window.__openfundChart.chart.renderer.getConfig());
      check(prefix+` ${product} renderer text/grid/crosshair/panes`,config.layout.textColor.toLowerCase()===(theme==='light'?'#3f4c44':'#a9b3a9')&&config.grid.vertLines.color.toLowerCase()===(theme==='light'?'#0a120d12':'#ffffff0a')&&config.grid.horzLines.color===config.grid.vertLines.color&&config.crosshair.color===config.layout.textColor&&config.panes.separatorColor.toLowerCase()===(theme==='light'?'#0a120d22':'#ffffff18'));
      if(width===1440&&!connected)for(const id of ['settings-dialog','notifications-dialog','review-dialog','confirm-dialog','sltp-dialog']){
       // Paint-only inspection of existing dialogs; never submit or synthesize orders.
       await child.locator('#'+id).evaluate(el=>el.showModal());
       check(prefix+` ${product}/${id} native palette`,await nativeSurfaces(child,'#'+id,theme));
       await readableText(child,'#'+id,theme);
       await page.keyboard.press('Escape');check(prefix+` ${product}/${id} Escape closes`,!await child.locator('#'+id).evaluate(el=>el.open));
      }
      if(width===1440&&!connected){const file=`${product}-${locale}-${theme}.png`;await page.screenshot({animations:'disabled',path:path.join(OUT,file)});screenshots.push({file,fixture:'none'})}
      // Switch via the real control, then refresh to verify persistence.
      await page.getByRole('button',{name:locale==='fa'?'تغییر پوسته':'Toggle theme',exact:true}).focus();await page.keyboard.press('Enter');
      await page.waitForFunction(expected=>document.documentElement.dataset.theme===expected,theme==='light'?'dark':'light');
      await child.waitForFunction(expected=>document.documentElement.dataset.theme===expected&&window.__openfundChart?.chart?.renderer.getConfig().layout.background.toLowerCase()===(expected==='light'?'#ffffff':'#060808'),theme==='light'?'dark':'light');
      check(prefix+` ${product} live Vela theme`,true);
      await page.reload();await page.locator('.of-terminal-top').waitFor();await page.waitForTimeout(250);await page.locator('.of-terminal-top').waitFor();
      check(prefix+` ${product} persisted toggle`,await page.locator('html').getAttribute('data-theme')!==(theme));
      await page.getByRole('button',{name:locale==='fa'?'تغییر پوسته':'Toggle theme',exact:true}).click();
     }
    }
   }
  }
  if(!connected) for(const locale of ['en','fa'])for(const theme of ['dark','light'])for(const surface of ['public','terminal']){
    await page.evaluate(theme=>localStorage.setItem('of-theme-choice',theme),theme);
    await page.goto(BASE+`/${locale}/${surface==='public'?'faq':'prop/dashboard'}`);await page.reload();await page.waitForTimeout(350);
    await page.locator('header .rk-chip-connect').click();const dialog=page.getByRole('dialog');await dialog.waitFor();
    await page.waitForTimeout(300);
    check(`${surface}/${locale}/${theme}: wallet failure keeps header bounded`,Object.values(await headerGeometry(page,surface==='terminal')).every(v=>Array.isArray(v)?v.length===0:!v));
    check(`${surface}/${locale}/${theme}: native wallet modal palette`,await dialog.evaluate(el=>getComputedStyle(el).filter)==='none');
    check(`${surface}/${locale}/${theme}: wallet modal has no filtered ancestor`,await dialog.evaluate(el=>{for(let node=el;node;node=node.parentElement)if(/invert|hue-rotate/.test(getComputedStyle(node).filter))return false;return true}));
    const file=`wallet-modal-${surface}-${locale}-${theme}.png`;await page.screenshot({animations:'disabled',path:path.join(OUT,file)});screenshots.push({file,fixture:'No installed wallet; real connection error and modal'});
    await page.keyboard.press('Escape');check(`${surface}/${locale}/${theme}: wallet modal closes`,await page.getByRole('dialog').count()===0);
  }
  await page.goto(BASE+'/en/perpetual/trade?account=gains-private');await page.waitForURL('**/en/prop/dashboard');
  check('Direct EN Perpetual redirects without account query',page.url().endsWith('/en/prop/dashboard'));
  for(const suffix of ['','/dashboard','/portfolio','/journal','/rewards','/not-a-page']){
   await page.goto(BASE+'/en/perpetual'+suffix);await page.waitForURL('**/en/prop/dashboard');
   check('EN Perpetual route unavailable: '+suffix,true);
  }
  await page.goto(BASE+'/en/home');await page.locator('#language-toggle').waitFor();await page.waitForTimeout(1800);
  await page.locator('#language-toggle').click();await page.waitForURL('**/fa/home');
  await page.locator('.home-products').waitFor();await page.waitForFunction(()=>!window.__ofReloadLanding);await page.locator('.home-products').waitFor();
  check('EN Home language switch returns to FA two-product Home',true);
  await page.locator('#language-toggle').click();await page.waitForURL('**/en/home');
  await page.locator('.hero').waitFor();
  // Wait for the classic page's actual document replacement, not an intermediate route.
  await page.waitForFunction(()=>!window.__ofReloadLanding);await page.locator('.hero').waitFor();
  check('FA Home language switch returns to EN Prop landing',true);
  await page.goto(BASE+'/fa/perpetual/journal?account=product-specific');
  await page.locator('.of-terminal-top').waitFor();
  // Leaving the classic EN Home can schedule a document reload after the
  // terminal first appears. Click only after that handoff has completed.
  await page.waitForFunction(()=>!window.__ofReloadLanding);await page.locator('.of-terminal-top').waitFor();
  await page.getByRole('button',{name:'EN',exact:true}).click();
  await page.waitForURL('**/en/prop/dashboard');check('Perpetual language switch clears product account context',true);
  check('No browser exceptions',errors.length===0);
  await context.close();
 }
 // Delayed CMS replies must never start a classic runtime on a removed page.
 for(const delay of [0,50,100,250]){
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  await context.route('**/items/**',async route=>{await new Promise(resolve=>setTimeout(resolve,delay));await route.abort('connectionrefused').catch(()=>{})});
  page.on('pageerror',e=>{errors.push(e.message);browserErrors.push({url:page.url(),error:e.stack||e.message});console.error('BROWSER EXCEPTION',e.stack||e.message)});
  await page.goto(BASE+'/en/home');await page.locator('.hero').waitFor();
  await page.goto(BASE+'/fa/prop/journal');await page.locator('.of-terminal-top').waitFor();await page.waitForTimeout(500);
  check(`Delayed CMS ${delay}ms: leaving Home does not boot stale scripts`,errors.length===0);
  await context.close();
 }
 }finally{await browser.close();fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({browserErrors,networkErrors,chartData:CHART_FIXTURE?'recorded Gains chart fixture; presentation only':'live public Gains',base:BASE,cms:CMS_FIXTURE?'repository published editorial seed fixture':'existing local Directus',checks,screenshots,capturedAt:new Date().toISOString(),status:'completed checks only; process exit determines acceptance'},null,2));}
 console.log(`PASS ${checks.length} UI polish checks`);
 await require('./test-auto-dark.cjs').runAutoDark({configureContext:chartRoutes});
})().catch(e=>{console.error(e);process.exitCode=1});
