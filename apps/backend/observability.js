/**
 * Minimal operational signals (no external dependency).
 *
 * Counters for failures that previously disappeared silently, plus a
 * snapshot used by the admin metrics endpoint. Every failure is also logged
 * as one structured line, `[obs] {"event":...}`, that log-based alerts can
 * match (docs/deployment/LAUNCH_PARITY_RUNBOOK.md, Observability). Log lines
 * carry the event, a short action name and an error code — never request
 * details, wallet addresses or other personal data.
 */
const counters = new Map()
const lastAt = new Map()

export function recordFailure(event, { action = null, error = null, now = Date.now() } = {}) {
  counters.set(event, (counters.get(event) || 0) + 1)
  lastAt.set(event, now)
  const code = error?.code || error?.name || 'error'
  console.error('[obs] ' + JSON.stringify({ event, action, code: String(code).slice(0, 40), count: counters.get(event) }))
}
export function recordSuccess(event, { now = Date.now() } = {}) { lastAt.set(`${event}:ok`, now) }

export function failureCounts() {
  return Object.fromEntries([...counters].map(([event, count]) => [event, { count, lastAt: new Date(lastAt.get(event)).toISOString() }]))
}

/** Health snapshot: engine-loop lag, market-feed staleness, failure counters. */
export function metricsSnapshot({ engine = null, marketData = null, now = Date.now(), lagLimitMs = 10_000, staleLimitMs = 60_000 } = {}) {
  const lastPassAt = engine?.lastPassAt ?? null
  const lagMs = lastPassAt ? now - lastPassAt : null
  let markets = 0, fresh = 0, newest = null
  if (marketData?.marks) for (const [, m] of marketData.marks) { markets++; if (now - m.at < 5000) fresh++; newest = Math.max(newest ?? 0, m.at) }
  const feedAgeMs = newest ? now - newest : null
  const failures = failureCounts()
  const alerts = []
  if (engine && (lagMs === null || lagMs > lagLimitMs)) alerts.push('engine_loop_lag')
  if (marketData && (feedAgeMs === null || feedAgeMs > staleLimitMs)) alerts.push('market_feed_stale')
  if (failures.payment_recovery_failure) alerts.push('payment_recovery_failures')
  if (failures.payment_watcher_failure) alerts.push('payment_watcher_failures')
  if (failures.payment_escalation_failure) alerts.push('payment_escalation_failures')
  if (failures.audit_insert_failure) alerts.push('audit_insert_failures')
  return { generatedAt: new Date(now).toISOString(), uptimeSeconds: Math.round(process.uptime()),
    engineLoop: { lastPassAt: lastPassAt ? new Date(lastPassAt).toISOString() : null, lagMs, limitMs: lagLimitMs },
    marketFeed: { markets, fresh, newestMarkAgeMs: feedAgeMs, limitMs: staleLimitMs },
    failures, alerts, ok: alerts.length === 0 }
}

export function resetForTests() { counters.clear(); lastAt.clear() }
