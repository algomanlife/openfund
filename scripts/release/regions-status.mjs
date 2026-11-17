#!/usr/bin/env node
/**
 * Release identity of every production service in both regions (public
 * endpoints only, no credentials). Exit 1 on any commit or version skew.
 *
 *   node scripts/release/regions-status.mjs [--expect-commit <40-hex>]
 *     --global  https://openfi.cloud            (GLOBAL Web/API /version)
 *     --backstage https://backstage.openfi.cloud (Backstage /health commit)
 *     --iran    https://openfi.live             (IRAN web /version)
 * The IRAN worker has no public route; its release is checked with
 * `scripts/liara/check-infra.mjs --guard runtime … --expect-commit`.
 */
import { fileURLToPath } from 'node:url'
import { releaseSkew } from './deploy-checks.mjs'

const json = url => fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) }).then(r => { if (!r.ok) throw Error(`HTTP ${r.status}`); return r.json() })

export async function collect({ global = 'https://openfi.cloud', backstage = 'https://backstage.openfi.cloud', iran = 'https://openfi.live' } = {}) {
  const row = async (name, url, pick) => { try { return { name, ...pick(await json(url)) } } catch (e) { return { name, commit: null, error: e.message } } }
  return Promise.all([
    row('GLOBAL web/api', new URL('/version', global), v => ({ commit: v.commit, version: v.version, official: v.frontend?.official ?? null, status: v.status })),
    row('GLOBAL backstage', new URL('/health', backstage), h => ({ commit: h.commit ?? null, version: null })),
    row('IRAN web/api', new URL('/version', iran), v => ({ commit: v.commit, version: v.version, official: v.frontend?.official ?? null, status: v.status })),
  ])
}

async function main() {
  const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined }
  const rows = await collect({ global: arg('--global'), backstage: arg('--backstage'), iran: arg('--iran') })
  const problems = releaseSkew(rows)
  const expect = arg('--expect-commit')
  if (expect) for (const r of rows) if (r.commit && r.commit !== expect) problems.push(`${r.name} runs ${r.commit.slice(0, 8)}, expected ${expect.slice(0, 8)}`)
  for (const r of rows) console.log(`${r.name.padEnd(18)} ${r.commit ? r.commit.slice(0, 12) : '—'.padEnd(12)} ${r.version ?? ''} ${r.error ? `(${r.error})` : ''}`)
  for (const p of problems) console.log(`SKEW  ${p}`)
  console.log(problems.length ? `${problems.length} problem(s)` : 'every service in both regions runs the same release')
  process.exit(problems.length ? 1 : 0)
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
