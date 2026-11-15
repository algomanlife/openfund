const DAY_MS = 86_400_000

export const FUNDED_PAYOUT_VERSION = 'funded-v1'
export const FUNDED_PAYOUT_CYCLES = Object.freeze([
  Object.freeze({ key: 'weekly', intervalDays: 7, splitPct: 75, remainderPct: 25 }),
  Object.freeze({ key: 'biweekly', intervalDays: 14, splitPct: 85, remainderPct: 15 }),
  Object.freeze({ key: 'triweekly', intervalDays: 21, splitPct: 90, remainderPct: 10 }),
  Object.freeze({ key: 'monthly', intervalDays: null, splitPct: 100, remainderPct: 0 }),
])

function anniversary(start, months) {
  const date = new Date(start)
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const last = new Date(date)
  last.setUTCMonth(last.getUTCMonth() + 1, 0)
  date.setUTCDate(Math.min(day, last.getUTCDate()))
  return date
}

/** The next boundary after the period containing the last live request. */
export function fundedPayoutBoundary(activation, cycle, lastRequest = null) {
  if (!activation || !cycle) return null
  const start = new Date(activation)
  const last = lastRequest ? new Date(lastRequest) : start
  if (!Number.isFinite(+start) || !Number.isFinite(+last)) return null
  if (cycle.intervalDays) {
    const width = cycle.intervalDays * DAY_MS
    return new Date(+start + width * Math.max(1, Math.floor((last - start) / width) + 1))
  }
  const months = Math.max(0, (last.getUTCFullYear() - start.getUTCFullYear()) * 12 + last.getUTCMonth() - start.getUTCMonth())
  const boundary = anniversary(start, Math.max(1, months))
  return +boundary <= +last ? anniversary(start, months + 1) : boundary
}
