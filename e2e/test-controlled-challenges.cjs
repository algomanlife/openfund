const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const { randomUUID } = require('node:crypto')
const { chromium } = require('playwright')
const { walletInitScript, connect, signIn } = require('./helpers/wallet-ui.cjs')
const backend = createRequire(path.resolve(__dirname, '../apps/backend/package.json'))
const { generatePrivateKey, privateKeyToAccount } = backend('viem/accounts')
const { Pool } = backend('pg')
const base = new URL(process.env.TEST_FRONTEND_URL || 'http://localhost:8296')
const db = new URL(process.env.DATABASE_URL)
const token = process.env.ADMIN_API_TOKEN
if (!['localhost', '127.0.0.1'].includes(base.hostname) || !['localhost', '127.0.0.1'].includes(db.hostname) ||
    !db.pathname.endsWith('_test') || !token) throw new Error('A local runtime, fresh test database and test operator token are required')

const result = async response => {
  const body = await response.json()
  assert.ok(response.ok, JSON.stringify(body))
  return body
}
const admin = (endpoint, body) => fetch(new URL('/admin' + endpoint, base), {
  method: 'POST', headers: { authorization: `Bearer ${token}`, 'x-admin-actor': 'browser-acceptance', 'content-type': 'application/json' },
  body: JSON.stringify(body),
}).then(result)
const inject = price => fetch(new URL('/internal/inject-price', base), {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(process.env.INTERNAL_API_TOKEN ? { authorization: `Bearer ${process.env.INTERNAL_API_TOKEN}` } : {}) },
  body: JSON.stringify({ symbol: 'BTC/USD', price, metadata: { base: 'BTC', group: 'crypto', maxLeverage: 100 } }),
}).then(result)
const shot = async (page, name) => {
  if (!process.env.OUTPUT_DIR) return
  fs.mkdirSync(process.env.OUTPUT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(process.env.OUTPUT_DIR, name + '.png'), animations: 'disabled' })
}

async function main() {
  const pool = new Pool({ connectionString: db.toString() })
  const browser = await chromium.launch()
  const row = async (sql, args) => (await pool.query(sql, args)).rows[0]
  try {
    for (const profile of ['instant', 'standard']) {
      const wallet = privateKeyToAccount(generatePrivateKey())
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
      const page = await context.newPage()
      await page.exposeFunction('purchaseSign', ({ raw }) => wallet.signMessage({ message: { raw } }))
      await page.addInitScript(walletInitScript, wallet.address)
      await page.goto(new URL(`/en/checkout?plan=${profile}&size=10000`, base).href)
      await connect(page)
      await signIn(page)
      const coupon = await admin('/coupons/controlled', { profile, walletAddress: wallet.address })
      await page.getByLabel('Email for the receipt').fill('controlled-trader@example.test')
      await page.locator('.of-co-accept input').check()
      await page.locator('#of-coupon').fill(coupon.code)
      await page.getByRole('button', { name: 'Apply', exact: true }).click()
      await page.getByText('With this coupon the challenge is activated without payment.').waitFor()
      await page.getByRole('button', { name: 'Activate challenge' }).click()
      await page.locator('.of-co-receipt').waitFor({ timeout: 15000 })
      const challenge = await row(`SELECT c.* FROM openfund_challenges c
        JOIN purchase_orders o ON o.id=c.purchase_order_id WHERE o.coupon_id=$1 AND NOT o.payment_required`, [coupon.id])
      assert.equal(challenge.status, profile === 'instant' ? 'started' : 'created')
      assert.equal(challenge.rules_snapshot.controlledTest.profile, profile)
      console.log(`${profile} zero-payment activation through checkout passed.`)
      if (profile === 'instant') {
        await context.close()
        continue
      }

      const post = async (url, body) => {
        const r = await page.evaluate(async ({ url, body }) => {
          const response = await fetch(url, { method: 'POST', credentials: 'include',
            headers: { 'content-type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(body) })
          return { status: response.status, data: await response.json() }
        }, { url, body })
        assert.equal(r.status, 200, JSON.stringify(r.data))
        return r.data
      }
      const trade = async id => {
        const account = await row('SELECT demo_account_id FROM openfund_challenges WHERE id=$1', [id])
        await inject(50000)
        const opened = await post('/trading/order?account=' + account.demo_account_id, {
          market: 'BTC/USD', side: 'long', order_type: 'market', margin: 500, leverage: 10,
        })
        assert.ok(opened.position, JSON.stringify(opened))
        await inject(51400)
        const closed = await post('/trading/positions/' + opened.position.id + '/close', { fraction: 1, idempotencyKey: randomUUID() })
        assert.equal(closed.position.status, 'closed')
      }
      await post('/challenges/' + challenge.id + '/start', {})
      await trade(challenge.id)
      const phase2 = await row("SELECT id FROM openfund_challenges WHERE parent_challenge_id=$1 AND stage=2 AND status='started'", [challenge.id])
      await trade(phase2.id)
      const { fundedChallengeId } = await admin('/rewards/reviews/' + phase2.id, { decision: 'approve', note: 'Controlled evaluation verified' })
      await page.goto(new URL('/en/prop/withdrawals', base).href)
      await page.getByRole('radio', { name: /Weekly/ }).first().check()
      await page.getByRole('button', { name: 'Confirm cycle and activate' }).click()
      await page.getByText('Realized net profit', { exact: true }).first().waitFor()
      await trade(fundedChallengeId)
      await page.reload()
      await page.getByRole('button', { name: 'Request simulated payout' }).click()
      await page.getByRole('button', { name: 'Messages', exact: true }).waitFor()

      const operator = await browser.newPage({ viewport: { width: 1280, height: 900 } })
      await operator.goto(new URL('/en/operations/payouts', base).href)
      await operator.getByLabel('Operator token').fill(token)
      await operator.getByLabel('Operator', { exact: true }).fill('browser-acceptance')
      await operator.getByLabel('Payout scope').selectOption('test')
      await operator.getByRole('button', { name: 'Refresh' }).click()
      await operator.getByRole('button', { name: new RegExp(wallet.address, 'i') }).click()
      await operator.getByRole('button', { name: 'Approve', exact: true }).click()
      const simulate = operator.getByRole('button', { name: 'Complete simulated settlement' })
      await simulate.waitFor()
      await shot(operator, 'operator-test-payout')
      await Promise.all([operator.waitForResponse(response => response.url().endsWith('/review') && response.ok()), simulate.click()])
      const { status, payout_ref, payment_evidence } = await row(
        "SELECT status,payout_ref,payment_evidence FROM withdrawal_requests WHERE challenge_id=$1 AND test_mode", [fundedChallengeId])
      assert.deepEqual({ status, payout_ref, payment_evidence }, { status: 'simulated_settled', payout_ref: null, payment_evidence: null })
      await page.reload()
      await page.getByText('Simulated settlement completed', { exact: true }).waitFor()
      await shot(page, 'trader-simulated-settlement')
      console.log('Two-Step trading, review and simulated settlement verified through the React runtime.')
      await operator.close()
      await context.close()
    }
  } finally {
    await browser.close()
    await pool.end()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
