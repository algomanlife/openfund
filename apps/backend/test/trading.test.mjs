/**
 * Demo trading engine test suite — deterministic synthetic prices via the
 * market-data injection seam. Covers: funding (exact 100k, idempotent,
 * concurrent-safe), market/limit/stop orders, long/short PnL, fees, margin
 * validation, leverage limits, SL/TP execution, liquidation, duplicate
 * submission, ownership isolation, suspension, ledger reconciliation.
 *
 * Run: node test/trading.test.mjs   (backend must be running on :8080)
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'
import pg from 'pg'

const BASE = process.env.TEST_BACKEND_URL || 'http://localhost:8080'
const DOMAIN = 'localhost:5173'
let passed = 0, failed = 0
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log('PASS -', name) }
  else { failed++; console.log('FAIL -', name, extra) }
}

const j = async (method, path, body, cookie, headers = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  })
  const setCookie = res.headers.get('set-cookie') || ''
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data, cookie: setCookie.split(';')[0] }
}

async function login(wallet) {
  const n = (await j('POST', '/auth/nonce', { address: wallet.address })).data
  const message = createSiweMessage({ domain: DOMAIN, address: wallet.address, uri: 'http://localhost:5173/', chainId: 421614, nonce: n.nonce, version: '1' })
  const signature = await wallet.signMessage({ message })
  const r = await j('POST', '/auth/verify', { message, signature })
  return r.cookie
}

const pool = new pg.Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : { host: '/tmp', user: 'openfund_cms', password: 'openfund_local_dev', database: 'openfund_cms' })
const D = (v) => Number(v)

const w1 = privateKeyToAccount(generatePrivateKey())
const w2 = privateKeyToAccount(generatePrivateKey())
const MKT = 'BTC/USD'

/* independent Gains-math expectations (plain JS — never the engine's code):
   BTC/USD: fee 0.035%/side on INITIAL notional; fixed spread 0.005%/side
   (long opens buying above mark, closes selling below mark) */
const FEE = 0.035, SPR = 0.005
const fx = (mark, side, dir) => (side === 'long') === (dir === 'open')
  ? mark * (1 + SPR / 100) : mark * (1 - SPR / 100)
const near = (a, b, tol = 0.02) => Math.abs(Number(a) - b) < tol


const clean = async (userId) => {
  await pool.query('DELETE FROM trading_positions WHERE user_id=$1', [userId])
  await pool.query('DELETE FROM trading_orders WHERE user_id=$1', [userId])
  await pool.query('DELETE FROM trading_ledger WHERE user_id=$1', [userId])
  await pool.query('DELETE FROM demo_accounts WHERE user_id=$1', [userId])
}

/* ================= 1. FUNDING ================= */
{
  const cookie = await login(w1)
  const uid = (await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [w1.address.toLowerCase()])).rows[0].id
  await clean(uid)
  const cookie2 = await login(w1)                      /* re-login after clean */
  const st = await j('GET', '/trading/state', null, cookie2)
  ok('demo account exists with exactly 100000.00 DAI', st.data.account?.balance === '100000.00', JSON.stringify(st.data.account))
  ok('equity = balance initially', st.data.account?.equity === '100000.00')
  ok('free margin = 100000.00', st.data.account?.free_margin === '100000.00')
  const led = await pool.query('SELECT * FROM trading_ledger WHERE user_id=$1 ORDER BY id', [uid])
  ok('exactly ONE funding ledger event', led.rows.length === 1 && led.rows[0].event === 'demo_funding' && D(led.rows[0].amount) === 100000)
  ok('ledger balance_after = 100000', D(led.rows[0].balance_after) === 100000)

  /* concurrent logins cannot double-fund */
  await Promise.all([login(w1), login(w1), login(w1)])
  const accs = await pool.query('SELECT * FROM demo_accounts WHERE user_id=$1', [uid])
  ok('concurrent logins → still one account', accs.rows.length === 1)
  const funds = await pool.query('SELECT * FROM trading_ledger WHERE user_id=$1 AND event=$2', [uid, 'demo_funding'])
  ok('still exactly one funding event', funds.rows.length === 1)

  global.C1 = cookie2; global.U1 = uid
}

