/* Journey acceptance gaps (workstream H) — real local SIWE/PostgreSQL and the
 * real evaluation engine, disposable EIP-6963 signer, SIM_TEST_MODE seams only.
 * No blockchain writes, no payments.
 *
 *  J1 SIWE message names Arbitrum One (chain id 42161), session restore after
 *     reload, site -> terminal navigation keeps the session, an expired server
 *     session falls back to signed-out (401) and a new sign-in recovers it.
 *  J2 one-phase daily-loss breach -> failed (daily_loss_breach only), orders
 *     refused afterwards, violation shown on the dashboard.
 *  J3 one-phase maximum-loss breach -> failed (maximum_loss_breach recorded).
 *  J4 the challenge_failed notification reaches the trader inbox.
 *
 * The conduct clock is pinned to a weekday open-market instant so conduct
 * rules never depend on when the suite runs.
 * Usage: TEST_FRONTEND_URL=http://localhost:8471 DATABASE_URL=postgres://localhost:5432/openfund_journey_test \
 *        node e2e/test-journey-acceptance.cjs */
const { chromium } = require('playwright')
const { createRequire } = require('node:module')
const path = require('node:path')
const { walletInitScript, connect, signIn } = require('./helpers/wallet-ui.cjs')
const backend = createRequire(path.resolve(__dirname, '../apps/backend/package.json'))
const { generatePrivateKey, privateKeyToAccount } = backend('viem/accounts')
const { Pool } = backend('pg')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8471').replace(/\/$/, '')
const db = new URL(process.env.DATABASE_URL || '')
if (!['localhost', '127.0.0.1'].includes(new URL(BASE).hostname) || !['localhost', '127.0.0.1'].includes(db.hostname) || !/(_test|_ci)$/.test(db.pathname))
  throw new Error('A local runtime and a disposable *_test/*_ci database are required')

const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS - ' : 'FAIL - ') + name + (ok || !detail ? '' : ' :: ' + String(detail).slice(0, 300))) }
const internal = (endpoint, body) => fetch(BASE + '/internal' + endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())

