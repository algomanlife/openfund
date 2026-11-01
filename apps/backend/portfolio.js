/**
 * Openfund Portfolio — native analytics over the authoritative trading engine.
 *
 * Reuses @luxalgo/journal-core (vendored under third_party/, MIT) for the
 * verified analytics: metrics, equity/drawdown curves, daily stats (PnL
 * calendar) and aggregation buckets.
 *
 * SINGLE SOURCE OF TRUTH: PostgreSQL trading_positions/ledger owned by the
 * engine. This module only READS them and adapts rows into the journal's
 * RoundTrip shape — it never writes trading data. Authoritative totals
 * (balance/equity/realized) come from the account row itself; journal metrics
 * are analytical views over the same rows.
 *
 * Every endpoint is ownership-scoped: the account is resolved from the
 * session user, never from a client-supplied id.
 */
import pg from 'pg'
import * as journal from '../../third_party/luxalgo-trade-journal/dist/index.js'

const { computeOverview, equityCurve, dailyStats, drawdown, bySymbol, byDirection, byAssetClass } = journal

const TZ = process.env.PORTFOLIO_TZ || 'UTC'
const INITIAL_BALANCE = 100000

/** Openfund position row → journal-core RoundTrip (stable, id-preserving) */
export function toRoundTrip(p) {
  const fees = Number(p.open_fee) + Number(p.close_fee || 0)
  const net = Number(p.realized_pnl)
  const closed = p.status !== 'open'
  return {
    key: `${p.account_id}|${p.market}|${p.side}|${p.opened_at.toISOString()}`,
    accountId: String(p.account_id),
    symbol: p.market,
    assetClass: assetClassOf(p.market),
    direction: p.side,
    status: !closed ? 'open' : net > 0 ? 'win' : net < 0 ? 'loss' : 'breakeven',
    openedAt: p.opened_at.toISOString(),
    closedAt: closed ? p.closed_at.toISOString() : undefined,
    quantity: Number(p.quantity),
    openQuantity: closed ? 0 : Number(p.quantity),
    avgEntry: Number(p.entry_price),
    avgExit: closed && p.exit_price != null ? Number(p.exit_price) : undefined,
    grossPnl: net + fees,          /* realized P&L before fees */
    fees,
    netPnl: net,                   /* engine's settled net — authoritative */
    executionCount: 2,
    executionIds: [String(p.order_id), String(p.id)],
    exits: [],
    durationMs: closed ? p.closed_at - p.opened_at : undefined,
    /* Openfund extensions carried alongside (traceability) */
    ofPositionId: String(p.id),
    ofMarket: p.market,
    ofLeverage: p.leverage,
    ofMargin: Number(p.margin),
    ofExitReason: p.exit_reason,
    ofOpenFee: Number(p.open_fee),
    ofCloseFee: Number(p.close_fee || 0),
    ofOpenedAt: p.opened_at.toISOString(),
    ofClosedAt: closed ? p.closed_at.toISOString() : null,
    ofEntryPrice: Number(p.entry_price),
    ofExitPrice: p.exit_price != null ? Number(p.exit_price) : null,
    ofStatus: p.status
  }
}

const GROUP_CLASS = { crypto: 'crypto', forex: 'forex', stocks: 'equity', indices: 'other', commodities: 'other' }
function assetClassOf(market) { return GROUP_CLASS[(market || '').split('/')[1]?.toLowerCase?.() === 'usd' ? '' : ''] || 'crypto' }

export class Portfolio {
  constructor(pool, marketData) { this.pool = pool; this.md = marketData }

  async accountOf(userId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM demo_accounts WHERE user_id=$1 AND account_type=$2', [userId, 'free_demo'])
    return rows[0] || null
  }

  async allPositions(userId) {
    const { rows } = await this.pool.query(
      `SELECT p.*, a.balance, a.realized_pnl AS acc_realized, a.used_margin
         FROM trading_positions p JOIN demo_accounts a ON a.id = p.account_id
        WHERE p.user_id=$1 ORDER BY p.opened_at`, [userId])
    return rows
  }