/* ================= 2. MARKET LONG + PnL + CLOSE ================= */
{
  marketDataPrice(MKT, '50000')
  const order = { market: MKT, side: 'long', order_type: 'market', margin: 1000, leverage: 10 }
  const r = await j('POST', '/trading/order', order, C1, { 'Idempotency-Key': 'long-1' })
  ok('market long filled', r.status === 200 && r.data.position?.status === 'open', JSON.stringify(r.data).slice(0, 150))
  const pos = r.data.position
  const expEntry = fx(50000, 'long', 'open'); global.EXPE = expEntry            /* 50002.5 */
  ok('entry = mark + spread (50002.50)', near(pos?.entry_price, expEntry, 0.01), pos?.entry_price)
  ok('quantity = notional/entry ≈ 0.19999', near(pos?.quantity, 10000 / expEntry, 0.0001), pos?.quantity)
  ok('open fee = 0.035% of 10k notional (3.50)', near(pos?.open_fee, 3.5, 0.001), pos?.open_fee)

  const st = await j('GET', '/trading/state', null, C1)
  ok('balance = 100000 - 3.5 fee', near(st.data.account.balance, 99996.5, 0.01), st.data.account.balance)
  ok('used margin = 1000', st.data.account.used_margin === '1000.00')
  ok('free margin = 98996.50', near(st.data.account.free_margin, 98996.5, 0.01), st.data.account.free_margin)

  /* live PnL at 51000: qty × (mark − entry) — presentation uses the raw mark */
  marketDataPrice(MKT, '51000')
  const st2 = await j('GET', '/trading/state', null, C1)
  ok('unrealized PnL ≈ +199.95', near(st2.data.account.unrealized_pnl, (10000 / expEntry) * (51000 - expEntry), 0.02), st2.data.account.unrealized_pnl)
  ok('equity = balance + upnl', near(st2.data.account.equity, 99996.5 + (10000 / expEntry) * (51000 - expEntry), 0.03), st2.data.account.equity)
  ok('position in open panel', st2.data.positions.length === 1 && st2.data.positions[0].mark_price === '51000.00')

  /* duplicate submission returns the ORIGINAL result */
  const dup = await j('POST', '/trading/order', order, C1, { 'Idempotency-Key': 'long-1' })
  ok('duplicate order → duplicate flag, no second position', dup.data.duplicate === true, JSON.stringify(dup.data).slice(0, 100))
  const cnt = await pool.query('SELECT count(*)::int c FROM trading_positions WHERE user_id=$1', [U1])
  ok('still exactly one position', cnt.rows[0].c === 1)

  /* close at 51000 → exit = mark − spread; fee on INITIAL notional (3.5) */
  const expExit = fx(51000, 'long', 'close')
  const expNet = (10000 / expEntry) * (expExit - expEntry) - 10000 * FEE / 100; global.EXPN = expNet
  const close = await j('POST', `/trading/positions/${pos.id}/close`, {}, C1)
  if (!close.data?.position) console.log('CLOSE-DEBUG:', close.status, JSON.stringify(close.data).slice(0, 200))
  ok('close: exit = mark − spread (50997.50)', near(close.data.position.exit_price, expExit, 0.01), close.data.position.exit_price)
  ok('close fee on INITIAL notional (3.50)', near(close.data.position.close_fee, 3.5, 0.001), close.data.position.close_fee)
  ok('realized ≈ +195.47 (Gains math)', near(close.data.position.realized_pnl, expNet, 0.01), close.data.position.realized_pnl)
  const st3 = await j('GET', '/trading/state', null, C1)
  ok('balance = 99996.5 + net', near(st3.data.account.balance, 99996.5 + expNet, 0.02), st3.data.account.balance)
  ok('used margin released', st3.data.account.used_margin === '0.00')
  ok('open positions empty after close', st3.data.positions.length === 0)
  ok('history has the closed trade', st3.data.history.length === 1 && st3.data.history[0].exit_reason === 'manual')

  /* ledger reconciliation */
  const led = (await pool.query('SELECT * FROM trading_ledger WHERE user_id=$1 ORDER BY id', [U1])).rows
  ok('ledger: funding −3.5 open fee +net close', near(led[1].amount, -3.5, 0.001) && near(led[2].amount, expNet, 0.01), JSON.stringify(led.map(l => l.amount)))
  ok('balance_after chain is consistent', near(led[2].balance_after, 99996.5 + expNet, 0.02))
}

/* ================= 3. SHORT + LOSS ================= */
{
  marketDataPrice(MKT, '50000')
  const r = await j('POST', '/trading/order', { market: MKT, side: 'short', order_type: 'market', margin: 500, leverage: 5 }, C1, { 'Idempotency-Key': 'short-1' })
  ok('market short filled', r.data.position?.status === 'open')
  marketDataPrice(MKT, '50200')    /* price up → short loses 0.05*200 = 10 */
  const close = await j('POST', `/trading/positions/${r.data.position.id}/close`, {}, C1)
  /* short: entry 50000−spread, exit 50200+spread, fees 0.875/side (0.035% of 2500) */
  const sEntry = fx(50000, 'short', 'open'), sExit = fx(50200, 'short', 'close')
  const sNet = (2500 / sEntry) * (sEntry - sExit) - 2500 * FEE / 100
  const net = D(close.data.position.realized_pnl)
  ok('short loss accounting (Gains math)', near(net, sNet, 0.01), String(net))
  const st = await j('GET', '/trading/state', null, C1)
  const prevBal = 99996.5 + (global.EXPN || 0) - 0.875  /* short open fee 0.035% of 2500 */
  ok('balance reflects short loss + fees', near(st.data.account.balance, prevBal + sNet, 0.02), st.data.account.balance)
}

