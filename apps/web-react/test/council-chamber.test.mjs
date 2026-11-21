/**
 * Governance hero illustration: the council chamber uses the real council
 * rules (apps/backend/governance-rules.js) for seats, quorum and the
 * approval threshold, and every illustrative cycle's stamp matches what
 * evaluateSession() would decide for the same votes.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL('../src/features/governance/CouncilChamber.tsx', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', write: false, packages: 'external', loader: { '.css': 'empty' }, jsx: 'automatic' })
const mod = { exports: {} }; new Function('module', 'exports', 'require', outputFiles[0].text)(mod, mod.exports, require)
const { CYCLES, outcome, COUNCIL_SEATS, QUORUM, APPROVE_THRESHOLD } = mod.exports
const rules = await import('../../backend/governance-rules.js')

test('chamber constants are the council rules', () => {
  assert.equal(COUNCIL_SEATS, rules.VOTING.councilSize)
  assert.equal(QUORUM, rules.VOTING.quorum)
  assert.equal(APPROVE_THRESHOLD, rules.VOTING.ordinaryThreshold)
})

test('every illustrative cycle stamps what evaluateSession decides, with both outcomes shown', () => {
  const stamps = new Set()
  for (const c of CYCLES) {
    assert.equal(c.votes.length, COUNCIL_SEATS, c.id)
    assert.match(c.id, /^OFP-DEMO-/)
    const votes = c.votes.flatMap((choice, i) => (choice ? [{ member: String(i), choice }] : []))
    const real = rules.evaluateSession({ votes, snapshotMembers: COUNCIL_SEATS, quorum: QUORUM, threshold: APPROVE_THRESHOLD, closed: true })
    const shown = outcome(c.votes)
    assert.equal(shown.approved, real.outcome === 'approved', c.id)
    stamps.add(shown.approved)
  }
  assert.deepEqual([...stamps].sort(), [false, true])
})
