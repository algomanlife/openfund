/* Infrastructure drift check (ADR 0042): the manifest, workflows, docs, live
   Liara account and GitHub environments must agree; deploy guards refuse
   collisions. Live inventories here are fixtures; no network access. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadStack, loadFiles, staticCheck, liveCheck, guardRuntime, guardEdge, workflowEnvironments } from '../check-infra.mjs'

const RT = '.github/workflows/deploy-liara-iran-runtime.yml'
const EDGE = '.github/workflows/deploy-liara-iran.yml'
const COMMIT = 'a'.repeat(40)
const stack = loadStack()
const files = loadFiles(stack)
const clone = () => structuredClone(stack)
const has = (problems, re) => assert.ok(problems.some(p => re.test(p)), `expected ${re} in:\n${problems.join('\n')}`)

/* a live account and GitHub that match the manifest exactly */
function healthy() {
  const prod = stack.environments.production
  const projects = prod.apps.filter(a => a.provisioned !== false).map(a => ({
    id: a.id, network: prod.network, defaultSubdomain: a.role === 'web',
    env: { ...a.env, ...Object.fromEntries(a.secrets.map(s => [s, '(set)'])), DATABASE_URL: prod.database.name },
    releases: [{ state: 'READY', message: `openfund ${COMMIT} production` }],
  }))
  return {
    projects,
    databases: [{ name: prod.database.name, network: prod.network, public: false }],
    domains: prod.apps.flatMap(a => (a.domains ?? []).map(d => ({ name: d, project: a.id }))),
    github: {
      'liara-iran-runtime': { reviewers: true, vars: { LIARA_RUNTIME_WEB_APP: 'openfund-iran', LIARA_RUNTIME_WORKER_APP: 'openfund-iran-worker', LIARA_RUNTIME_PUBLIC_URL: 'https://openfi.live', OPENFUND_GLOBAL_URL: 'https://openfund.cloud' } },
    },
  }
}

test('the committed manifest, workflows and docs agree', () => {
  assert.deepEqual(staticCheck(stack, files), [])
})

test('a workflow environment name that differs from the manifest fails', () => {
  const f = { ...files, [RT]: files[RT].replace("|| 'liara-iran-runtime-staging'", "|| 'liara-iran-staging'") }
  has(staticCheck(stack, f), /staging uses environment "liara-iran-staging"/)
  assert.deepEqual(workflowEnvironments(files[EDGE]), { production: 'liara-iran', staging: 'liara-iran-staging' })
})

test('staging that targets production infrastructure fails', () => {
  const s = clone()
  s.environments.staging.apps[0].id = 'openfund-iran'
  has(staticCheck(s, files), /"openfund-iran" is used by both runtime/)
  const n = clone()
  n.environments.staging.network = n.environments.production.network
  has(staticCheck(n, files), /is used by both runtime staging and runtime production|is used by both runtime production and runtime staging/)
})

test('an edge app that is a runtime app fails statically and in the guard', () => {
  const s = clone()
  s.legacyEdge.environments.staging.app = 'openfund-iran'
  has(staticCheck(s, files), /"openfund-iran" is used by both/)
  has(guardEdge(stack, { target: 'staging', app: 'openfund-iran' }), /regional runtime app/)
  assert.deepEqual(guardEdge(stack, { target: 'staging', app: 'openfund-iran-edge-staging' }), [])
})

test('a worker configured as a public web application fails', () => {
  const s = clone()
  const w = s.environments.production.apps.find(a => a.role === 'worker')
  w.public = true
  w.domains = ['worker.example']
  has(staticCheck(s, files), /worker must be private/)
  const r = clone()
  r.environments.production.apps.find(a => a.role === 'worker').env.OPENFUND_ROLES = 'http,engine'
  has(staticCheck(r, files), /must not run the http role/)
})

test('a web app without market data (orders always stale) fails', () => {
  const s = clone()
  s.environments.production.apps.find(a => a.role === 'web').env.OPENFUND_ROLES = 'http'
  has(staticCheck(s, files), /must run market-data/)
})

test('deploying the worker before the migrating web app fails', () => {
  const swapped = files[RT].replace('"$WEB_APP:liara.web.json" "$WORKER_APP:liara.worker.json"', '"$WORKER_APP:liara.worker.json" "$WEB_APP:liara.web.json"')
  assert.notEqual(swapped, files[RT])
  has(staticCheck(stack, { ...files, [RT]: swapped }), /web app \(which migrates\) before the worker/)
})

