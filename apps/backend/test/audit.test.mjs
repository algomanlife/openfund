import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { MarketData, quoteRecord } from '../market-data.js'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { Engine } from '../engine.js'
import { Portfolio, toRoundTrip } from '../portfolio.js'
import { accountMetrics, positionMetrics, D } from '../trading-math.js'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'

if (!/audit|test|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({connectionString:process.env.DATABASE_URL})
after(() => pool.end())
const md = () => ({
  price:'50000', at:Date.now(), open:true,
  markets:new Map([['BTC/USD',{base:'BTC',group:'crypto',maxLeverage:100}]]),
  marketMeta(m) { return this.markets.get(m) },
  mark(m) { return this.marketMeta(m) ? {mark:this.price,at:this.at} : null },
  tradeable(m) { return !this.marketMeta(m) ? {ok:false,reason:'unknown_market'} : !this.open ? {ok:false,reason:'market_closed'} : Date.now()-this.at>5000 ? {ok:false,reason:'stale_price'} : {ok:true,mark:this.price,meta:this.marketMeta(m)} },
})
const order = {market:'BTC/USD',side:'long',order_type:'market',margin:1000,leverage:10}
async function setup() {
  const id=randomUUID(), market=md(), engine=new Engine(pool,market)
  await pool.query('INSERT INTO openfund_users(id,wallet_address) VALUES ($1,$2)',[id,'0x'+randomUUID().replaceAll('-','')+'00000000'])
  await engine.ensureDemoAccount(id)
  return {id,market,engine}
}
const near = (a,b,epsilon=.011) => assert.ok(Math.abs(Number(a)-Number(b))<epsilon,`${a} ≠ ${b}`)

test('same idempotency key is independent across users; concurrent retries settle once',async()=>{
  const a=await setup(), b=await setup()
  const results=await Promise.all(Array.from({length:8},()=>a.engine.submitOrder(a.id,order,'same-key')))
  assert.equal(new Set(results.map(r=>r.order.id)).size,1)
  const other=await b.engine.submitOrder(b.id,order,'same-key')
  assert.notEqual(other.order.user_id,results[0].order.user_id)
  assert.equal((await a.engine.state(a.id)).positions.length,1)
  await assert.rejects(()=>a.engine.submitOrder(a.id,{...order,margin:2000},'same-key'),/idempotency_conflict/)
  const ledger=(await pool.query("SELECT * FROM trading_ledger WHERE user_id=$1 AND event='open_fee'",[a.id])).rows
  assert.equal(ledger.length,1)
})
test('rejected retry remains rejected; exact balance cannot pay margin plus fees',async()=>{
  const a=await setup(), req={...order,margin:100000,leverage:1}
  const r=await a.engine.submitOrder(a.id,req,'reject')
  assert.equal(r.reason,'insufficient_margin')
  assert.equal((await a.engine.submitOrder(a.id,req,'reject')).ok,false)
  assert.equal((await a.engine.state(a.id)).positions.length,0)
})
test('malformed, non-finite and negative financial inputs fail explicitly',async()=>{
  const a=await setup()
  for (const patch of [{side:'oops'},{order_type:'oops'},{margin:'NaN'},{margin:'Infinity'},{margin:'abc'},{leverage:1.1},{target_price:-2},{sl:0},{tp:-1}])
    await assert.rejects(()=>a.engine.submitOrder(a.id,{...order,...patch},randomUUID()),e=>e.status===400)
})
test('partial close is proportional, survives Engine restart and replay, and conserves all ledger money',async()=>{
  const a=await setup(), r=await a.engine.submitOrder(a.id,order,'partial-open')
  a.market.price='51000'
  const args={fraction:'0.25',idempotencyKey:'quarter'}
  const [first,retry]=await Promise.all([a.engine.closePosition(a.id,r.position.id,args),a.engine.closePosition(a.id,r.position.id,args)])
  assert.equal(first.position.id,retry.position.id)
  assert.equal([first,retry].filter(result=>result.duplicate === true).length,1)
  const restarted=new Engine(pool,a.market), state=await restarted.state(a.id)
  assert.equal(state.positions.length,1)
  near(state.account.used_margin,750)
  near(state.positions[0].open_fee,2.625,.00001)
  near(first.position.open_fee,.875,.00001)
  near(state.positions[0].quantity,Number(r.position.quantity)*.75,.00000001)
  await assert.rejects(()=>a.engine.closePosition(a.id,r.position.id,{fraction:.5,idempotencyKey:'quarter'}),/idempotency_conflict/)
  await restarted.closePosition(a.id,r.position.id)
  const final=await restarted.state(a.id)
  near(final.account.used_margin,0)
  const sum=(await pool.query('SELECT SUM(amount)::text AS total FROM trading_ledger WHERE user_id=$1',[a.id])).rows[0].total
  near(final.account.balance,sum)
  const rows=(await pool.query('SELECT * FROM trading_positions WHERE user_id=$1',[a.id])).rows
  near(rows.reduce((sum,p)=>sum+Number(p.open_fee),0),3.5,.000001)
  const portfolio=new Portfolio(pool,a.market), overview=await portfolio.overview(a.id)
  near(overview.metrics.netPnl,Number(final.account.balance)-100000)
  near(overview.account.equity,final.account.equity)
})
test('pending protection uses target entry, pending fills and cancellation share account locks',async()=>{
  const a=await setup()
  const r=await a.engine.submitOrder(a.id,{...order,order_type:'limit',target_price:49000,tp:49500},'limit')
  assert.equal(r.pending,true)
  a.market.price='48900'
  a.engine.running=true
  await Promise.all([a.engine.loop(),a.engine.cancelOrder(a.id,r.order.id).catch(e=>assert.equal(e.status,409))])
  const row=(await pool.query('SELECT status FROM trading_orders WHERE id=$1',[r.order.id])).rows[0]
  assert.ok(['filled','cancelled'].includes(row.status))
  const fees=(await pool.query("SELECT * FROM trading_ledger WHERE user_id=$1 AND event='open_fee'",[a.id])).rows
  assert.equal(fees.length,row.status==='filled'?1:0)
  a.engine.stop()
})
test('stale marks never fabricate equity and never execute pending/automatic exits',async()=>{
  const a=await setup(), r=await a.engine.submitOrder(a.id,{...order,sl:49900},'stale')
  a.market.price='49000';a.market.at=Date.now()-6000
  a.engine.running=true;await a.engine.loop();a.engine.stop()
  const s=await a.engine.state(a.id)
  assert.equal(s.positions.length,1)
  assert.equal(s.positions[0].unrealized_pnl,null)
  assert.equal(s.account.equity,null)
  assert.equal(s.account.free_margin,null)
  assert.equal(s.account.valuation_status,'stale')
  await assert.rejects(()=>a.engine.closePosition(a.id,r.position.id),/stale_price/)
  const ov=await new Portfolio(pool,a.market).overview(a.id)
  assert.equal(ov.account.equity,null)
})
test('liquidation threshold includes closing fees and spread for long and short',()=>{
  const m=md()
  for(const side of ['long','short']) {
    const p={market:'BTC/USD',side,margin:'1000',quantity:'.2',entry_price:'50000',leverage:10,open_fee:'3.5'}
    const v=positionMetrics(p,m)
    m.price=v.liquidation
    near(positionMetrics(p,m).net,-900,.000001)
  }
})
test('decimal valuation preserves sub-cent instruments and aggregate loss reduces free margin',()=>{
  const m=md();m.price='.00001234'
  const p={market:'BTC/USD',side:'long',margin:'1000',quantity:'1000000',entry_price:'.00001300',leverage:1,open_fee:'.35'}
  const v=positionMetrics(p,m)
  assert.equal(v.gross.toString(),'-.66'.replace('-.','-0.'))
  const a=accountMetrics({balance:'10000',used_margin:'1000'},[p],m)
  assert.equal(a.free_margin,'8999.34')
  assert.ok(D(v.mark).gt(0))
})
test('risk observations persist peak and daily/max drawdown without inventing challenge limits',async()=>{
  const a=await setup();await a.engine.submitOrder(a.id,order,'risk')
  const before=await a.engine.state(a.id)
  a.market.price='49500'
  const after=await new Engine(pool,a.market).state(a.id)
  assert.ok(Number(after.account.risk.maximum_drawdown)>Number(before.account.risk.maximum_drawdown))
  assert.equal(after.account.risk.daily_limit,null)
  assert.equal(after.account.risk.basis,'sampled_equity')
})
test('SIWE validates URI, expiry, both product chains and atomic nonce consumption',async()=>{
  const wallet=privateKeyToAccount(generatePrivateKey()), base=process.env.TEST_BACKEND_URL || 'http://localhost:8080'
  const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}}
  async function message(patch={}) {
    const n=await post('/auth/nonce',{address:wallet.address})
    const message=createSiweMessage({domain:'localhost:5173',uri:'http://localhost:5173/',address:wallet.address,chainId:42161,nonce:n.data.nonce,version:'1',...patch})
    return {message,signature:await wallet.signMessage({message})}
  }
  const payload=await message()
  const race=await Promise.all([post('/auth/verify',payload),post('/auth/verify',payload)])
  assert.deepEqual(race.map(r=>r.status).sort(),[200,400])
  assert.equal((await post('/auth/verify',await message({uri:'https://evil.example/'}))).data.error,'invalid_uri')
  assert.equal((await post('/auth/verify',await message({expirationTime:new Date(Date.now()-10000)}))).status,400)
  assert.equal((await post('/auth/verify',await message({chainId:42161}))).status,200)
})

test('upstream timestamps and invalid marks cannot appear fresh; startup failure retries and stops cleanly', async()=>{
  const now=Date.now()
  assert.equal(quoteRecord({market:'BTC/USD',mark:'NaN',updatedAt:now}),null)
  assert.equal(quoteRecord({market:'BTC/USD',mark:'-1',updatedAt:now}),null)
  const stale=quoteRecord({market:'BTC/USD',mark:'50000',updatedAt:now-60000},now)
  assert.equal(stale.at,now-60000)
  const source=new MarketData()
  source.marks.set('BTC/USD',stale)
  assert.equal(source.freshMark('BTC/USD'),null)
  const original=globalThis.fetch
  globalThis.fetch=async()=>{throw Error('test offline')}
  try { await assert.rejects(()=>source.bootstrap(),/test offline/); assert.ok(source.retryTimer) }
  finally { globalThis.fetch=original; source.stop() }
  assert.equal(source.retryTimer,null)
  assert.equal(source.refreshTimer,null)
})
