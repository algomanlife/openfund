/**
 * Hybrid Governance v1.0 — pure policy rules and static financial-isolation checks.
 * No database or network. Run: node --test test/governance-rules.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  CONSTITUENCIES, COUNCIL_SIZE, SEATS_PER_CONSTITUENCY, VOTING, STATES, TRANSITIONS, CATEGORIES, RESERVED_POWERS,
  DELEGATED_CATEGORIES, PERMISSIONS, FINANCIAL_FIELDS, resolveClassification, assertTransition, evaluateSession,
  buildVoteMessage, VOTE_DOMAIN, electionWinners, addMonths, thresholdKindFor,
} from '../governance-rules.js'
import { rejectFinancialFields } from '../governance-routes.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const votes = (a, r = 0, s = 0) => [...Array(a).fill({ choice: 'approve' }), ...Array(r).fill({ choice: 'reject' }), ...Array(s).fill({ choice: 'abstain' })]
const ev = (v, over = {}) => evaluateSession({ votes: v, snapshotMembers: 10, recused: 0, quorum: VOTING.quorum, threshold: VOTING.ordinaryThreshold, closed: false, ...over })

/* ---------------- council structure ---------------- */
test('the council has exactly 10 seats: five constituencies x two seats', () => {
  assert.equal(CONSTITUENCIES.length, 5)
  assert.equal(SEATS_PER_CONSTITUENCY, 2)
  assert.equal(COUNCIL_SIZE, 10)
  assert.deepEqual([...CONSTITUENCIES].sort(), ['ambassador', 'coach', 'community_trader', 'funded_trader', 'moderator'])
})
test('policy constants match GOVERNANCE.md', () => {
  assert.deepEqual({ ...VOTING }, { councilSize: 10, quorum: 7, ordinaryThreshold: 6, constitutionalThreshold: 7 })
  assert.equal(thresholdKindFor('governance_amendment'), 'constitutional')
  assert.equal(thresholdKindFor('roadmap'), 'ordinary')
})
test('terms are six calendar months in UTC, clamping month ends', () => {
  assert.equal(addMonths('2027-01-15T00:00:00Z', 6).toISOString(), '2027-07-15T00:00:00.000Z')
  assert.equal(addMonths('2027-08-31T00:00:00Z', 6).toISOString(), '2028-02-29T00:00:00.000Z')
})

/* ---------------- binding vs advisory ---------------- */
test('every reserved company power is advisory-only', () => {
  for (const c of RESERVED_POWERS) {
    assert.throws(() => resolveClassification(c, 'binding'), /reserved_power_is_advisory_only/, c)
    assert.equal(resolveClassification(c, 'advisory'), 'advisory')
  }
})
test('delegated categories may be binding; unknown categories and classes are rejected', () => {
  for (const c of DELEGATED_CATEGORIES) assert.equal(resolveClassification(c, 'binding'), 'binding')
  assert.throws(() => resolveClassification('nonsense', 'binding'), /unknown_category/)
  assert.throws(() => resolveClassification('roadmap', 'official'), /invalid_classification/)
  assert.equal(new Set(CATEGORIES).size, CATEGORIES.length)
  for (const c of RESERVED_POWERS) assert.ok(!DELEGATED_CATEGORIES.includes(c))
})
test('the database enforces the same rule as the code (CHECK list matches the rules module)', () => {
  const sql = read('../schema.sql')
  const check = sql.match(/gov_reserved_is_advisory CHECK \(([\s\S]*?)\)\s*\);/)[1]
  const listed = [...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).filter((v) => v !== 'advisory')
  assert.deepEqual(listed.sort(), [...DELEGATED_CATEGORIES].sort())
})

