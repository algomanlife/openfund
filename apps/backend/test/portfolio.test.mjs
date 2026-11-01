/**
 * Portfolio integration tests — auth/ownership, adapter correctness,
 * journal-core analytics vs independently computed expectations.
 * Run: node test/portfolio.test.mjs (backend on :8080, SIM_TEST_MODE=1)
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'
import pg from 'pg'

const BASE = 'http://localhost:8080'
let passed = 0, failed = 0
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log('PASS -', name) }
  else { failed++; console.log('FAIL -', name, extra) }
}
const j = async (method, path, body, cookie) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  return { status: res.status, data: await res.json().catch(() => null), cookie: (res.headers.get('set-cookie') || '').split(';')[0] }
}
async function login(w) {
  const n = (await j('POST', '/auth/nonce', { address: w.address })).data
  const message = createSiweMessage({ domain: 'localhost:5173', address: w.address, uri: 'http://localhost:5173/', chainId: 421614, nonce: n.nonce, version: '1' })
  return (await j('POST', '/auth/verify', { message, signature: await w.signMessage({ message }) })).cookie
}
const inj = (price) => fetch(BASE + '/internal/inject-price', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: 'BTC/USD', price })
})

const w1 = privateKeyToAccount(generatePrivateKey())
const w2 = privateKeyToAccount(generatePrivateKey())
const pool = new pg.Pool({ host: '/tmp', user: 'openfund_cms', password: 'openfund_local_dev', database: 'openfund_cms' })
const near = (a, b, tol = 0.02) => Math.abs(Number(a) - b) < tol

/* deterministic trades: BTC/USD, fee 0.035%/side, spread 0.005%/side */
const FEE = 0.035, SPR = 0.005
const fx = (mark, side, dir) => (side === 'long') === (dir === 'open') ? mark * (1 + SPR / 100) : mark * (1 - SPR / 100)

