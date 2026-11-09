
async function walletButton(page, name) {
  const fa=await page.locator('html').getAttribute('lang')==='fa';
  if(fa) name=({'Sign in':'ورود به اوپن‌فاند','Account':'حساب من','Network: Arbitrum One':'شبکه: Arbitrum One','Network: Sepolia':'شبکه: Sepolia'})[name] || name;
  const button=page.getByRole('button',{name,exact:true,includeHidden:true}).first();
  await button.waitFor({state:'attached'});
  const menu=button.locator('xpath=ancestor::details[contains(@class,"rk-account-menu")]');
  if(await menu.count() && !await menu.evaluate(el=>el.open)) await menu.locator('summary').click();
  return button;
}
/* Real local SIWE/PostgreSQL and server-authoritative simulation, with a
 * disposable EIP-6963 signer. Controlled market/Perpetual fixtures are used
 * only for failure and lifecycle assertions. No blockchain writes are allowed. */
const { chromium } = require('playwright');
const { createRequire } = require('node:module');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const req = createRequire(path.resolve(__dirname,'../apps/backend/package.json'));
const { generatePrivateKey, privateKeyToAccount } = req('viem/accounts');
const { Pool } = req('pg');
const BASE=(process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/,'');
const API=process.env.TEST_BACKEND_URL || 'http://localhost:8080';
const OUT=path.resolve(__dirname,'../output/playwright/terminal-completion');
fs.mkdirSync(OUT,{recursive:true});
const results=[],measurements=[],screenshots=[];
function check(name,value){assert.ok(value,name);results.push(name);console.log('PASS - '+name)}
async function walletContext(browser,{fixtures=false}={}){
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const wallets=[privateKeyToAccount(generatePrivateKey()),privateKeyToAccount(generatePrivateKey())];
 const page=await context.newPage();
 await page.exposeFunction('completionSign',({raw,index})=>wallets[index].signMessage({message:{raw}}));
 await page.addInitScript(addresses=>{
   const events={};let index=0,chain=sessionStorage.getItem('completion-wallet-chain')||'0xaa36a7',rejectConnect=false,rejectSign=false,permitted=sessionStorage.getItem('completion-wallet-approved')==='yes';
   const emit=(name,payload)=>(events[name]||[]).forEach(fn=>fn(payload));
   const provider={isRabby:true,on:(name,fn)=>(events[name]||=[]).push(fn),removeListener:(name,fn)=>events[name]=(events[name]||[]).filter(x=>x!==fn),
    request:async({method,params})=>{
     if(method==='eth_requestAccounts'&&rejectConnect){rejectConnect=false;throw Object.assign(new Error('Connection rejected'),{code:4001})}
     if(method==='eth_accounts')return !permitted||index<0?[]:[addresses[index]];
     if(method==='eth_requestAccounts'){permitted=true;sessionStorage.setItem('completion-wallet-approved','yes');return index<0?[]:[addresses[index]];}
     if(method==='eth_chainId')return chain;
     if(method==='net_version')return String(parseInt(chain,16));
     if(method==='wallet_switchEthereumChain'){chain=params[0].chainId;sessionStorage.setItem('completion-wallet-chain',chain);emit('chainChanged',chain);return null}
     if(method==='personal_sign'){if(rejectSign){rejectSign=false;throw Object.assign(new Error('Signature rejected'),{code:4001})}return window.completionSign({raw:params[0],index})}
     if(method==='eth_getBalance')return '0x0';
     if(method==='eth_blockNumber')return '0x1';
     if(['wallet_requestPermissions','wallet_getPermissions'].includes(method))return [{parentCapability:'eth_accounts'}];
     if(method==='eth_sendTransaction'||method==='eth_signTransaction'){window.completionWallet.transactions++;throw new Error('Blockchain writes forbidden in this test')}
     return null;
    }};
   window.completionWallet={transactions:0,network:()=>chain,rejectConnect:()=>{rejectConnect=true},rejectSign:()=>{rejectSign=true},
    changeAccount:i=>{index=i;emit('accountsChanged',i<0?[]:[addresses[index]])},changeChain:id=>{chain=id;sessionStorage.setItem('completion-wallet-chain',chain);emit('chainChanged',id)}};
   const announce=()=>dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'58d4b098-dbac-4070-8a44-9120c0630d24',name:'Rabby test signer',rdns:'io.rabby',icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>'},provider}}));
   addEventListener('eip6963:requestProvider',announce);announce();
 },wallets.map(w=>w.address));
 if(fixtures){
  await context.route('http://localhost:8055/**',route=>route.abort());
  await context.route('https://api.gains.trade/v1/arbitrum/**',async route=>{
   const url=route.request().url();const data=url.includes('/candles')?[]:url.endsWith('/markets')?[{symbol:'BTC/USD',base:'BTC',quote:'USD',group:'crypto',pairIndex:0,isOpen:true,minLeverage:'1',maxLeverage:'100',pricePrecision:1,sizePrecision:5}]:[{market:'BTC/USD',mark:'50000',index:'50000',updatedAt:Date.now()}];
   await route.fulfill({json:{data}});
  });
  await context.routeWebSocket('wss://api.gains.trade/**',socket=>socket.close());
  await context.route('**/products/perpetual/gains**',route=>route.fulfill({json:{positions:[{id:'controlled-gains-read',market:'BTC/USD',side:'long',entry:'50000',margin:'100',currency:'USDC',leverage:5,sl:null,tp:null}],orders:[],history:[],stats:{totalTrades:0,winRate:null},collaterals:[{index:3,symbol:'USDC',decimals:6}],pagination:{hasMore:false,nextCursor:null}}}));
 }
 return {context,page,wallets};
}
async function call(page,url,body,method){return page.evaluate(async({url,body,method})=>{
 const response=await fetch(url,{method:method||(body?'POST':'GET'),credentials:'include',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};
},{url:API+url,body,method})}
async function connect(page){
 if(!await page.locator('[data-wallet-picker]').count()) await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().click();
 await page.locator('[data-wallet-picker] [data-wallet-id]').first().click();
 await (await walletButton(page, 'Sign in')).waitFor();
}
async function signIn(page){
 const dismiss=page.locator('.of-session-dismiss:visible');
 if(await dismiss.count()) await dismiss.first().click();
 await (await walletButton(page, 'Sign in')).click();
 await (await walletButton(page, 'Account')).waitFor();
}
async function switchToTarget(page){
 const menu=page.locator('.rk-account-menu:visible').first();
 if(!await menu.evaluate(el=>el.open)) await menu.locator('summary').click();
 await menu.locator('[data-switch-network]').click();
}
async function functional(browser){
 const {context,page}=await walletContext(browser,{fixtures:true}),errors=[],protectionWrites=[];
 page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/protection'))protectionWrites.push(request.url())});
 page.on('pageerror',e=>{errors.push(e.stack||e.message);console.error('BROWSER ERROR',e.stack||e.message)});
 try{
  await page.goto(BASE+'/en/prop/dashboard');
  check('EIP-6963 fixture does not expose window.ethereum',await page.evaluate(()=>!window.ethereum));
  await page.evaluate(()=>window.completionWallet.rejectConnect());
  await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().click();
  await page.locator('[data-wallet-picker] [data-wallet-id]').first().click();
  await page.locator('[data-wallet-result="rejected"]').waitFor();
  check('Rejected connection is visible and does not authenticate',(await call(page,'/auth/me')).status===401);
  await connect(page);
  await page.goto(BASE+'/fa/prop/dashboard');
  await page.getByLabel('محصول',{exact:true}).selectOption('perpetual');
  await page.waitForURL(/perpetual\/dashboard/);
  await page.evaluate(()=>window.completionWallet.rejectSign());
  await (await walletButton(page, 'Sign in')).click();
  await page.locator('[data-wallet-notice="rejected"]').first().waitFor();
  check('Rejected SIWE signature remains unauthenticated',(await call(page,'/auth/me')).status===401);
  await signIn(page);
  check('Router-driven product switch signs on Arbitrum rather than stale Sepolia',await page.evaluate(()=>window.completionWallet.network()==='0xa4b1'));
  await page.getByTitle('کیف پول و شبکه',{exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:/Disconnect|قطع اتصال/}).waitFor();
  check('Detected wallet account modal opens without provider errors',true);
  await page.screenshot({path:path.join(OUT,'wallet-connection.png'),fullPage:true});
  await page.keyboard.press('Escape');
  await page.goto(BASE+'/fa/perpetual/trade');
  const frame=page.frameLocator('iframe');
  await frame.locator('[data-close="controlled-gains-read"]').waitFor();
  check('Perpetual adopts its signed-in adapter and displays native collateral',(await frame.locator('body').innerText()).includes('100.00 USDC'));
  check('Perpetual execution and position mutations remain disabled',await frame.locator('#submit-order').isDisabled() && await frame.locator('[data-close="controlled-gains-read"]').isDisabled());
  check('Read-only execution limitation is visible',(await frame.locator('#account-feed-state').innerText()).match(/execution is not enabled|فعال نیست/));
  await page.reload();await (await walletButton(page, 'Account')).waitFor();
  check('EIP-6963 connection and SIWE session reconnect after reload',true);
  await page.getByLabel('محصول',{exact:true}).selectOption('prop');
  await page.waitForURL(/prop\/trade/);
  await switchToTarget(page);
  await page.waitForFunction(()=>window.completionWallet.network()==='0xaa36a7');
  const accounts=(await call(page,'/accounts')).data.accounts,trial=accounts.find(a=>a.type==='free_trial');
  await call(page,'/internal/inject-price',{symbol:'BTC/USD',price:'50000',metadata:{base:'BTC',group:'crypto',maxLeverage:100}});
  await page.goto(BASE+'/en/prop/trade?account='+trial.id);
  await page.waitForFunction(()=>window.__ofServerTP?.canTrade);
  const f=page.frameLocator('iframe');await f.locator('#submit-order').waitFor();
  await f.locator('#of-sl').fill('bad-number');await f.locator('#submit-order').click();
  check('Invalid protection input is not silently discarded',(await f.locator('#of-err').innerText()).includes('valid number'));
  await f.locator('#of-sl').fill('');
  await f.locator('[data-pct="100"]').click();await f.locator('#submit-order').click();
  await f.locator('#review-dialog[open]').waitFor();
  check('MAX sizing reserves opening fees and reaches a valid review',true);await f.locator('#review-cancel').click();
  await f.locator('#of-collateral').fill('۱۰۰۰');await f.locator('#submit-order').click();
  await f.locator('#review-dialog[open]').waitFor();
  check('Persian numeric input produces a server-authoritative review',(await f.locator('#review-body').innerText()).includes('1,000.00'));
  check('Review does not execute before confirmation',(await call(page,'/trading/state?account='+trial.id)).data.positions.length===0);
  const identities=[];let lose=true;
  await page.route('**/trading/order?account=*',async route=>{
    identities.push(route.request().headers()['idempotency-key']);
    if(lose){lose=false;await route.fetch();await route.abort('failed')}else await route.continue();
  });
  await f.locator('#review-confirm').click();await f.locator('#review-confirm').waitFor({state:'visible'});
  await page.waitForFunction(()=>window.__ofServerTP?.state.positions.length===1);
  check('Lost order response retains the review for explicit retry',await f.locator('#review-dialog').evaluate(el=>el.open));
  await f.locator('#review-confirm').click();await f.locator('#review-dialog').waitFor({state:'hidden'});
  const opened=(await call(page,'/trading/state?account='+trial.id)).data;
  check('Explicit retry reuses the same key and opens only one position',identities.length===2&&identities[0]===identities[1]&&opened.positions.length===1);
  const position=opened.positions[0];
  await page.waitForTimeout(700);check('Unprotected positions do not invent chart protection or send risk mutations',protectionWrites.length===0);
  await f.locator(`[data-sltp="${position.id}"]`).click();
  await f.locator('#sltp-sl').fill('49000');await f.locator('#sltp-tp').fill('52000');await f.locator('#sltp-save').click();
  await page.waitForFunction(()=>window.__ofServerTP?.state.positions[0]?.sl===49000);
  await page.waitForTimeout(800);
  check('SL/TP editor updates actual server protection without renderer feedback writes',protectionWrites.length===1);
  await f.locator('body').evaluate(()=>{
    const drawings=window.__openfundChart.chart.drawings;
    const drawing=drawings.all().find(item=>item.anchors?.length===3);
    if(!drawing)throw new Error('Managed protected-position drawing missing');
    const anchors=drawing.anchors.map(anchor=>({...anchor}));anchors[1].price=48500;
    drawings.update(drawing.id,{anchors});
    // Reproduce an authoritative SSE redraw arriving during the drag debounce.
    window.dispatchEvent(new Event('of-trading-update'));
  });
  await page.waitForFunction(()=>window.__ofServerTP?.state.positions[0]?.sl===48500);
  await page.waitForTimeout(750);
  check('Chart protection edit survives an immediate SSE redraw and uses the scoped adapter once',protectionWrites.length===2&&protectionWrites.every(url=>url.includes('account='+trial.id)));

  await f.locator(`[data-close="${position.id}"]`).click();await f.locator('#close-fraction').selectOption('0.5');await f.locator('#confirm-ok').click();
  await page.waitForFunction(original=>window.__ofServerTP?.state.positions.some(p=>p.id===original.id&&p.margin>0&&p.margin<Number(original.margin)),position);
  const partial=(await call(page,'/trading/state?account='+trial.id)).data;
  check('Partial close respects quantity precision and conserves margin',partial.history.length===1&&Math.abs(Number(partial.positions[0].margin)+Number(partial.history[0].margin)-Number(position.margin))<.000001);
  await f.locator('[data-otype="limit"]').click();await f.locator('#of-price').fill('49000');await f.locator('#of-collateral').fill('100');await f.locator('#submit-order').click();await f.locator('#review-confirm').click();
  await page.waitForFunction(()=>window.__ofServerTP?.state.orders.length===1);
  const order=(await call(page,'/trading/state?account='+trial.id)).data.orders[0];
  await f.locator('[data-bt="orders"]').click();await f.locator(`[data-cancel="${order.id}"]`).click();await f.locator('#confirm-ok').click();
  await page.waitForFunction(()=>window.__ofServerTP?.state.orders.length===0);check('Pending limit order cancellation persists',true);
  await f.locator('[data-otype="stop"]').click();await f.locator('#of-price').fill('51000');await f.locator('#submit-order').click();await f.locator('#review-confirm').click();
  await page.waitForFunction(()=>window.__ofServerTP?.state.orders.length===1);
  await call(page,'/internal/inject-price',{symbol:'BTC/USD',price:'51100'});
  await page.waitForFunction(()=>window.__ofServerTP?.state.positions.length===2 && window.__ofServerTP.state.orders.length===0);
  check('Stop order becomes an authoritative position after server trigger',true);
  await call(page,'/internal/inject-price',{symbol:'BTC/USD',price:'53000'});
  await page.waitForFunction(id=>!window.__ofServerTP?.state.positions.some(p=>p.id===id),position.id);
  check('Server TP closes the protected remaining position',true);
  const user=(await call(page,'/auth/me')).data.user;
  const pool=new Pool({connectionString:process.env.DATABASE_URL});let challenge;
  try{challenge=(await pool.query("INSERT INTO openfund_challenges(user_id,challenge_plan_id) SELECT $1,id FROM challenge_plans WHERE slug='standard' RETURNING id",[user.id])).rows[0]}finally{await pool.end()}
  await page.reload();await page.getByLabel('Active account',{exact:true}).selectOption(challenge.id);
  await page.waitForFunction(()=>!window.__ofServerTP);
  await page.frameLocator('iframe').locator('#account-feed-state').filter({hasText:'Challenge execution is not activated'}).waitFor();
  check('Unactivated Challenge cannot borrow the Free Trial execution adapter',await page.frameLocator('iframe').locator('#submit-order').isDisabled());
  await page.getByLabel('Active account',{exact:true}).selectOption(trial.id);await page.waitForFunction(()=>window.__ofServerTP?.canTrade);
  check('Returning to the owned Free Trial restores execution without resetting history',(await call(page,'/trading/state?account='+trial.id)).data.history.length>=2);
  await page.goto(BASE+'/en/prop/journal?account='+trial.id);
  await page.getByRole('combobox',{name:'Journal layout'}).selectOption('compact');
  await page.getByText('Preferences saved.',{exact:true}).waitFor();
  await page.reload();await page.waitForFunction(()=>document.querySelector('[aria-label="Journal layout"]')?.value==='compact');
  check('Journal layout preference survives reload in the selected account',true);
  await page.getByRole('navigation',{name:'Journal sections'}).getByRole('button',{name:'Playbooks',exact:true}).click();
  await page.getByRole('button',{name:'New entry',exact:true}).click();
  await page.getByLabel('Title',{exact:true}).fill('Integration recovery playbook');
  await page.getByLabel('Private notes',{exact:true}).fill('Disposable test note; no financial records imported.');
  await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByText('Entry saved.',{exact:true}).waitFor();
  await page.reload();await page.getByRole('heading',{name:'Integration recovery playbook',exact:true}).waitFor();
  check('Journal playbook writes persist in PostgreSQL across reload',true);
  await page.getByLabel('Active account',{exact:true}).selectOption(challenge.id);
  await page.getByRole('button',{name:'Playbooks',exact:true}).click();
  check('Challenge journal does not show the trial private note',await page.getByRole('heading',{name:'Integration recovery playbook',exact:true}).count()===0);
  await page.goto(BASE+'/en/prop/trade?account='+trial.id);await page.waitForFunction(()=>window.__ofServerTP?.canTrade);
  await page.evaluate(()=>window.completionWallet.changeAccount(1));
  await (await walletButton(page, 'Sign in')).waitFor();
  check('Wallet change clears the previous execution adapter',await page.evaluate(()=>!window.__ofServerTP));await signIn(page);
  await page.waitForFunction(()=>window.__ofServerTP?.canTrade);
  check('Second wallet has an independent account and empty positions',(await call(page,'/trading/state')).data.positions.length===0);
  await page.evaluate(()=>window.completionWallet.changeChain('0x1'));
  await page.locator('[data-switch-network]').first().waitFor({state:'attached'});
  check('Unsupported chain change preserves wallet identity and exposes a network correction',await page.locator('.rk-chip-addr').count()===1);
  await switchToTarget(page);
  await page.waitForFunction(()=>window.completionWallet.network()==='0xaa36a7');
  if(!await page.locator('.rk-account-menu').evaluate(el=>el.open))await page.locator('.rk-account-menu > summary').click();
  await page.getByTitle('Wallet & network',{exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/Disconnect|قطع اتصال/}).click();
  await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().waitFor();
  await page.waitForFunction(async api=>(await fetch(api+'/auth/me',{credentials:'include'})).status===401,API);
  check('Wallet-modal disconnect revokes SIWE and clears private state',await page.evaluate(()=>!window.__ofServerTP));
  // Exercise the unavailable-catalog branch explicitly even when the
  // candidate gate has a healthy Directus instance for other routes.
  await context.route('**/items/challenge_plans**',route=>route.abort('failed'));
  await page.goto(BASE+'/en/challenges');
  await page.locator('#challenge-order').getByText('The challenge catalog is unavailable. Please try again later.',{exact:true}).waitFor();
  check('Unavailable CMS catalog shows an accurate state and disables challenge activation',await page.locator('#detail-review').isDisabled());
  await page.locator('.nav-cta').click();await page.waitForURL(/prop\/trade$/);await page.waitForTimeout(700);
  check('Challenges-to-terminal navigation does not dispatch into removed legacy content',await page.locator('.of-terminal-compact').count()===1);
  check('Functional scenarios never request a blockchain transaction',await page.evaluate(()=>window.completionWallet.transactions===0));
  check('Functional scenarios have no uncaught JavaScript errors',errors.length===0);
 }catch(error){fs.writeFileSync(path.join(OUT,'functional-errors.json'),JSON.stringify(errors,null,2));console.error('Collected browser errors',errors);console.log('Diagnostic alerts',await page.getByRole('alert').allTextContents());await page.screenshot({path:path.join(OUT,'functional-failure.png'),fullPage:true});throw error;}finally{await context.close()}
}
async function layout(browser){
 const {context,page}=await walletContext(browser),errors=[],assetErrors=[],requests=[];page.on('pageerror',e=>{errors.push(e.stack||e.message);console.error('BROWSER ERROR',e.stack||e.message)});
 page.on('request',r=>{if(r.url().startsWith(API+'/products/'))requests.push(new URL(r.url()).pathname)});
 page.on('response',r=>{if(r.url().startsWith(BASE)&&r.status()>=400&&['script','stylesheet','image','font'].includes(r.request().resourceType()))assetErrors.push(r.url())});
 try{
  await page.goto(BASE+'/en/prop/dashboard');await connect(page);await signIn(page);
  // Layout snapshots deliberately start dark. A fresh CI browser may now
  // default to light, so make the test's preference explicit before toggling.
  if(await page.locator('html').getAttribute('data-theme')==='light'){
    await page.getByRole('button',{name:'Toggle theme',exact:true}).click();
    await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  }
  const tabs={prop:['dashboard','trade','portfolio','journal','journal?section=accounts','leaderboard','withdrawals','certificates'],perpetual:['dashboard','trade','portfolio','journal','journal?section=accounts','leaderboard','rewards']};
  for(const product of ['prop','perpetual'])for(const locale of (product==='perpetual'?['fa']:['en','fa']))for(const [width,height]of [[1920,1080],[1440,900],[1366,768],[1280,720]])for(const tab of tabs[product]){
    await page.setViewportSize({width,height});await page.goto(`${BASE}/${locale}/${product}/${tab}`);
    await page.locator('.of-terminal-compact').waitFor();await page.waitForTimeout(tab==='trade'?1400:250);
    const record=await page.evaluate(()=>{
      const header=document.querySelector('.of-terminal-header').getBoundingClientRect();
      const controls=document.querySelector('.of-terminal-top').getBoundingClientRect();
      const warning=document.querySelector('.of-release-mismatch')?.getBoundingClientRect();
      const main=document.querySelector('#terminal-main').getBoundingClientRect();
      return {header:header.height,controls:controls.height,warningFits:!warning||(warning.top>=controls.bottom-1&&warning.bottom<=header.bottom+1&&warning.left>=-1&&warning.right<=innerWidth+1),mainFollowsHeader:main.top>=header.bottom-1,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,headerOverflow:document.querySelector('.of-terminal-top').scrollWidth>innerWidth+1,active:[...document.querySelectorAll('#terminal-navigation>a[aria-current="page"]')].map(a=>a.textContent)};
    });
    check(`${product}/${locale}/${tab} ${width}: shared header and no horizontal overflow ${JSON.stringify(record)}`,record.controls===39&&record.header>=40&&record.warningFits&&record.mainFollowsHeader&&!record.overflow&&!record.headerOverflow);
    if(['dashboard','trade','portfolio','journal','journal?section=accounts'].includes(tab))check(`${product}/${locale}/${tab} ${width}: exact active tab`,record.active.length===1);
    if(tab==='dashboard'){
      const grid=await page.locator('.of-dashboard-workspace').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
      check(`${product}/${locale} ${width}: account/detail dashboard grid`,grid===2);
    }
    const component=tab==='dashboard'?'.of-dashboard-workspace':tab==='trade'?'iframe.of-trading-workspace':tab.startsWith('journal')?'.of-journal-workspace':tab==='portfolio'?'.of-tabs':tab==='withdrawals'?'.of-purchase-page':'.of-empty';
    check(`${product}/${locale}/${tab} ${width}: expected component mounted`,await page.locator(component).count()>0);
    const dataSource=product==='prop'?'PostgreSQL/Engine + owned product API':'Gains native read adapter + owned journal API';
    check(`${product}/${locale}/${tab} ${width}: product context connected`,requests.some(url=>url===`/products/${product}/context`));
    measurements.push({product,locale,tab,viewport:[width,height],component,dataSource,requests:[...new Set(requests)],...record});
    if(width===1440){
      const file=`${product}-${locale}-${tab.replaceAll(/[?=]/g,'-')}.png`;await page.screenshot({path:path.join(OUT,file),fullPage:true});screenshots.push(file);
      const themeButton=page.getByRole('button',{name:locale==='fa'?'تغییر پوسته':'Toggle theme',exact:true});
      await themeButton.click();
      await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
      const palette=await page.locator('.of-terminal').evaluate(el=>({bg:getComputedStyle(el).backgroundColor,text:getComputedStyle(el).color}));
      check(`${product}/${locale}/${tab}: authenticated light surface and text`,palette.bg==='rgb(255, 255, 255)'&&palette.text==='rgb(22, 40, 30)');
      check(`${product}/${locale}/${tab}: authenticated light panels`,await page.locator('.of-panel,.of-metric').evaluateAll(els=>els.every(el=>getComputedStyle(el).backgroundColor==='rgb(255, 255, 255)')));
      if(tab==='trade'){
        const child=page.frames().find(f=>f.parentFrame());
        await child.waitForFunction(()=>window.__openfundChart?.chart?.renderer.getConfig().layout.background.toLowerCase()==='#ffffff');
        check(`${product}/${locale}: authenticated light Vela plot`,true);
      }
      const lightFile=file.replace('.png','-light.png');await page.screenshot({animations:'disabled',path:path.join(OUT,lightFile),fullPage:true});screenshots.push(lightFile);
      await themeButton.click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
    }
  }
  for(const product of ['prop','perpetual'])for(const locale of (product==='perpetual'?['fa']:['en','fa']))for(const section of ['dashboard','calendar','daily','trades','reports','firms','notebook','playbooks','progress','missed','import','accounts','settings']){
    await page.setViewportSize({width:1440,height:900});await page.goto(`${BASE}/${locale}/${product}/journal?section=${section}`);await page.waitForTimeout(200);
    check(`${product}/${locale}/Journal ${section}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(await page.locator('html').getAttribute('data-theme')!=='light')await page.getByRole('button',{name:locale==='fa'?'تغییر پوسته':'Toggle theme',exact:true}).click();
    check(`${product}/${locale}/Journal ${section}: authenticated light theme`,await page.locator('.of-terminal').evaluate(el=>getComputedStyle(el).backgroundColor==='rgb(255, 255, 255)'));
    const file=`${product}-${locale}-journal-${section}-light.png`;await page.screenshot({path:path.join(OUT,file),fullPage:true});screenshots.push(file);
  }
  const owned=(await call(page,'/accounts')).data.accounts.find(account=>account.type==='free_trial');
  await page.goto(BASE+'/en/prop/journal?section=playbooks&account='+owned.id);
  await page.locator('.of-language-select select').first().selectOption('fa');
  await page.waitForURL(BASE+'/fa/prop/journal?section=playbooks&account='+owned.id);
  check('Terminal language switching preserves the selected account and journal section',true);
  await page.locator('.rk-chip-addr').first().waitFor();
  const walletLabels=await page.locator('.rk-chip-addr').allTextContents();
  check('All terminal tabs share one connected wallet state',walletLabels.length>0&&new Set(walletLabels).size===1);
  check('Layout verification never requests a blockchain transaction',await page.evaluate(()=>window.completionWallet.transactions===0));
  check('All terminal tabs have no uncaught JavaScript errors',errors.length===0);
  check('All terminal tabs load their scripts styles images and fonts',assetErrors.length===0);
 }finally{await context.close()}
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  if(process.env.COMPLETION_PHASE!=='layout')await functional(browser);
  if(process.env.COMPLETION_PHASE!=='functional')await layout(browser);
  fs.writeFileSync(path.join(OUT,'results-'+(process.env.COMPLETION_PHASE||'all')+'.json'),JSON.stringify({fixture:'Disposable EIP-6963 signers; actual local SIWE/PostgreSQL/simulation; functional market/Gains fixtures; layout public data live; no blockchain writes',results,measurements,screenshots},null,2));
  console.log(`${results.length} terminal completion checks passed`);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
