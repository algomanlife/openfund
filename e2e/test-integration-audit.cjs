
async function walletButton(page, name) {
  const fa=await page.locator('html').getAttribute('lang')==='fa';
  if(fa) name=({'Sign in':'ورود به اوپن‌فاند','Account':'حساب من','Network: Arbitrum One':'شبکه: Arbitrum One','Network: Sepolia':'شبکه: Sepolia'})[name] || name;
  const button=page.getByRole('button',{name,exact:true,includeHidden:true}).first();
  await button.waitFor({state:'attached'});
  const menu=button.locator('xpath=ancestor::details[contains(@class,"rk-account-menu")]');
  if(await menu.count() && !await menu.evaluate(el=>el.open)) await menu.locator('summary').click();
  return button;
}
/* Production bundle in Chromium. Generated EIP-1193 test wallets sign real
 * SIWE messages; CMS and Gains read failures are controlled fixtures. This
 * is not a hardware/extension WalletConnect or on-chain execution test. */
const {chromium} = require('playwright')
const {createRequire} = require('node:module')
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict')
const req = createRequire(path.resolve(__dirname,'../apps/backend/package.json'))
const {generatePrivateKey,privateKeyToAccount} = req('viem/accounts')
const BASE = process.env.TEST_FRONTEND_URL || 'http://localhost:8080'
const API = process.env.TEST_BACKEND_URL || 'http://localhost:8080'
const OUT = path.resolve(__dirname,'../output/playwright/audit')
fs.mkdirSync(OUT,{recursive:true})
const results=[]
function check(name,value) { assert.ok(value,name); results.push(name); console.log('PASS - '+name) }

