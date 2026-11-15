/* Local runtime only. The fixture never creates a real payment. */
const assert = require('node:assert/strict')
const path = require('node:path')
const { createRequire } = require('node:module')
const { randomUUID } = require('node:crypto')
const { chromium } = require('playwright')
const { Pool } = createRequire(path.resolve(__dirname, '../apps/backend/package.json'))('pg')
const base = new URL(process.env.TEST_FRONTEND_URL || 'http://localhost:8291')
const dbUrl = new URL(process.env.DATABASE_URL)
const token = process.env.ADMIN_API_TOKEN
if (!['localhost', '127.0.0.1'].includes(base.hostname) || !/test|audit|_ci/.test(dbUrl.pathname) || !token)
  throw new Error('Payout browser acceptance requires a local runtime, isolated database and test operator access.')

async function main() {
  const pool = new Pool({ connectionString: dbUrl.toString() })
  const browser = await chromium.launch()
  try {
    const suffix = randomUUID()
    const wallet = '0x' + suffix.replaceAll('-', '') + '00000001'
    const row = async (sql, values) => (await pool.query(sql, values)).rows[0]
    const user = await row('INSERT INTO openfund_users(wallet_address) VALUES ($1) RETURNING id', [wallet])
    const plan = await row("INSERT INTO challenge_plans(slug,name,status) VALUES ($1,'Isolated payout browser check','inactive') RETURNING id", [suffix])
    const account = await row("INSERT INTO demo_accounts(user_id,account_type,currency,balance) VALUES ($1,'challenge','USD',10000) RETURNING id", [user.id])
    const challenge = await row(`INSERT INTO openfund_challenges(user_id,challenge_plan_id,demo_account_id,account_size_usd)
      VALUES ($1,$2,$3,10000) RETURNING id`, [user.id, plan.id, account.id])
    const payout = await row(`INSERT INTO withdrawal_requests(user_id,challenge_id,amount_usd,kind,recipient_wallet,eligibility)
      VALUES ($1,$2,23.45,'reward',$3,'{"reward":"23.45"}') RETURNING id`, [user.id, challenge.id, wallet])
    assert.equal((await fetch(new URL('/admin/withdrawals', base))).status, 403)

    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await page.goto(new URL('/en/operations/payouts', base).href)
    await page.getByLabel('Operator token').fill(token)
    await page.getByLabel('Operator', { exact: true }).fill('browser-acceptance')
    await page.getByRole('button', { name: 'Refresh' }).click()
    await page.getByRole('button', { name: new RegExp(wallet) }).click()
    await page.getByRole('heading', { name: 'Payout details' }).waitFor()
    await page.getByLabel('Message', { exact: true }).fill('Isolated test explanation for the rejection.')
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/audit') && response.ok()),
      page.getByRole('button', { name: 'Reject', exact: true }).click(),
    ])
    const result = await row('SELECT status,note FROM withdrawal_requests WHERE id=$1', [payout.id])
    assert.equal(result.status, 'rejected')
    assert.match(result.note, /Isolated test explanation/)
    console.log('Payout operations browser check passed.')
  } finally {
    await browser.close()
    await pool.end()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
