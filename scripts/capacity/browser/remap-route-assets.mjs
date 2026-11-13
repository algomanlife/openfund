/**
 * Re-map k6/route-assets.json to the current frontend build when a browser
 * cannot be used to re-record it (capture-routes.mjs is the preferred tool).
 *
 * Vite names hashed files `<name>-<hash>.<ext>`. Each recorded /assets/ path
 * is replaced by the current file with the same <name> and extension (bytes
 * updated from disk); entry files referenced by react/index.html that the
 * old recording lacks are added to every route. Documents, runtime config
 * and public API requests are dynamic and kept as recorded. Unmatched
 * recorded assets are dropped and listed.
 *
 * Usage: node browser/remap-route-assets.mjs [reactDir=../../react]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REACT = path.resolve(process.argv[2] || path.join(HERE, '../../../react'))
const FILE = path.join(HERE, '../k6/route-assets.json')
const graph = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const stem = p => { const b = path.basename(p); const m = b.match(/^(.*)-[A-Za-z0-9_-]{8}(\.[a-z0-9]+)$/); return m ? m[1] + m[2] : null }
const current = new Map()
for (const f of fs.readdirSync(path.join(REACT, 'assets'))) { const s = stem(f); if (s && !current.has(s)) current.set(s, f) }
const html = fs.readFileSync(path.join(REACT, 'index.html'), 'utf8')
const entries = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1])
const dropped = new Set(); let remapped = 0, added = 0
for (const [route, reqs] of Object.entries(graph)) {
  const out = []
  for (const r of reqs) {
    const p = r.path.split('?')[0]
    if (!p.startsWith('/assets/')) { out.push(r); continue }
    if (fs.existsSync(path.join(REACT, p))) { out.push(r); continue }
    const s = stem(p), f = s && current.get(s)
    if (!f) { dropped.add(p); continue }
    out.push({ ...r, path: '/assets/' + f, bytes: fs.statSync(path.join(REACT, 'assets', f)).size }); remapped++
  }
  for (const e of entries) if (!out.some(r => r.path === e)) {
    out.push({ path: e, type: e.endsWith('.css') ? 'stylesheet' : 'script', status: 200, bytes: fs.statSync(path.join(REACT, e)).size, cache: 'public, max-age=31536000, immutable' }); added++
  }
  graph[route] = out
}
fs.writeFileSync(FILE, JSON.stringify(graph, null, 1) + '\n')
console.log(JSON.stringify({ remapped, addedEntryFiles: added, dropped: [...dropped] }))
