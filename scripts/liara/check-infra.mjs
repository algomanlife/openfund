#!/usr/bin/env node
/**
 * Infrastructure drift check for Openfund's Liara deployments (ADR 0042).
 * The manifest infra/liara-iran-runtime/stack.json is the single source of
 * truth; this script fails when the repository, the live Liara account or the
 * GitHub environments disagree with it.
 *
 *   node scripts/liara/check-infra.mjs                 # static: manifest, workflows, docs (CI, no secrets)
 *   node scripts/liara/check-infra.mjs --live          # + live Liara (LIARA_API_TOKEN) and GitHub (gh)
 *       [--expect-commit <40-hex>]                     #   + latest ready release of each app is this commit
 *   node scripts/liara/check-infra.mjs --guard runtime --target staging|production --web <app> --worker <app>
 *   node scripts/liara/check-infra.mjs --guard edge --target staging|production --app <app>
 *
 * Guards run inside the deploy workflows before anything is deployed. With
 * LIARA_API_TOKEN set they also inspect the live target. Secrets are never
 * printed: a DATABASE_URL is reduced to its host before it is compared.
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = new URL('../../', import.meta.url)
const read = p => readFileSync(new URL(p, ROOT), 'utf8')
const TARGETS = ['staging', 'production']

/* identifiers that were documented but never existed in the account */
export const STALE_IDS = ['openfund-iran-web', 'openfund-iran-net']
export const DOCS = ['docs/deployment/LIARA_IRAN_RUNTIME.md', 'docs/deployment/LIARA_IRAN.md', 'docs/deployment/LIARA_IRAN_SETUP.md', 'docs/deployment/ENVIRONMENT.md']
const RUNTIME_WORKFLOW = '.github/workflows/deploy-liara-iran-runtime.yml'
const EDGE_WORKFLOW = '.github/workflows/deploy-liara-iran.yml'

export const loadStack = () => JSON.parse(read('infra/liara-iran-runtime/stack.json'))

export function loadFiles(stack = loadStack()) {
  const files = { [RUNTIME_WORKFLOW]: read(RUNTIME_WORKFLOW), [EDGE_WORKFLOW]: read(EDGE_WORKFLOW) }
  for (const d of DOCS) files[d] = read(d)
  for (const f of ['.liaraignore', 'infra/liara-iran-runtime/Dockerfile.dockerignore']) files[f] = existsSync(new URL(f, ROOT)) ? read(f) : null
  return files
}

/* `environment: ${{ inputs.target == 'production' && 'A' || 'B' }}` → { production: A, staging: B } */
export function workflowEnvironments(text) {
  const m = text?.match(/environment:\s*\$\{\{\s*inputs\.target == 'production' && '([^']+)' \|\| '([^']+)'\s*\}\}/)
  return m ? { production: m[1], staging: m[2] } : null
}

