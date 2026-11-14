#!/usr/bin/env node
/**
 * Release identity for an Iran runtime build: the SAME rule Render's build
 * applies (scripts/release/render-build.mjs). An official tag at the commit,
 * or else the gated main candidate: the commit must be the current main tip
 * with the required CI checks green. The version is printed as JSON
 * {version, official}; the process fails when the commit is not releasable.
 *
 *   node scripts/liara/release-source.mjs <40-hex-commit>
 */
import { candidateSource } from '../release/candidate-source.mjs'

const sha = process.argv[2]
if (!/^[a-f0-9]{40}$/.test(sha || '')) { console.error('usage: release-source.mjs <40-hex-commit>'); process.exit(2) }
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'openfund-liara-release-source' }
if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN || process.env.GH_TOKEN}`
const api = 'https://api.github.com/repos/algomanlife/openfund'
try {
  let tag
  for (let page = 1; page <= 10 && !tag; page++) {
    const r = await fetch(`${api}/tags?per_page=100&page=${page}`, { headers, signal: AbortSignal.timeout(15000) })
    if (!r.ok) throw new Error(`tag lookup failed: ${r.status}`)
    const tags = await r.json()
    tag = tags.find(t => t.commit?.sha === sha && /^v\d+\.\d+\.\d+$/.test(t.name))?.name
    if (tags.length < 100) break
  }
  const out = tag ? { version: tag.slice(1), official: true } : { version: (await candidateSource(sha)).version, official: false }
  console.log(JSON.stringify(out))
} catch (e) { console.error(`not releasable: ${e.message}`); process.exit(1) }
