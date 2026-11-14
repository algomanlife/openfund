#!/usr/bin/env node
/**
 * Idempotent Liara provisioning for the Iran regional runtime (ADR 0033).
 *
 *   node scripts/liara/provision.mjs --env staging                 # plan only (default)
 *   node scripts/liara/provision.mjs --env staging --apply         # create what is missing
 *   node scripts/liara/provision.mjs --env production --apply --confirm PROVISION-IRAN-PRODUCTION
 *
 * Desired state: infra/liara-iran-runtime/stack.json (no secrets).
 * Only commands confirmed in @liara/cli 9.6.7 `--help` are used:
 *   network:list/create, db:list/create, app:list/create, disk:create,
 *   env:list/set. It never deletes, resizes or overwrites; an existing
 *   resource is reported, not changed. Secrets are never printed: only their
 *   presence (by name) is checked. Everything the CLI cannot do (domains, TLS,
 *   database backups, DNS records) is printed as an exact manual step.
 *
 * Auth: LIARA_API_TOKEN in the environment (passed as --api-token).
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const PRODUCTION_CONFIRM = 'PROVISION-IRAN-PRODUCTION'

/* tolerant reader of `--output json` rows: Liara's JSON field names are not
   documented, so a resource matches when any identifying field equals it */
export function names(rows) {
  const out = new Set()
  for (const r of Array.isArray(rows) ? rows : rows?.data ?? []) {
    if (typeof r === 'string') { out.add(r); continue }
    for (const [k, v] of Object.entries(r || {})) if (/^(name|project_?id|app|id|title)$/i.test(k) && typeof v === 'string') out.add(v)
  }
  return out
}

export function plan(stack, envName, inventory) {
  const env = stack.environments?.[envName]
  if (!env) throw new Error(`unknown environment ${envName}`)
  const steps = [], problems = [], manual = []
  const have = { networks: names(inventory.networks), databases: names(inventory.databases), apps: names(inventory.apps) }
  if (have.networks.has(env.network)) steps.push({ action: 'exists', kind: 'network', name: env.network })
  else steps.push({ action: 'create', kind: 'network', name: env.network, args: ['network:create', '--name', env.network] })
  const db = env.database
  if (have.databases.has(db.name)) steps.push({ action: 'exists', kind: 'database', name: db.name })
  else if (!db.plan) problems.push(`database ${db.name}: choose a Liara plan (stack.json "plan")`)
  else steps.push({ action: 'create', kind: 'database', name: db.name,
    args: ['db:create', '--name', db.name, '--type', db.type, '--version', db.version, '--plan', db.plan, '--network', env.network, '--yes', ...(db.publicNetwork ? ['--public-network'] : [])] })
  for (const app of env.apps) {
    const exists = have.apps.has(app.id)
    if (exists) steps.push({ action: 'exists', kind: 'app', name: app.id })
    else if (!app.plan) problems.push(`app ${app.id}: choose a Liara plan (stack.json "plan")`)
    else {
      steps.push({ action: 'create', kind: 'app', name: app.id, args: ['create', '--app', app.id, '--platform', app.platform, '--plan', app.plan, '--network', env.network] })
      /* a disk can be created safely only together with a new app: the CLI cannot list disks */
      for (const d of app.disks ?? []) steps.push({ action: 'create', kind: 'disk', name: `${app.id}/${d.name}`, args: ['disk:create', '--app', app.id, '--name', d.name, '--size', String(d.sizeGB)] })
    }
    if (exists) for (const d of app.disks ?? []) manual.push(`verify disk "${d.name}" (${d.sizeGB} GB) exists on ${app.id} (Liara console → app → Disks); the CLI cannot list disks`)
    const plain = Object.entries(app.env ?? {})
    if (plain.length) steps.push({ action: exists ? 'verify-env' : 'set-env', kind: 'env', name: app.id, keys: plain.map(([k]) => k),
      args: ['env:set', '--app', app.id, ...plain.map(([k, v]) => `${k}=${v}`), '--force'] })
    for (const s of app.secrets ?? []) manual.push(`set secret ${s} on ${app.id} (liara env:set --app ${app.id} ${s}=… — value from the owner's vault, never from Git)`)
    for (const d of app.domains ?? []) manual.push(`attach domain ${d} to ${app.id} in the Liara console, add the CNAME/ALIAS, TXT and _acme-challenge records the console shows, then issue SSL`)
  }
  manual.push(`enable/confirm daily backups for ${db.name} and run one manual backup + restore drill (Liara console → database → Backups)`)
  manual.push(`copy the private connection string of ${db.name} into DATABASE_URL (web, worker) and DB_CONNECTION_STRING (cms); public network stays off`)
  return { env: envName, steps, problems, manual }
}

function liara(args, { token, bin = process.env.LIARA_BIN || 'liara' }) {
  const r = spawnSync(bin, [...args, '--api-token', token], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`liara ${args[0]} failed: ${(r.stderr || r.stdout || '').trim().slice(0, 400)}`)
  return r.stdout
}

export async function main(argv = process.argv.slice(2), { run = liara, stdout = console } = {}) {
  const arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null }
  const envName = arg('--env'), apply = argv.includes('--apply')
  if (!['staging', 'production'].includes(envName)) throw new Error('--env staging|production is required')
  if (apply && envName === 'production' && arg('--confirm') !== PRODUCTION_CONFIRM) throw new Error(`production --apply needs --confirm ${PRODUCTION_CONFIRM}`)
  const token = process.env.LIARA_API_TOKEN
  if (!token) throw new Error('LIARA_API_TOKEN is required (never pass it on the command line)')
  const stack = JSON.parse(readFileSync(new URL('../../infra/liara-iran-runtime/stack.json', import.meta.url), 'utf8'))
  const opts = { token }
  const listJson = cmd => { const out = run([cmd, '--output', 'json'], opts); try { return JSON.parse(out) } catch { throw new Error(`liara ${cmd} did not return JSON`) } }
  const inventory = { networks: listJson('network:list'), databases: listJson('db:list'), apps: listJson('app:list') }
  const p = plan(stack, envName, inventory)
  for (const s of p.steps) stdout.log(`${s.action.padEnd(10)} ${s.kind.padEnd(8)} ${s.name}${s.keys ? ' [' + s.keys.join(', ') + ']' : ''}`)
  for (const m of p.problems) stdout.log(`BLOCKED    ${m}`)
  if (apply) {
    if (p.problems.length) throw new Error('refusing to apply while the plan has blocked items')
    for (const s of p.steps.filter(s => s.action === 'create' || s.action === 'set-env')) { run(s.args, opts); stdout.log(`done       ${s.kind} ${s.name}`) }
  } else stdout.log('\n(plan only — re-run with --apply to create the missing resources)')
  stdout.log('\nManual steps (not supported by the Liara CLI):'); for (const m of p.manual) stdout.log(`  - ${m}`)
  return p
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(e => { console.error(e.message); process.exit(1) })
}