/* ---------------- lifecycle state machine ---------------- */
test('exactly the declared transitions are valid; everything else is rejected', () => {
  const allRoles = ['author', 'reviewer', 'management']
  for (const from of STATES) for (const to of STATES) {
    const declared = TRANSITIONS[from][to]
    for (const via of [null, 'open_voting', 'finalize', 'implementation', 'void_or_unresolved']) {
      let ok = true
      try { assertTransition(from, to, allRoles, via) } catch { ok = false }
      const expected = Boolean(declared) && ((Array.isArray(declared) ? null : declared.via) === via)
      assert.equal(ok, expected, `${from}->${to} via ${via}`)
    }
  }
})
test('generic endpoint cannot open voting, finalize, or mark implemented', () => {
  assert.throws(() => assertTransition('under_review', 'voting', ['reviewer', 'management'], null), /dedicated_operation/)
  assert.throws(() => assertTransition('voting', 'approved', ['reviewer', 'management'], null), /dedicated_operation/)
  assert.throws(() => assertTransition('in_progress', 'implemented', ['reviewer', 'management'], null), /dedicated_operation/)
})
test('role restrictions: authors cannot review, reviewers cannot block, nobody leaves archived', () => {
  assert.throws(() => assertTransition('submitted', 'under_review', ['author'], null), /transition_forbidden/)
  assert.doesNotThrow(() => assertTransition('submitted', 'under_review', ['reviewer'], null))
  assert.throws(() => assertTransition('in_progress', 'blocked', ['reviewer'], 'implementation'), /transition_forbidden/)
  assert.doesNotThrow(() => assertTransition('in_progress', 'blocked', ['management'], 'implementation'))
  assert.deepEqual(TRANSITIONS.archived, {})
})
test('there is no path from rejected or approved to implemented without scheduling and progress', () => {
  assert.equal(TRANSITIONS.approved.implemented, undefined)
  assert.equal(TRANSITIONS.rejected.implementation_scheduled, undefined)
  assert.equal(TRANSITIONS.implementation_scheduled.implemented, undefined)
})

/* ---------------- tally ---------------- */
test('ordinary approval needs 6 affirmative votes of the full council AND quorum 7', () => {
  assert.equal(ev(votes(6, 1)).outcome, 'approved')       /* 6 yes of 7 participating */
  assert.equal(ev(votes(6)).outcome, 'pending')            /* 6 participating: quorum not yet met, others may still vote */
  assert.equal(ev(votes(6), { closed: true }).outcome, 'unresolved')
  assert.equal(ev(votes(6), { closed: true }).reason, 'quorum_unreachable')
  assert.equal(ev(votes(5, 2), { closed: true }).outcome, 'rejected')
  assert.equal(ev(votes(5, 2)).outcome, 'pending')         /* 3 members may still vote: 5+3 >= 6 */
})
test('constitutional amendments need 7 affirmative votes', () => {
  const c = { threshold: VOTING.constitutionalThreshold }
  assert.equal(ev(votes(6, 4), { ...c, closed: true }).outcome, 'rejected')
  assert.equal(ev(votes(7, 1), c).outcome, 'approved')
  assert.equal(ev(votes(6, 1), c).outcome, 'pending')
})
test('abstention is participation but never an affirmative vote', () => {
  const r = ev(votes(5, 0, 2))
  assert.equal(r.participating, 7); assert.equal(r.quorumMet, true); assert.equal(r.approve, 5)
  assert.notEqual(r.outcome, 'approved')
  assert.equal(ev(votes(5, 0, 5), { closed: true }).outcome, 'rejected')
  assert.equal(ev(votes(6, 0, 1)).outcome, 'approved')
})
test('vacancies and recusals never lower the threshold or quorum', () => {
  /* 7 seated, 3 vacant: still 6 yes required */
  assert.equal(ev(votes(5, 2), { snapshotMembers: 7 }).outcome, 'rejected')
  assert.equal(ev(votes(6, 1), { snapshotMembers: 7 }).outcome, 'approved')
  /* 8 seated, 2 recused -> only 6 can vote, quorum 7 is unreachable: unresolved, NOT approved at a lowered bar */
  const r = ev(votes(6), { snapshotMembers: 8, recused: 2 })
  assert.equal(r.outcome, 'unresolved')
  /* the same 6 yes of 6 voters is not "unanimous" success */
  assert.notEqual(r.outcome, 'approved')
})
test('an early determinate result is final; an open indeterminate one is not', () => {
  assert.equal(ev(votes(1)).final, false)
  assert.equal(ev(votes(7)).final, true)
  assert.equal(ev(votes(0, 5)).final, true) /* 0 + 5 remaining < 6 */
})

/* ---------------- signed vote message ---------------- */
test('the vote message is domain-separated and binds proposal, session, seat, wallet, choice and nonce', () => {
  const m = buildVoteMessage({ ofpId: 'OFP-0001', sessionId: 's', seatId: 'x', wallet: '0xabc', choice: 'approve', nonce: 'n', issuedAt: 'a', expiresAt: 'b' })
  for (const part of [VOTE_DOMAIN, 'OFP-0001', 'Session: s', 'Seat: x', 'Wallet: 0xabc', '\nChoice: approve\n', 'Nonce: n', 'moves no funds']) assert.ok(m.includes(part), part)
})

