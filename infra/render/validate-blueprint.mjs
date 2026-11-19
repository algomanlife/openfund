#!/usr/bin/env node
/**
 * Openfund — render.yaml blueprint structural validator.
 *
 * Validates the repository's Render Blueprint WITHOUT network access:
 *   - parses the YAML (js-yaml)
 *   - checks root-level structure (services / databases)
 *   - checks every service has name/type (+ runtime unless keyvalue)
 *   - checks every non-Docker service has a buildCommand
 *   - checks web services expose healthCheckPath (Render-managed deploys)
 *   - resolves every fromDatabase / fromService reference to a declared
 *     resource (catches the classic "missing dependency" blueprint bug)
 *   - checks disk definitions (name + mountPath + sizeGB)
 *   - flags env vars that must NOT be literal secrets (KEY/SECRET/PASSWORD/…)
 *
 * This complements — does not replace — `render blueprint validate` with a
 * Render API token (see docs/deployment/RENDER.md for the authenticated
 * validation step, which requires the RENDER_API_TOKEN secret).
 *
 * Usage: node infra/render/validate-blueprint.mjs [path-to-render.yaml]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const here = path.dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] || path.resolve(here, '../../render.yaml')

const problems = []
const ok = msg => console.log(`  ✓ ${msg}`)
const fail = msg => { problems.push(msg); console.log(`  ✗ ${msg}`) }

const raw = fs.readFileSync(file, 'utf8')
let doc
try {
  doc = yaml.load(raw)
  ok('YAML parses')
} catch (e) {
  console.error(`FATAL: render.yaml is not valid YAML: ${e.message}`)
  process.exit(1)
}

/* ---- root structure ---- */
const services = doc.services || []
const databases = doc.databases || []
if (!services.length) fail('no services defined')
if (!databases.length) fail('no databases defined (the platform requires managed PostgreSQL)')
else ok(`databases: ${databases.map(d => d.name).join(', ')}`)

const dbNames = new Set(databases.map(d => d.name))
const svcNames = new Set(services.map(s => s.name))
if (svcNames.size !== services.length) fail('duplicate service names')
if (dbNames.size !== databases.length) fail('duplicate database names')

/* ---- allowed service types (per Render blueprint spec) ---- */
const TYPES = new Set(['web', 'pserv', 'worker', 'cron', 'keyvalue'])
const RUNTIMES = new Set(['node', 'python', 'ruby', 'rust', 'go', 'deno', 'image', 'static', 'docker'])

/* env keys that must never carry a literal value in Git */
const SECRETISH = /(PASSWORD|SECRET|PRIVATE_KEY|TOKEN|_KEY$|API_KEY|ADMIN_EMAIL)/

/* ---- per-service checks ---- */
for (const s of services) {
  const id = s.name || '(unnamed service)'
  if (!s.name) fail('a service is missing `name`')
  if (!s.type || !TYPES.has(s.type)) fail(`${id}: invalid/missing type ${JSON.stringify(s.type)}`)
  if (s.type === 'keyvalue') continue
  if (!s.runtime || !RUNTIMES.has(s.runtime)) fail(`${id}: invalid/missing runtime ${JSON.stringify(s.runtime)}`)
  if (s.type === 'cron' && !s.schedule) fail(`${id}: cron job requires a schedule`)

  const isImage = s.runtime === 'image' || s.runtime === 'docker'
  if (isImage) {
    if (!s.image?.url) fail(`${id}: image runtime requires image.url`)
    else ok(`${id}: image ${s.image.url}`)
  } else if (s.type !== 'static') {
    if (!s.buildCommand) fail(`${id}: missing buildCommand (non-Docker services must build)`)
  }

  if (s.type === 'web') {
    if (!s.healthCheckPath) fail(`${id}: web service should define healthCheckPath`)
    else ok(`${id}: health ${s.healthCheckPath}`)
  }

  if (s.disk) {
    if (!s.disk.name || !s.disk.mountPath) fail(`${id}: disk requires name + mountPath`)
    if (!(Number(s.disk.sizeGB) > 0)) fail(`${id}: disk sizeGB must be positive`)
    else ok(`${id}: disk ${s.disk.name} → ${s.disk.mountPath} (${s.disk.sizeGB}GB)`)
  }

  /* ---- env var references + secret hygiene ---- */
  for (const v of s.envVars || []) {
    const key = v.key
    if (!key) { fail(`${id}: an envVar entry is missing its key`); continue }
    if (v.fromDatabase) {
      const { name, property } = v.fromDatabase
      if (!dbNames.has(name)) fail(`${id}: ${key} references unknown database "${name}"`)
      const props = new Set(['connectionString', 'connectionPoolString', 'user', 'password', 'database'])
      if (!props.has(property)) fail(`${id}: ${key} uses unsupported postgres property "${property}"`)
    }
    if (v.fromService) {
      const { name, type, property, envVarKey } = v.fromService
      if (!svcNames.has(name)) fail(`${id}: ${key} references unknown service "${name}"`)
      if (type && !TYPES.has(type)) fail(`${id}: ${key} fromService type "${type}" invalid`)
      const svc = services.find(x => x.name === name)
      if (svc && svc.type !== type) fail(`${id}: ${key} fromService type mismatch (declared ${type}, actual ${svc.type})`)
      if (envVarKey ? property || !/^[A-Z_][A-Z_0-9]*$/.test(envVarKey) : !['host', 'port'].includes(property || '')) fail(`${id}: ${key} invalid service reference`)
    }
    if (v.value !== undefined && SECRETISH.test(key)) {
      fail(`${id}: ${key} carries a literal value — secrets must be sync:false / generateValue`)
    }
    if (v.sync === false && SECRETISH.test(key)) ok(`${id}: ${key} prompt-only secret`)
  }
}