{
  const c1 = await login(w1)
  const u1 = (await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [w1.address.toLowerCase()])).rows[0].id
  await pool.query('DELETE FROM trade_notes WHERE user_id=$1', [u1])
  await pool.query('DELETE FROM trading_positions WHERE user_id=$1', [u1])
  await pool.query('DELETE FROM trading_orders WHERE user_id=$1', [u1])
  await pool.query('DELETE FROM trading_ledger WHERE user_id=$1', [u1])
  await pool.query('DELETE FROM demo_accounts WHERE user_id=$1', [u1])
  await login(w1)  /* re-fund after clean */

  /* ---- security: unauthenticated + cross-account ---- */
  ok('unauthenticated → 401', (await j('GET', '/portfolio/overview')).status === 401)
  ok('unauthenticated trades → 401', (await j('GET', '/portfolio/trades')).status === 401)
  const c2 = await login(w2)
  const u2 = (await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [w2.address.toLowerCase()])).rows[0].id
  await pool.query('DELETE FROM trade_notes WHERE user_id=$1', [u2])
  await pool.query('DELETE FROM trading_positions WHERE user_id=$1', [u2])
  await pool.query('DELETE FROM trading_orders WHERE user_id=$1', [u2])
  await pool.query('DELETE FROM trading_ledger WHERE user_id=$1', [u2])
  await pool.query('DELETE FROM demo_accounts WHERE user_id=$1', [u2])

  /* ---- deterministic trades: 2 wins, 1 loss ---- */
  await inj('50000')
  const trades = [
    { side: 'long', margin: 1000, lev: 5, open: 50000, close: 51000 },
    { side: 'short', margin: 800, lev: 5, open: 50000, close: 49500 },
    { side: 'long', margin: 600, lev: 10, open: 50000, close: 49900 }
  ]
  const expected = []
  for (const tr of trades) {
    await inj(String(tr.open))
    const o = await j('POST', '/trading/order', {
      market: 'BTC/USD', side: tr.side, order_type: 'market', margin: tr.margin, leverage: tr.lev
    }, c1, { 'Idempotency-Key': 'pf-' + tr.side + tr.open + tr.margin })
    await inj(String(tr.close))
    await j('POST', `/trading/positions/${o.data.position.id}/close`, {}, c1)
    const entry = fx(tr.open, tr.side, 'open'), exit = fx(tr.close, tr.side, 'close')
    const notional = tr.margin * tr.lev
    const qty = notional / entry
    const gross = qty * (tr.side === 'long' ? exit - entry : entry - exit)
    const feeSide = notional * FEE / 100
    expected.push({ net: gross - feeSide /* engine close-fee net */, gross, fee: feeSide, qty })
  }

  /* ---- overview ---- */
  const ov = (await j('GET', '/portfolio/overview', null, c1)).data
  ok('account: balance ≈ 100k − ΣopenFee + Σnet', near(ov.account.balance,
    100000 - expected.reduce((s, e) => s + e.fee, 0) + expected.reduce((s, e) => s + e.net, 0), 0.03), ov.account.balance)
  ok('totalTrades = 3, closed = 3', ov.account.totalTrades === 3 && ov.account.closedTrades === 3)
  ok('totalFees ≈ Σ(open+close fees)', near(ov.account.totalFees, 2 * expected.reduce((s, e) => s + e.fee, 0), 0.02), ov.account.totalFees)
  ok('equityBasis honestly labeled realized', ov.equityBasis === 'realized')

  /* metrics — independent expectations */
  const nets = expected.map(e => e.net)
  const wins = nets.filter(n => n > 0), losses = nets.filter(n => n < 0)
  ok('metrics: wins=2, losses=1', ov.metrics.wins === 2 && ov.metrics.losses === 1, JSON.stringify({ w: ov.metrics.wins, l: ov.metrics.losses }))
  ok('metrics: winRate ≈ 2/3', near(ov.metrics.winRate, 2 / 3, 0.001))
  ok('metrics: netPnl ≈ Σ realized (gross − closeFee)', near(ov.metrics.netPnl,
    expected.reduce((s, e) => s + e.net, 0), 0.03), String(ov.metrics.netPnl))
  const netsBoth = expected.map(e => e.net)            /* engine realized = journal netPnl */
  ok('metrics: largestWin matches', near(ov.metrics.largestWin, Math.max(...netsBoth), 0.03))
  ok('metrics: largestLoss matches', near(ov.metrics.largestLoss, Math.min(...netsBoth), 0.03))
  ok('metrics: avgWin ≈ Σwins/2', near(ov.metrics.avgWin, netsBoth.filter(n => n > 0).reduce((a, b) => a + b, 0) / 2, 0.03))
  ok('metrics: profitFactor = grossProfit/grossLoss', near(ov.metrics.profitFactor,
    wins.reduce((a, b) => a + b, 0) / Math.abs(losses.reduce((a, b) => a + b, 0)), 0.02), ov.metrics.profitFactor)

  /* equity curve + drawdown */
  ok('equity curve has 3 points ending at Σnet', ov.equityCurve.length === 3 &&
    near(ov.equityCurve[2].cumNetPnl, expected.reduce((s, e) => s + e.net, 0), 0.03))
  ok('drawdown present (peak ≥ 0)', ov.drawdown.peak >= 0 && ov.drawdown.maxDrawdown >= 0)

  /* PnL calendar: all trades today (UTC) */
  const today = new Date().toISOString().slice(0, 10)
  const day = ov.daily.find(d => d.date === today)
  ok('calendar: today has 3 trades', day && day.trades === 3, JSON.stringify(ov.daily))
  ok('calendar: today netPnl ≈ Σnet', day && near(day.netPnl, expected.reduce((s, e) => s + e.net, 0), 0.03))

  /* buckets */
  const bk = (await j('GET', '/portfolio/buckets', null, c1)).data
  ok('bySymbol: BTC/USD with 3 trades', bk.bySymbol[0]?.key === 'BTC/USD' && bk.bySymbol[0]?.trades === 3)
  ok('byDirection: long 2 / short 1', bk.byDirection.find(b => b.key === 'long')?.trades === 2 &&
    bk.byDirection.find(b => b.key === 'short')?.trades === 1)

  /* ---- history: filters + pagination ---- */
  const all = (await j('GET', '/portfolio/trades?limit=2&offset=0', null, c1)).data
  ok('pagination: total 3, page 1 → 2 rows', all.total === 3 && all.trades.length === 2)
  const page2 = (await j('GET', '/portfolio/trades?limit=2&offset=2', null, c1)).data
  ok('pagination: page 2 → 1 row', page2.trades.length === 1)
  const longs = (await j('GET', '/portfolio/trades?side=long', null, c1)).data
  ok('filter side=long → 2', longs.total === 2)
  const search = (await j('GET', '/portfolio/trades?market=btc', null, c1)).data
  ok('symbol search → 3', search.total === 3)

  /* ---- details + notes ---- */
  const first = all.trades[0]
  const d = (await j('GET', `/portfolio/trades/${first.ofPositionId}`, null, c1)).data
  ok('details: trade + ledger rows + empty note', !!d.trade && d.ledger.length >= 2 && d.note.notes === '', JSON.stringify(d?.ledger?.length))
  ok('details: ledger reconciles with netPnL', near(d.ledger[d.ledger.length - 1].balanceAfter, Number(ov.account.balance), 0.03))
  const noteRes = await j('PUT', '/portfolio/notes', { tradeKey: d.trade.key, notes: 'good trade', tags: ['breakout', 'news'] }, c1)
  ok('note saved', noteRes.status === 200)
  const d2 = (await j('GET', `/portfolio/trades/${first.ofPositionId}`, null, c1)).data
  ok('note persisted + private', d2.note.notes === 'good trade' && d2.note.tags.length === 2)
  const d3 = (await j('GET', `/portfolio/trades/${first.ofPositionId}`, null, c2)).data
  ok('user B cannot read A\'s trade details', (await j('GET', `/portfolio/trades/${first.ofPositionId}`, null, c2)).status === 404)
  const c2notes = (await j('GET', `/portfolio/trades/${first.ofPositionId}`, null, c2)).status
  ok('user B cannot see A\'s notes (404)', c2notes === 404)

  /* user B's own portfolio is empty and isolated */
  const ovB = (await j('GET', '/portfolio/overview', null, c2)).data
  ok('user B: own scope only (empty or own fresh account)', !ovB || !ovB.account || ovB.account.totalTrades === 0, JSON.stringify(ovB?.account?.totalTrades))

  /* no import endpoints exist (feature removed by design) */
  const probe = await fetch(BASE + '/api/import/csv', { method: 'POST' })
  ok('no external import API exists (404)', probe.status === 404)

  if (failed === 0) {
    for (const u of [u1, u2]) {
      await pool.query('DELETE FROM trade_notes WHERE user_id=$1', [u])
      await pool.query('DELETE FROM trading_positions WHERE user_id=$1', [u])
      await pool.query('DELETE FROM trading_orders WHERE user_id=$1', [u])
      await pool.query('DELETE FROM trading_ledger WHERE user_id=$1', [u])
      await pool.query('DELETE FROM demo_accounts WHERE user_id=$1', [u])
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`)
await pool.end()
process.exit(failed ? 1 : 0)
