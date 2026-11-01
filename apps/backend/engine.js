/**
 * Openfund demo trading engine — server-authoritative simulation.
 *
 * INTEGRITY RULES
 *  - All money math uses decimal.js (never JS floats); persisted as NUMERIC.
 *  - Execution prices come from the server's own market-data marks — the
 *    client never submits an execution price.
 *  - Every balance change is a ledger row (append-only, balance_after).
 *  - Order submissions are idempotent (client idempotency-key).
 *  - Account mutations run inside DB transactions with per-account locking.
 *  - The engine loop keeps monitoring pending orders / SL / TP / liquidation
 *    even when the user's browser is closed.
 *
 * SIMULATION ASSUMPTIONS (Gains public API does not provide these —
 * documented in docs/audits/DEMO_TRADING_AUDIT.md, NOT claimed Gains parity):
 *  - execution at server mark, no slippage (no tick data exists)
 *  - fee: SIM_FEE_PCT of notional, charged on open AND close (default 0.05%)
 *  - liquidation when margin + unrealized ≤ maintenance level (10% of margin)
 *  - limit/stop fill at the target price when the mark crosses it
 *  - funding not simulated in v1
 */
import crypto from 'node:crypto'
import Decimal from 'decimal.js'
import pg from 'pg'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

const D = (v) => new Decimal(v)
export const SIM = {
  INITIAL_BALANCE: '100000.00',
  MAINT_PCT: process.env.SIM_MAINT_PCT || '10',    /* liquidation at 10% maintenance */
  MIN_MARGIN: '1',
  STALE_MS: 5000,
}

/* ---------- Gains-documented fee & spread tiers (per asset class) ----------
   Sources: docs.gains.trade/gtrade-leveraged-trading/fees-and-spread
   Class A (published values): BTC/ETH 0.035%, core crypto 0.05%, non-core
   0.06%, forex major 0.012%. Fixed spread/side: BTC/ETH 0.005%, forex
   0.005%, most other crypto 0%.
   Class B (documented fallbacks — stocks/indices/commodities fees are not
   published per class in the public doc): 0.06% fee, 0.01-0.02% spread. */
const FEE_TIERS = { btceth: '0.035', crypto: '0.05', forex: '0.012', fallback: '0.06' }
const SPREAD_TIERS = { btceth: '0.005', crypto: '0', forex: '0.005', commodities: '0.02', fallback: '0.01' }

/** opening/closing fee % for a market (percent of notional) */
export function feePct(meta, symbol) {
  const base = String(meta?.base || symbol?.split('/')[0] || '').toUpperCase()
  if (base === 'BTC' || base === 'ETH') return FEE_TIERS.btceth
  switch (String(meta?.group || '').toLowerCase()) {
    case 'crypto': return FEE_TIERS.crypto
    case 'forex': return FEE_TIERS.forex
    default: return FEE_TIERS.fallback     /* stocks, indices, commodities, unknown */
  }
}

/** fixed spread % per side for a market (applied to the mark price) */
export function spreadPct(meta, symbol) {
  const base = String(meta?.base || symbol?.split('/')[0] || '').toUpperCase()
  if (base === 'BTC' || base === 'ETH') return SPREAD_TIERS.btceth
  switch (String(meta?.group || '').toLowerCase()) {
    case 'crypto': return SPREAD_TIERS.crypto
    case 'forex': return SPREAD_TIERS.forex
    case 'commodities': return SPREAD_TIERS.commodities
    default: return SPREAD_TIERS.fallback
  }
}

/** execution price with the fixed spread applied (Gains: spread applies to
    the oracle price — buy above mark for a long entry, sell below for a
    short entry; mirrored on close) */
export function withSpread(price, side, dir, meta, symbol) {
  const sp = D(spreadPct(meta, symbol)).div(100)
  const p = D(price)
  /* dir: 'open' | 'close'; long opens buying (+spread) and closes selling
     (−spread); short is the mirror */
  const buy = (side === 'long') === (dir === 'open')
  return buy ? p.times(sp.plus(1)) : p.times(new Decimal(1).minus(sp))
}

