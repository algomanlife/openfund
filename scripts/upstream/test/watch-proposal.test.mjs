import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBody } from '../watch-proposal.mjs'

const results = [
  { id: 'vela', name: 'Vela', installed: '0.9.3', latest: '0.10.4', risk: 'high', action: 'manual-review', reasons: ['minor on 0.x'], status: 'update-available' },
  { id: 'directus', name: 'Directus', installed: '11.9.1', latest: '12.6.1', risk: 'high', action: 'blocked-owner-decision', reasons: ['major'], status: 'update-available' },
  { id: 'react', name: 'React', installed: '19.3.1', latest: '19.3.1', risk: 'none', action: 'none', reasons: ['up to date'], status: 'up-to-date' },
]

test('proposal body states it is a proposal, lists blocked majors, embeds tests and reports, and requires approval', () => {
  const body = buildBody({ results, tests: 'upstream isolation checks passed', reports: { vela: 'CONFLICT 0001-menu.patch' } })
  assert.match(body, /\*\*proposal\*\*, not an upgrade/)
  assert.match(body, /2 provider\(s\) have updates; 1 are majors or otherwise blocked pending an owner decision \(Directus\)/)
  assert.match(body, /upstream isolation checks passed/); assert.match(body, /CONFLICT 0001-menu\.patch/)
  assert.match(body, /Approval required/); assert.doesNotMatch(body, /auto-?merge/i)
})
