import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createBackstage } from '../apps/backstage/operations/server.js'
import { createVerifier } from '../apps/backstage/operations/password.js'

const { Pool } = createRequire(new URL('../apps/backend/package.json', import.meta.url))('pg')
const db = new URL(process.env.DATABASE_URL)
const upstream = new URL(process.env.TEST_BACKEND_URL || 'http://localhost:8314')
const loopback = url => ['localhost', '127.0.0.1'].includes(url.hostname)
if (!loopback(db) || !loopback(upstream) || !/(?:_test|_ci)$/.test(db.pathname) || !process.env.ADMIN_API_TOKEN)
  throw new Error('Backstage browser acceptance requires an isolated local backend and database')
const pool = new Pool({ connectionString: db.href })
const owner = 'acceptance-owner'
const password = randomBytes(20).toString('base64url')
const port = Number(process.env.BACKSTAGE_TEST_PORT || 8315)
const origin = 'http://127.0.0.1:' + port
const server = createBackstage({ origin, backend: upstream.origin, cms: 'http://127.0.0.1:8055', owner,
  verifier: await createVerifier(password), credential: process.env.ADMIN_API_TOKEN })
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
let browser
try {
  const row = async (sql, args) => (await pool.query(sql, args)).rows[0]
  const address = '0x' + randomBytes(20).toString('hex')
  const trader = await row('INSERT INTO openfund_users (wallet_address,display_name) VALUES ($1,$2) RETURNING id', [address, 'Browser fixture'])
  const plan = await row("SELECT id FROM challenge_plans WHERE slug='standard'")
  const challenge = await row(`INSERT INTO openfund_challenges (user_id,challenge_plan_id,status,stage,account_size_usd,rules_snapshot,completed_at)
    VALUES ($1,$2,'passed',2,10000,'{"phases":2}',now()) RETURNING id`, [trader.id, plan.id])

  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, colorScheme: 'dark' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(origin)
  assert.equal(await page.evaluate(async () => (await fetch('/api/users')).status), 401)
  await page.getByLabel('Owner identity').fill(owner)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('heading', { name: 'Overview' }).waitFor()
  await page.locator('aside').getByRole('link', { name: 'Traders' }).click()
  await page.getByRole('textbox', { name: 'Search traders by wallet or name' }).fill(address)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('link', { name: address }).click()
  await page.getByRole('heading', { name: 'Browser fixture' }).waitFor()
  assert.equal(await page.getByText(address, { exact: true }).getAttribute('dir'), 'ltr')

  await page.getByRole('link', { name: challenge.id, exact: true }).click()
  await page.getByRole('heading', { name: 'Frozen rules' }).waitFor()
  await page.getByRole('heading', { name: 'Recent positions' }).waitFor()
  await page.locator('aside').getByRole('link', { name: 'Final-pass reviews' }).click()
  const review = page.getByRole('row').filter({ hasText: challenge.id })
  await review.getByRole('button', { name: 'Approve' }).click()
  await page.getByLabel('Decision note').fill('Verified final pass in browser acceptance')
  await page.getByRole('dialog').getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Confirm decision' }).click()
  await page.getByText('Decision recorded.').waitFor()
  const decision = await row('SELECT decision,funded_challenge_id FROM challenge_reviews WHERE challenge_id=$1', [challenge.id])
  assert.equal(decision.decision, 'approved')
  assert.ok(decision.funded_challenge_id)

  const submission = await fetch(new URL('/support/messages', upstream), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Browser fixture', email: address.slice(2, 18) + '@example.test',
      department: 'support', subject: 'Browser support request', message: 'A support request from the isolated acceptance test.',
      privacyConsent: true, startedAt: Date.now() - 6000, locale: 'en' }),
  })
  assert.ok(submission.ok, await submission.clone().text())
  const contact = await submission.json()
  await page.locator('aside').getByRole('link', { name: 'Support inbox' }).click()
  await page.getByRole('link', { name: contact.reference }).click()
  await page.getByRole('heading', { name: 'Browser support request' }).waitFor()
  await page.getByRole('button', { name: 'In progress', exact: true }).click()
  await page.getByLabel('Decision note').fill('Operator-only note from browser acceptance')
  await page.getByRole('dialog').getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Confirm decision' }).click()
  await page.getByText('Operator-only note from browser acceptance', { exact: false }).waitFor()
  const handled = await row('SELECT status,internal_notes FROM support_messages WHERE reference=$1', [contact.reference])
  assert.equal(handled.status, 'in_progress')
  assert.match(handled.internal_notes, /Operator-only note/)
  assert.equal((await fetch(new URL('/admin/support/messages/' + contact.reference, upstream))).status, 403)

  if (process.env.BACKSTAGE_TEST_CONTROLLED === '1') {
    await page.locator('aside').getByRole('link', { name: 'Coupons' }).click()
    for (const [label, profile] of [['Instant Funding', 'instant'], ['Two-Step', 'standard']]) {
      const card = page.locator('article').filter({ has: page.getByRole('heading', { name: label, exact: true }) })
      await card.getByRole('button', { name: 'Issue entitlement' }).click()
      await page.getByRole('dialog').getByLabel('Wallet address').fill(address)
      await page.getByRole('dialog').getByLabel('Password').fill(password)
      await page.getByRole('dialog').getByRole('button', { name: 'Issue entitlement' }).click()
      await page.getByText('Generated code', { exact: false }).waitFor()
      const issued = await row("SELECT coupon_id,user_id FROM controlled_challenge_coupons WHERE profile=$1", [profile])
      assert.equal(issued.user_id, trader.id)
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
    }
    const issue = await row("SELECT coupon_id FROM controlled_challenge_coupons WHERE profile='instant'")
    const account = await row("INSERT INTO demo_accounts (user_id,account_type,currency,balance) VALUES ($1,'challenge','USD',10000) RETURNING id", [trader.id])
    const controlled = await row(`INSERT INTO openfund_challenges (user_id,challenge_plan_id,demo_account_id,rules_snapshot,stage,status,account_size_usd)
      VALUES ($1,$2,$3,$4,0,'started',10000) RETURNING id`, [trader.id, plan.id, account.id, JSON.stringify({ controlledTest: { profile: 'instant', couponId: issue.coupon_id } })])
    const payout = await row(`INSERT INTO withdrawal_requests (user_id,challenge_id,amount_usd,kind,test_mode)
      VALUES ($1,$2,15,'reward',true) RETURNING id`, [trader.id, controlled.id])
    await page.locator('aside').getByRole('link', { name: 'Payout requests' }).click()
    await page.getByLabel('Scope').selectOption('test')
    const target = page.getByRole('row').filter({ hasText: payout.id })
    for (const action of ['Approve', 'Complete simulated settlement']) {
      await target.getByRole('button', { name: action, exact: true }).click()
      await page.getByLabel('Decision note').fill('Reviewed the test payout history')
      await page.getByRole('dialog').getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Confirm decision' }).click()
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
    }
    await target.getByRole('link', { name: payout.id }).click()
    await page.getByRole('heading', { name: 'Payout correspondence' }).waitFor()
    await page.getByRole('button', { name: 'Reply', exact: true }).click()
    await page.getByRole('dialog').getByLabel('Message').fill('Your test review is complete.')
    await page.getByRole('dialog').getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Confirm decision' }).click()
    await page.getByText('Your test review is complete.', { exact: true }).waitFor()
    const settled = await row('SELECT status,payout_ref,payment_evidence FROM withdrawal_requests WHERE id=$1', [payout.id])
    assert.deepEqual(settled, { status: 'simulated_settled', payout_ref: null, payment_evidence: null })
  }
  await page.locator('aside').getByRole('link', { name: 'Overview' }).click()
  await page.getByRole('heading', { name: 'Action queue' }).waitFor()
  await page.locator('main > [role=status]').waitFor({ state: 'hidden' })
  if (process.env.OUTPUT_DIR) {
    await mkdir(process.env.OUTPUT_DIR, { recursive: true })
    await page.screenshot({ path: join(process.env.OUTPUT_DIR, 'backstage-overview-en.png') })
  }
  await page.getByLabel('Language').selectOption('fa')
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl')
  await page.reload()
  await page.getByRole('heading', { name: 'نمای کلی', exact: true }).waitFor()
  assert.equal(await page.locator('html').getAttribute('lang'), 'fa')
  await page.locator('main > [role=status]').waitFor({ state: 'hidden' })
  if (process.env.OUTPUT_DIR) await page.screenshot({ path: join(process.env.OUTPUT_DIR, 'backstage-overview-fa.png') })
  await page.setViewportSize({ width: 480, height: 800 })
  await page.getByRole('button', { name: 'ناوبری' }).click()
  await page.locator('aside').getByRole('link', { name: 'معامله‌گران' }).click()
  await page.getByRole('heading', { name: 'معامله‌گران' }).waitFor()
  await page.getByRole('button', { name: 'خروج', exact: true }).click()
  await page.getByRole('heading', { name: 'دسترسی مالک' }).waitFor()
  assert.equal(await page.evaluate(async () => (await fetch('/api/users')).status), 401)
  assert.deepEqual(errors, [])
  console.log('Backstage browser acceptance passed')
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
  await pool.end()
}
