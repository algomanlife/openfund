/* Genuine account captures using a disposable in-memory signer and the real
 * local API/database. No CMS, market, portfolio or financial response fixtures.
 * Never point this utility at a public/production account service. */
const {chromium}=require('playwright')
const {createRequire}=require('node:module')
const fs=require('node:fs'), path=require('node:path')
const req=createRequire(path.resolve('apps/backend/package.json'))
const {generatePrivateKey,privateKeyToAccount}=req('viem/accounts')
const {createPublicClient,http}=req('viem')
const {sepolia,arbitrum}=req('viem/chains')
const BASE=process.env.DOCS_CAPTURE_URL||'http://localhost:8186'
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))throw Error('Local capture host required')
;(async()=>{
 const wallet=privateKeyToAccount(generatePrivateKey())
 const browser=await chromium.launch({headless:true})
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}})
  await page.emulateMedia({reducedMotion:'reduce'})
  const clients={['0xaa36a7']:createPublicClient({chain:sepolia,transport:http()}),['0xa4b1']:createPublicClient({chain:arbitrum,transport:http()})}
  await page.exposeFunction('docsSign',raw=>wallet.signMessage({message:{raw}}))
  await page.exposeFunction('docsRpc',({chain,method,params})=>clients[chain].request({method,params}))
  await page.addInitScript(address=>{
   const events={};let chain='0xaa36a7'
   window.ethereum={isMetaMask:true,on:(k,fn)=>(events[k]||=[]).push(fn),removeListener:(k,fn)=>events[k]=(events[k]||[]).filter(x=>x!==fn),request:async({method,params})=>{
    if(['eth_accounts','eth_requestAccounts'].includes(method))return[address]
    if(method==='eth_chainId')return chain
    if(method==='net_version')return String(parseInt(chain,16))
    if(method==='wallet_switchEthereumChain'){chain=params[0].chainId;(events.chainChanged||[]).forEach(fn=>fn(chain));return null}
    if(method==='personal_sign')return window.docsSign(params[0])
    if(method==='wallet_requestPermissions')return[{parentCapability:'eth_accounts'}]
    if(method.startsWith('eth_'))return window.docsRpc({chain,method,params})
    throw Error('Unsupported documentation wallet method')
   }}
  },wallet.address)
  await page.goto(BASE+'/en/home')
  await page.getByRole('button',{name:'Connect Wallet',exact:true}).click()
  const walletAction = async name => {
   const button = page.getByRole('button',{name,exact:true,includeHidden:true}).first()
   await button.waitFor({state:'attached'})
   const menu = button.locator('xpath=ancestor::details[contains(@class,"rk-account-menu")]')
   if(await menu.count() && !await menu.evaluate(el=>el.open)) await menu.locator('summary').click()
   return button
  }
  await (await walletAction('Sign in')).click()
  await page.getByRole('button',{name:'Account',exact:true,includeHidden:true}).waitFor({state:'attached'})
  const entries=[]
  const capture=async(name,route,state)=>{
   await page.screenshot({path:`docs/assets/screenshots/${name}.jpg`,type:'jpeg',quality:84,animations:'disabled'})
   entries.push({file:`${name}.jpg`,route,viewport:{width:1440,height:1000},session:'Disposable generated documentation wallet; real local SIWE session',state,capturedAt:new Date().toISOString()})
  }
  await (await walletAction('Account')).click()
  await page.getByRole('heading',{name:'Openfund Account',exact:true}).waitFor()
  await capture('account-profile','/en/home','Actual profile dialog; generated address is not a personal wallet')
  await page.keyboard.press('Escape')
  for(const[name,route,state]of[
   ['prop-portfolio','prop/portfolio','New virtual-DAI account, no trades; 100000 virtual DAI issued by the real backend'],
   ['journal','prop/journal','Empty real private notebook; no seeded notes'],
   ['analytics','prop/dashboard','Actual new-account analytics; no generated performance history'],
   ['perpetual-portfolio','perpetual/portfolio','Official Gains reads for newly generated wallet; no positions created'],
  ]) {
   const targetLocale=route.startsWith('perpetual/')?'fa':'en'
   await page.goto(BASE+'/'+targetLocale+'/'+route)
   await page.locator('.of-terminal-top').waitFor()
   await page.waitForTimeout(7000)
   if(await page.locator('.of-terminal-top').count()!==1)throw Error('Capture requires the actual terminal workspace')
   await capture(name,'/'+targetLocale+'/'+route,state)
  }
  const filename='docs/assets/screenshots/manifest.json'
  const manifest=JSON.parse(fs.readFileSync(filename,'utf8'))
  manifest.wallet='Public pages anonymous; account captures use a disposable generated signer, real local SIWE/API and no fabricated market or financial responses. No personal wallet, approvals or chain transactions.'
  manifest.screenshots=manifest.screenshots.filter(x=>!entries.some(e=>e.file===x.file)).concat(entries)
  fs.writeFileSync(filename,JSON.stringify(manifest,null,2)+'\n')
  await page.evaluate(async()=>{await fetch('/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})})
  console.log(`${entries.length} genuine account captures; session revoked; private key discarded`)
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1})
