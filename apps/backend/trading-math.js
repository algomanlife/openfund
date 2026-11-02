/** Openfund simulation v1. Decimal-only valuation shared by engine and portfolio.
 * This is an isolated virtual-DAI policy, not a reproduction of Gains v10 fees. */
import Decimal from 'decimal.js'
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })
export const D = v => new Decimal(v)
export const SIM = {
  INITIAL_BALANCE: '100000.00', MAINT_PCT: process.env.SIM_MAINT_PCT || '10',
  MIN_MARGIN: '1', STALE_MS: 5000,
}
if (!D(SIM.MAINT_PCT).isFinite() || D(SIM.MAINT_PCT).lt(0) || D(SIM.MAINT_PCT).gte(100))
  throw new Error('Invalid SIM_MAINT_PCT')
export const feePct = (meta, symbol) => {
  const base = String(meta?.base || symbol?.split('/')[0] || '').toUpperCase()
  if (['BTC', 'ETH'].includes(base)) return '0.035'
  return ({ crypto: '0.05', forex: '0.012' })[String(meta?.group).toLowerCase()] || '0.06'
}
export const spreadPct = (meta, symbol) => {
  const base = String(meta?.base || symbol?.split('/')[0] || '').toUpperCase()
  if (['BTC', 'ETH'].includes(base)) return '0.005'
  return ({ crypto: '0', forex: '0.005', commodities: '0.02' })[String(meta?.group).toLowerCase()] ?? '0.01'
}
export const withSpread = (price, side, dir, meta, symbol) =>
  D(price).times(D(1).plus(D(spreadPct(meta, symbol)).div(100).times((side === 'long') === (dir === 'open') ? 1 : -1)))
export const pnl = (qty, entry, mark, side) => D(qty).times(D(mark).minus(entry)).times(side === 'long' ? 1 : -1)
export const closingFee = (p, md) => D(p.margin).times(p.leverage).times(feePct(md.marketMeta(p.market), p.market)).div(100)
export function freshMark(md, market) {
  const m = md.mark(market)
  if (!m || !Number.isFinite(m.at) || m.at > Date.now() + 1000 || Date.now() - m.at > SIM.STALE_MS) return null
  try { return D(m.mark).isFinite() && D(m.mark).gt(0) ? m : null } catch { return null }
}
export function positionMetrics(p, md) {
  const m = freshMark(md, p.market), fee = closingFee(p, md)
  const gross = m ? pnl(p.quantity, p.entry_price, m.mark, p.side) : null
  const exit = m ? withSpread(m.mark, p.side, 'close', md.marketMeta(p.market), p.market) : null
  const net = exit ? pnl(p.quantity, p.entry_price, exit, p.side).minus(fee) : null
  // margin + executable gross - closing fee = maintenance collateral.
  const move = D(p.margin).times(D(1).minus(D(SIM.MAINT_PCT).div(100))).minus(fee).div(p.quantity)
  const executionLiq = D(p.entry_price).plus(move.times(p.side === 'long' ? -1 : 1))
  const multiplier = withSpread(1, p.side, 'close', md.marketMeta(p.market), p.market)
  return { mark: m ? D(m.mark).toString() : null, gross, net, fee,
    liquidation: Decimal.max(0, executionLiq.div(multiplier)).toFixed(10) }
}
export function accountMetrics(account, positions, md) {
  let gross = D(0), known = true
  for (const p of positions) {
    const v = positionMetrics(p, md)
    if (v.gross === null) known = false
    else gross = gross.plus(v.gross)
  }
  const balance = D(account.balance), used = D(account.used_margin)
  const equity = known ? balance.plus(gross) : null
  return { balance: balance.toFixed(2), equity: equity?.toFixed(2) ?? null,
    used_margin: used.toFixed(2), free_margin: equity ? Decimal.max(0, equity.minus(used)).toFixed(2) : null,
    unrealized_pnl: known ? gross.toFixed(2) : null, valuation_status: known ? 'fresh' : 'stale',
    margin_ratio: equity && used.gt(0) ? equity.div(used).times(100).toFixed(4) : null }
}