/* ---- cross-service expectations specific to the Openfund graph ---- */
const has = (predicate, label) => {
  if (services.some(predicate) || databases.some(predicate)) ok(`graph: ${label}`)
  else fail(`graph: expected ${label}`)
}
if (databases.some(d => d.name === 'openfund-db' && String(d.postgresMajorVersion) === '17')) ok('graph: PostgreSQL 17 openfund-db')
else fail('graph: expected PostgreSQL 17 openfund-db')
has(s => s.runtime === 'image' && /directus/.test(s.image?.url || ''), 'Directus service (official image)')
has(s => s.runtime === 'node', 'Node API/web service')
has(s => (s.envVars || []).some(v => v.key === 'DATABASE_URL' && v.fromDatabase), 'API consumes managed DATABASE_URL')
const cms = services.find(s => s.name === 'openfund-cms')
if (cms?.envVars?.some(v => v.key === 'DB_CLIENT' && v.value === 'pg') &&
    cms?.envVars?.some(v => v.key === 'DB_CONNECTION_STRING' && v.sync === false && !v.fromDatabase && !('value' in v))) ok('graph: Directus uses PostgreSQL through its own role secret')
else fail('graph: Directus requires DB_CLIENT=pg and a sync:false DB_CONNECTION_STRING for the openfund_directus role (never the owner fromDatabase credential, OF-2026-11-12)')
/* OF-2026-11-11: compensating controls while Directus stays on 11.x */
{
  const env = Object.fromEntries((cms?.envVars || []).filter(v => 'value' in v).map(v => [v.key, String(v.value)]))
  const major = Number((/directus:(\d+)\./.exec(cms?.image?.url || '') || [])[1])
  if (major === 11) {
    const deny = (env.IMPORT_IP_DENY_LIST || '').split(',')
    const mime = (env.FILES_MIME_TYPE_ALLOW_LIST || '').split(',')
    if (env.CACHE_ENABLED === 'false') ok('Directus 11: response cache off (GHSA-c6w9-5g5j-jh2p)')
    else fail('Directus 11 requires CACHE_ENABLED=false (GHSA-c6w9-5g5j-jh2p)')
    if (['0.0.0.0', '0.0.0.0/8', '127.0.0.0/8', '::', '::1', '169.254.0.0/16', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'].every(r => deny.includes(r))) ok('Directus 11: file import deny list covers 0.0.0.0, loopback, link-local and private ranges (GHSA-j5h6-vqc3-phqh)')
    else fail('Directus 11 requires an explicit IMPORT_IP_DENY_LIST including 0.0.0.0, 0.0.0.0/8, ::, loopback, link-local and private ranges (GHSA-j5h6-vqc3-phqh)')
    if (mime.length && !mime.some(m => /html|svg|xml|javascript|\*/.test(m))) ok('Directus 11: upload MIME allow list excludes HTML, SVG and scripts')
    else fail('Directus requires FILES_MIME_TYPE_ALLOW_LIST without HTML, SVG, XML, scripts or wildcards')
    if (env.WEBSOCKETS_ENABLED === 'false') ok('Directus: WebSockets disabled')
    else fail('Directus requires WEBSOCKETS_ENABLED=false')
  }
}
const api = services.find(s => s.name === 'openfund')
if (api?.numInstances !== 1) fail('graph: engine/SSE service requires numInstances: 1')
if (api?.buildCommand?.trim() !== 'node scripts/release/render-build.mjs') fail('graph: API must use the verified official release build')
if (api?.autoDeployTrigger !== 'off') fail('graph: production requires approved exact-release deployment')
const domains = api?.envVars?.find(v => v.key === 'ALLOWED_DOMAINS')
/* exact SIWE hosts: the Render host, both production origins and the Iran edge
   (ADR 0031); no other host may be added without changing this list */
const requiredDomains = ['openfund-our6.onrender.com','openfi.cloud','openfund.cloud','iran.openfund.cloud']
const configuredDomains = String(domains?.value || '').split(',').map(v => v.trim()).filter(Boolean)
if (domains?.fromService || configuredDomains.length !== requiredDomains.length ||
    new Set(configuredDomains).size !== requiredDomains.length ||
    !requiredDomains.every(v => configuredDomains.includes(v)))
  fail('graph: ALLOWED_DOMAINS must list exactly the onrender host, both production origins and the Iran edge host; Blueprint sync must preserve them')
else ok('graph: SIWE accepts the four exact production hosts')
if (!api?.envVars?.some(v => v.key === 'VITE_DIRECTUS_HOST' && v.fromService?.envVarKey === 'RENDER_EXTERNAL_HOSTNAME'))
  fail('graph: VITE_DIRECTUS_HOST must reference a public hostname, not the private-network host property')
const databaseRegion = databases.find(d => d.name === 'openfund-db')?.region
for (const service of [api,cms]) if (!databaseRegion || service?.region !== databaseRegion) fail(`graph: ${service?.name} must share the database region for private connections`)

console.log('')
if (problems.length) {
  console.error(`${problems.length} blueprint problem(s) in ${path.relative(process.cwd(), file)}`)
  process.exit(1)
}
console.log(`render.yaml OK — ${services.length} service(s), ${databases.length} database(s)`)
