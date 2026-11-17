/* Pure checks used by scripts/release/deploy.mjs and regions-status.mjs.
   One official release = one commit on every service of every region. */

/** Render must not deploy by itself: an approved release is the only trigger */
export const autoDeployOff = service => service?.autoDeploy === 'no' || service?.autoDeployTrigger === 'off'

/** Web/API: backend /version and frontend manifest both carry the release */
export const webMatches = (source, [backend, frontend]) => backend?.status === 'matched' && backend.commit === source.commit &&
  frontend?.commit === source.commit && frontend?.version === source.version && frontend?.frontend?.id === source.frontend.id &&
  backend.backend?.id === source.backend.id

/** Backstage: /health reports the deployed commit */
export const backstageMatches = (source, health) => health?.ok === true && health.commit === source.commit

/** Backstage verified after a deploy. A build that reports a commit must
 *  report this one. A build from before the identity field (a rollback to
 *  v0.6.5 or older) reports none; it passes only when Render itself confirmed
 *  that the deploy of exactly this commit is live. */
export const backstageVerified = (source, health, renderConfirmedCommit) =>
  backstageMatches(source, health) || (health?.ok === true && health?.commit == null && renderConfirmedCommit === source.commit)

/** every reachable region and service on one commit and version; returns problems */
export function releaseSkew(rows) {
  const problems = []
  const known = rows.filter(r => r.commit)
  for (const r of rows) if (!r.commit) problems.push(`${r.name}: release identity unavailable${r.error ? ` (${r.error})` : ''}`)
  const commits = new Set(known.map(r => r.commit))
  if (commits.size > 1) problems.push(`commit skew: ${known.map(r => `${r.name}=${r.commit.slice(0, 8)}`).join(', ')}`)
  const versions = new Set(known.filter(r => r.version).map(r => r.version))
  if (versions.size > 1) problems.push(`version skew: ${known.filter(r => r.version).map(r => `${r.name}=${r.version}`).join(', ')}`)
  return problems
}