test('workflows without their deploy guard step fail, even when a comment mentions it', () => {
  has(staticCheck(stack, { ...files, [EDGE]: files[EDGE].replaceAll('--guard edge', '') }), /must run the edge deploy guard/)
  const commentOnly = files[RT].replace(/^(\s*)run: node (\S*check-infra\.mjs"? --guard runtime)/gm, '$1# $2')
  assert.notEqual(commentOnly, files[RT])
  has(staticCheck(stack, { ...files, [RT]: commentOnly }), /must run the runtime deploy guard/)
})

test('documentation that disagrees with the manifest fails', () => {
  const doc = 'docs/deployment/LIARA_IRAN_RUNTIME.md'
  has(staticCheck(stack, { ...files, [doc]: files[doc] + '\nDeploy to `openfund-iran-web`.\n' }), /stale identifier "openfund-iran-web"/)
  has(staticCheck(stack, { ...files, [doc]: files[doc].replaceAll('`openfund-iran-worker`', 'the worker') }), /does not name `openfund-iran-worker`/)
  const edgeDoc = 'docs/deployment/LIARA_IRAN.md'
  has(staticCheck(stack, { ...files, [edgeDoc]: files[edgeDoc] + '\n| `LIARA_APP_NAME` | Variable | prod | `openfund-iran` |\n' }), /names runtime app "openfund-iran"/)
})

test('the Liara upload filter must exist and match the image filter', () => {
  has(staticCheck(stack, { ...files, '.liaraignore': null }), /\.liaraignore is missing/)
  has(staticCheck(stack, { ...files, '.liaraignore': files['.liaraignore'] + '\nbrand\n' }), /differs from/)
})

test('a live account that matches the manifest passes', () => {
  assert.deepEqual(liveCheck(stack, healthy(), { expectCommit: COMMIT }), [])
})

test('GLOBAL and IRAN databases are never confused', () => {
  const inv = healthy()
  inv.projects[0].env.DATABASE_URL = 'dpg-abc123-a.oregon-postgres.render.com'
  has(liveCheck(stack, inv), /does not point at an Iran database/)
  const other = healthy()
  other.projects[1].env.DATABASE_URL = 'some-other-db'
  has(liveCheck(stack, other), /DATABASE_URL host some-other-db/)
})

test('a publicly reachable worker fails live', () => {
  const inv = healthy()
  inv.projects.find(p => p.id === 'openfund-iran-worker').defaultSubdomain = true
  has(liveCheck(stack, inv), /default subdomain .* is enabled/)
  const d = healthy()
  d.domains.push({ name: 'worker.example', project: 'openfund-iran-worker' })
  has(liveCheck(stack, d), /worker has public domains/)
})

test('a deployed commit that differs from the approved release fails', () => {
  const inv = healthy()
  inv.projects[1].releases.unshift({ state: 'READY', message: `openfund ${'b'.repeat(40)} production` })
  has(liveCheck(stack, inv, { expectCommit: COMMIT }), /latest ready release is not/)
})

test('edge proxy settings on a runtime app and runtime settings on an edge app fail', () => {
  const inv = healthy()
  inv.projects[0].env.OPENFUND_UPSTREAM_HOST = 'x.onrender.com'
  has(liveCheck(stack, inv), /carries edge proxy setting OPENFUND_UPSTREAM_HOST/)
  const e = healthy()
  e.projects.push({ id: 'openfund-iran-edge', network: null, defaultSubdomain: true, env: { OPENFUND_REGION: 'IRAN' }, releases: [] })
  has(liveCheck(stack, e), /runs the regional runtime, not the edge/)
})

test('GitHub environments: missing, wrong app, staging aimed at production, edge aimed at the runtime', () => {
  const missing = healthy(); delete missing.github['liara-iran-runtime']
  has(liveCheck(stack, missing), /GitHub environment liara-iran-runtime \(production\) does not exist/)
  const wrong = healthy(); wrong.github['liara-iran-runtime'].vars.LIARA_RUNTIME_WEB_APP = 'openfund-iran-staging'
  has(liveCheck(stack, wrong), /LIARA_RUNTIME_WEB_APP=openfund-iran-staging, manifest says openfund-iran/)
  const staging = healthy()
  staging.github['liara-iran-runtime-staging'] = { reviewers: true, vars: { LIARA_RUNTIME_WEB_APP: 'openfund-iran', LIARA_RUNTIME_WORKER_APP: 'openfund-iran-worker', LIARA_RUNTIME_PUBLIC_URL: 'https://openfi.live' } }
  has(liveCheck(stack, staging), /liara-iran-runtime-staging: LIARA_RUNTIME_WEB_APP=openfund-iran, manifest says openfund-iran-staging/)
  const edge = healthy()
  edge.github['liara-iran-staging'] = { reviewers: false, vars: { LIARA_APP_NAME: 'openfund-iran' } }
  const p = liveCheck(stack, edge)
  has(p, /LIARA_APP_NAME=openfund-iran is a runtime app/)
  has(p, /liara-iran-staging: has no required reviewers/)
  const unprotected = healthy(); unprotected.github['liara-iran-runtime'].reviewers = false
  has(liveCheck(stack, unprotected), /liara-iran-runtime: has no required reviewers/)
})

test('runtime guard: only the manifest apps of a provisioned target', () => {
  assert.deepEqual(guardRuntime(stack, { target: 'production', web: 'openfund-iran', worker: 'openfund-iran-worker' }), [])
  has(guardRuntime(stack, { target: 'production', web: 'openfund-iran-web', worker: 'openfund-iran-worker' }), /manifest says openfund-iran$/)
  has(guardRuntime(stack, { target: 'staging', web: 'openfund-iran-staging', worker: 'openfund-iran-staging-worker' }), /staging is not provisioned/)
  has(guardRuntime(stack, { target: 'staging', web: 'openfund-iran', worker: 'openfund-iran-worker' }), /manifest says openfund-iran-staging/)
})
