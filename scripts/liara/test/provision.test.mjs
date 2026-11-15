/* Liara provisioning planner (ADR 0033): create-only, idempotent, never
   deletes, refuses production without confirmation, never echoes secrets. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { plan, main, names, PRODUCTION_CONFIRM } from '../provision.mjs'

const stack = JSON.parse(readFileSync(new URL('../../../infra/liara-iran-runtime/stack.json', import.meta.url), 'utf8'))
const withPlans = env => {
  const s = structuredClone(stack)
  s.environments[env].database.plan = 'db-plan'
  for (const a of s.environments[env].apps) a.plan = 'app-plan'
  return s
}

test('names() reads identifying fields from Liara JSON rows', () => {
  assert.deepEqual([...names([{ name: 'a' }, { project_id: 'b' }, 'c'])].sort(), ['a', 'b', 'c'])
  assert.deepEqual([...names({ data: [{ Name: 'x' }] })], ['x'])
})

test('empty account: everything is created, in dependency order, disks only with new apps', () => {
  const p = plan(withPlans('staging'), 'staging', { networks: [], databases: [], apps: [] })
  assert.deepEqual(p.problems, [])
  const kinds = p.steps.filter(s => s.action === 'create').map(s => s.kind)
  assert.deepEqual(kinds.slice(0, 2), ['network', 'database'])
  assert.ok(kinds.includes('disk'))
  const db = p.steps.find(s => s.kind === 'database')
  assert.ok(!db.args.includes('--public-network'), 'database stays private')
  const allowed = new Set(['network:create', 'db:create', 'create', 'disk:create', 'env:set'])
  assert.ok(p.steps.every(s => !s.args || allowed.has(s.args[0])), 'only create/set commands, never delete/remove/resize')
})

test('existing resources are reported, not recreated (idempotent)', () => {
  const env = stack.environments.staging
  const p = plan(withPlans('staging'), 'staging', { networks: [{ name: env.network }], databases: [{ name: env.database.name }], apps: env.apps.map(a => ({ name: a.id })) })
  assert.equal(p.steps.filter(s => s.action === 'create').length, 0)
  assert.ok(p.manual.some(m => /verify disk/.test(m)))
})

test('missing plans block creation instead of guessing', () => {
  const p = plan(stack, 'production', { networks: [], databases: [], apps: [] })
  assert.ok(p.problems.length >= 4)
})

test('secrets are listed by name only; domains and backups are manual', () => {
  const p = plan(withPlans('production'), 'production', { networks: [], databases: [], apps: [] })
  const all = JSON.stringify(p)
  assert.ok(p.manual.some(m => m.includes('iran.openfund.cloud')) && p.manual.some(m => m.includes('openfi.live')) && p.manual.some(m => m.includes('iran.openfi.cloud')))
  assert.ok(p.manual.some(m => /backup/.test(m)))
  for (const s of ['DATABASE_URL', 'REGION_SYNC_KEYS', 'ADMIN_PASSWORD']) assert.ok(all.includes(s))
  assert.doesNotMatch(all, /postgres:\/\/|Bearer /)
})

test('main(): plan by default, production apply needs the confirmation, token never in args', async () => {
  const calls = []
  const run = (args, opts) => { calls.push(args); assert.equal(opts.token, 'tok'); return '[]' }
  process.env.LIARA_API_TOKEN = 'tok'
  const quiet = { log() {} }
  await main(['--env', 'staging'], { run, stdout: quiet })
  assert.ok(calls.every(a => a[1] === '--output'), 'plan mode only lists')
  await assert.rejects(main(['--env', 'production', '--apply'], { run, stdout: quiet }), new RegExp(PRODUCTION_CONFIRM))
  await assert.rejects(main(['--env', 'staging', '--apply'], { run, stdout: quiet }), /blocked items/, 'plans are null in the committed manifest')
  assert.ok(calls.flat().every(a => a !== 'tok'))
  delete process.env.LIARA_API_TOKEN
})