/* ---------- per-account async mutex (safe concurrency) ---------- */
const locks = new Map()
async function withAccountLock(accountId, fn) {
  const prev = locks.get(accountId) || Promise.resolve()
  const run = prev.then(fn, fn)
  locks.set(accountId, run.catch(() => {}))
  try { return await run } finally { if (locks.get(accountId) === run) locks.delete(accountId) }
}

export class Engine {
  constructor(pool, marketData) {
    this.pool = pool
    this.md = marketData
    this.listeners = new Set()          /* state-change → SSE push */
    this.timer = null
    this.running = false
  }

  onState(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  emit(accountId) { for (const fn of this.listeners) { try { fn(accountId) } catch {} } }

  start(intervalMs = 1000) {
    if (this.running) return
    this.running = true
    this.timer = setInterval(() => { this.loop().catch(console.error) }, intervalMs)
    this.timer.unref?.()
    console.log('[engine] monitoring loop started')
  }
  stop() { this.running = false; clearInterval(this.timer) }

  /* =========================================================
   * ACCOUNT / FUNDING
   * ======================================================= */

  /** one free_demo account per user — atomic + idempotent funding event */
  async ensureDemoAccount(userId, client) {
    const c = client || this.pool
    return c.connect ? c.connect().then(async cc => { try { return await this.#ensureTx(cc, userId) } finally { cc.release() } })
                      : this.#ensureTx(c, userId)
  }
  async #ensureTx(c, userId) {
    await c.query('BEGIN')
    try {
      const { rows } = await c.query(
        `INSERT INTO demo_accounts (user_id, balance, currency)
         VALUES ($1, $2, 'DAI')
         ON CONFLICT (user_id, account_type) DO NOTHING
         RETURNING *`, [userId, SIM.INITIAL_BALANCE])
      let account
      if (rows.length > 0) {
        account = rows[0]
        /* exactly ONE auditable funding event — same transaction */
        await c.query(
          `INSERT INTO trading_ledger (account_id, user_id, event, amount, balance_after, meta)
           VALUES ($1,$2,'demo_funding',$3,$3,$4)`,
          [account.id, userId, SIM.INITIAL_BALANCE, JSON.stringify({ type: 'free_demo', currency: 'DAI' })])
        await c.query(`INSERT INTO trading_events (account_id, kind, detail) VALUES ($1,'demo_account_created',$2)`,
          [account.id, JSON.stringify({ initial_balance: SIM.INITIAL_BALANCE })])
        console.log(`[engine] demo account funded: 100000 DAI (user ${userId.slice(0, 8)})`)
      } else {
        account = (await c.query('SELECT * FROM demo_accounts WHERE user_id=$1 AND account_type=$2', [userId, 'free_demo'])).rows[0]
      }
      await c.query('COMMIT')
      return account
    } catch (e) { await c.query('ROLLBACK'); throw e }
  }

  async getAccount(userId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM demo_accounts WHERE user_id=$1 AND account_type=$2', [userId, 'free_demo'])
    return rows[0] || null
  }

  /* =========================================================
   * STATE (account + positions + orders) — server authoritative
   * ======================================================= */

  async state(userId) {
    const account = await this.getAccount(userId)
    if (!account) return { account: null, positions: [], orders: [], history: [] }
    const [positions, orders, history] = await Promise.all([
      this.pool.query(
        `SELECT * FROM trading_positions WHERE account_id=$1 AND status='open' ORDER BY opened_at DESC`, [account.id]),
      this.pool.query(
        `SELECT * FROM trading_orders WHERE account_id=$1 AND status='pending' ORDER BY created_at DESC`, [account.id]),
      this.pool.query(
        `SELECT * FROM trading_positions WHERE account_id=$1 AND status IN ('closed','liquidated') ORDER BY closed_at DESC LIMIT 100`, [account.id]),
    ])
    const view = this.#accountView(account, positions.rows)
    return { account: view, positions: positions.rows.map(p => this.#positionView(p)), orders: orders.rows, history: history.rows.map(p => this.#positionView(p)) }
  }

  /** equity = balance + unrealized (all open positions) */
  #accountView(account, openPositions) {
    const bal = D(account.balance)
    let unreal = new Decimal(0)
    for (const p of openPositions) {
      const m = this.md.mark(p.market)
      if (m) unreal = unreal.plus(this.#pnl(D(p.quantity), D(p.entry_price), D(m.mark), p.side))
    }
    const used = D(account.used_margin)
    return {
      id: account.id, type: account.account_type, currency: account.currency, status: account.status,
      balance: bal.toFixed(2),
      equity: bal.plus(unreal).toFixed(2),
      used_margin: used.toFixed(2),
      free_margin: bal.minus(used).toFixed(2),
      realized_pnl: D(account.realized_pnl).toFixed(2),
      unrealized_pnl: unreal.toFixed(2),
    }
  }

  #positionView(p) {
    const m = this.md.mark(p.market)
    const mark = m ? m.mark : null
    let pnl = null
    if (p.status === 'open' && mark) pnl = this.#pnl(D(p.quantity), D(p.entry_price), D(mark), p.side).toFixed(2)
    if (p.status !== 'open') pnl = D(p.realized_pnl).toFixed(2)
    return {
      id: p.id, market: p.market, side: p.side, quantity: D(p.quantity).toFixed(8),
      entry_price: D(p.entry_price).toFixed(2), mark_price: mark ? D(mark).toFixed(2) : null,
      margin: D(p.margin).toFixed(2), leverage: p.leverage,
      sl_price: p.sl_price ? D(p.sl_price).toFixed(2) : null,
      tp_price: p.tp_price ? D(p.tp_price).toFixed(2) : null,
      status: p.status, exit_price: p.exit_price ? D(p.exit_price).toFixed(2) : null,
      exit_reason: p.exit_reason, open_fee: D(p.open_fee).toFixed(4), close_fee: D(p.close_fee).toFixed(4),
      realized_pnl: pnl, opened_at: p.opened_at, closed_at: p.closed_at
    }
  }

  #pnl(qty, entry, mark, side) {
    return side === 'long' ? qty.times(mark.minus(entry)) : qty.times(entry.minus(mark))
  }

  /* =========================================================
   * ORDER SUBMISSION (idempotent, validated, transactional)
   * ======================================================= */

  async submitOrder(userId, req, idempotencyKey) {
    if (idempotencyKey) {
      const { rows } = await this.pool.query('SELECT * FROM trading_orders WHERE idempotency_key=$1', [idempotencyKey])
      if (rows[0]) {
        return { ok: true, duplicate: true, order: rows[0],
          position: rows[0].position_id ? await this.#positionById(rows[0].position_id) : null }
      }
    }
    const account = await this.getAccount(userId)
    if (!account) throw Object.assign(new Error('account_not_found'), { status: 404 })
    if (account.status !== 'active') throw Object.assign(new Error('account_suspended'), { status: 403 })

    const order = {
      market: String(req.market || ''), side: req.side === 'short' ? 'short' : 'long',
      order_type: ['market', 'limit', 'stop'].includes(req.order_type) ? req.order_type : 'market',
      margin: D(req.margin || 0), leverage: Math.floor(Number(req.leverage) || 0),
      target_price: req.target_price != null ? D(req.target_price) : null,
      sl_price: req.sl != null ? D(req.sl) : null, tp_price: req.tp != null ? D(req.tp) : null,
    }

    /* ---------- validation ---------- */
    const reject = async (reason) => {
      if (!idempotencyKey) return { ok: false, reason }
      const { rows } = await this.pool.query(
        `INSERT INTO trading_orders (idempotency_key, account_id, user_id, market, side, order_type,
           margin, leverage, target_price, sl_price, tp_price, status, reject_reason, request_meta)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'rejected',$12,$13) RETURNING *`,
        [idempotencyKey, account.id, userId, order.market, order.side, order.order_type,
         order.margin.toFixed(10), order.leverage, order.target_price?.toFixed(10) || null,
         order.sl_price?.toFixed(10) || null, order.tp_price?.toFixed(10) || null,
         reason, JSON.stringify({ requested: req })])
      return { ok: false, reason, order: rows[0] }
    }

    const t = this.md.tradeable(order.market)
    if (!t.ok) return reject(t.reason)
    if (!(order.margin.gte(SIM.MIN_MARGIN))) return reject('margin_too_small')
    if (order.leverage < 1 || order.leverage > Number(t.meta.maxLeverage || 100)) return reject('leverage_exceeded')
    if (order.order_type !== 'market' && !order.target_price) return reject('target_price_required')
    if (order.margin.gt(D('100000000'))) return reject('margin_too_large')

    /* SL/TP sanity vs side */
    const mark = D(t.mark)
    if (order.sl_price != null) {
      if (order.side === 'long' && order.sl_price.gte(mark)) return reject('sl_above_mark')
      if (order.side === 'short' && order.sl_price.lte(mark)) return reject('sl_below_mark')
    }
    if (order.tp_price != null) {
      if (order.side === 'long' && order.tp_price.lte(mark)) return reject('tp_below_mark')
      if (order.side === 'short' && order.tp_price.gte(mark)) return reject('tp_above_mark')
    }

    return withAccountLock(account.id, async () => {
      const c = await this.pool.connect()
      try {
        await c.query('BEGIN')
        const acc = (await c.query('SELECT * FROM demo_accounts WHERE id=$1 FOR UPDATE', [account.id])).rows[0]
        const free = D(acc.balance).minus(D(acc.used_margin))
        if (order.margin.gt(free)) { await c.query('ROLLBACK'); return reject('insufficient_margin') }

        /* create the order row first (idempotency captured even on race) */
        const { rows: orows } = await c.query(
          `INSERT INTO trading_orders (idempotency_key, account_id, user_id, market, side, order_type,
             margin, leverage, target_price, sl_price, tp_price, status, request_meta)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12) RETURNING *`,
          [idempotencyKey, account.id, userId, order.market, order.side, order.order_type,
           order.margin.toFixed(10), order.leverage, order.target_price?.toFixed(10) || null,
           order.sl_price?.toFixed(10) || null, order.tp_price?.toFixed(10) || null,
           JSON.stringify({ requested: req, mark: t.mark })])
        const orow = orows[0]

        let result
        if (order.order_type === 'market') {
          result = await this.#fill(c, acc, orow, t.mark, order.sl_price?.toFixed(10) || null, order.tp_price?.toFixed(10) || null)
          await c.query('COMMIT')
        } else {
          await c.query('COMMIT')
          result = { ok: true, order: orow, position: null, pending: true }
        }
        this.emit(account.id)
        return result
      } catch (e) {
        await c.query('ROLLBACK').catch(() => {})
        /* unique idempotency race → return the winner */
        if (String(e.code) === '23505' && idempotencyKey) {
          const { rows } = await this.pool.query('SELECT * FROM trading_orders WHERE idempotency_key=$1', [idempotencyKey])
          if (rows[0]) return { ok: true, duplicate: true, order: rows[0], position: rows[0].position_id ? await this.#positionById(rows[0].position_id) : null }
        }
        throw e
      } finally { c.release() }
    })
  }

  /* fill an order at `price` — inside the caller's transaction.
     Gains-aligned: entry gets the fixed spread applied (buy above mark for
     a long, sell below for a short); the opening fee is the market's
     per-class tier on the initial notional; the notional itself is NOT
     shrunk by fees (v10 behaviour). */
  async #fill(c, acc, orow, price, sl, tp, applySpread = true) {
    const meta = this.md.marketMeta(orow.market)
    /* market orders pay the fixed spread on top of the mark; limit/stop
       orders fill AT the trader's chosen target price (no extra spread) */
    const execPrice = applySpread ? withSpread(price, orow.side, 'open', meta, orow.market) : D(price)
    const margin = D(orow.margin), lev = Number(orow.leverage)
    const notional = margin.times(lev)
    const qty = notional.div(execPrice)
    const fee = notional.times(D(feePct(meta, orow.market))).div(100)
    price = execPrice.toString()

    /* balance -= open fee; used_margin += margin */
    const newBal = D(acc.balance).minus(fee)
    const newUsed = D(acc.used_margin).plus(margin)
    await c.query('UPDATE demo_accounts SET balance=$1, used_margin=$2, updated_at=now() WHERE id=$3',
      [newBal.toFixed(10), newUsed.toFixed(10), acc.id])

    const { rows: prows } = await c.query(
      `INSERT INTO trading_positions (order_id, account_id, user_id, market, side, quantity,
         entry_price, margin, leverage, sl_price, tp_price, status, open_fee)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'open',$12) RETURNING *`,
      [orow.id, acc.id, orow.user_id, orow.market, orow.side, qty.toFixed(10), D(price).toFixed(10),
       margin.toFixed(10), lev, sl, tp, fee.toFixed(10)])
    const pos = prows[0]

    await c.query('UPDATE trading_orders SET status=$1, filled_price=$2, position_id=$3, updated_at=now() WHERE id=$4',
      ['filled', D(price).toFixed(10), pos.id, orow.id])
    await c.query(
      `INSERT INTO trading_ledger (account_id, user_id, event, position_id, amount, balance_after, meta)
       VALUES ($1,$2,'open_fee',$3,$4,$5,$6)`,
      [acc.id, orow.user_id, pos.id, fee.negated().toFixed(10), newBal.toFixed(10),
       JSON.stringify({ market: orow.market, side: orow.side, leverage: lev, entry: price })])
    await c.query(`INSERT INTO trading_events (account_id, kind, detail) VALUES ($1,'order_filled',$2)`,
      [acc.id, JSON.stringify({ order: orow.id, position: pos.id, market: orow.market, entry: price, qty: qty.toFixed(10) })])

    const filled = (await c.query('SELECT * FROM trading_orders WHERE id=$1', [orow.id])).rows[0]
    return { ok: true, order: filled, position: this.#positionView(pos), pending: false }
  }

  async #positionById(id) {
    const { rows } = await this.pool.query('SELECT * FROM trading_positions WHERE id=$1', [id])
    return rows[0] ? this.#positionView(rows[0]) : null
  }

  /* =========================================================
   * POSITION MANAGEMENT
   * ======================================================= */

  async closePosition(userId, positionId) {
    const account = await this.getAccount(userId)
    if (!account) throw Object.assign(new Error('account_not_found'), { status: 404 })
    return withAccountLock(account.id, async () => {
      const c = await this.pool.connect()
      try {
        await c.query('BEGIN')
        const pos = (await c.query('SELECT * FROM trading_positions WHERE id=$1 FOR UPDATE', [positionId])).rows[0]
        if (!pos || pos.user_id !== userId) { await c.query('ROLLBACK'); throw Object.assign(new Error('not_found'), { status: 404 }) }
        if (pos.status !== 'open') { await c.query('ROLLBACK'); return { duplicate: true, position: this.#positionView(pos) } }
        const t = this.md.tradeable(pos.market)
        if (!t.ok) { await c.query('ROLLBACK'); throw Object.assign(new Error(t.reason), { status: 409 }) }
        const out = await this.#closeTx(c, pos, t.mark, 'manual')
        await c.query('COMMIT')
        this.emit(account.id)
        return out
      } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e } finally { c.release() }
    })
  }

  async updateProtection(userId, positionId, { sl, tp }) {
    const account = await this.getAccount(userId)
    if (!account) throw Object.assign(new Error('account_not_found'), { status: 404 })
    const pos = (await this.pool.query('SELECT * FROM trading_positions WHERE id=$1', [positionId])).rows[0]
    if (!pos || pos.user_id !== userId) throw Object.assign(new Error('not_found'), { status: 404 })
    if (pos.status !== 'open') throw Object.assign(new Error('position_not_open'), { status: 409 })
    const m = this.md.freshMark(pos.market)
    if (!m) throw Object.assign(new Error('stale_price'), { status: 409 })
    const mark = D(m.mark)
    const slD = sl != null ? D(sl) : null, tpD = tp != null ? D(tp) : null
    if (slD != null) {
      if (pos.side === 'long' && slD.gte(mark)) throw Object.assign(new Error('sl_above_mark'), { status: 400 })
      if (pos.side === 'short' && slD.lte(mark)) throw Object.assign(new Error('sl_below_mark'), { status: 400 })
    }
    if (tpD != null) {
      if (pos.side === 'long' && tpD.lte(mark)) throw Object.assign(new Error('tp_below_mark'), { status: 400 })
      if (pos.side === 'short' && tpD.gte(mark)) throw Object.assign(new Error('tp_above_mark'), { status: 400 })
    }
    await this.pool.query('UPDATE trading_positions SET sl_price=$1, tp_price=$2 WHERE id=$3',
      [slD?.toFixed(10) || null, tpD?.toFixed(10) || null, positionId])
    await this.pool.query(`INSERT INTO trading_events (account_id, kind, detail) VALUES ($1,'protection_updated',$2)`,
      [account.id, JSON.stringify({ position: positionId, sl: slD?.toString() || null, tp: tpD?.toString() || null })])
    this.emit(account.id)
    return { ok: true }
  }

  async cancelOrder(userId, orderId) {
    const account = await this.getAccount(userId)
    if (!account) throw Object.assign(new Error('account_not_found'), { status: 404 })
    const { rows } = await this.pool.query(
      `UPDATE trading_orders SET status='cancelled', updated_at=now()
        WHERE id=$1 AND user_id=$2 AND status='pending' RETURNING *`, [orderId, userId])
    if (!rows[0]) throw Object.assign(new Error('not_found'), { status: 404 })
    await this.pool.query(`INSERT INTO trading_events (account_id, kind, detail) VALUES ($1,'order_cancelled',$2)`,
      [account.id, JSON.stringify({ order: orderId })])
    this.emit(account.id)
    return { ok: true, order: rows[0] }
  }

  /* =========================================================
   * MONITORING LOOP — pending orders, SL/TP, liquidation
   * (runs even with no browser open)
   * ======================================================= */

  async loop() {
    if (!this.running) return
    const pending = await this.pool.query(
      `SELECT o.*, a.balance, a.used_margin FROM trading_orders o
         JOIN demo_accounts a ON a.id = o.account_id
        WHERE o.status='pending'`)
    for (const o of pending.rows) {
      if (this.#shouldTrigger(o)) {
        await withAccountLock(o.account_id, () => this.#triggerPending(o).catch(console.error))
      }
    }
    const open = await this.pool.query(
      `SELECT p.*, a.balance FROM trading_positions p
         JOIN demo_accounts a ON a.id = p.account_id
        WHERE p.status='open'`)
    for (const p of open.rows) {
      const m = this.md.mark(p.market)
      if (!m) continue
      const mark = D(m.mark)
      const pnl = this.#pnl(D(p.quantity), D(p.entry_price), mark, p.side)
      const margin = D(p.margin)
      const reason = this.#exitReason(p, mark, pnl, margin)
      if (reason) {
        await withAccountLock(p.account_id, () => this.#autoExit(p, mark, reason).catch(console.error))
      }
    }
  }

  #shouldTrigger(o) {
    const m = this.md.mark(o.market)
    if (!m) return false
    const mark = D(m.mark), target = D(o.target_price)
    if (o.order_type === 'limit') {
      return o.side === 'long' ? mark.lte(target) : mark.gte(target)
    } /* stop */
    return o.side === 'long' ? mark.gte(target) : mark.lte(target)
  }

  #exitReason(p, mark, pnl, margin) {
    if (p.sl_price != null) {
      const sl = D(p.sl_price)
      if (p.side === 'long' ? mark.lte(sl) : mark.gte(sl)) return 'sl'
    }
    if (p.tp_price != null) {
      const tp = D(p.tp_price)
      if (p.side === 'long' ? mark.gte(tp) : mark.lte(tp)) return 'tp'
    }
    /* liquidation: margin + unrealized ≤ maintenance level */
    const maint = margin.times(D(SIM.MAINT_PCT)).div(100)
    if (margin.plus(pnl).lte(maint)) return 'liquidation'
    return null
  }

  async #triggerPending(o) {
    const c = await this.pool.connect()
    try {
      await c.query('BEGIN')
      const cur = (await c.query('SELECT * FROM trading_orders WHERE id=$1 FOR UPDATE', [o.id])).rows[0]
      if (!cur || cur.status !== 'pending' || !this.#shouldTrigger(cur)) { await c.query('ROLLBACK'); return }
      const acc = (await c.query('SELECT * FROM demo_accounts WHERE id=$1 FOR UPDATE', [cur.account_id])).rows[0]
      const free = D(acc.balance).minus(D(acc.used_margin))
      const margin = D(cur.margin)
      if (margin.gt(free)) {
        await c.query(`UPDATE trading_orders SET status='rejected', reject_reason='insufficient_margin', updated_at=now() WHERE id=$1`, [cur.id])
        await c.query('COMMIT')
        this.emit(acc.id)
        return
      }
      /* fills at the target price (deterministic; documented assumption) */
      await this.#fill(c, acc, cur, D(cur.target_price).toString(), cur.sl_price, cur.tp_price, false)
      await c.query('COMMIT')
      this.emit(acc.id)
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e } finally { c.release() }
  }

  async #autoExit(p, mark, reason) {
    const c = await this.pool.connect()
    try {
      await c.query('BEGIN')
      const cur = (await c.query('SELECT * FROM trading_positions WHERE id=$1 FOR UPDATE', [p.id])).rows[0]
      if (!cur || cur.status !== 'open') { await c.query('ROLLBACK'); return }
      await this.#closeTx(c, cur, mark.toString(), reason)
      await c.query('COMMIT')
      this.emit(p.account_id)
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e } finally { c.release() }
  }

  /* close a position at `price` (mark) for `reason` — inside the caller's
     transaction. Gains-aligned: the closing fee is charged on the INITIAL
     position size (margin × leverage, not the exit value), and the exit
     execution price carries the fixed spread (long closes selling below
     mark, short closes buying above mark). */
  async #closeTx(c, pos, price, reason) {
    const meta = this.md.marketMeta(pos.market)
    const execPrice = withSpread(price, pos.side, 'close', meta, pos.market)
    const qty = D(pos.quantity), entry = D(pos.entry_price), margin = D(pos.margin)
    const initialNotional = margin.times(pos.leverage)
    const closeFee = initialNotional.times(D(feePct(meta, pos.market))).div(100)
    const gross = this.#pnl(qty, entry, execPrice, pos.side)
    const net = gross.minus(closeFee)
    price = execPrice.toString()

    const acc = (await c.query('SELECT * FROM demo_accounts WHERE id=$1 FOR UPDATE', [pos.account_id])).rows[0]
    const newBal = D(acc.balance).plus(net)
    const newUsed = D(acc.used_margin).minus(margin)
    const newRealized = D(acc.realized_pnl).plus(net)

    await c.query('UPDATE demo_accounts SET balance=$1, used_margin=$2, realized_pnl=$3, updated_at=now() WHERE id=$4',
      [newBal.toFixed(10), newUsed.toFixed(10), newRealized.toFixed(10), acc.id])
    await c.query(
      `UPDATE trading_positions SET status=$1, exit_price=$2, exit_reason=$3, close_fee=$4,
         realized_pnl=$5, closed_at=now() WHERE id=$6`,
      [reason === 'liquidation' ? 'liquidated' : 'closed', D(price).toFixed(10), reason,
       closeFee.toFixed(10), net.toFixed(10), pos.id])
    await c.query(
      `INSERT INTO trading_ledger (account_id, user_id, event, position_id, amount, balance_after, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [acc.id, pos.user_id, reason === 'liquidation' ? 'liquidation' : 'close', pos.id,
       net.toFixed(10), newBal.toFixed(10),
       JSON.stringify({ market: pos.market, side: pos.side, entry: entry.toString(), exit: price, reason })])
    await c.query(`INSERT INTO trading_events (account_id, kind, detail) VALUES ($1,'position_closed',$2)`,
      [acc.id, JSON.stringify({ position: pos.id, market: pos.market, reason, entry: entry.toString(), exit: price, net: net.toFixed(10) })])

    return { ok: true, position: this.#positionView((await c.query('SELECT * FROM trading_positions WHERE id=$1', [pos.id])).rows[0]) }
  }
}

export function newId() { return crypto.randomUUID() }
