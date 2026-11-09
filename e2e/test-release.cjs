const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const BASE=process.env.TEST_FRONTEND_URL || 'http://localhost:8288';
const API=process.env.TEST_BACKEND_URL || 'http://localhost:8288';
(async()=>{
 const browser=await chromium.launch({headless:true});
 let geometryChecks=0;
 async function warningDoesNotOccludeWallet(page) {
   for(const width of [390,1440]) {
     await page.setViewportSize({width,height:1000});
     const warning=page.locator('.of-release-mismatch'), wallet=page.getByRole('button',{name:'Connect Wallet',exact:true}).first();
     const alertRect=await warning.boundingBox(), controls=await page.locator('.of-terminal-top').boundingBox(), main=await page.locator('#terminal-main').boundingBox();
     assert.ok(alertRect && controls && main);
     assert.ok(alertRect.y>=controls.y+controls.height-1,'release warning below controls');
     assert.ok(main.y>=alertRect.y+alertRect.height-1,'main follows release warning');
     assert.ok(alertRect.x>=0 && alertRect.x+alertRect.width<=width+1,'warning fits viewport');
     assert.equal(await warning.evaluate(el=>getComputedStyle(el).position),'static');
     assert.ok(await wallet.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'wallet hit target is unobstructed');
     await wallet.click();
     await page.keyboard.press('Escape');
     await page.getByRole('dialog').waitFor({state:'hidden'});
     geometryChecks+=6;
   }
 }
 try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const backend=await fetch(API+'/version').then(r=>r.json());const frontend=await fetch(BASE+'/release-manifest.json').then(r=>r.json());
 assert.equal(backend.status,'matched');assert.equal(frontend.commit,backend.commit);assert.equal(frontend.frontend.id,backend.frontend.id);
 const response=await fetch(BASE+'/index.html');assert.match(response.headers.get('cache-control'),/no-cache/);
 await page.goto(BASE+'/en/prop/dashboard');await page.locator('.of-release-version').waitFor();assert.equal(await page.locator('.of-release-version').innerText(),'v'+frontend.version+(frontend.official===false?' candidate':''));
 await page.route('**/version',async route=>{await route.fulfill({status:503,json:{...backend,status:'mismatch',commit:'0'.repeat(40)}})});
 await page.reload();await page.getByRole('alert').filter({hasText:'Application and server versions differ'}).waitFor();await warningDoesNotOccludeWallet(page);
 await page.unroute('**/version');
 await page.route('**/release-manifest.json',route=>route.fulfill({status:404,json:{error:'not_found'}}));
 await page.reload();await page.getByRole('alert').filter({hasText:'Release manifest is missing'}).waitFor();await warningDoesNotOccludeWallet(page);
 await page.unroute('**/release-manifest.json');
 await page.route('**/version',route=>route.abort('connectionrefused'));
 await page.reload();await page.getByRole('alert').filter({hasText:'Release verification is unavailable'}).waitFor();
 assert.equal(errors.length,0);
 fs.mkdirSync('output/playwright/release',{recursive:true});fs.writeFileSync('output/playwright/release/results.json',JSON.stringify({checks:9+geometryChecks,status:'passed',commit:frontend.commit,tests:['same-origin manifest','backend/frontend identity','build hashes','cache headers','visible release','mismatch warning','missing frontend warning','unavailable backend warning','runtime errors']},null,2));
 console.log(`${9+geometryChecks} release diagnostics and wallet geometry checks passed`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