/* ================= 4. VALIDATION REJECTIONS ================= */
{
  const bad = [
    [{ market: 'NOPE/USD', side: 'long', order_type: 'market', margin: 100, leverage: 5 }, 'unknown_market', 'unknown market'],
    [{ market: MKT, side: 'long', order_type: 'market', margin: 0.5, leverage: 5 }, 'margin_too_small', 'margin below minimum'],
    [{ market: MKT, side: 'long', order_type: 'market', margin: 100, leverage: 500 }, 'leverage_exceeded', 'leverage above max (200×)'],
    [{ market: MKT, side: 'long', order_type: 'limit', margin: 100, leverage: 5 }, 'target_price_required', 'limit without target'],
    [{ market: MKT, side: 'long', order_type: 'market', margin: 999999999, leverage: 5 }, 'margin_too_large', 'margin above hard cap'],
    [{ market: MKT, side: 'long', order_type: 'market', margin: 100, leverage: 5, sl: 51000 }, 'sl_above_mark', 'SL above mark for long'],
    [{ market: MKT, side: 'long', order_type: 'market', margin: 100, leverage: 5, tp: 49000 }, 'tp_below_mark', 'TP below mark for long'],
  ]
  for (const [body, reason, name] of bad) {
    const r = await j('POST', '/trading/order', body, C1, { 'Idempotency-Key': 'bad-' + reason + Math.random() })
    ok('reject: ' + name, r.status === 400 && r.data.error === reason, JSON.stringify(r.data).slice(0, 80))
  }
}

/* ================= 5. LIMIT ORDER TRIGGER ================= */
{
  marketDataPrice(MKT, '50000')
  const r = await j('POST', '/trading/order', { market: MKT, side: 'long', order_type: 'limit', margin: 400, leverage: 5, target_price: 49500 }, C1, { 'Idempotency-Key': 'lim-1' })
  ok('limit order pending', r.data.pending === true && r.data.order?.status === 'pending')
  const st = await j('GET', '/trading/state', null, C1)
  ok('pending order visible', st.data.orders.length === 1)
  /* price falls to 49500 → trigger, filled at target */
  await new Promise(r2 => setTimeout(r2, 1500))
  marketDataPrice(MKT, '49500')
  await new Promise(r2 => setTimeout(r2, 2000))
  const st2 = await j('GET', '/trading/state', null, C1)
  ok('limit triggered → open position at 49500', st2.data.positions.some(p => p.entry_price === '49500.00'))
  /* cancel it */
  const p = st2.data.positions[0]
  await j('POST', `/trading/positions/${p.id}/close`, {}, C1)
}

/* ================= 6. STOP ORDER TRIGGER ================= */
{
  marketDataPrice(MKT, '50000')
  await j('POST', '/trading/order', { market: MKT, side: 'long', order_type: 'stop', margin: 400, leverage: 5, target_price: 50500 }, C1, { 'Idempotency-Key': 'stp-1' })
  marketDataPrice(MKT, '50500')
  await new Promise(r => setTimeout(r, 2000))
  const st = await j('GET', '/trading/state', null, C1)
  ok('stop triggered at 50500', st.data.positions.some(p => p.entry_price === '50500.00'))
  if (st.data.positions[0]) await j('POST', `/trading/positions/${st.data.positions[0].id}/close`, {}, C1)
}

/* ================= 7. SL / TP EXECUTION (server-side, no browser) ================= */
{
  marketDataPrice(MKT, '50000')
  const r = await j('POST', '/trading/order', { market: MKT, side: 'long', order_type: 'market', margin: 1000, leverage: 5, sl: 49500 }, C1, { 'Idempotency-Key': 'sl-1' })
  marketDataPrice(MKT, '49400')   /* crosses SL */
  await new Promise(r2 => setTimeout(r2, 2000))
  const st = await j('GET', '/trading/state', null, C1)
  ok('SL executed (exit_reason=sl)', st.data.history.some(h => h.exit_reason === 'sl'))
  ok('SL exit = mark − spread', near(st.data.history.find(h => h.exit_reason === 'sl')?.exit_price, fx(49400, 'long', 'close'), 0.01))

  marketDataPrice(MKT, '50000')
  const r2 = await j('POST', '/trading/order', { market: MKT, side: 'long', order_type: 'market', margin: 1000, leverage: 5, tp: 50800 }, C1, { 'Idempotency-Key': 'tp-1' })
  marketDataPrice(MKT, '50900')
  await new Promise(r3 => setTimeout(r3, 2000))
  const st2 = await j('GET', '/trading/state', null, C1)
  ok('TP executed (exit_reason=tp)', st2.data.history.some(h => h.exit_reason === 'tp'))
}

