/* Every HTTP route the backend declares, read from source (no server boot).
   `app.<method>(path)` is absolute. `router.<method>(path)` in a module is
   relative to each prefix that server.js mounts that module's factory under
   (app.use('/prefix', factory(...))), or absolute when mounted without one.
   Used by the redirect regression tests (ADR 0043). */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const METHOD = /\b([A-Za-z_$][\w$]*)\.(get|post|put|patch|delete|all|head)\(\s*(\[[^\]]*\]|'[^']*'|"[^"]*"|`[^`]*`)/g
const strings = raw => [...raw.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(m => m[1] ?? m[2] ?? m[3])

function sources(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'test', 'scripts'].includes(name)) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...sources(p))
    else if (name.endsWith('.js')) out.push(p)
  }
  return out
}

export function routeInventory() {
  const server = readFileSync(join(ROOT, 'server.js'), 'utf8')
  /* factory name → module file */
  const fromFile = new Map()
  for (const m of server.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/([^']+)'/g))
    for (const name of m[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop())) fromFile.set(name, m[2])
  /* module file → mount prefixes ('' = mounted without a prefix) */
  const mounts = new Map()
  /* app.use('/prefix', [limit(n),] factory(…)) and app.use(factory(…)) */
  for (const m of server.matchAll(/app\.use\(\s*(?:'([^']*)'\s*,\s*)?(?:limit\(\d+\)\s*,\s*)?([\w$]+)\(/g)) {
    const file = fromFile.get(m[2]); if (!file) continue
    if (!mounts.has(file)) mounts.set(file, new Set())
    mounts.get(file).add(m[1] ?? '')
  }
  const routes = []
  for (const file of sources(ROOT)) {
    const rel = file.slice(ROOT.length)
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(METHOD)) {
      const [, receiver, method] = m
      for (const path of strings(m[3])) {
        if (!path.startsWith('/')) continue
        const set = mounts.get(rel) ?? new Set([''])
        const prefixes = receiver === 'app' ? [''] : [...set]
        /* a file mounted both with and without a prefix (a router plus a middleware
           factory): its router paths are emitted both ways; the unprefixed copy is
           flagged, since it may not exist */
        const ambiguous = receiver !== 'app' && set.size > 1
        for (const prefix of prefixes) routes.push({ method: method.toUpperCase(), path: (prefix + path).replace(/\/{2,}/g, '/'), file: basename(file), receiver,
          ambiguous: ambiguous && prefix === '' })
      }
    }
  }
  /* routers mounted under a prefix also answer at the prefix itself */
  for (const [file, set] of mounts) for (const prefix of set) if (prefix) routes.push({ method: 'GET', path: prefix, file })
  return routes
}

/** a concrete request path for a route pattern (":id" → "x1", "*splat" → "a/b") */
export const sample = path => path.replace(/\{?\/?\*[\w$]*\}?/g, '/a/b').replace(/:([\w$]+)\??/g, 'x1').replace(/\/{2,}/g, '/') || '/'
