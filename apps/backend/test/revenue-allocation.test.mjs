import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

const url = process.env.DATABASE_URL
test('verified revenue posts balanced allocations only for a configured policy and reverses exactly', { skip: !url }, async () => {
  assert.match(new URL(url).pathname, /test|audit|_ci/)
  const pool = new pg.Pool({ connectionString: url })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const id = randomUUID()
    const wallet = '0x' + id.replaceAll('-', '') + '12345678'
    const { rows: [user] } = await client.query('INSERT INTO openfund_users(wallet_address) VALUES ($1) RETURNING id', [wallet])
    const { rows: [plan] } = await client.query("INSERT INTO challenge_plans(slug, name) VALUES ($1,'Allocation test') RETURNING id", [id])
    const purchase = async at => {
      const { rows: [order] } = await client.query(`INSERT INTO purchase_orders
        (user_id,challenge_plan_id,account_size_usd,list_price_usd,discount_usd,price_usd,created_at)
        VALUES ($1,$2,10000,100,20,80,$3) RETURNING id`, [user.id, plan.id, at])
      const { rows: [payment] } = await client.query(`INSERT INTO payments
        (purchase_order_id,user_id,chain_id,tx_hash,from_address,to_address,amount) VALUES ($1,$2,42161,$3,$4,$5,80) RETURNING id`,
      [order.id, user.id, '0x' + randomUUID().replaceAll('-', '').padStart(64, '0'), wallet, '0x' + '12'.repeat(20)])
      await client.query("UPDATE purchase_orders SET status='paid',paid_at=now() WHERE id=$1", [order.id])
      return { order: order.id, payment: payment.id }
    }
    const inactive = await purchase('1970-01-01')
    assert.equal((await client.query('SELECT 1 FROM revenue_allocation_journal WHERE purchase_order_id=$1', [inactive.order])).rowCount, 0)
    await client.query(`INSERT INTO revenue_allocation_policies(version,effective_at,allocation_base,approval_reference,approved_by)
      VALUES ($1,'2099-01-01','verified_order_price','test approval','test owner')`, [id])
    const active = await purchase('2099-01-02')
    const entries = async () => (await client.query(`SELECT allocation_base_usd,treasury_usd,operations_usd
      FROM revenue_allocation_journal WHERE purchase_order_id=$1 ORDER BY id`, [active.order])).rows
    assert.deepEqual(await entries(), [{ allocation_base_usd: '80.00', treasury_usd: '47.20', operations_usd: '32.80' }])
    for (const [amount, kind] of [[31.01, 'refund'], [48.99, 'chargeback']]) {
      await client.query(`INSERT INTO payment_adjustments(payment_id,purchase_order_id,kind,amount_usd,reference,recorded_by)
        VALUES ($1,$2,$3,$4,$5,'test')`, [active.payment, active.order, kind, amount, randomUUID()])
    }
    const { rows: [total] } = await client.query(`SELECT sum(allocation_base_usd) AS base, sum(treasury_usd) AS treasury,
      sum(operations_usd) AS operations FROM revenue_allocation_journal WHERE purchase_order_id=$1`, [active.order])
    assert.deepEqual(total, { base: '0.00', treasury: '0.00', operations: '0.00' })
  } finally {
    await client.query('ROLLBACK')
    client.release()
    await pool.end()
  }
})