;(async()=>{
  const browser=await chromium.launch({headless:true})
  try {
    const context=await browser.newContext({viewport:{width:1440,height:1000}})
    // Deterministic market protocol fixtures keep this CI smoke test independent
    // of quote-server availability. Live chart coverage is test-dual-terminals.js.
    await context.route('https://api.gains.trade/v1/arbitrum/**', async route => {
      const url=route.request().url()
      const data=url.includes('/candles') ? [] : url.endsWith('/markets') ? [{symbol:'BTC/USD',base:'BTC',quote:'USD',group:'crypto',pairIndex:0,isOpen:true,minLeverage:'1',maxLeverage:'100',pricePrecision:1,sizePrecision:5}] : [{market:'BTC/USD',mark:'50000',index:'50000',updatedAt:Date.now()}]
      await route.fulfill({json:{data}})
    })
    await context.routeWebSocket('wss://api.gains.trade/**', socket=>socket.close())
    await context.route('**/products/perpetual/gains**',route=>route.fulfill({json:{positions:[],orders:[],history:[],stats:{totalTrades:0,winRate:null}}}))
    // Content is a CMS protocol fixture, not a production seed or financial data.
    await context.route('**/items/**',async route=>{
      const data=route.request().url().includes('/home_content') ? {
        prop_cta_destination:'challenges',perpetual_cta_destination:'terminal',translations:['fa','en'].map(language_code=>({
          language_code,headline:language_code==='fa'?'همه بازارها در یک پلتفرم معاملاتی':'All Markets One Trading Platform',
          prop_title:'Prop',prop_cta:'Prop',perpetual_title:'Perpetual',perpetual_cta:'Perpetual',
        }))
      } : []
      await route.fulfill({json:{data}})
    })
    const page=await context.newPage(), errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    const wallets=[privateKeyToAccount(generatePrivateKey()),privateKeyToAccount(generatePrivateKey())]
    await page.exposeFunction('auditSign',({raw,index})=>wallets[index].signMessage({message:{raw}}))
    await page.addInitScript(addresses=>{
      const events={}, w=window
      let index=0, chain='0xaa36a7'
      w.auditWallet={network:()=>chain, changeAccount:i=>{index=i;(events.accountsChanged||[]).forEach(fn=>fn(i<0?[]:[addresses[i]]))}}
      w.ethereum={isMetaMask:true,on:(k,fn)=>(events[k]||=[]).push(fn),removeListener:(k,fn)=>events[k]=(events[k]||[]).filter(x=>x!==fn),
        request:async({method,params})=>{
          if(['eth_accounts','eth_requestAccounts'].includes(method))return index<0?[]:[addresses[index]]
          if(method==='eth_chainId')return chain
          if(method==='net_version')return String(parseInt(chain,16))
          if(method==='wallet_switchEthereumChain'){chain=params[0].chainId;(events.chainChanged||[]).forEach(fn=>fn(chain));return null}
          if(method==='personal_sign')return w.auditSign({raw:params[0],index})
          if(method==='eth_getBalance')return '0x0'
          if(method==='eth_blockNumber')return '0x1'
          if(method==='wallet_requestPermissions')return [{parentCapability:'eth_accounts'}]
          return null
        }}
    },wallets.map(w=>w.address))
    for (const locale of ['fa']) for (const width of [390,1440]) {
      await page.setViewportSize({width,height:1000})
      await page.goto(`${BASE}/${locale}/home`)
      await page.locator('.home-products').waitFor()
      check(`Home ${locale} ${width}: gateway navigation omitted with terminal access retained`,await page.locator('header #navigation,header .menu').count()===0 && await page.locator('header .nav-cta').count()===1)
      const navLinks=await page.locator('header #navigation a').evaluateAll(links=>links.map(a=>a.getAttribute('href')))
      check(`Home ${locale} ${width}: navigation stays localized`,navLinks.length===0)
      check(`Home ${locale} ${width}: product links scoped`,await page.locator('.home-panel').last().locator('a').getAttribute('href')===`/${locale}/perpetual/trade`)
      check(`Home ${locale} ${width}: no overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
      check(`Home ${locale} ${width}: ambient behind content`,await page.locator('.landing-motion .landing-network').count()===2 && await page.locator('.landing-motion').evaluate(el=>getComputedStyle(el).zIndex==='-1'&&getComputedStyle(el).pointerEvents==='none'))
      await page.screenshot({path:path.join(OUT,`home-${locale}-${width}.png`),fullPage:true})
    }
    await page.emulateMedia({reducedMotion:'reduce'})
    check('Reduced motion stops ambient animation',await page.locator('.landing-network circle').first().evaluate(el=>getComputedStyle(el).animationName)==='none')
    await page.emulateMedia({reducedMotion:'no-preference'})
    await page.route('**/release-manifest.json',route=>route.fulfill({status:404,json:{error:'not_found'}}))
    await page.goto(`${BASE}/en/prop/dashboard`)
    await page.locator('[data-release-diagnostic="missing"]').waitFor()
    check('Unversioned build warning remains below wallet controls',await page.locator('.of-release-mismatch').evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('.of-terminal-top').getBoundingClientRect().bottom-1))
    await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().click()
    await page.locator('[data-wallet-picker] [data-wallet-id="injected"]').click()
    await page.unroute('**/release-manifest.json')
    await (await walletButton(page, 'Sign in')).waitFor()
    await (await walletButton(page, 'Sign in')).click()
    await (await walletButton(page, 'Account')).waitFor()
    await (await walletButton(page, 'Account')).click()
    const dialog=page.getByRole('dialog')
    await dialog.getByRole('heading',{name:'Openfund Account',exact:true}).waitFor()
    check('English profile exposes Prop only',await dialog.locator('a[href*="/en/perpetual/"]').count()===0)
    check('Account button opens Openfund profile',await dialog.getByText(wallets[0].address.slice(0,8),{exact:false}).count()>0)
    await dialog.getByRole('link',{name:/Openfund Prop/}).click()
    await page.waitForURL(/prop\/dashboard$/)
    await page.locator('.of-account-card.selected').waitFor()
    const directory=await page.evaluate(async API=>fetch(API+'/accounts',{credentials:'include'}).then(r=>r.json()),API)
    check('Profile opens the owned Prop account',await page.locator('.of-account-card.selected').getAttribute('data-account-id')===directory.accounts.find(account=>account.type==='free_trial').id)
    // Confirm the same named action also works in Persian.
    await page.goto(`${BASE}/fa/prop/dashboard`)
    await (await walletButton(page, 'حساب من')).click()
    await page.getByRole('dialog').getByRole('heading',{name:'حساب اوپن‌فاند',exact:true}).waitFor()
    await page.keyboard.press('Escape')
    check('Persian account button and Escape work',await page.getByRole('dialog').count()===0)
    await page.goto(`${BASE}/en/prop/trade`)
    const frame=page.frameLocator('iframe')
    await frame.locator('#ac-equity').waitFor()
    const state=await page.evaluate(async API=>{
      const post=async(p,b)=>{const r=await fetch(API+p,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(b)});if(!r.ok)throw Error(await r.text());return r.json()}
      await post('/internal/inject-price',{symbol:'BTC/USD',price:'50000',metadata:{base:'BTC',group:'crypto',maxLeverage:100}})
      const o=await post('/trading/order',{market:'BTC/USD',side:'long',order_type:'market',margin:1000,leverage:10})
      await post('/internal/inject-price',{symbol:'BTC/USD',price:'51000'})
      return {position:o.position, state:await fetch(API+'/trading/state',{credentials:'include'}).then(r=>r.json())}
    },API)
    await page.waitForFunction(expected=>Math.abs(window.__ofServerTP?.state.positions[0]?.srvPnl-Number(expected))<.001,state.state.positions[0].unrealized_pnl)
    check('Terminal PnL comes from server snapshot',await page.evaluate(expected=>Math.abs(window.__ofServerTP.state.positions[0].srvPnl-Number(expected))<.001,state.state.positions[0].unrealized_pnl))
    await page.reload()
    await page.waitForFunction(()=>window.__ofServerTP?.state.positions.length===1)
    check('Reload restores wallet session and persisted position',true)
    // Partial-close through the shared terminal's actual controls.
    await frame.locator(`[data-close="${state.position.id}"]`).click()
    await frame.locator('#close-fraction').selectOption('0.5')
    await frame.locator('#confirm-ok').click()
    await page.waitForFunction(()=>Math.abs(Number(window.__ofServerTP?.state.positions[0]?.margin)-500)<.001)
    check('Terminal partial close updates authoritative remaining margin',true)
    await page.evaluate(()=>window.auditWallet.changeAccount(1))
    await (await walletButton(page, 'Sign in')).waitFor()
    check('Account change clears private trading state',await page.evaluate(()=>!window.__ofServerTP))
    await (await walletButton(page, 'Sign in')).click()
    await (await walletButton(page, 'Account')).waitFor()
    await page.waitForFunction(()=>window.__ofServerTP?.state.positions.length===0)
    check('Second wallet sees its own empty account',true)
    await page.goto(`${BASE}/fa/perpetual/dashboard`)
    await (await walletButton(page, 'تغییر شبکه به Arbitrum One')).click()
    await page.waitForFunction(()=>window.auditWallet.network()==='0xa4b1')
    check('Perpetual requests Arbitrum One through wallet network switch',true)
    await page.route('**/products/perpetual/gains**',route=>route.fulfill({status:502,json:{error:'gains_read_failed'}}))
    const gainsFailed=page.waitForResponse(response=>response.url().includes('/products/perpetual/gains') && response.status()===502)
    await page.goto(`${BASE}/fa/perpetual/portfolio`)
    // A full navigation can reconnect the injected wallet after the page has
    // loaded. Re-establish SIWE before checking the authenticated error view.
    if (await page.evaluate(async API=>fetch(API+'/auth/me',{credentials:'include'}).then(r=>r.status),API)!==200) {
      await (await walletButton(page, 'Sign in')).click()
      await (await walletButton(page, 'Account')).waitFor()
    }
    await gainsFailed
    await page.getByRole('alert').filter({hasText:'دریافت اطلاعات ناموفق بود.'}).waitFor()
    check('Gains failure is explicit; Prop balance never leaks',!(await page.locator('body').innerText()).includes('100,000.00'))
    await page.unroute('**/products/perpetual/gains**')
    await page.evaluate(()=>window.auditWallet.changeAccount(-1))
    await page.getByRole('button',{name:'اتصال کیف پول',exact:true}).first().waitFor()
    await page.waitForFunction(async API=>(await fetch(API+'/auth/me',{credentials:'include'})).status===401,API)
    const auth=await page.evaluate(async API=>(await fetch(API+'/auth/me',{credentials:'include'})).status,API)
    check('Disconnect revokes backend session',auth===401)
    const anonymous=await browser.newContext()
    const anon=await anonymous.newPage()
    await anon.route('**/items/**',route=>route.fulfill({json:{data:[]}}))
    await anon.goto(`${BASE}/fa/home`)
    await anon.getByRole('button',{name:'اتصال کیف پول',exact:true}).click()
    await anon.locator('[data-wallet-picker]').getByText('انتخاب کیف پول',{exact:true}).waitFor()
    await anon.locator('[data-wallet-empty]').waitFor()
    check('Wallet picker opens and translates to Persian without an injected wallet',true)
    await anon.keyboard.press('Escape')
    check('Wallet modal closes on Escape',await anon.getByRole('dialog').count()===0)
    await anonymous.close()
    check('No uncaught JavaScript errors',errors.length===0)
    fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({fixture:'CMS/Gains protocol fixtures + EIP-1193 test wallets; PostgreSQL/API real; no chain transactions',results,errors},null,2))
    console.log(`${results.length} audit browser checks passed`)
  } finally { await browser.close() }
})().catch(e=>{console.error(e);process.exitCode=1})
