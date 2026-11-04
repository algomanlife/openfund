const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const BASE=process.env.TEST_FRONTEND_URL || 'http://localhost:8288/react';
const API=process.env.TEST_BACKEND_URL || 'http://localhost:8288';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const backend=await fetch(API+'/version').then(r=>r.json());const frontend=await fetch(BASE+'/release-manifest.json').then(r=>r.json());
 assert.equal(backend.status,'matched');assert.equal(frontend.commit,backend.commit);assert.equal(frontend.frontend.id,backend.frontend.id);
 const response=await fetch(BASE+'/index.html');assert.match(response.headers.get('cache-control'),/no-cache/);
 await page.goto(BASE+'/#/en/prop/dashboard');await page.locator('.of-release-version').waitFor();assert.equal(await page.locator('.of-release-version').innerText(),'v'+frontend.version);
 await page.route('**/version',async route=>{await route.fulfill({status:503,json:{...backend,status:'mismatch',commit:'0'.repeat(40)}})});
 await page.reload();await page.getByRole('alert').filter({hasText:'Application and server versions differ'}).waitFor();
 await page.unroute('**/version');
 await page.route('**/release-manifest.json',route=>route.fulfill({status:404,json:{error:'not_found'}}));
 await page.reload();await page.getByRole('alert').filter({hasText:'Application and server versions differ'}).waitFor();
 await page.unroute('**/release-manifest.json');
 await page.route('**/version',route=>route.abort('connectionrefused'));
 await page.reload();await page.getByRole('alert').filter({hasText:'Application and server versions differ'}).waitFor();
 assert.equal(errors.length,0);
 fs.mkdirSync('output/playwright/release',{recursive:true});fs.writeFileSync('output/playwright/release/results.json',JSON.stringify({checks:9,status:'passed',commit:frontend.commit,tests:['same-origin manifest','backend/frontend identity','build hashes','cache headers','visible release','mismatch warning','missing frontend warning','unavailable backend warning','runtime errors']},null,2));
 console.log('9 release diagnostics checks passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
