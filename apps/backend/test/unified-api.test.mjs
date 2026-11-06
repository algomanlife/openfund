import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import pg from 'pg'
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts'
import {createSiweMessage} from 'viem/siwe'
import {Engine} from '../engine.js'
import {MarketData} from '../market-data.js'
if(!/test|audit|_ci/.test(process.env.DATABASE_URL || ''))throw Error('Use isolated test database')
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});after(()=>pool.end())
const base=process.env.TEST_BACKEND_URL || 'http://localhost:8080'
async function api(path,body,cookie,method=body?'POST':'GET'){
 const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json','Idempotency-Key':randomUUID(),Origin:'http://localhost:5173',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
 return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}
}
async function login(wallet){const n=await api('/auth/nonce',{address:wallet.address});const message=createSiweMessage({address:wallet.address,domain:'localhost:5173',uri:'http://localhost:5173/',chainId:11155111,nonce:n.data.nonce,version:'1'});const r=await api('/auth/verify',{message,signature:await wallet.signMessage({message})});assert.equal(r.status,200);return r.cookie}
test('owned account API isolates Challenge journals and enforces disabled read-only state after reauthentication',async()=>{
 const wallet=privateKeyToAccount(generatePrivateKey()),cookie=await login(wallet),me=(await api('/auth/me',null,cookie)).data.user;
 const trial=(await api('/accounts',null,cookie)).data.accounts.find(a=>a.type==='free_trial');
 const challenge=(await pool.query("INSERT INTO openfund_challenges(user_id,challenge_plan_id) SELECT $1,id FROM challenge_plans WHERE slug='standard' RETURNING id",[me.id])).rows[0];
 const scope='/products/prop',entry={id:randomUUID(),title:'Plan',body:'Account-specific plan',date:'2026-11-02',tags:['breakout'],classification:'playbook'};
 assert.equal((await api(scope+'/journal?account='+trial.id,entry,cookie,'PUT')).status,200);
 assert.equal((await api(scope+'/journal?account='+challenge.id,null,cookie)).data.total,0);
 const context=await api(scope+'/context?account='+challenge.id,null,cookie);assert.equal(context.data.state,null);assert.equal(context.data.capabilities.simulatedTrading,false);
 /* v0.3.1: challenge execution is implemented — an unprovisioned challenge
    (bare record, no trading account yet) is a 404, not the old
    409 challenge_execution_unavailable gate */
 assert.equal((await api(scope+'/overview?account='+challenge.id,null,cookie)).status,404);
 assert.equal((await api(scope+'/context?account='+randomUUID(),null,cookie)).status,404);
 assert.equal((await api('/trading/preview?account='+challenge.id,{market:'BTC/USD',margin:1,leverage:1,side:'long'},cookie)).status,404);
 const prefs={range:'30D',layout:'compact',hidden:['Edge Score']};assert.equal((await api(scope+'/preferences?account='+trial.id,prefs,cookie,'PUT')).status,200);assert.deepEqual((await api(scope+'/preferences?account='+trial.id,null,cookie)).data,prefs);
 assert.equal((await api(scope+'/preferences?account='+challenge.id,null,cookie)).data.layout,'comfortable');
 const bad=await api('/products/perpetual/context?account='+trial.id,null,cookie);assert.equal(bad.status,404);
 const engine=new Engine(pool,new MarketData());await pool.query('UPDATE demo_accounts SET balance=0 WHERE id=$1',[trial.id]);await engine.enforceTrialRisk(me.id);
 const freshCookie=await login(wallet),directory=await api('/accounts',null,freshCookie);const disabled=directory.data.accounts.find(a=>a.id===trial.id);assert.equal(disabled.status,'permanently_disabled');assert.equal(disabled.balance,'0.00');
 assert.equal((await api(scope+'/journal?account='+trial.id,null,freshCookie)).data.total,1);
 assert.equal((await api(scope+'/journal?account='+trial.id,{...entry,version:1},freshCookie,'PUT')).status,403);
 assert.equal((await api(scope+'/journal/'+entry.id+'?account='+trial.id+'&version=1',null,freshCookie,'DELETE')).status,403);
 assert.equal((await api(scope+'/preferences?account='+trial.id,prefs,freshCookie,'PUT')).status,403);
 assert.equal((await api('/portfolio/notes',{tradeKey:trial.id+'|position|'+randomUUID(),notes:'blocked',tags:[]},freshCookie,'PUT')).status,403);
 assert.equal((await api('/trading/order',{market:'BTC/USD',side:'long',margin:1,leverage:1},freshCookie)).status,403);
 assert.equal((await api('/accounts',null,null)).status,401);
})
