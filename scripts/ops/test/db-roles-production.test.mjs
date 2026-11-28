import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { tlsUrl, withCredentials } from '../db-roles-production.mjs'

/* OF-2026-11-12 production switch: connection strings are rebuilt, never logged */
const owner = 'postgresql://openfund_app:0wner%2Fpw@dpg-x.frankfurt-postgres.render.com/openfund'

test('the Directus connection keeps host and database and swaps only the credentials', () => {
  const next = new URL(withCredentials('postgresql://openfund_app:pw@dpg-x-a/openfund', 'openfund_directus', 'n3w/p@ss:w0rd'))
  assert.equal(next.hostname, 'dpg-x-a'); assert.equal(next.pathname, '/openfund')
  assert.equal(decodeURIComponent(next.username), 'openfund_directus')
  assert.equal(decodeURIComponent(next.password), 'n3w/p@ss:w0rd')
})

test('TLS is verified by default; encrypt-only is an explicit opt-in', () => {
  assert.equal(new URL(tlsUrl(owner, undefined)).searchParams.get('sslmode'), 'verify-full')
  const relaxed = new URL(tlsUrl(owner + '?sslmode=disable', 'encrypt-only'))
  assert.equal(relaxed.searchParams.get('sslmode'), 'require'); assert.equal(relaxed.searchParams.get('uselibpqcompat'), 'true')
})

test('every credential is masked before use, and the workflow gates apply behind an exact confirmation', () => {
  const src = fs.readFileSync(new URL('../db-roles-production.mjs', import.meta.url), 'utf8')
  assert.match(src, /::add-mask::/)
  assert.ok(src.indexOf('mask(password)') < src.indexOf("rolesScript('apply'"))
  assert.ok(!/console\.(log|error)\([^)]*(password|owner|previous|next)\b/i.test(src), 'no credential is logged')
  const wf = fs.readFileSync(new URL('../../../.github/workflows/db-roles-production.yml', import.meta.url), 'utf8')
  assert.match(wf, /environment: production/)
  assert.match(wf, /switch openfund-cms to openfund_directus/)
  assert.ok(!/run:.*\$\{\{\s*inputs\./.test(wf), 'inputs reach the shell only through env')
})
