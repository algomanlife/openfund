import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
const require = createRequire(import.meta.url)
function load(file, session) {
  const result = buildSync({ entryPoints:[fileURLToPath(new URL(file,import.meta.url))],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,
    external:session ? ['../session/useOpenfundSession','../../session/useOpenfundSession'] : [] })
  const mod={exports:{}}
  new Function('require','module','exports',result.outputFiles[0].text)(name=>name.endsWith('/useOpenfundSession')&&session?session:require(name),mod,mod.exports)
  return mod.exports
}
const { networkForHash } = load('../src/wallet/productNetwork.ts')
test('network selection follows the product path, including query-bearing root routes, rather than account query values',()=>{
  assert.equal(networkForHash('/en/perpetual/trade?account=owned').id,42161)
  assert.equal(networkForHash('/fa/perpetual?account=owned').id,42161)
  assert.equal(networkForHash('/en/prop/trade?account=perpetual').id,11155111)
  assert.equal(networkForHash('/en/prop/dashboard?redirect=/perpetual/trade').id,11155111)
})

test('trade and transaction detail links preserve the selected account query',()=>{
  const { routeQuery } = load('../src/features/terminal/model.ts',{useSession:()=>null,backendUrl:()=>''})
  const path='/en/perpetual/journal?account='+encodeURIComponent('gains:arbitrum:0x1234')
  const value=routeQuery(path,{transaction:'0xabc'})
  assert.equal(value.split('?').length,2)
  const params=new URLSearchParams(value.split('?')[1])
  assert.equal(params.get('account'),'gains:arbitrum:0x1234')
  assert.equal(params.get('transaction'),'0xabc')
  assert.equal(routeQuery('/fa/prop/journal',{trade:'owned-position'}),'/fa/prop/journal?trade=owned-position')
})

test('Prop bridge scopes reads and retries one reviewed intent with one idempotency key',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/en/prop/trade?account=owned-account'})
  const saved={};for(const key of ['window','document','addEventListener','removeEventListener','EventSource','Event','CustomEvent','fetch','IS_REACT_ACT_ENVIRONMENT'])saved[key]=globalThis[key]
  globalThis.window=dom.window;globalThis.document=dom.window.document
  globalThis.addEventListener=dom.window.addEventListener.bind(dom.window);globalThis.removeEventListener=dom.window.removeEventListener.bind(dom.window)
  globalThis.IS_REACT_ACT_ENVIRONMENT=true
  globalThis.Event=dom.window.Event;globalThis.CustomEvent=dom.window.CustomEvent
  class Stream { close(){} }
  globalThis.EventSource=Stream
  const calls=[];let fail=true
  const state={as_of:1,account:{status:'active',valuation_status:'fresh',currency:'USD',balance:100000,equity:100000,free_margin:100000,used_margin:0,unrealized_pnl:0,realized_pnl:0},positions:[],orders:[],history:[]}
  globalThis.fetch=async(url,options={})=>{
    calls.push({url,options})
    if(url.includes('/trading/order')&&fail){fail=false;throw new Error('Response lost')}
    return {ok:true,status:200,json:async()=>url.includes('/trading/order')?{ok:true,pending:false}:state}
  }
  const { TradingBridge }=load('../src/trading/TradingBridge.tsx',{backendUrl:()=> 'http://backend.test',useSession:()=>({status:'authenticated',user:{id:'test-user'}})})
  const root=createRoot(document.getElementById('root'))
  try {
    await act(async()=>{root.render(React.createElement(TradingBridge,{accountId:'owned-account',pricing:{'BTC/USD':.00035}}))})
    const provider=window.__ofServerTP
    assert.equal(provider.canTrade,true)
    const request={market:'BTC/USD',side:'long',type:'market',collateral:100,leverage:5,sl:null,tp:null}
    await assert.rejects(()=>provider.submitAsync(request),/Response lost/)
    assert.equal((await provider.submitAsync(request)).ok,true)
    const writes=calls.filter(call=>call.url.includes('/trading/order'))
    assert.equal(writes.length,2)
    assert.equal(writes[0].options.headers['Idempotency-Key'],writes[1].options.headers['Idempotency-Key'])
    assert.ok(writes[0].options.headers['Idempotency-Key'])
    for(const call of calls)assert.ok(call.url.includes('account=owned-account'))
    assert.equal(JSON.parse(writes[0].options.body).accountId,'owned-account')
    assert.equal(JSON.parse(writes[0].options.body).product,'prop')
    await act(async()=>root.unmount())
    await assert.rejects(()=>provider.previewAsync(request),/Account context changed/)
  } finally {
    if(window.__ofServerTP)await act(async()=>root.unmount())
    dom.window.close();for(const [key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}
  }
})

test('queued account writes preserve the captured account after route selection changes',async()=>{
 const {api}=load('../src/features/terminal/model.ts',{useSession:()=>null,backendUrl:()=> 'http://backend.test'});
 const previousLocation=globalThis.location,previousFetch=globalThis.fetch;let target;
 try{
  globalThis.location={pathname:'/en/prop/journal',search:'?account=second-account'};
  globalThis.fetch=async url=>{target=url;return {ok:true,json:async()=>({ok:true})}};
  await api('prop','/preferences',{method:'PUT',body:'{}'},'first-account');
  assert.equal(new URL(target).searchParams.get('account'),'first-account');
 }finally{if(previousLocation===undefined)delete globalThis.location;else globalThis.location=previousLocation;globalThis.fetch=previousFetch;}
});