async function main() {
  const pool = new Pool({ connectionString: db.href })
  const browser = await chromium.launch()
  const wallet = privateKeyToAccount(generatePrivateKey())
  const signed = []
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.exposeFunction('purchaseSign', ({ raw }) => { signed.push(Buffer.from(String(raw).slice(2), 'hex').toString('utf8')); return wallet.signMessage({ message: { raw } }) })
  await page.addInitScript(walletInitScript, wallet.address)
  /* cookie-bearing same-origin calls; every write carries an Idempotency-Key */
  const call = (url, body, method) => page.evaluate(async ({ url, body, method }) => {
    const r = await fetch(url, { method: method || (body ? 'POST' : 'GET'), credentials: 'include',
      headers: { 'content-type': 'application/json', ...(body ? { 'Idempotency-Key': crypto.randomUUID() } : {}) }, body: body ? JSON.stringify(body) : undefined })
    return { status: r.status, data: await r.json().catch(() => null) }
  }, { url, body, method })
  const buy = async (planSlug, label) => {
    const order = await call('/purchases/orders', { planSlug, accountSize: 5000, idempotencyKey: 'journey-' + label + '-' + Date.now() })
    const confirm = await call('/internal/confirm-order', { orderId: order.data?.order?.id, txHash: '0x' + (Date.now().toString(16) + label.length).padStart(64, '0') })
    return confirm.data?.challengeId
  }
  const status = async id => (await pool.query('SELECT status FROM openfund_challenges WHERE id=$1', [id])).rows[0]?.status
  await internal('/test-clock', { at: '2026-11-18T12:00:00.000Z' })
  try {
    /* ---------- J1 onboarding and session ---------- */
    await page.goto(BASE + '/en/prop/dashboard')
    await connect(page); await signIn(page)
    check('SIWE sign-in creates a session', (await call('/auth/me')).status === 200)
    check('the SIWE message is bound to Arbitrum One (chain id 42161)', signed.some(m => /Chain ID: 42161\b/.test(m)), signed.join('\n---\n'))
    await page.reload(); await signIn(page)
    check('session restores after a reload without a new signature', signed.length === 1 && (await call('/auth/me')).status === 200, `signatures=${signed.length}`)
    await page.goto(BASE + '/en'); await page.goto(BASE + '/en/prop/trade')
    check('site -> terminal navigation keeps the session', (await call('/auth/me')).status === 200)
    await pool.query("UPDATE auth_sessions SET expires_at = now() - interval '1 minute' WHERE user_id = (SELECT id FROM openfund_users WHERE lower(wallet_address)=lower($1))", [wallet.address])
    await page.goto(BASE + '/en/prop/dashboard')
    await page.getByRole('button', { name: 'Sign in', exact: true, includeHidden: true }).first().waitFor({ state: 'attached', timeout: 20000 })
    check('an expired session is reported signed-out (401), not as signed-in', (await call('/auth/me')).status === 401)
    await signIn(page)
    check('signing in again after expiry recovers a working session', (await call('/auth/me')).status === 200 && signed.length === 2)

    /* ---------- J2/J3 evaluation fail paths ---------- */
    const failCase = async (label, dropTo, expectRule, forbidRule) => {
      const id = await buy('one-phase', label)
      check(`${label}: challenge provisioned through the test seam`, !!id)
      await call('/challenges/' + id + '/start', {})
      const account = (await call('/challenges/' + id)).data?.accountId
      await call('/internal/inject-price', { symbol: 'BTC/USD', price: 50000 })
      const open = await call('/trading/order?account=' + account, { market: 'BTC/USD', side: 'long', margin: 2000, leverage: 5 })
      check(`${label}: position opens on the challenge account`, open.status === 200, JSON.stringify(open.data).slice(0, 200))
      await call('/internal/inject-price', { symbol: 'BTC/USD', price: dropTo })
      await page.goto(BASE + '/en/prop/dashboard?account=' + id)
      const failed = await page.waitForFunction(() => document.querySelector('.of-challenge-panel')?.getAttribute('data-status') === 'failed', null, { timeout: 30000 }).then(() => true, () => false)
      check(`${label}: the engine fails the challenge and the dashboard shows it`, failed)
      const view = (await call('/challenges/' + id)).data
      const rules = (view?.events || []).filter(e => e.kind === 'violation').flatMap(e => (e.detail?.violations || e.payload?.violations || []).map(v => v.rule))
      check(`${label}: ${expectRule} is recorded`, rules.includes(expectRule), rules.join())
      if (forbidRule) check(`${label}: ${forbidRule} is not recorded`, !rules.includes(forbidRule), rules.join())
      check(`${label}: the violation is shown on the dashboard`, await page.locator('.of-challenge-panel [role=alert]').count() > 0)
      const later = await call('/trading/order?account=' + account, { market: 'BTC/USD', side: 'long', margin: 100, leverage: 1 })
      check(`${label}: trading is refused after the failure`, later.status >= 400, `${later.status} ${JSON.stringify(later.data)}`)
    }
    /* 0.2 BTC: −200 breaches the 3 % daily limit (150) but not the 12 % maximum (600) */
    await failCase('daily loss', 49000, 'daily_loss_breach', 'maximum_loss_breach')
    /* −800 breaches both; the maximum-loss rule must be recorded */
    await failCase('maximum loss', 46000, 'maximum_loss_breach')

    /* ---------- J5 minimum trading days gate the phase pass ----------
       Trading days are distinct UTC+3 fill days (trading_positions.opened_at,
       database time, not the conduct clock). Earlier days are simulated by
       moving this disposable account's own fills back one and two days. */
    {
      const id = await buy('standard', 'trading-days')
      await call('/challenges/' + id + '/start', {})
      const account = (await call('/challenges/' + id)).data?.accountId
      const roundTrip = async (exit) => {
        await call('/internal/inject-price', { symbol: 'BTC/USD', price: 50000 })
        const open = await call('/trading/order?account=' + account, { market: 'BTC/USD', side: 'long', margin: 2000, leverage: 5 })
        await call('/internal/inject-price', { symbol: 'BTC/USD', price: exit })
        const closed = await call('/trading/positions/' + open.data?.position?.id + '/close?account=' + account, { fraction: 1 })
        return open.status === 200 && closed.status === 200
      }
      const backdate = days => pool.query(`UPDATE trading_positions SET opened_at = opened_at - ($2::int * interval '1 day')
        WHERE account_id=$1 AND opened_at > now() - interval '1 hour'`, [account, days])
      /* +2,400 per BTC on 0.2 BTC ≈ +480 gross: above the 8 % phase-1 target (400) */
      check('trading days: a target-reaching trade fills and closes', await roundTrip(52400))
      const view = (await call('/challenges/' + id)).data
      check('trading days: target reached on day 1 does not pass (1 of 3 days)', await status(id) === 'started' && view?.metrics?.tradingDays === 1, JSON.stringify(view?.metrics || {}).slice(0, 200))
      await page.goto(BASE + '/en/prop/dashboard?account=' + id)
      check('trading days: the dashboard shows the minimum-days progress', await page.getByText('min trading days: 1/3').first().waitFor({ timeout: 15000 }).then(() => true, () => false))
      await backdate(2)
      await roundTrip(50000); await backdate(1)
      check('trading days: two days still does not pass', await status(id) === 'started')
      await roundTrip(50000)
      let passed = false
      for (let i = 0; i < 10 && !passed; i++) { passed = await status(id) === 'passed'; if (!passed) await page.waitForTimeout(1000) }
      const stage2 = (await pool.query("SELECT status FROM openfund_challenges WHERE parent_challenge_id=$1 AND stage=2", [id])).rows[0]
      check('trading days: the third trading day passes phase 1 and starts phase 2', passed && stage2?.status === 'started', JSON.stringify(stage2))
    }

    /* ---------- J6 checkout: localized states, responsiveness, order recovery (no payment) ---------- */
    for (const [locale, dir] of [['fa', 'rtl'], ['ar', 'rtl'], ['en', 'ltr']]) {
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(`${BASE}/${locale}/checkout?plan=standard&size=10000`)
        await page.locator('.of-co-total b').first().waitFor({ timeout: 15000 }).catch(() => {})
        const state = await page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, total: document.querySelector('.of-co-total b')?.textContent }))
        check(`checkout ${locale} @${width}px: ${dir}, server price, no horizontal overflow`, state.dir === dir && state.lang.startsWith(locale.slice(0, 2)) && /\$80\b/.test(state.total || '') && state.overflow <= 1, JSON.stringify(state))
      }
    }
    await page.setViewportSize({ width: 390, height: 900 })
    const pendingOrders = async () => ((await call('/purchases/history')).data?.orders || []).filter(o => o.status === 'pending')
    const pending = await call('/purchases/orders', { planSlug: 'standard', accountSize: 10000, idempotencyKey: 'journey-recover-' + Date.now() })
    const before = (await pendingOrders()).length
    await page.goto(`${BASE}/fa/checkout?order=${pending.data?.order?.id}`)
    const recovered = await page.locator('.of-co-state').first().waitFor({ timeout: 15000 }).then(() => true, () => false)
    await page.reload()
    const again = await page.locator('.of-co-state').first().waitFor({ timeout: 15000 }).then(() => true, () => false)
    check('checkout fa @390px: a pending order link recovers the order state, also after a refresh', recovered && again && page.url().includes(pending.data?.order?.id))
    check('checkout: recovery never creates a second order', (await pendingOrders()).length === before, `${before}`)
    await page.setViewportSize({ width: 1366, height: 900 })

    /* ---------- J4 notifications (relay runs every 30 s) ---------- */
    let seen = false
    for (let i = 0; i < 10 && !seen; i++) {
      seen = ((await call('/notifications')).data?.notifications || []).some(n => n.kind === 'challenge_failed')
      if (!seen) await page.waitForTimeout(5000)
    }
    await page.goto(BASE + '/en/prop/inbox')
    check('challenge_failed notification is delivered and shown in the inbox', seen && await page.getByText('Your challenge ended after a rule breach.').first().waitFor({ timeout: 15000 }).then(() => true, () => false))
    check('no browser errors during the journeys', errors.length === 0, errors.join('\n'))
  } finally {
    await internal('/test-clock', { at: null }).catch(() => {})
    await browser.close(); await pool.end()
  }
  const failed = results.filter(r => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) process.exitCode = 1
}
main().catch(e => { console.error(e); process.exitCode = 1 })
