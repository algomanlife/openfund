import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {JSDOM} from 'jsdom'
const source=readFileSync(new URL('../public/legacy/market-depth.js',import.meta.url),'utf8')
const markup=readFileSync(new URL('../src/pages/terminal-body.html',import.meta.url),'utf8')
const book=(market='BTC/USD')=>({market,markPrice:'100',timestamp:Date.now(),asks:[{price:'101',size:'2',sizeUsd:'202',cumulativeUsd:'202'}],bids:[{price:'99',size:'3',sizeUsd:'297',cumulativeUsd:'297'}]})
async function setup(){
 const dom=new JSDOM(markup,{url:'http://localhost/react/',runScripts:'outside-only'}),w=dom.window,sockets=[];
 class Socket{constructor(){sockets.push(this);this.sent=[]}send(s){this.sent.push(JSON.parse(s))}close(){this.onclose?.()}}
 w.WebSocket=Socket;w.fetch=async url=>({ok:true,json:async()=>url.includes('/book')?(()=>{const market=decodeURIComponent(url.split('/markets/')[1].split('/')[0]);const b=book(market);if(market==='ETH/USD'){b.markPrice='200';b.asks[0].price='201';b.bids[0].price='199'}return b})():{data:[]}});w.eval(source);await w.OpenfundDepth.select('BTC/USD');
 return {w,sockets,close(){w.dispatchEvent(new w.Event('pagehide'));w.close()}}
}
test('restores Book/Trades and ignores acknowledgement or malformed trade payloads',async()=>{
 const a=await setup();try{const s=a.sockets[0];s.onopen();assert.deepEqual(s.sent.map(x=>x.channel),['book','trades']);assert.equal(a.w.document.querySelectorAll('[data-book-tab]').length,2);
 for(const data of [undefined,null,{},[null,undefined,{}]])assert.doesNotThrow(()=>s.onmessage({data:JSON.stringify({op:'subscribed',channel:'trades',data})}));
 assert.equal(a.w.document.querySelectorAll('#trades-list .tr-row').length,0);
 const envelopeBook=book();delete envelopeBook.market;envelopeBook.asks[0].price='102';s.onmessage({data:JSON.stringify({channel:'book',market:'BTC/USD',snapshot:true,seq:1,data:envelopeBook})});assert.ok(a.w.document.querySelector('#book-asks').textContent.includes('102'));
 const trade={market:'BTC/USD',price:'101',sizeUsd:'202',side:'long',action:'TradeOpenedMarket',timestamp:Date.now(),txHash:'0x'+'a'.repeat(64)};
 s.onmessage({data:JSON.stringify({channel:'trades',snapshot:true,data:[trade,trade]})});assert.equal(a.w.document.querySelectorAll('#trades-list .tr-row').length,1);
 s.onmessage({data:JSON.stringify({channel:'trades',data:[{...trade,price:'NaN'},{...trade,market:'ETH/USD'}]})});assert.equal(a.w.document.querySelectorAll('#trades-list .tr-row').length,1);
 }finally{a.close()}
})
test('sequence gaps clear stale ladders and resubscribe; symbol switches cannot leak old levels',async()=>{
 const a=await setup();try{const old=a.sockets[0];old.onopen();old.onmessage({data:JSON.stringify({channel:'book',snapshot:true,seq:1,data:book()})});assert.equal(a.w.document.querySelectorAll('#book-asks .bk-row').length,1);
 old.onmessage({data:JSON.stringify({channel:'book',seq:3,data:book()})});assert.equal(a.w.document.querySelectorAll('#book-asks .bk-row').length,0);assert.equal(old.sent.at(-2).op,'unsubscribe');assert.equal(old.sent.at(-1).op,'subscribe');
 await a.w.OpenfundDepth.select('ETH/USD');old.onmessage({data:JSON.stringify({channel:'book',snapshot:true,seq:4,data:book()})});assert.ok(a.w.document.querySelector('#book-asks').textContent.includes('201'));
 const socket=a.sockets.at(-1);socket.onmessage({data:JSON.stringify({channel:'book',snapshot:true,seq:1,data:{...book('ETH/USD'),asks:[{price:'NaN',size:'1',sizeUsd:'1',cumulativeUsd:'1'}]}})});assert.ok(!a.w.document.querySelector('#book-asks').textContent.includes('NaN'));
 socket.onmessage({data:JSON.stringify({op:'ping'})});assert.equal(socket.sent.at(-1).op,'pong');
 }finally{a.close()}
})
test('shared workspace retains real feed integration and does not hide Book/Trades controls',()=>{
 const workspace=readFileSync(new URL('../src/features/terminal/TradingPages.tsx',import.meta.url),'utf8');assert.ok(workspace.includes('legacy/market-depth.js'));assert.ok(!workspace.includes('.book-panel .panel-tabs,.book-tools'));assert.ok(workspace.includes('legacy/react-boot.js'));assert.ok(workspace.includes('workspace.css?raw'));const styles=readFileSync(new URL('../src/features/terminal/workspace.css',import.meta.url),'utf8');assert.ok(styles.includes('prefers-reduced-motion'));
 /* v0.3.1: the boot logic moved to the external CSP-safe react-boot.js;
    synthetic market data must stay disabled there */
 const boot=readFileSync(new URL('../public/legacy/react-boot.js',import.meta.url),'utf8');assert.ok(boot.includes('syntheticMarketData: false'));assert.ok(boot.includes('openfund-display'));assert.ok(boot.includes('of-boot-data'));
})