/* ---------------- elections ---------------- */
test('election winners: top two by votes; a tie for the last seat is never broken silently', () => {
  assert.deepEqual(electionWinners([{ candidateId: 'a', votes: 5 }, { candidateId: 'b', votes: 3 }, { candidateId: 'c', votes: 1 }]).winners, ['a', 'b'])
  const tie = electionWinners([{ candidateId: 'a', votes: 5 }, { candidateId: 'b', votes: 3 }, { candidateId: 'c', votes: 3 }])
  assert.equal(tie.needsRunoff, true); assert.deepEqual(tie.winners, ['a']); assert.deepEqual(tie.tie.sort(), ['b', 'c'])
  assert.deepEqual(electionWinners([{ candidateId: 'a', votes: 0 }]).winners, [])
})

/* ---------------- permissions and financial isolation ---------------- */
test('no permission is granted to council members or authors, and none concerns money', () => {
  const roles = new Set(Object.values(PERMISSIONS).flat())
  assert.deepEqual([...roles].sort(), ['administrator', 'management', 'moderator', 'reviewer'])
  for (const action of Object.keys(PERMISSIONS)) assert.doesNotMatch(action, /fund|treasur|price|pricing|commission|payout|transfer|risk|trade|order|balance|contract|deploy/i, action)
})
test('only Company Management can appoint, revoke, activate terms, grant roles, block, confirm capacity or approve election rules', () => {
  for (const a of ['seat.appoint', 'membership.revoke', 'term.activate', 'role.grant', 'implementation.block', 'capacity.confirm', 'election.approve_rules']) {
    assert.deepEqual(PERMISSIONS[a], ['management'], a)
  }
})
test('payloads carrying financial fields are rejected at any depth', () => {
  for (const key of ['amount', 'priceUsd', 'commissionRate', 'payout', 'treasury', 'riskLimit', 'contractAddress', 'privateKey']) {
    assert.equal(rejectFinancialFields({ title: 'x', nested: { deep: [{ [key]: 1 }] } }), key, key)
  }
  assert.equal(rejectFinancialFields({ title: 'Improve chart tooltips', summary: 'ok' }), null)
  assert.ok(FINANCIAL_FIELDS.length >= 15)
})
test('governance code imports no trading, purchase, payout or treasury module', () => {
  for (const file of ['../governance.js', '../governance-rules.js', '../governance-routes.js']) {
    const src = read(file)
    const imports = [...src.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1])
    for (const i of imports) assert.match(i, /^(node:|viem$|express$|\.\/governance)/, `${file} imports ${i}`)
  }
})
test('governance SQL never writes to, and only reads openfund_challenges and openfund_users from, non-governance tables', () => {
  const schema = read('../schema.sql')
  const financial = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]).filter((t) => !t.startsWith('gov_') && !['openfund_users', 'openfund_challenges'].includes(t))
  assert.ok(financial.includes('purchase_orders') && financial.includes('withdrawal_requests'))
  const src = read('../governance.js')
  for (const t of financial) assert.doesNotMatch(src, new RegExp(`\\b${t}\\b`), `governance.js references ${t}`)
  assert.doesNotMatch(src, /(INSERT INTO|UPDATE|DELETE FROM)\s+(openfund_|auth_|demo_|purchase|payment|withdraw)/i)
})
test('governance tables reference only governance tables and openfund_users', () => {
  const block = read('../schema.sql').split('Openfund Hybrid Governance v1.0')[1]
  const refs = [...block.matchAll(/REFERENCES (\w+)/g)].map((m) => m[1])
  assert.ok(refs.length > 20)
  for (const r of refs) assert.ok(r.startsWith('gov_') || r === 'openfund_users', r)
})
test('evidence tables are append-only by trigger', () => {
  const block = read('../schema.sql').split('Openfund Hybrid Governance v1.0')[1]
  for (const t of ['gov_votes', 'gov_decisions', 'gov_decision_amendments', 'gov_proposal_history', 'gov_audit_events', 'gov_election_votes', 'gov_implementation_log', 'gov_proposal_revisions']) {
    assert.match(block, new RegExp(`BEFORE UPDATE OR DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION gov_forbid_mutation`), t)
  }
})
test('no token, staking, NFT or treasury-wallet concept exists in the governance data model', () => {
  const block = read('../schema.sql').split('Openfund Hybrid Governance v1.0')[1]
  assert.doesNotMatch(block, /token_balance|stake|staking|nft|erc20|treasury_wallet|voting_power/i)
})