const appsOf = (stack, target) => stack.environments[target].apps
const roleApp = (stack, target, role) => appsOf(stack, target).find(a => a.role === role)
const runtimeAppIds = stack => new Set(TARGETS.flatMap(t => appsOf(stack, t).map(a => a.id)))
const ignoreLines = t => (t ?? '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
export const dbHost = url => { try { return new URL(url).hostname } catch { return null } }
const isGlobalDb = (stack, host) => !host || stack.global.forbiddenDatabaseHostPatterns.some(p => host.includes(p)) || host === stack.global.database

export function staticCheck(stack, files) {
  const problems = []
  const bad = m => problems.push(m)

  /* 1. workflows deploy through the manifest's GitHub environments */
  const rt = workflowEnvironments(files[RUNTIME_WORKFLOW]), edge = workflowEnvironments(files[EDGE_WORKFLOW])
  if (!rt) bad(`${RUNTIME_WORKFLOW}: deploy environment expression not found`)
  if (!edge) bad(`${EDGE_WORKFLOW}: deploy environment expression not found`)
  for (const t of TARGETS) {
    if (rt && rt[t] !== stack.environments[t].github.environment) bad(`${RUNTIME_WORKFLOW}: ${t} uses environment "${rt[t]}", manifest says "${stack.environments[t].github.environment}"`)
    if (edge && edge[t] !== stack.legacyEdge.environments[t].github) bad(`${EDGE_WORKFLOW}: ${t} uses environment "${edge[t]}", manifest says "${stack.legacyEdge.environments[t].github}"`)
  }

  /* 2. no identifier is shared between GLOBAL, runtime staging, runtime production and the edge */
  const scopes = { global: [...stack.global.services, stack.global.database, ...stack.global.githubEnvironments] }
  for (const t of TARGETS) {
    const e = stack.environments[t]
    scopes[`runtime ${t}`] = [e.network, e.database.name, e.github.environment, ...e.apps.map(a => a.id), ...e.apps.flatMap(a => a.domains ?? [])]
    const ed = stack.legacyEdge.environments[t]
    scopes[`edge ${t}`] = [ed.app, ed.github]
  }
  const owner = new Map()
  for (const [scope, ids] of Object.entries(scopes)) for (const id of ids) {
    if (owner.has(id) && owner.get(id) !== scope) bad(`"${id}" is used by both ${owner.get(id)} and ${scope}`)
    else owner.set(id, scope)
  }

  /* 3. roles: the web app migrates and is public; the worker never is */
  for (const t of TARGETS) {
    const e = stack.environments[t]
    if (e.database.publicNetwork) bad(`${t}: database ${e.database.name} must not be on the public network`)
    for (const a of e.apps.filter(a => a.role !== 'cms')) {
      const roles = (a.env?.OPENFUND_ROLES ?? '').split(',')
      if (a.env?.OPENFUND_REGION !== 'IRAN') bad(`${t}/${a.id}: OPENFUND_REGION must be IRAN`)
      for (const s of ['DATABASE_URL', 'CMS_PUBLIC_URL']) if (!a.secrets?.includes(s)) bad(`${t}/${a.id}: must list ${s} (required at boot in production)`)
      if (a.role === 'web' && (a.env?.MIGRATE_ON_START !== '1' || !roles.includes('http') || a.public !== true)) bad(`${t}/${a.id}: the web app must be public, run http and migrate (MIGRATE_ON_START=1)`)
      if (a.role === 'worker') {
        if (a.public !== false || (a.domains ?? []).length) bad(`${t}/${a.id}: the worker must be private with no domains`)
        if (roles.includes('http')) bad(`${t}/${a.id}: the worker must not run the http role`)
        if (a.env?.MIGRATE_ON_START === '1') bad(`${t}/${a.id}: only the web app migrates`)
      }
    }
    if (!roleApp(stack, t, 'web') || !roleApp(stack, t, 'worker')) bad(`${t}: needs one web and one worker app`)
  }

  /* 4. deploy order and guards in the workflows */
  const w = files[RUNTIME_WORKFLOW] ?? ''
  const webAt = w.indexOf('"$WEB_APP:liara.web.json"'), workerAt = w.indexOf('"$WORKER_APP:liara.worker.json"')
  if (webAt < 0 || workerAt < 0 || webAt > workerAt) bad(`${RUNTIME_WORKFLOW}: must deploy the web app (which migrates) before the worker`)
  /* a real step, not a comment, runs the guard (from the workflow revision) */
  const runsGuard = (text, kind) => new RegExp(`^\\s*run: node \\S*check-infra\\.mjs"? --guard ${kind} `, 'm').test(text ?? '')
  if (!runsGuard(w, 'runtime')) bad(`${RUNTIME_WORKFLOW}: must run the runtime deploy guard`)
  if (!runsGuard(files[EDGE_WORKFLOW], 'edge')) bad(`${EDGE_WORKFLOW}: must run the edge deploy guard`)

  /* 5. documentation names what the manifest says, and nothing stale */
  for (const [path, text] of Object.entries(files)) {
    if (!text || path.endsWith('ignore')) continue
    for (const id of STALE_IDS) if (new RegExp(`\\b${id}\\b`).test(text)) bad(`${path}: stale identifier "${id}" (manifest: ${roleApp(stack, 'production', 'web').id} / network ${stack.environments.production.network})`)
    /* a table row that prescribes the edge app id must never name a runtime app */
    for (const row of text.split('\n').filter(l => l.startsWith('|') && l.includes('LIARA_APP_NAME')))
      for (const id of runtimeAppIds(stack)) if (row.includes(`\`${id}\``)) bad(`${path}: LIARA_APP_NAME row names runtime app "${id}" for the edge`)
  }
  const runtimeDoc = files['docs/deployment/LIARA_IRAN_RUNTIME.md'] ?? ''
  const prod = stack.environments.production
  for (const id of [...prod.apps.map(a => a.id), prod.network, prod.database.name, ...TARGETS.map(t => stack.environments[t].github.environment)])
    if (!runtimeDoc.includes(`\`${id}\``)) bad(`docs/deployment/LIARA_IRAN_RUNTIME.md: does not name \`${id}\` from the manifest`)
  const edgeDoc = files['docs/deployment/LIARA_IRAN.md'] ?? ''
  for (const t of TARGETS) for (const id of Object.values(stack.legacyEdge.environments[t]))
    if (!edgeDoc.includes(`\`${id}\``)) bad(`docs/deployment/LIARA_IRAN.md: does not name \`${id}\` from the manifest`)

  /* 6. the Liara CLI upload filter matches the image's build-context filter */
  if (files['.liaraignore'] == null) bad('.liaraignore is missing: liara deploy would fall back to the root .dockerignore and drop apps/web-react/src/brand')
  else if (ignoreLines(files['.liaraignore']).join('\n') !== ignoreLines(files['infra/liara-iran-runtime/Dockerfile.dockerignore']).join('\n'))
    bad('.liaraignore differs from infra/liara-iran-runtime/Dockerfile.dockerignore')
  return problems
}

/* inventory = { projects: [{ id, network, defaultSubdomain, env: {k: v (DATABASE_URL reduced to host)}, releases: [{ state, message }] }],
                 databases: [{ name, network, public }], domains: [{ name, project }],
                 github: null | { [envName]: { reviewers: bool, vars: {} } } } */
export function liveCheck(stack, inv, { targets = TARGETS, expectCommit = null } = {}) {
  const problems = []
  const bad = m => problems.push(m)
  const project = id => inv.projects.find(p => p.id === id)
  const runtimeIds = runtimeAppIds(stack)
  for (const t of targets) {
    const e = stack.environments[t]
    if (!e.provisioned) continue
    const db = inv.databases.find(d => d.name === e.database.name)
    if (!db) bad(`${t}: database ${e.database.name} does not exist`)
    else {
      if (db.public) bad(`${t}: database ${db.name} is on the public network`)
      if (db.network !== e.network) bad(`${t}: database ${db.name} is on network "${db.network}", manifest says "${e.network}"`)
    }
    for (const a of e.apps.filter(a => a.provisioned !== false)) {
      const p = project(a.id)
      if (!p) { bad(`${t}: app ${a.id} does not exist`); continue }
      if (p.network !== e.network) bad(`${t}/${a.id}: on network "${p.network}", manifest says "${e.network}"`)
      for (const [k, v] of Object.entries(a.env ?? {})) if (p.env[k] !== v) bad(`${t}/${a.id}: ${k}=${p.env[k] ?? '(unset)'}, manifest says ${v}`)
      for (const s of a.secrets ?? []) if (!['REGION_SYNC_KEYS', 'REGION_SYNC_ACTIVE_KID', 'REGION_SYNC_PEER_URL'].includes(s) && !(s in p.env)) bad(`${t}/${a.id}: required ${s} is not set`)
      if (a.role !== 'cms') {
        const host = p.env.DATABASE_URL
        if (isGlobalDb(stack, host)) bad(`${t}/${a.id}: DATABASE_URL does not point at an Iran database (host ${host ?? 'unset'})`)
        else if (host !== e.database.name) bad(`${t}/${a.id}: DATABASE_URL host ${host}, manifest says ${e.database.name}`)
        for (const k of ['OPENFUND_UPSTREAM_HOST', 'EDGE_PORT', 'OPENFUND_EDGE_CLIENT_IP_KEY']) if (k in p.env) bad(`${t}/${a.id}: carries edge proxy setting ${k} (runtime apps are not the edge)`)
      }
      const attached = inv.domains.filter(d => d.project === a.id).map(d => d.name)
      if (a.role === 'worker') {
        if (p.defaultSubdomain) bad(`${t}/${a.id}: default subdomain ${a.id}.liara.run is enabled (the worker must not be public)`)
        if (attached.length) bad(`${t}/${a.id}: worker has public domains ${attached.join(', ')}`)
      }
      for (const d of a.domains ?? []) if (!attached.includes(d)) bad(`${t}/${a.id}: domain ${d} is not attached`)
      if (expectCommit) {
        const ready = p.releases.find(r => r.state === 'READY')
        if (!ready?.message?.includes(expectCommit)) bad(`${t}/${a.id}: latest ready release is not ${expectCommit} (${(ready?.message ?? 'none').slice(0, 60)})`)
      }
    }
  }
  for (const t of TARGETS) {
    const ed = stack.legacyEdge.environments[t]
    const p = project(ed.app)
    if (p && 'OPENFUND_REGION' in p.env) bad(`edge ${t}: app ${ed.app} runs the regional runtime, not the edge`)
  }
  for (const d of inv.domains) if (!runtimeIds.has(d.project) && !Object.values(stack.legacyEdge.environments).some(e => e.app === d.project)) bad(`domain ${d.name} is attached to unmanaged app ${d.project}`)

  if (inv.github) {
    const gh = inv.github
    for (const t of TARGETS) {
      const e = stack.environments[t], name = e.github.environment, env = gh[name]
      if (!env) { if (e.provisioned) bad(`GitHub environment ${name} (${t}) does not exist`); continue }
      const want = { LIARA_RUNTIME_WEB_APP: roleApp(stack, t, 'web').id, LIARA_RUNTIME_WORKER_APP: roleApp(stack, t, 'worker').id }
      for (const [k, v] of Object.entries(want)) if (env.vars[k] !== v) bad(`GitHub ${name}: ${k}=${env.vars[k] ?? '(unset)'}, manifest says ${v}`)
      const url = env.vars.LIARA_RUNTIME_PUBLIC_URL
      if (!url || dbHost(url) !== e.github.publicUrlHost) bad(`GitHub ${name}: LIARA_RUNTIME_PUBLIC_URL=${url ?? '(unset)'}, manifest host ${e.github.publicUrlHost}`)
      if (e.github.requiredReviewers && !env.reviewers) bad(`GitHub ${name}: has no required reviewers`)
      if (t === 'production' && !env.vars.OPENFUND_GLOBAL_URL) bad(`GitHub ${name}: OPENFUND_GLOBAL_URL is unset, so a deploy cannot prove it matches the GLOBAL release`)
    }
    for (const t of TARGETS) {
      const ed = stack.legacyEdge.environments[t], env = gh[ed.github]
      if (!env) continue
      const app = env.vars.LIARA_APP_NAME
      if (app && runtimeIds.has(app)) bad(`GitHub ${ed.github}: LIARA_APP_NAME=${app} is a runtime app; an edge deploy would overwrite it`)
      else if (app && app !== ed.app) bad(`GitHub ${ed.github}: LIARA_APP_NAME=${app}, manifest says ${ed.app}`)
      if (!env.reviewers) bad(`GitHub ${ed.github}: has no required reviewers`)
    }
  }
  return problems
}

export function guardRuntime(stack, { target, web, worker }) {
  const problems = []
  const e = stack.environments[target]
  if (!e) return [`unknown target ${target}`]
  if (!e.provisioned) problems.push(`${target} is not provisioned (stack.json "provisioned": false); provision it before deploying`)
  if (web !== roleApp(stack, target, 'web').id) problems.push(`${target}: LIARA_RUNTIME_WEB_APP=${web}, manifest says ${roleApp(stack, target, 'web').id}`)
  if (worker !== roleApp(stack, target, 'worker').id) problems.push(`${target}: LIARA_RUNTIME_WORKER_APP=${worker}, manifest says ${roleApp(stack, target, 'worker').id}`)
  if (web === worker) problems.push('web and worker must be different apps')
  return problems
}

export function guardEdge(stack, { target, app }) {
  const problems = []
  const ed = stack.legacyEdge.environments[target]
  if (!ed) return [`unknown target ${target}`]
  if (runtimeAppIds(stack).has(app)) problems.push(`${app} is a regional runtime app; the edge must never be deployed over it`)
  else if (app !== ed.app) problems.push(`edge ${target}: LIARA_APP_NAME=${app}, manifest says ${ed.app}`)
  return problems
}

/* ---- live inventory (read-only) ---- */
async function liaraInventory(token) {
  const get = async p => {
    const r = await fetch(`https://api.iran.liara.ir${p}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) })
    if (!r.ok) throw new Error(`Liara GET ${p}: ${r.status}`)
    return r.json()
  }
  const projects = []
  for (const row of (await get('/v1/projects')).projects ?? []) {
    const d = (await get(`/v1/projects/${row.project_id}`)).project ?? {}
    const env = {}
    for (const { key, value } of d.envs ?? []) env[key] = key === 'DATABASE_URL' ? dbHost(value) : (/KEY|TOKEN|SECRET|PASSWORD/.test(key) ? '(set)' : value)
    const rel = await get(`/v1/projects/${row.project_id}/releases`).catch(() => ({}))
    projects.push({ id: row.project_id, network: row.network?.name ?? null, defaultSubdomain: !!d.defaultSubdomain, env,
      releases: (rel.releases ?? []).map(r => ({ state: r.state, message: r.message ?? '' })) })
  }
  const databases = ((await get('/v1/databases')).databases ?? []).map(d => ({ name: d.hostname, network: d.network?.name ?? null, public: !!d.publicNetwork }))
  const domains = ((await get('/v1/domains')).domains ?? []).map(d => ({ name: d.name, project: typeof d.project === 'object' ? d.project?.project_id : d.project }))
  return { projects, databases, domains }
}

function githubInventory(repo = 'algomanlife/openfund') {
  const gh = path => { const r = spawnSync('gh', ['api', path], { encoding: 'utf8' }); return r.status === 0 ? JSON.parse(r.stdout) : null }
  const list = gh(`repos/${repo}/environments`)
  if (!list) return null
  const out = {}
  for (const e of list.environments ?? []) {
    const vars = Object.fromEntries((gh(`repos/${repo}/environments/${encodeURIComponent(e.name)}/variables`)?.variables ?? []).map(v => [v.name, v.value]))
    out[e.name] = { reviewers: (e.protection_rules ?? []).some(r => r.type === 'required_reviewers' && (r.reviewers ?? []).length), vars }
  }
  return out
}

export async function main(argv = process.argv.slice(2), { log = console.log } = {}) {
  const arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null }
  const stack = loadStack()
  const problems = staticCheck(stack, loadFiles(stack))
  const guard = arg('--guard'), target = arg('--target'), token = process.env.LIARA_API_TOKEN
  const expectCommit = arg('--expect-commit')
  if (expectCommit && !/^[0-9a-f]{40}$/.test(expectCommit)) throw new Error('--expect-commit needs a 40-character commit')
  if (guard) {
    if (!TARGETS.includes(target)) throw new Error('--target staging|production is required with --guard')
    if (guard === 'runtime') problems.push(...guardRuntime(stack, { target, web: arg('--web'), worker: arg('--worker') }))
    else if (guard === 'edge') problems.push(...guardEdge(stack, { target, app: arg('--app') }))
    else throw new Error('--guard runtime|edge')
    if (token) {
      const inv = { ...(await liaraInventory(token)), github: null }
      if (guard === 'runtime') problems.push(...liveCheck(stack, inv, { targets: [target], expectCommit }))
      else { const p = inv.projects.find(p => p.id === arg('--app')); if (p && 'OPENFUND_REGION' in p.env) problems.push(`${p.id} runs the regional runtime; refusing to deploy the edge over it`) }
    } else log('(no LIARA_API_TOKEN: live target not inspected)')
  } else if (argv.includes('--live')) {
    if (!token) throw new Error('--live needs LIARA_API_TOKEN in the environment')
    problems.push(...liveCheck(stack, { ...(await liaraInventory(token)), github: githubInventory() }, { expectCommit }))
  }
  for (const p of problems) log(`DRIFT  ${p}`)
  log(problems.length ? `${problems.length} problem(s)` : 'infrastructure manifest, workflows and docs agree')
  return problems
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then(p => process.exit(p.length ? 1 : 0), e => { console.error(e.message); process.exit(2) })
}
