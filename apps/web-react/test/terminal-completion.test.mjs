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
test('wallet network is Arbitrum One (42161) on every route — Prop, Perpetual, website and checkout',()=>{
  for (const path of ['/en/perpetual/trade?account=owned','/fa/perpetual?account=owned','/en/prop/trade?account=perpetual',
    '/en/prop/dashboard?redirect=/perpetual/trade','/fa/challenges','/en/ambassador','/'])
    assert.equal(networkForHash(path).id,42161,path)
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

/* ---- added interface locales (ar, ru, zh-CN) ---- */
const i18n = load('../src/i18n/locales.ts')
test('locale helpers: five locales, RTL only for fa/ar, English fallback, never Persian for added locales',()=>{
  assert.deepEqual([...i18n.LOCALES],['fa','en','ar','ru','zh-CN'])
  assert.deepEqual(i18n.LOCALES.map(l=>i18n.dirOf(l)),['rtl','ltr','rtl','ltr','ltr'])
  assert.equal(i18n.pick('fa','پرتفوی','Portfolio'),'پرتفوی')
  assert.equal(i18n.pick('ar','پرتفوی','Portfolio'),'المحفظة')
  assert.equal(i18n.pick('ru','پرتفوی','Portfolio'),'Портфель')
  assert.equal(i18n.pick('zh-CN','پرتفوی','Portfolio'),'投资组合')
  assert.equal(i18n.pick('ar','فقط فارسی','Untranslated source'),'Untranslated source')
  assert.equal(i18n.pick('ru','x','Balance · USD'),'Баланс · USD','template keys re-insert interpolated values')
  assert.equal(i18n.normalizeLocale('de'),'fa')
  assert.equal(i18n.switchLocalePath('/fa/prop/trade','zh-CN'),'/zh-CN/prop/trade')
  /* no hidden English fallback: an untranslated string is reported as a miss */
  assert.equal(typeof i18n.contentLocale,'undefined','editorial content is no longer redirected to English')
  assert.ok(i18n.untranslatedNotice('zh-CN').length>0 && i18n.untranslatedNotice('fa').includes('ترجمه'))
})
test('added locales: editorial dictionaries load on demand and untranslated text is reported',async()=>{
  const messages = load('../src/i18n/messages/index.ts')
  for (const locale of ['ar','ru','zh-CN']) {
    assert.equal(messages.contentLoaded(locale),false)
    await messages.ensureLocaleContent(locale)
    assert.equal(messages.contentLoaded(locale),true)
    assert.equal(messages.translateSource(locale,'An untranslated sentence for the test.'),'An untranslated sentence for the test.')
    assert.ok(messages.missesFor(locale).includes('An untranslated sentence for the test.'))
    for (const neutral of ['BTC/USD','Openfund','12.5%','https://openfund.cloud']) assert.equal(messages.translateSource(locale,neutral),neutral)
    assert.ok(!messages.missesFor(locale).includes('BTC/USD'))
  }
})
test('bilingual records resolve every locale through localizeRecords (CMS row first, then the reviewed dictionary)',async()=>{
  const localize = load('../src/i18n/localize.ts')
  const record = localize.localizeRecords({ fa: 'پرتفوی', en: 'Portfolio' })
  assert.deepEqual(Object.keys(record),['fa','en'],'added locales are non-enumerable')
  assert.equal(record.ar,'المحفظة')
  const nested = localize.localizeRecords({ title: { fa: { a: 'پرتفوی' }, en: { a: 'Portfolio', slug: 'portfolio' } } })
  assert.equal(nested.title.ru.a,'Портфель'); assert.equal(nested.title.ru.slug,'portfolio','identifier fields are never translated')
  const cms = localize.localizeRecords({ fa: 'x', en: 'Portfolio' })
  localize.attachCmsTranslation(cms,'zh-CN','编辑部译文')
  assert.equal(cms['zh-CN'],'编辑部译文','a Directus row for the locale wins over the bundled dictionary')
})
test('added-locale dictionaries share one key set and keep symbols and placeholders intact',async()=>{
  const dicts = ['ar','ru','zh-CN'].map(l=>load(`../src/i18n/messages/${l}.ts`)).map(m=>Object.values(m)[0])
  const keys = dicts.map(d=>Object.keys(d).sort().join('\n'))
  assert.equal(keys[1],keys[0]); assert.equal(keys[2],keys[0])
  for (const d of dicts) for (const [k,v] of Object.entries(d)) {
    assert.ok(v.trim(),'empty translation for '+k)
    for (const token of k.match(/\$\{[^}]+\}|\b(?:USD|DAI|UTC|JSON|CSV|PDF|PNG|DePay|Gains|Openfund|SL|TP)\b/g)||[]) assert.ok(v.includes(token),`${k}: ${token} missing`)
  }
})
test('terminal locale dictionaries only use existing terminal keys and keep list shapes',()=>{
  const {readFileSync}=require('node:fs')
  const w={}; new Function('window',readFileSync(new URL('../public/legacy/terminal-locales.js',import.meta.url),'utf8'))(w)
  const src=readFileSync(new URL('../public/legacy/terminal.js',import.meta.url),'utf8')
  const EN=new Function('return '+src.slice(src.indexOf('const EN = {')+11,src.indexOf('};',src.indexOf('const EN = {'))+1))()
  for (const l of ['ar','ru','zh-CN']) {
    const d=w.OpenfundTerminalLocales[l]
    for (const k of Object.keys(d)) assert.ok(k in EN,`${l}: unknown key ${k}`)
    assert.equal(d['pos.details'].length,EN['pos.details'].length)
    assert.ok(Object.keys(w.OpenfundTerminalLocales.L[l]).length>20)
  }
  assert.ok(src.includes("window.__ofSetLang"),'terminal accepts the shell locale without reloading')
})
