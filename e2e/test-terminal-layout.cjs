/* Real browser layout acceptance. Public market feeds remain live; no financial
 * responses, wallet records, prices or liquidity are invented by this test. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const BASE = process.env.TEST_FRONTEND_URL || 'http://localhost:8080/react';
const AUTH = process.env.TEST_LAYOUT_AUTH === '1';
const OUT = path.resolve(__dirname, '../output/playwright/terminal-layout' + (AUTH ? '-authenticated' : ''));
fs.mkdirSync(OUT, {recursive: true});
const viewports = [[1920,1080],[1440,900],[1366,768],[1280,720]];
const results = [], errors = [], consoleErrors = [], screenshots = [];
function check(name, value) { assert.ok(value, name); results.push(name); }
async function metrics(page) {
  const outer = await page.evaluate(() => ({
    width: innerWidth, height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    headerHeight: document.querySelector('.of-terminal-header').getBoundingClientRect().height,
    headerOverflow: document.querySelector('.of-terminal-top').scrollWidth > innerWidth,
  }));
  const inner = await page.frameLocator('iframe').locator('body').evaluate(body => {
    const rect = e => {const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const panel = body.querySelector('.trade-panel'), bounds=rect(panel);
    const required = ['#acct-strip','.side-group','.otype-group','.lev-box','#of-collateral','#of-size','#of-sl','#of-tp','#of-err','#lev-err','#rk-liq','#rk-margin','#rk-fee','#rk-maxloss','#submit-order'];
    if (!body.querySelector('#of-price').disabled) required.push('#of-price');
    return {
      width: innerWidth, height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      panelHeight: panel.clientHeight, panelScrollHeight: panel.scrollHeight,
      panelScrollWidth: panel.scrollWidth, panelWidth: panel.clientWidth,
      tickerHeight: body.querySelector('.market-bar').getBoundingClientRect().height,
      chart: rect(body.querySelector('.chart-panel')),
      book: rect(body.querySelector('.book-panel')), panel: bounds,
      visibleControls: required.map(selector => {
        const e=body.querySelector(selector), r=rect(e);
        return {selector, visible:!e.hidden && getComputedStyle(e).display!=='none', rect:r,
          contained:r.x>=bounds.x-1 && r.right<=bounds.right+1 && r.y>=bounds.y-1 && r.bottom<=bounds.bottom+1 && r.bottom<=innerHeight};
      }),
      controlOverflow: [...body.querySelectorAll('.field input,.field > span,.lev-presets,.book-controls,.acct-row')].filter(e=>e.getBoundingClientRect().height && e.scrollWidth>e.clientWidth+1).map(e=>e.id||e.className),
      numericDirections: ['#cur-pair','#of-collateral','#of-sl','#rk-margin'].map(selector=>getComputedStyle(body.querySelector(selector)).direction),
    };
  });
  return {outer, inner};
}
(async () => {
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  if (AUTH) {
    const { createRequire } = require('node:module');
    const appRequire = createRequire(path.resolve(__dirname, '../apps/backend/package.json'));
    const { generatePrivateKey, privateKeyToAccount } = appRequire('viem/accounts');
    const wallet = privateKeyToAccount(generatePrivateKey());
    await page.exposeFunction('layoutSign', raw => wallet.signMessage({message:{raw}}));
    await page.addInitScript(address => {
      const events={}; let chain='0xaa36a7';
      window.ethereum={isMetaMask:true,
        on:(name,fn)=>(events[name] ||= []).push(fn),
        removeListener:(name,fn)=>events[name]=(events[name]||[]).filter(x=>x!==fn),
        request:async({method,params})=>{
          if(['eth_accounts','eth_requestAccounts'].includes(method))return [address];
          if(method==='eth_chainId')return chain;
          if(method==='net_version')return String(parseInt(chain,16));
          if(method==='personal_sign')return window.layoutSign(params[0]);
          if(method==='eth_getBalance')return '0x0'; // Test-signer native balance fixture, not a real wallet capture.
          if(method==='eth_blockNumber')return '0x1';
          if(method==='wallet_requestPermissions')return [{parentCapability:'eth_accounts'}];
          if(method==='wallet_switchEthereumChain'){chain=params[0].chainId;(events.chainChanged||[]).forEach(fn=>fn(chain));return null;}
          return null;
        }};
    },wallet.address);
    await page.goto(`${BASE}/#/en/prop/trade`);
    await page.getByRole('button',{name:'Connect Wallet',exact:true}).click();
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('button',{name:'Account',exact:true}).waitFor();
    await page.waitForFunction(()=>!!window.__ofServerTP?.serverMode);

  }
  const captures=[], geometries={};
  try {
    for(const product of ['prop','perpetual']) for(const locale of ['en','fa']) {
      await page.goto(`${BASE}/#/${locale}/${product}/trade`);
      const frame=page.frameLocator('iframe');
      await frame.locator('#submit-order').waitFor();
      await frame.locator('canvas').first().waitFor({timeout:20000});
      await page.waitForTimeout(1200);
      for(const [width,height] of viewports) {
        await page.setViewportSize({width,height});
        for(const type of ['market','limit','stop']) {
          await frame.locator(`[data-otype="${type}"]`).click();
          const state=await metrics(page), label=`${product}/${locale} ${width}x${height} ${type}`;
          check(`${label}: document fits`,state.outer.scrollWidth<=width+1 && state.outer.scrollHeight<=height+1);
          check(`${label}: iframe fits`,state.inner.scrollWidth<=width+1 && state.inner.scrollHeight<=state.inner.height+1);
          check(`${label}: header is 40 + 34px`,state.outer.headerHeight===40 && state.inner.tickerHeight===34 && !state.outer.headerOverflow);
          check(`${label}: order entry has no overflow`,state.inner.panelScrollHeight<=state.inner.panelHeight+1 && state.inner.panelScrollWidth<=state.inner.panelWidth+1);
          check(`${label}: required controls and warnings fit`,state.inner.visibleControls.every(c=>!c.visible||c.contained));
          check(`${label}: input labels fit`,state.inner.controlOverflow.length===0);
          check(`${label}: numbers stay LTR`,state.inner.numericDirections.every(d=>d==='ltr'));
          check(`${label}: chart dominates`,state.inner.chart.width>width*.5 && state.inner.chart.height>300);
          const key=`${product}:${width}:${type}`;
          const geometry=[state.inner.chart,state.inner.book,state.inner.panel].map(r=>[r.x,r.width]);
          if(locale==='en')geometries[key]=geometry;
          else check(`${label}: Persian preserves English columns`,JSON.stringify(geometry)===JSON.stringify(geometries[key]));
          captures.push({product,locale,width,height,type,...state});
        }
        await frame.locator('[data-otype="market"]').click();
        const file=`after-${product}-${locale}-${width}x${height}.png`;
        await page.screenshot({path:path.join(OUT,file)});
        screenshots.push({file,product,locale,width,height,capturedAt:new Date().toISOString()});
      }
      // Disclosures must not move, cover or scroll the essential controls.
      await frame.locator('.order-details summary').click();
      check(`${product}/${locale}: details open with entry/index/impact visible`,await frame.locator('#rk-entry').isVisible() && await frame.locator('#rk-oracle').isVisible());
      const open=await metrics(page);
      check(`${product}/${locale}: disclosure keeps action contained`,open.inner.visibleControls.every(c=>!c.visible||c.contained) && open.inner.scrollWidth<=open.inner.width);
      await frame.locator('.order-details summary').press('Escape');
      check(`${product}/${locale}: Escape closes order details`,!(await frame.locator('.order-details').evaluate(e=>e.open)));
      await frame.locator('.market-details summary').click();
      check(`${product}/${locale}: secondary statistics stay accessible`,await frame.locator('#st-oi').isVisible() && await frame.locator('#st-funding').isVisible());
      await frame.locator('.market-details summary').click();
      await frame.locator('#side-short').click();
      check(`${product}/${locale}: short direction preserved`,await frame.locator('#side-short').getAttribute('aria-pressed')==='true');
      await frame.locator('[data-lev="10"]').click();
      check(`${product}/${locale}: leverage presets preserved`,await frame.locator('#lev-range').inputValue()==='10');
      await frame.locator('#of-collateral').fill('150');
      check(`${product}/${locale}: collateral remains editable`,await frame.locator('#of-collateral').inputValue()==='150');
      for(const tab of ['positions','orders','history','fills','funding']) {
        await frame.locator(`[data-bt="${tab}"]`).click();
        check(`${product}/${locale}: ${tab} tab preserved`,await frame.locator(`[data-bt="${tab}"]`).getAttribute('aria-selected')==='true');
      }
      if (!AUTH || product==='perpetual') check(`${product}/${locale}: unavailable execution stays disabled`,await frame.locator('#submit-order').isDisabled());
      if (!AUTH) check(`${product}/${locale}: signed-out equity stays unknown`,(await frame.locator('#ac-equity').innerText())==='—');
      if (AUTH && product==='prop') {
        check(`${product}/${locale}: real Prop account is loaded`,await frame.locator('body').evaluate(()=>!!window.__ofServerTP?.serverMode));
        // Exercise a long validation message in the shortest supported desktop.
        await frame.locator('#of-collateral').fill('999999999999');
        await frame.locator('#of-sl').fill('1');
        await page.waitForTimeout(350);
        const invalid=await metrics(page);
        check(`${product}/${locale}: invalid-order warnings and action fit`,invalid.inner.panelScrollHeight<=invalid.inner.panelHeight+1 && invalid.inner.visibleControls.every(c=>!c.visible||c.contained));
        await frame.locator('#submit-order').click();
        check(`${product}/${locale}: invalid order cannot open confirmation`,!(await frame.locator('#review-dialog').evaluate(e=>e.open)));
        await frame.locator('#of-sl').fill('');
        await frame.locator('#of-collateral').fill('150');
      }
      await page.locator('.of-terminal-more summary').click();
      check(`${product}/${locale}: secondary routes preserved`,await page.locator(`.of-terminal-more-links a[href$="/${product==='prop'?'certificates':'rewards'}"]`).isVisible());
      await page.locator('.of-terminal-more summary').press('Escape');
      // Deliberate alternative for short desktops and narrow/touch screens.
      for(const [width,height] of [[1280,600],[1024,768],[390,844]]) {
        await page.setViewportSize({width,height});
        for(const view of ['chart','book','trade','activity']) {
          await frame.locator(`button[data-workspace-view="${view}"]`).click();
          check(`${product}/${locale}: ${width}x${height} ${view} view is accessible`,await frame.locator(view==='activity'?'.bottom-panel':`.${view==='trade'?'trade':view}-panel`).isVisible());
          if(view==='trade') {
            const state=await metrics(page);
            check(`${product}/${locale}: ${width}x${height} alternative form fits`,state.inner.panelScrollHeight<=state.inner.panelHeight+1 && state.inner.visibleControls.every(c=>!c.visible||c.contained));
            const key=`compact:${product}:${width}`;
            const geometry=state.inner.visibleControls.filter(c=>['#acct-strip','.side-group','.otype-group','.lev-box','#of-collateral','#of-sl','#submit-order'].includes(c.selector)).map(c=>[c.rect.x,c.rect.width]);
            if(locale==='en')geometries[key]=geometry;
            else check(`${product}/${locale}: ${width}x${height} alternative geometry matches English`,JSON.stringify(geometry)===JSON.stringify(geometries[key]));
            if(width===1280||width===390) await page.screenshot({path:path.join(OUT,`compact-${product}-${locale}-${width}x${height}.png`)});

          }
        }
      }
      await page.setViewportSize({width:1440,height:900});
    }
    check('No uncaught browser exceptions',errors.length===0);
    fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({authenticated:AUTH,passed:results.length,results,captures,screenshots,errors,consoleErrors},null,2));
    console.log(`${results.length} layout and interaction checks passed; ${screenshots.length} viewport screenshots.`);
  } catch(error) {
    await page.screenshot({path:path.join(OUT,'failure.png')});
    fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({passed:results.length,results,captures,screenshots,errors,consoleErrors,failure:String(error)},null,2));
    throw error;
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
