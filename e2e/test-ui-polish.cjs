/* Real integrated UI matrix. Disposable EIP-1193 connection only: no personal
 * wallets, invented trading records or blockchain writes. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const BASE=(process.env.TEST_FRONTEND_URL||'http://localhost:8080/react').replace(/\/$/,'');
const OUT=path.resolve(process.env.POLISH_OUTPUT||'output/playwright/ui-polish');
fs.mkdirSync(OUT,{recursive:true});
const checks=[],screenshots=[];
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
(async()=>{
 const browser=await chromium.launch();
 try{
 for(const connected of [false,true]){
  const context=await browser.newContext();
  if(connected)await context.addInitScript(()=>{
   let chain='0xaa36a7';const events={};
   window.ethereum={isMetaMask:true,on:(n,f)=>(events[n]||=[]).push(f),removeListener:(n,f)=>events[n]=(events[n]||[]).filter(x=>x!==f),request:async({method,params})=>{
    if(['eth_accounts','eth_requestAccounts'].includes(method))return ['0x0000000000000000000000000000000000000001'];
    if(method==='eth_chainId')return chain;
    if(method==='eth_getBalance')return '0x0'; // Explicit connection fixture, never financial acceptance.
    if(method==='eth_blockNumber')return '0x1';
    if(method==='wallet_switchEthereumChain'){chain=params[0].chainId;(events.chainChanged||[]).forEach(f=>f(chain));return null;}
    if(method==='wallet_requestPermissions')return [{parentCapability:'eth_accounts'}];
    if(method==='eth_sendTransaction'||method==='personal_sign')throw Error('No signing permitted in presentation matrix');
    return null;
   }};
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const locale of ['fa','en'])for(const theme of ['dark','light'])for(const width of [1440,900,390]){
   await page.setViewportSize({width,height:900});
   await page.goto(BASE+`/#/${locale}/home`);
   await page.evaluate(theme=>{localStorage.setItem('of-theme',theme);document.documentElement.dataset.theme=theme},theme);
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
   check(prefix+' Home products',await page.locator('.home-panel').count()===(locale==='fa'?2:0));
   check(prefix+' Home navigation',await page.locator('header #navigation').count()===(locale==='fa'?0:1));
   check(prefix+' terminal entry',await page.locator('header .nav-cta').isVisible());
   if(width===1440 && !connected || width===390 && connected){const file=`home-${locale}-${theme}-${width}-${connected?'test-wallet':'disconnected'}.png`;await page.screenshot({animations:'disabled',path:path.join(OUT,file),fullPage:true});screenshots.push({file,fixture:connected?'connection-only test wallet':'none'})}
   await page.goto(BASE+`/#/${locale}/faq`);await page.waitForTimeout(300);await page.locator('#navigation').waitFor({state:'attached'});
   check(prefix+' other-page navigation',await page.locator('#navigation a').count()===10);
   const tv=page.locator('.tradingview-credit');await tv.waitFor();
   check(prefix+' TradingView description',(await tv.innerText()).includes(locale==='fa'?'اطلاعات و اخبار بازارها':'Market Data & News'));
   check(prefix+' external-resource wording',(await tv.innerText()).includes(locale==='fa'?'منبع خارجی':'External resource'));
   check(prefix+' existing footer references',await page.locator('.credits-row .render-credit').count()===4);
   if(width===1440&&!connected){const file=`footer-${locale}-${theme}.png`;await page.locator('.credits-row').evaluate(el=>el.scrollIntoView({behavior:'instant',block:'center'}));await page.screenshot({animations:'disabled',path:path.join(OUT,file)});screenshots.push({file,fixture:'none'})}
   for(const product of locale==='fa'?['prop','perpetual']:['prop']){
    for(const section of ['dashboard','trade','portfolio','journal','journal?section=accounts']){
     await page.goto(BASE+`/#/${locale}/${product}/${section}`);await page.locator('.of-terminal-top').waitFor();await page.waitForTimeout(250);await page.locator('.of-terminal-top').waitFor();
     check(prefix+` ${product}/${section} geometry`,Object.values(await headerGeometry(page,true)).every(v=>Array.isArray(v)?v.length===0:!v));
     check(prefix+` ${product}/${section} theme`,await page.locator('html').getAttribute('data-theme')===theme);
     check(prefix+` ${product}/${section} product selector`,await page.locator('.of-product-switch').count()===(locale==='fa'?1:0));
     if(width===1440&&!connected&&['dashboard','journal'].includes(section)){const file=`${section}-${product}-${locale}-${theme}.png`;await page.screenshot({animations:'disabled',path:path.join(OUT,file),fullPage:true});screenshots.push({file,fixture:'none'})}
     if(section==='trade'){
      const frame=page.frameLocator('iframe');await frame.locator('canvas').first().waitFor();
      const child=page.frames().find(f=>f.parentFrame());
      await child.waitForFunction(()=>!!window.__openfundChart?.chart);
      await child.evaluate(()=>window.__openfundChart.chart.ready());
      await page.waitForTimeout(150);
      const state=await frame.locator('html').evaluate(el=>({theme:el.dataset.theme,filter:getComputedStyle(el).filter,bg:getComputedStyle(el.ownerDocument.body).backgroundColor,chart:window.__openfundChart?.chart?.renderer.getConfig().layout.background}));
      check(prefix+` ${product} iframe native theme`,state.chart?.toLowerCase()===(theme==='light'?'#f2f5f0':'#060808')&&state.theme===theme&&state.filter==='none'&&state.bg===(theme==='light'?'rgb(242, 245, 240)':'rgb(6, 8, 8)'));
      if(width===1440&&!connected){const file=`${product}-${locale}-${theme}.png`;await page.screenshot({animations:'disabled',path:path.join(OUT,file)});screenshots.push({file,fixture:'none'})}
      // Switch via the real control, then refresh to verify persistence.
      await page.getByRole('button',{name:locale==='fa'?'تغییر پوسته':'Toggle theme',exact:true}).click();
      await page.waitForFunction(expected=>document.documentElement.dataset.theme===expected,theme==='light'?'dark':'light');
      await child.waitForFunction(expected=>document.documentElement.dataset.theme===expected&&window.__openfundChart?.chart?.renderer.getConfig().layout.background.toLowerCase()===(expected==='light'?'#f2f5f0':'#060808'),theme==='light'?'dark':'light');
      check(prefix+` ${product} live Vela theme`,true);
      await page.reload();await page.locator('.of-terminal-top').waitFor();await page.waitForTimeout(250);await page.locator('.of-terminal-top').waitFor();
      check(prefix+` ${product} persisted toggle`,await page.locator('html').getAttribute('data-theme')!==(theme));
      await page.getByRole('button',{name:locale==='fa'?'تغییر پوسته':'Toggle theme',exact:true}).click();
     }
    }
   }
  }
  if(!connected) for(const locale of ['en','fa'])for(const theme of ['dark','light'])for(const surface of ['public','terminal']){
    await page.evaluate(theme=>{localStorage.setItem('of-theme',theme);document.documentElement.dataset.theme=theme},theme);
    await page.goto(BASE+`/#/${locale}/${surface==='public'?'faq':'prop/dashboard'}`);await page.reload();await page.waitForTimeout(350);
    await page.locator('header .rk-chip-connect').click();const dialog=page.getByRole('dialog');await dialog.waitFor();
    await page.waitForTimeout(300);
    check(`${surface}/${locale}/${theme}: wallet failure keeps header bounded`,Object.values(await headerGeometry(page,surface==='terminal')).every(v=>Array.isArray(v)?v.length===0:!v));
    const expected=surface==='public'&&theme==='light'?'invert(1) hue-rotate(180deg)':'none';
    check(`${surface}/${locale}/${theme}: native wallet modal palette`,await dialog.evaluate(el=>getComputedStyle(el).filter)===expected);
    const file=`wallet-modal-${surface}-${locale}-${theme}.png`;await page.screenshot({animations:'disabled',path:path.join(OUT,file)});screenshots.push({file,fixture:'No installed wallet; real connection error and modal'});
    await page.keyboard.press('Escape');check(`${surface}/${locale}/${theme}: wallet modal closes`,await page.getByRole('dialog').count()===0);
  }
  await page.goto(BASE+'/#/en/perpetual/trade?account=gains-private');await page.waitForURL('**/#/en/prop/dashboard');
  check('Direct EN Perpetual redirects without account query',page.url().endsWith('#/en/prop/dashboard'));
  for(const suffix of ['','/dashboard','/portfolio','/journal','/rewards','/not-a-page']){
   await page.goto(BASE+'/#/en/perpetual'+suffix);await page.waitForURL('**/#/en/prop/dashboard');
   check('EN Perpetual route unavailable: '+suffix,true);
  }
  await page.goto(BASE+'/#/en/home');await page.locator('#language-toggle').waitFor();await page.waitForTimeout(1800);
  await page.locator('#language-toggle').click();await page.waitForURL('**/#/fa/home');
  await page.locator('.home-products').waitFor();check('EN Home language switch returns to FA two-product Home',true);
  await page.locator('#language-toggle').click();await page.waitForURL('**/#/en/home');
  await page.locator('.hero').waitFor();check('FA Home language switch returns to EN Prop landing',true);
  await page.goto(BASE+'/#/fa/perpetual/journal?account=product-specific');await page.getByRole('button',{name:'EN',exact:true}).click();
  await page.waitForURL('**/#/en/prop/dashboard');check('Perpetual language switch clears product account context',true);
  check('No browser exceptions',errors.length===0);
  await context.close();
 }
 }finally{await browser.close();fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({base:BASE,checks,screenshots,capturedAt:new Date().toISOString(),status:'completed checks only; process exit determines acceptance'},null,2));}
 console.log(`PASS ${checks.length} UI polish checks`);
})().catch(e=>{console.error(e);process.exitCode=1});