/* ================= 8. LIQUIDATION ================= */
{
  marketDataPrice(MKT, '50000')
  /* margin 100, lev 50 → notional 5000, qty 0.1; liquidation at ~10% margin = loss ≥ 90 */
  await j('POST', '/trading/order', { market: MKT, side: 'long', order_type: 'market', margin: 100, leverage: 50 }, C1, { 'Idempotency-Key': 'liq-1' })
  marketDataPrice(MKT, '49900')   /* −0.1*100 = −10 not yet */
  await new Promise(r => setTimeout(r, 1500))
  let st = await j('GET', '/trading/state', null, C1)
  ok('still open before liquidation level', st.data.positions.length === 1)
  marketDataPrice(MKT, '49100')   /* −0.1*900 = −90 ≥ 90% of margin → liquidation */
  await new Promise(r => setTimeout(r, 2000))
  st = await j('GET', '/trading/state', null, C1)
  const liq = st.data.history.find(h => h.exit_reason === 'liquidation')
  ok('liquidated when loss hit maintenance level', !!liq, JSON.stringify(st.data.history.map(h => h.exit_reason)))
  ok('status = liquidated', liq?.status === 'liquidated')
}

/* ================= 9. OWNERSHIP + SUSPENSION ================= */
{
  const c2 = await login(w2)
  const u2 = (await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [w2.address.toLowerCase()])).rows[0].id
  /* user2 sees only own (empty) account */
  const st2 = await j('GET', '/trading/state', null, c2)
  ok('other user has own 100k account (empty)', st2.data.account.balance === '100000.00' && st2.data.positions.length === 0)
  /* user2 cannot close user1's position */
  marketDataPrice(MKT, '50000')
  const r1 = await j('POST', '/trading/order', { market: MKT, side: 'long', order_type: 'market', margin: 100, leverage: 5 }, C1, { 'Idempotency-Key': 'own-1' })
  const pid = r1.data.position.id
  const steal = await j('POST', `/trading/positions/${pid}/close`, {}, c2)
  ok('cannot close another user\'s position (404)', steal.status === 404, String(steal.status))
  const still = await j('GET', '/trading/state', null, C1)
  ok('position still open', still.data.positions.length === 1)
  /* suspended user cannot trade */
  await pool.query('UPDATE openfund_users SET status=$2 WHERE id=$1', [u2, 'suspended'])
  const trad = await j('POST', '/trading/order', { market: MKT, side: 'long', order_type: 'market', margin: 100, leverage: 5 }, c2, { 'Idempotency-Key': 'susp-1' })
  ok('suspended user cannot trade (403)', trad.status === 403, String(trad.status))
  await pool.query('UPDATE openfund_users SET status=$2 WHERE id=$1', [u2, 'active'])
  await j('POST', `/trading/positions/${pid}/close`, {}, C1)
}

/* ================= 10. BALANCE RECONCILIATION ================= */
{
  const acc = (await pool.query('SELECT * FROM demo_accounts WHERE user_id=$1', [U1])).rows[0]
  const led = (await pool.query('SELECT * FROM trading_ledger WHERE user_id=$1 ORDER BY id DESC LIMIT 1', [U1])).rows[0]
  ok('account balance = last ledger balance_after', D(acc.balance) === D(led.balance_after), `${acc.balance} vs ${led.balance_after}`)
  const st = await j('GET', '/trading/state', null, C1)
  ok('final state consistent (no open positions)', st.data.positions.length === 0 && st.data.orders.length === 0)
  if (failed === 0) {
    await clean(U1)
    await clean((await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [w2.address.toLowerCase()])).rows[0].id)
  } else {
    console.log('--- FAILURE DIAGNOSTICS (DB kept for inspection) ---')
    const pos = (await pool.query('SELECT market, side, entry_price, exit_price, exit_reason, realized_pnl, status FROM trading_positions ORDER BY opened_at')).rows
    console.log('positions:', JSON.stringify(pos, null, 1))
    const led = (await pool.query('SELECT event, amount, balance_after FROM trading_ledger WHERE user_id=$1 ORDER BY id', [U1])).rows
    console.log('ledger:', JSON.stringify(led, null, 1))
  }
}

/* helper: inject a deterministic price through the backend (test seam) */
function marketDataPrice(symbol, price) {
  /* the engine reads marks from the server process; the injection seam is
     exercised through a test-only debug endpoint when SIM_TEST_MODE is on */
  fetch(BASE + '/internal/inject-price', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, price })
  }).catch(() => {})
}

console.log(`\n${passed} passed, ${failed} failed`)
await pool.end()
process.exit(failed ? 1 : 0)