  /** overview + metrics + curves + calendar in one authoritative payload */
  async overview(userId) {
    const account = await this.accountOf(userId)
    if (!account) return null
    const positions = await this.allPositions(userId)
    const trades = positions.map(toRoundTrip)

    const ov = computeOverview(trades, { timeZone: TZ })
    const curve = equityCurve(trades)
    const days = dailyStats(trades, TZ)
    const dd = drawdown(curve, INITIAL_BALANCE)

    /* authoritative account numbers (NUMERIC from the engine) */
    const bal = Number(account.balance)
    const used = Number(account.used_margin)
    const realized = Number(account.acc_realized)
    const openTrades = trades.filter(t => t.status === 'open')
    let unreal = 0
    for (const p of positions) if (p.status === 'open') {
      const m = this.md.mark(p.market)
      if (m) unreal += Number(p.quantity) * (Number(m.mark) - Number(p.entry_price)) * (p.side === 'long' ? 1 : -1)
    }

    return {
      account: {
        id: account.id, type: account.account_type, currency: account.currency, status: account.status,
        initialBalance: INITIAL_BALANCE, balance: bal, equity: bal + unreal,
        realizedPnl: realized, unrealizedPnl: unreal, netPnl: realized + unreal,
        totalFees: trades.reduce((s, t) => s + t.fees, 0),
        openPositions: openTrades.length, closedTrades: trades.length - openTrades.length,
        totalTrades: trades.length, usedMargin: used
      },
      metrics: ov.metrics,
      equityCurve: curve,           /* cumulative realized net PnL per trade close */
      equityBasis: 'realized',      /* honest label: no historical mark-to-market snapshots */
      daily: days,                  /* PnL calendar (tz documented) */
      drawdown: dd,
      timeZone: TZ
    }
  }

  async buckets(userId) {
    const positions = await this.allPositions(userId)
    const trades = positions.map(toRoundTrip)
    return {
      bySymbol: bySymbol(trades), byDirection: byDirection(trades), byAssetClass: byAssetClass(trades)
    }
  }

  /** paginated + filtered history (never loads everything at once) */
  async history(userId, { limit = 25, offset = 0, side, market, status, from, to, sort = 'closed_desc' }) {
    const where = ['p.user_id = $1']
    const params = [userId]
    if (side) { params.push(side); where.push(`p.side = $${params.length}`) }
    if (market) { params.push(`%${market}%`); where.push(`p.market ILIKE $${params.length}`) }
    if (status) { params.push(status); where.push(`p.status = $${params.length}`) }
    if (from) { params.push(from); where.push(`p.opened_at >= $${params.length}`) }
    if (to) { params.push(to); where.push(`p.opened_at <= $${params.length}`) }
    const orderBy = sort === 'pnl_desc' ? 'p.realized_pnl DESC NULLS LAST'
      : sort === 'pnl_asc' ? 'p.realized_pnl ASC NULLS LAST'
      : sort === 'opened_asc' ? 'p.opened_at ASC'
      : 'p.closed_at DESC NULLS LAST, p.opened_at DESC'
    const count = await this.pool.query(
      `SELECT count(*)::int c FROM trading_positions p WHERE ${where.join(' AND ')}`, params)
    params.push(Number(limit), Number(offset))
    const { rows } = await this.pool.query(
      `SELECT p.* FROM trading_positions p WHERE ${where.join(' AND ')}
        ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`, params)
    return { total: count.rows[0].c, trades: rows.map(toRoundTrip) }
  }

  async details(userId, positionId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM trading_positions WHERE id=$1 AND user_id=$2', [positionId, userId])
    if (!rows[0]) return null
    const p = rows[0]
    const order = (await this.pool.query('SELECT * FROM trading_orders WHERE id=$1', [p.order_id])).rows[0]
    const ledger = (await this.pool.query(
      'SELECT event, amount, balance_after, ts, meta FROM trading_ledger WHERE position_id=$1 ORDER BY id', [p.id])).rows
    const note = (await this.pool.query(
      'SELECT notes, tags FROM trade_notes WHERE user_id=$1 AND trade_key=$2', [userId, toRoundTrip(p).key])).rows[0]
    return {
      trade: toRoundTrip(p),
      order: order ? { id: order.id, type: order.order_type, status: order.status, idempotencyKey: order.idempotency_key, createdAt: order.created_at } : null,
      ledger: ledger.map(l => ({ event: l.event, amount: Number(l.amount), balanceAfter: Number(l.balance_after), ts: l.ts, meta: l.meta })),
      note: note ? { notes: note.notes, tags: note.tags } : { notes: '', tags: [] }
    }
  }

  async upsertNote(userId, tradeKey, notes, tags) {
    await this.pool.query(
      `INSERT INTO trade_notes (user_id, trade_key, notes, tags)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, trade_key) DO UPDATE SET notes=$3, tags=$4, updated_at=now()`,
      [userId, tradeKey, String(notes || '').slice(0, 4000), JSON.stringify(Array.isArray(tags) ? tags.slice(0, 20) : [])])
    return { ok: true }
  }
}
