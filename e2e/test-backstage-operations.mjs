/* Backstage operations sections — browser acceptance in Chromium against an
 * isolated local backend and database. Covers the owner workflows added for
 * launch completion: user suspension, the coupon wizard, the expense wizard,
 * support thread replies with trader notification, partner application
 * review, global search, the unified audit viewer and the read-only risk
 * board, in English (LTR) and Persian (RTL). */
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
const owner = 'operations-owner'
const password = randomBytes(20).toString('base64url')
const port = Number(process.env.BACKSTAGE_TEST_PORT || 8316)
const origin = 'http://127.0.0.1:' + port
const server = createBackstage({ origin, backend: upstream.origin, cms: 'http://127.0.0.1:8055', owner,
  realSettlement: false, verifier: await createVerifier(password), credential: process.env.ADMIN_API_TOKEN })
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
const tag = randomBytes(4).toString('hex').toUpperCase()
let browser
try {
  const row = async (sql, args) => (await pool.query(sql, args)).rows[0]
  const address = '0x' + randomBytes(20).toString('hex')
  const trader = await row('INSERT INTO openfund_users (wallet_address,display_name) VALUES ($1,$2) RETURNING id', [address, 'Operations fixture'])
  const reference = `OF-261117-${tag.replace(/[01IO]/g, 'A').slice(0, 6).padEnd(6, 'B')}`
  await pool.query(`INSERT INTO support_messages (reference, full_name, email, department, subject, message, locale, user_id, privacy_consent_at)
    VALUES ($1, 'Operations Fixture', $2, 'support', 'Payout timing question', 'Please explain how long a payout review usually takes for my account.', 'en', $3, now())`,
  [reference, `ops-${tag.toLowerCase()}@example.com`, trader.id])
  const application = await row(`INSERT INTO partner_applications (user_id, role, status, contact_email, payload, terms_version)
    VALUES ($1, 'coach', 'submitted', $2, '{"experience":"five years"}', 'acceptance') RETURNING id`, [trader.id, `coach-${tag.toLowerCase()}@example.com`])

  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, colorScheme: 'dark' })
  const capture = async name => {
    if (!process.env.OUTPUT_DIR) return
    await mkdir(process.env.OUTPUT_DIR, { recursive: true })
    await page.screenshot({ path: join(process.env.OUTPUT_DIR, name + '.png') })
  }
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const nav = name => page.locator('aside').getByRole('link', { name, exact: true }).click()
  const confirm = async () => {
    await page.getByRole('dialog').getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Confirm decision' }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
  }

  await page.goto(origin)
  await page.getByLabel('Owner identity').fill(owner)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('heading', { name: 'Overview' }).waitFor()

  /* every new section renders without an error banner */
  for (const [link, heading] of [['Partner commissions', 'Partner commissions'], ['Financial position', 'Financial position'],
    ['Verified expenses', 'Verified expenses'], ['Capital reserves', 'Capital reserves'], ['Obligations', 'Obligations'],
    ['Audit trail', 'Audit trail'], ['Live risk board', 'Live risk board'], ['Global search', 'Global search'], ['Notifications', 'Notifications']]) {
    await nav(link)
    await page.getByRole('heading', { name: heading, level: 1 }).waitFor()
    assert.equal(await page.locator('main [role=alert]').count(), 0, `${heading} rendered an error`)
  }

  /* global search resolves the fixture wallet to its trader record */
  await nav('Global search')
  await page.getByRole('textbox', { name: 'Global search' }).fill(address)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('link', { name: 'Traders', exact: true }).last().click()
  await page.getByRole('heading', { name: 'Operations fixture' }).waitFor()

  /* user suspension with step-up password and recorded reason */
  await page.getByRole('button', { name: 'Suspend trader' }).click()
  await page.getByRole('dialog').getByLabel('Decision note').fill('Browser acceptance suspension')
  await confirm()
  assert.equal((await row('SELECT status FROM openfund_users WHERE id=$1', [trader.id])).status, 'suspended')
  await page.getByRole('button', { name: 'Activate trader' }).click()
  await page.getByRole('dialog').getByLabel('Decision note').fill('Browser acceptance reactivation')
  await confirm()
  assert.equal((await row('SELECT status FROM openfund_users WHERE id=$1', [trader.id])).status, 'active')

  /* coupon wizard creates an inactive commercial coupon attributed to the owner */
  const code = `QA-${tag}`
  await nav('Coupons')
  await page.getByRole('button', { name: 'New coupon' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Code', { exact: true }).fill(code)
  await dialog.getByLabel('Value', { exact: true }).fill('15')
  await dialog.getByLabel('Name', { exact: true }).fill('Browser acceptance coupon')
  await confirm()
  const coupon = await row('SELECT id, status, kind, value FROM coupons WHERE code=$1', [code])
  assert.deepEqual([coupon.status, coupon.kind, Number(coupon.value)], ['inactive', 'percent', 15])
  assert.equal((await row('SELECT actor FROM coupon_audit WHERE coupon_id=$1 ORDER BY id LIMIT 1', [coupon.id])).actor, `admin:${owner}`)
  await page.getByRole('row').filter({ hasText: code }).getByRole('button', { name: 'Activate' }).click()
  await confirm()
  assert.equal((await row('SELECT status FROM coupons WHERE id=$1', [coupon.id])).status, 'active')
  await capture('backstage-coupons')

  /* expense wizard records an expense awaiting four-eyes verification */
  const invoice = `INV-${tag}`
  await nav('Verified expenses')
  await page.getByRole('button', { name: 'Record expense' }).click()
  await dialog.getByLabel('Description', { exact: true }).fill('Browser acceptance hosting invoice')
  await dialog.getByLabel('Original amount').fill('12.50')
  await dialog.getByLabel('Amount', { exact: true }).fill('12.50')
  await dialog.getByLabel('Incurred on').fill('2026-11-01')
  await dialog.getByLabel('Invoice / reference').fill(invoice)
  await confirm()
  const expense = await row('SELECT status, recorded_by FROM verified_expenses WHERE invoice_reference=$1', [invoice])
  assert.deepEqual([expense.status, expense.recorded_by], ['recorded', `admin:${owner}`])

  /* support reply reaches the trader thread and notifications */
  await nav('Support inbox')
  await page.getByRole('link', { name: reference }).click()
  await page.getByRole('heading', { name: 'Payout timing question' }).waitFor()
  await page.getByRole('button', { name: 'Reply to trader' }).click()
  await dialog.getByLabel('Message', { exact: true }).fill('Payout reviews usually complete within two business days.')
  await confirm()
  const thread = await row('SELECT thread_events FROM support_messages WHERE reference=$1', [reference])
  assert.equal(thread.thread_events.at(-1).role, 'operator')
  assert.ok(await row(`SELECT 1 FROM notifications WHERE user_id=$1 AND kind='support_reply'`, [trader.id]))
  await page.getByText('Payout reviews usually complete within two business days.').waitFor()

  /* partner application moves to review with a recorded note */
  await nav('Partner applications')
  await page.getByRole('link', { name: application.id }).click()
  await page.getByRole('heading', { name: 'Application detail' }).waitFor()
  await page.getByRole('button', { name: 'Start review' }).click()
  await dialog.getByLabel('Decision note').fill('Browser acceptance review start')
  await confirm()
  assert.equal((await row('SELECT status FROM partner_applications WHERE id=$1', [application.id])).status, 'under_review')

  /* unified audit viewer shows the financial trail entry for the expense */
  await nav('Audit trail')
  await page.getByRole('textbox', { name: 'Action' }).fill('expense_recorded')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('cell', { name: 'expense_recorded' }).first().waitFor()
  await capture('backstage-audit')

  /* Persian locale: RTL document, translated headings, technical values LTR */
  await page.getByRole('combobox', { name: 'Language' }).selectOption('fa')
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl')
  await page.locator('aside').getByRole('link', { name: 'تابلوی ریسک زنده' }).click()
  await page.getByRole('heading', { name: 'تابلوی ریسک زنده', level: 1 }).waitFor()
  await page.locator('aside').getByRole('link', { name: 'کدهای تخفیف' }).click()
  await page.getByRole('heading', { name: 'کدهای تخفیف', level: 1 }).waitFor()
  assert.equal(await page.getByText(code, { exact: true }).getAttribute('dir'), 'ltr')
  await capture('backstage-coupons-fa')
  assert.deepEqual(errors, [])
  console.log('Backstage operations browser acceptance passed.')
} finally {
  await browser?.close()
  server.close()
  await pool.end()
}
