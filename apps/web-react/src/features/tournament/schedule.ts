/* Openfund Premium League schedule (item A owns the full tournament model;
 * the Challenges menu needs only the start to show its compact countdown).
 * Trading days are weekdays counted in UTC: the market-session model in the
 * backend resets the daily-loss day at 00:00 UTC+3 for challenges, but the
 * tournament is a calendar event announced for "Monday 4 January 2027, 00:00
 * UTC", so the public countdown uses that instant. */
export const PREMIUM_LEAGUE_START = '2027-01-04T00:00:00Z'
export const PREMIUM_LEAGUE_TRADING_DAYS = 30

/** Close of the Nth weekday (UTC) counted from the start day itself. */
export function tradingEnd(startIso: string, tradingDays: number): Date {
  const day = new Date(startIso)
  let counted = 0
  for (;;) {
    const weekday = day.getUTCDay()
    if (weekday !== 0 && weekday !== 6) counted++
    if (counted === tradingDays) break
    day.setUTCDate(day.getUTCDate() + 1)
  }
  day.setUTCHours(23, 59, 59, 999)
  return day
}

/** Whole days until the start (ceil), 0 on the start day, null once started. */
export function daysUntil(startIso: string, now = Date.now()): number | null {
  const ms = Date.parse(startIso) - now
  return ms <= 0 ? null : Math.ceil(ms / 86_400_000)
}
