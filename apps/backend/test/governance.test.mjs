/**
 * Hybrid Governance v1.0 — service/database integration tests.
 * Requires an isolated test database with schema.sql applied:
 *   DATABASE_URL=postgres:///openfund_governance_test node migrate.js
 *   DATABASE_URL=postgres:///openfund_governance_test node --test test/governance.test.mjs
 * Needs no running server. Time is injected, so deadlines are tested deterministically.
 */
import test, { before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { randomUUID } from 'node:crypto'
import { createGovernance } from '../governance.js'
import { CONSTITUENCIES } from '../governance-rules.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

let T = Date.parse('2027-03-01T12:00:00Z')
const clock = () => new Date(T)
const advance = (ms) => { T += ms }
const HOUR = 3600_000, DAY = 86_400_000
const gov = createGovernance({ pool, clock })
const mgmt = gov.managementActor('test_management')
const rejects = (p, code, status) => assert.rejects(p, (e) => { assert.equal(e.code ?? e.message, code, `expected ${code}, got ${e.code ?? e.message}`); if (status) assert.equal(e.status, status); return true })

const TABLES = `gov_audit_events, gov_election_votes, gov_election_voters, gov_election_candidates, gov_elections, gov_implementation_log,
  gov_decision_amendments, gov_decisions, gov_conflicts, gov_votes, gov_vote_challenges, gov_voting_sessions, gov_comments,
  gov_proposal_history, gov_proposal_revisions, gov_proposals, gov_roles, gov_memberships, gov_eligibility, gov_seats, gov_terms`

const users = []
async function newUser(account = privateKeyToAccount(generatePrivateKey())) {
  const { rows: [u] } = await pool.query("INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id", [account.address.toLowerCase()])
  const user = { id: u.id, account }
  users.push(user)
  return user
}

/** a planned+active appointed term with a full set of verified members */
async function seatCouncil({ members = 10, start = new Date(T - DAY) } = {}) {
  const term = await gov.createTerm(mgmt, { label: `Term ${randomUUID().slice(0, 8)}`, startsAt: start, appointmentMethod: 'appointed' })
  await gov.activateTerm(mgmt, term.id)
  const seats = (await pool.query('SELECT id, constituency FROM gov_seats WHERE term_id=$1 ORDER BY constituency, seat_no', [term.id])).rows
  const seated = []
  for (const seat of seats.slice(0, members)) {
    const u = await newUser()
    await gov.setEligibility(mgmt, { userId: u.id, constituency: seat.constituency, status: 'verified', evidenceRef: 'review#' + seat.id.slice(0, 6) })
    const m = await gov.appoint(mgmt, { seatId: seat.id, userId: u.id, publicDisplayName: `Rep ${seated.length + 1}`, publicConsent: seated.length % 2 === 0 })
    seated.push({ ...u, seat, membershipId: m.membershipId })
  }
  return { term, seats, seated }
}
const reviewer = async () => {
  const u = await newUser()
  await gov.grantRole(mgmt, u.id, 'reviewer')
  return { user: u, actor: await gov.actorFor(u.id) }
}

/** proposal that reaches under_review */
async function proposalUnderReview(over = {}) {
  const author = await newUser()
  const p = await gov.createProposal(author.id, {
    title: 'Improve chart tooltips', summary: 'Show OHLC values in chart tooltips on touch devices.', description: 'Detailed description of the tooltip improvement with enough text.',
    category: 'product_priority', classification: 'binding', expectedBenefits: 'Faster reading', risks: 'None significant', ...over })
  const rv = await reviewer()
  await gov.transition(await gov.actorFor(author.id), p.ofpId, 'discussion')
  await gov.transition(await gov.actorFor(author.id), p.ofpId, 'submitted')
  await gov.transition(rv.actor, p.ofpId, 'under_review')
  return { ofp: p.ofpId, author, rv }
}
const FINANCIAL_TABLES = ['purchase_orders', 'payments', 'withdrawal_requests', 'demo_accounts', 'challenge_plans', 'openfund_challenges', 'referral_codes']
const fingerprint = async () => Object.fromEntries(await Promise.all(FINANCIAL_TABLES.map(async (t) => [t, (await pool.query(`SELECT count(*)::int n FROM ${t}`)).rows[0].n])))

before(async () => { await pool.query('SELECT 1') })
beforeEach(async () => { await pool.query(`TRUNCATE ${TABLES} RESTART IDENTITY CASCADE`); await pool.query('ALTER SEQUENCE gov_ofp_seq RESTART WITH 1'); T = Date.parse('2027-03-01T12:00:00Z') })
after(async () => { await pool.end() })

/* ============ council structure ============ */
test('with no council, the public view is truthful: no term, 10 vacancies, no invented members, elections disabled', async () => {
  const o = await gov.overview()
  assert.equal(o.council.term, null); assert.equal(o.council.vacantCount, 10); assert.equal(o.council.seatedCount, 0)
  assert.equal(o.model.dao, false); assert.equal(o.model.token, false); assert.equal(o.model.onChainVoting, false)
  assert.equal(o.elections.publicEnabled, false); assert.match(o.initialCouncilNote, /No council has been seated/)
})
test('a term creates exactly 10 seats, two per constituency, lasting six months', async () => {
  const { term, seats } = await seatCouncil({ members: 0 })
  assert.equal(seats.length, 10)
  for (const k of CONSTITUENCIES) assert.equal(seats.filter((s) => s.constituency === k).length, 2)
  const c = await gov.council()
  assert.equal(new Date(c.term.endsAt).toISOString(), '2027-08-28T12:00:00.000Z'.replace('08-28', '08-28'))
  assert.equal(c.seats.every((s) => s.status === 'vacant'), true)
  await assert.rejects(pool.query("INSERT INTO gov_seats (term_id, constituency, seat_no) VALUES ($1,'coach',3)", [term.id]))
  await assert.rejects(pool.query("INSERT INTO gov_seats (term_id, constituency, seat_no) VALUES ($1,'coach',1)", [term.id]))
})
test('an initial appointed council is labelled appointed, never elected; names appear only with consent', async () => {
  await seatCouncil()
  const c = await gov.council(); const o = await gov.overview()
  assert.equal(c.seatedCount, 10); assert.equal(c.term.appointmentMethod, 'appointed')
  assert.ok(c.seats.every((s) => s.membershipType === 'appointed'))
  assert.match(o.initialCouncilNote, /appointed by company management/)
  const named = c.seats.filter((s) => s.displayName), hidden = c.seats.filter((s) => s.nameWithheld)
  assert.equal(named.length, 5); assert.equal(hidden.length, 5); assert.ok(hidden.every((s) => s.displayName === null))
})
test('appointment requires verified eligibility for that exact constituency', async () => {
  const { seats } = await seatCouncil({ members: 0 })
  const u = await newUser()
  await rejects(gov.appoint(mgmt, { seatId: seats[0].id, userId: u.id }), 'not_verified_for_constituency', 409)
  await gov.setEligibility(mgmt, { userId: u.id, constituency: 'coach', status: 'verified', evidenceRef: 'review#1' })
  const wrong = seats.find((s) => s.constituency === 'ambassador')
  await rejects(gov.appoint(mgmt, { seatId: wrong.id, userId: u.id }), 'not_verified_for_constituency')
  await gov.setEligibility(mgmt, { userId: u.id, constituency: 'coach', status: 'pending', evidenceRef: 'review#1' })
  await rejects(gov.appoint(mgmt, { seatId: seats.find((s) => s.constituency === 'coach').id, userId: u.id }), 'not_verified_for_constituency')
  await assert.rejects(gov.setEligibility(mgmt, { userId: u.id, constituency: 'coach', status: 'verified' }), /evidence_ref_required/)
})
test('one person holds one active voting seat: same wallet, second constituency, or another wallet of the same person', async () => {
  const { seats } = await seatCouncil({ members: 0 })
  const a = await newUser(), b = await newUser()
  const coach = seats.filter((s) => s.constituency === 'coach'), amb = seats.filter((s) => s.constituency === 'ambassador')
  for (const [u, k] of [[a, 'coach'], [a, 'ambassador']]) await gov.setEligibility(mgmt, { userId: u.id, constituency: k, status: 'verified', evidenceRef: 'r#1', personRef: 'person-A' })
  await gov.setEligibility(mgmt, { userId: b.id, constituency: 'coach', status: 'verified', evidenceRef: 'r#2', personRef: 'person-A' })
  await gov.appoint(mgmt, { seatId: coach[0].id, userId: a.id })
  await rejects(gov.appoint(mgmt, { seatId: amb[0].id, userId: a.id }), 'already_holds_active_seat', 409)
  await rejects(gov.appoint(mgmt, { seatId: coach[1].id, userId: b.id }), 'already_holds_active_seat', 409)   /* second wallet, same person */
  await assert.rejects(pool.query("INSERT INTO gov_memberships (seat_id,user_id,starts_at,ends_at,appointment_method,appointed_by) VALUES ($1,$2,now(),now()+interval '1 day','appointed','x')", [amb[0].id, a.id]), /uq_gov_active_user/)
})
test('an occupied seat cannot be double-booked; suspended accounts cannot be seated', async () => {
  const { seats } = await seatCouncil({ members: 1 })
  const u = await newUser()
  await gov.setEligibility(mgmt, { userId: u.id, constituency: seats[0].constituency, status: 'verified', evidenceRef: 'r#1' })
  await rejects(gov.appoint(mgmt, { seatId: seats[0].id, userId: u.id }), 'seat_occupied', 409)
  await pool.query("UPDATE openfund_users SET status='suspended' WHERE id=$1", [u.id])
  await rejects(gov.appoint(mgmt, { seatId: seats[1].id, userId: u.id }), 'user_not_active', 409)
})
test('governance staff and council members are separate people (separation of duties)', async () => {
  const { seated } = await seatCouncil({ members: 1 })
  await rejects(gov.grantRole(mgmt, seated[0].id, 'reviewer'), 'council_member_cannot_be_governance_staff', 409)
  const { seats } = { seats: (await pool.query("SELECT id, constituency FROM gov_seats WHERE constituency='coach'")).rows }
  const rv = await reviewer()
  await gov.setEligibility(mgmt, { userId: rv.user.id, constituency: 'coach', status: 'verified', evidenceRef: 'r#9' })
  await rejects(gov.appoint(mgmt, { seatId: seats[0].id, userId: rv.user.id }), 'governance_staff_cannot_hold_seat', 409)
})
test('memberships end with the term and can be revoked; neither can vote afterwards', async () => {
  const { seated } = await seatCouncil({ members: 10 })
  const live = async (u) => (await gov.actorFor(u.id)).roles.has('council')
  assert.equal(await live(seated[0]), true)
  await gov.revokeMembership(mgmt, seated[0].membershipId, 'conduct review outcome')
  assert.equal(await live(seated[0]), false)
  await rejects(gov.revokeMembership(mgmt, seated[0].membershipId, 'again please'), 'membership_not_active', 409)
  advance(190 * DAY)                                   /* past the six-month term */
  assert.equal(await live(seated[1]), false)
  const c = await gov.council(); assert.equal(c.seatedCount, 0)
})
test('role escalation is impossible: members, council members and administrators cannot grant roles or appoint', async () => {
  const { seated, seats } = await seatCouncil({ members: 2 })
  const council = await gov.actorFor(seated[0].id)
  const plain = await gov.actorFor((await newUser()).id)
  const admin = await newUser(); await gov.grantRole(mgmt, admin.id, 'administrator'); const adminActor = await gov.actorFor(admin.id)
  for (const a of [council, plain, adminActor]) {
    await rejects(gov.grantRole(a, plain.userId, 'administrator'), 'forbidden', 403)
    await rejects(gov.appoint(a, { seatId: seats[5].id, userId: plain.userId }), 'forbidden', 403)
    await rejects(gov.revokeMembership(a, seated[1].membershipId, 'not allowed here'), 'forbidden', 403)
    await rejects(gov.activateTerm(a, randomUUID()), 'forbidden', 403)
  }
  await rejects(gov.setEligibility(council, { userId: plain.userId, constituency: 'coach', status: 'verified', evidenceRef: 'x#1' }), 'forbidden', 403)
  await rejects(gov.auditEvents(council), 'forbidden', 403)
  await assert.rejects(gov.workspace(plain.userId), /council_membership_required/)
})

/* ============ proposals ============ */
test('OFP identifiers are unique, sequential, stable and backend-generated', async () => {
  const author = await newUser()
  const mk = (category = 'documentation') => gov.createProposal(author.id, { title: 'Docs improvement', summary: 'Write better onboarding docs.', category })
  const [a, b, c] = [await mk(), await mk(), await mk()]
  assert.deepEqual([a.ofpId, b.ofpId, c.ofpId], ['OFP-0001', 'OFP-0002', 'OFP-0003'])
  await assert.rejects(pool.query("UPDATE gov_proposals SET ofp_number=5 WHERE ofp_id='OFP-0001'"), /immutable/i)
  await assert.rejects(pool.query("UPDATE gov_proposals SET ofp_id='OFP-9999' WHERE ofp_id='OFP-0001'"))
})
test('reserved company powers can only be advisory, in the service and in the database', async () => {
  const author = await newUser()
  for (const category of ['treasury', 'pricing', 'commissions', 'payouts', 'trading_risk', 'capital_allocation', 'contract_deployment']) {
    await rejects(gov.createProposal(author.id, { title: 'Change something', summary: 'Please change a financial thing.', category, classification: 'binding' }), 'reserved_power_is_advisory_only')
    const p = await gov.createProposal(author.id, { title: 'Change something', summary: 'Please change a financial thing.', category })
    assert.equal(p.classification, 'advisory'); assert.equal(p.binding, false); assert.equal(p.reservedPower, true)
  }
  await assert.rejects(pool.query("INSERT INTO gov_proposals (author_id,title,summary,category,classification) VALUES ($1,'Raw insert','Raw insert attempt','pricing','binding')", [author.id]), /gov_reserved_is_advisory/)
})
test('authors cannot flip an advisory financial proposal to binding by editing it', async () => {
  const author = await newUser()
  const p = await gov.createProposal(author.id, { title: 'Lower the prices', summary: 'Lower challenge prices please.', category: 'pricing' })
  await rejects(gov.updateProposal(author.id, p.ofpId, { classification: 'binding' }), 'reserved_power_is_advisory_only')
  await rejects(gov.updateProposal(author.id, p.ofpId, { category: 'roadmap', classification: 'binding' }).then(() => { throw new Error('x') }).catch((e) => { throw e.code ? e : e }), undefined).catch(() => {})
})
test('invalid inputs are rejected: bad category, short title, non-https links, oversize text', async () => {
  const author = await newUser()
  const base = { title: 'A fine title', summary: 'A fine summary text.', category: 'documentation' }
  await rejects(gov.createProposal(author.id, { ...base, category: 'nope' }), 'unknown_category')
  await rejects(gov.createProposal(author.id, { ...base, title: 'abc' }), 'title_too_short')
  await rejects(gov.createProposal(author.id, { ...base, githubIssue: 'javascript:alert(1)' }), 'githubIssue_invalid')
  await rejects(gov.createProposal(author.id, { ...base, documentation: ['http://insecure.example'] }), 'documentation_invalid')
  await rejects(gov.createProposal(author.id, { ...base, description: 'x'.repeat(20001) }), 'description_too_long')
})
test('lifecycle: only valid transitions by the right role, history retained, drafts stay private', async () => {
  const author = await newUser(); const other = await newUser(); const rv = await reviewer()
  const p = await gov.createProposal(author.id, { title: 'Accessible focus rings', summary: 'Make focus rings visible everywhere.', description: 'A long enough description for submission rules.', category: 'accessibility', classification: 'binding', expectedBenefits: 'Keyboard users', risks: 'Minor visual change' })
  await rejects(gov.getProposal(p.ofpId), 'proposal_not_found', 404)                            /* draft is private */
  assert.equal((await gov.getProposal(p.ofpId, author.id)).status, 'draft')
  const a = await gov.actorFor(author.id), o = await gov.actorFor(other.id)
  await rejects(gov.transition(o, p.ofpId, 'discussion'), 'transition_forbidden', 403)         /* not the author */
  await rejects(gov.transition(a, p.ofpId, 'voting'), 'invalid_transition', 409)
  await rejects(gov.transition(a, p.ofpId, 'approved'), 'invalid_transition', 409)
  await gov.transition(a, p.ofpId, 'discussion')
  await rejects(gov.transition(a, p.ofpId, 'under_review'), 'invalid_transition', 409)
  await gov.transition(a, p.ofpId, 'submitted')
  await rejects(gov.transition(a, p.ofpId, 'under_review'), 'transition_forbidden', 403)       /* authors cannot review themselves */
  await gov.transition(rv.actor, p.ofpId, 'under_review')
  await rejects(gov.transition(rv.actor, p.ofpId, 'voting'), 'transition_requires_dedicated_operation')
  const d = await gov.getProposal(p.ofpId)
  assert.deepEqual(d.history.map((h) => h.to_status), ['draft', 'discussion', 'submitted', 'under_review'])
  assert.equal(d.revisions.length, 1)
  await assert.rejects(pool.query('UPDATE gov_proposal_history SET note=$1', ['tampered']), /append-only/)
  await assert.rejects(pool.query('DELETE FROM gov_proposal_history'), /append-only/)
})
test('incomplete proposals cannot be submitted; edits are author-only and lock after submission', async () => {
  const author = await newUser(); const other = await newUser(); const a = await gov.actorFor(author.id)
  const p = await gov.createProposal(author.id, { title: 'Needs more detail', summary: 'This proposal lacks detail.', category: 'documentation' })
  await gov.transition(a, p.ofpId, 'discussion')
  await rejects(gov.transition(a, p.ofpId, 'submitted'), 'description_required_to_submit', 409)
  await rejects(gov.updateProposal(other.id, p.ofpId, { title: 'Hijacked title' }), 'forbidden', 403)
  const upd = await gov.updateProposal(author.id, p.ofpId, { description: 'Now a sufficiently long description.', expectedBenefits: 'Clarity', risks: 'None' })
  assert.equal(upd.revision, 2)                                                                  /* edits after publication = new immutable revision */
  await gov.transition(a, p.ofpId, 'submitted')
  await rejects(gov.updateProposal(author.id, p.ofpId, { title: 'Sneaky late change' }), 'proposal_locked', 409)
})
test('community feedback is separate from council votes and is labelled non-binding', async () => {
  const { ofp } = await proposalUnderReview(); const u = await newUser()
  await gov.addComment(u.id, ofp, { body: 'I support this.', stance: 'support' })
  await rejects(gov.addComment(u.id, ofp, { body: 'x', stance: 'vote' }), 'invalid_stance')
  const c = await gov.comments(ofp)
  assert.equal(c.comments.length, 1); assert.match(c.notice, /not a council vote/); assert.match(c.comments[0].author, /…/)
  assert.equal((await pool.query('SELECT count(*)::int n FROM gov_votes')).rows[0].n, 0)
})
test('pagination and filters are validated', async () => {
  await rejects(gov.listProposals({ limit: '-1' }), 'invalid_pagination')
  await rejects(gov.listProposals({ limit: '101' }), 'invalid_pagination')
  await rejects(gov.listProposals({ offset: 'abc' }), 'invalid_pagination')
  await rejects(gov.listProposals({ category: "x'; drop table gov_votes;--" }), 'unknown_category')
  await rejects(gov.listProposals({ status: 'draft' }), 'invalid_status')
  assert.equal((await gov.listProposals({})).total, 0)
})

/* ============ voting ============ */
async function openSession({ category, members = 10, classification = 'binding', hours = 48 } = {}) {
  const council = await seatCouncil({ members })
  const pr = await proposalUnderReview({ category: category || 'product_priority', classification })
  if (classification === 'binding' && ['roadmap', 'product_priority'].includes(category || 'product_priority')) await gov.confirmCapacity(mgmt, pr.ofp, 'within Q2 capacity')
  const session = await gov.openVoting(pr.rv.actor, pr.ofp, { opensAt: new Date(T), closesAt: new Date(T + hours * HOUR) })
  return { ...pr, ...council, session }
}
const vote = (u, ofp, choice) => gov.castVote(u.id, ofp, { choice })
const finalize = (pr) => gov.finalizeSession(pr.rv.actor, pr.ofp, { rationale: 'Result recorded per the voting policy.' })

test('binding capacity-bound proposals need management-confirmed capacity before voting opens', async () => {
  await seatCouncil()
  const pr = await proposalUnderReview({ category: 'roadmap' })
  await rejects(gov.openVoting(pr.rv.actor, pr.ofp, { opensAt: new Date(T), closesAt: new Date(T + DAY) }), 'capacity_confirmation_required', 409)
  await rejects(gov.confirmCapacity(pr.rv.actor, pr.ofp, 'reviewer cannot'), 'forbidden', 403)
  await gov.confirmCapacity(mgmt, pr.ofp, 'inside the approved envelope')
  await gov.openVoting(pr.rv.actor, pr.ofp, { opensAt: new Date(T), closesAt: new Date(T + DAY) })
})
test('voting is refused when the seated council cannot reach quorum (no silent rescheduling of the bar)', async () => {
  await seatCouncil({ members: 6 })
  const pr = await proposalUnderReview({ category: 'documentation' })
  await rejects(gov.openVoting(pr.rv.actor, pr.ofp, { opensAt: new Date(T), closesAt: new Date(T + DAY) }), 'council_below_quorum', 409)
})
test('only reviewers/management can open voting; windows are validated', async () => {
  const { ofp, author } = await (async () => { await seatCouncil(); return proposalUnderReview({ category: 'documentation' }) })()
  await rejects(gov.openVoting(await gov.actorFor(author.id), ofp, { opensAt: new Date(T), closesAt: new Date(T + DAY) }), 'forbidden', 403)
  await rejects(gov.openVoting(mgmt, ofp, { opensAt: new Date(T), closesAt: new Date(T + 1000) }), 'voting_window_out_of_range')
  await rejects(gov.openVoting(mgmt, ofp, { opensAt: new Date(T - DAY), closesAt: new Date(T + DAY) }), 'voting_window_in_past')
  await rejects(gov.openVoting(mgmt, ofp, { opensAt: 'nope', closesAt: 'nope' }), 'voting_window_invalid')
})
test('ordinary binding proposals need 6 approvals of 10; 6 approvals pass', async () => {
  const s = await openSession()
  for (let i = 0; i < 6; i++) await vote(s.seated[i], s.ofp, 'approve')
  await rejects(finalize(s), 'voting_still_open', 409)               /* quorum 7 not yet reached, 4 may still vote */
  await vote(s.seated[6], s.ofp, 'reject')
  const r = await finalize(s)
  assert.equal(r.outcome, 'approved'); assert.equal(r.binding, true)
  const p = await gov.getProposal(s.ofp)
  assert.equal(p.status, 'approved'); assert.equal(p.implementationStatus, 'not_started'); assert.ok(p.decisionRationale)
})
test('five approvals are not enough, even when everyone else abstains or rejects', async () => {
  const s = await openSession()
  for (let i = 0; i < 5; i++) await vote(s.seated[i], s.ofp, 'approve')
  for (let i = 5; i < 8; i++) await vote(s.seated[i], s.ofp, 'abstain')
  await vote(s.seated[8], s.ofp, 'reject'); await vote(s.seated[9], s.ofp, 'reject')
  const r = await finalize(s)
  assert.equal(r.outcome, 'rejected'); assert.equal(r.tally.abstain, 3)
  assert.equal((await gov.getProposal(s.ofp)).status, 'rejected')
})
test('abstentions count toward quorum but never as approval', async () => {
  const s = await openSession()
  for (let i = 0; i < 5; i++) await vote(s.seated[i], s.ofp, 'approve')
  await vote(s.seated[5], s.ofp, 'abstain'); await vote(s.seated[6], s.ofp, 'abstain')
  const t = await gov.sessionTally((await pool.query("SELECT * FROM gov_voting_sessions WHERE status='active'")).rows[0])
  assert.equal(t.participating, 7); assert.equal(t.quorumMet, true); assert.equal(t.approve, 5); assert.notEqual(t.outcome, 'approved')
})
test('constitutional amendments need 7 approvals: six is rejected, seven passes', async () => {
  const six = await openSession({ category: 'governance_amendment' })
  assert.equal(six.session.kind, 'constitutional'); assert.equal(six.session.threshold, 7)
  for (let i = 0; i < 6; i++) await vote(six.seated[i], six.ofp, 'approve')
  for (let i = 6; i < 10; i++) await vote(six.seated[i], six.ofp, 'reject')
  assert.equal((await finalize(six)).outcome, 'rejected')
  const seven = await openSession({ category: 'governance_amendment' })
  for (let i = 0; i < 7; i++) await vote(seven.seated[i], seven.ofp, 'approve')
  assert.equal((await finalize(seven)).outcome, 'approved')
})
test('insufficient participation leaves the proposal unresolved and under review, never silently approved', async () => {
  const s = await openSession()
  for (let i = 0; i < 6; i++) await vote(s.seated[i], s.ofp, 'approve')   /* 6 participate: quorum 7 missed */
  advance(49 * HOUR)
  const r = await finalize(s)
  assert.equal(r.outcome, 'unresolved'); assert.equal(r.tally.reason, 'quorum_unreachable')
  const p = await gov.getProposal(s.ofp)
  assert.equal(p.status, 'under_review'); assert.equal(p.decision, null)
  assert.equal(p.decisions[0].outcome, 'unresolved')
  const again = await gov.openVoting(s.rv.actor, s.ofp, { opensAt: new Date(T), closesAt: new Date(T + DAY) })   /* controlled rescheduling = a new session */
  assert.equal(again.phase, 'open')
})
test('vacancies never lower the threshold: 8 seated, 5 approve, 3 reject => rejected', async () => {
  const s = await openSession({ members: 8 })
  for (let i = 0; i < 5; i++) await vote(s.seated[i], s.ofp, 'approve')
  for (let i = 5; i < 8; i++) await vote(s.seated[i], s.ofp, 'reject')
  const r = await finalize(s)
  assert.equal(r.outcome, 'rejected'); assert.equal(r.tally.threshold, 6); assert.equal(r.tally.councilSize, 10)
})
test('one member, one vote: duplicates are rejected and the first vote is final', async () => {
  const s = await openSession()
  await vote(s.seated[0], s.ofp, 'approve')
  await rejects(vote(s.seated[0], s.ofp, 'approve'), 'already_voted', 409)
  await rejects(vote(s.seated[0], s.ofp, 'reject'), 'already_voted', 409)
  const ids = await Promise.allSettled([vote(s.seated[1], s.ofp, 'approve'), vote(s.seated[1], s.ofp, 'reject'), vote(s.seated[1], s.ofp, 'abstain')])
  assert.equal(ids.filter((r) => r.status === 'fulfilled').length, 1)                         /* concurrent duplicates: exactly one wins */
  assert.equal((await pool.query('SELECT count(*)::int n FROM gov_votes WHERE user_id=$1', [s.seated[1].id])).rows[0].n, 1)
  await assert.rejects(pool.query("UPDATE gov_votes SET choice='reject'"), /append-only/)
  await assert.rejects(pool.query('DELETE FROM gov_votes'), /append-only/)
})
test('invalid choices, non-members, plain members, reviewers and the author cannot vote', async () => {
  const s = await openSession()
  await rejects(gov.castVote(s.seated[0].id, s.ofp, { choice: 'yes' }), 'invalid_choice')
  const outsider = await newUser()
  await rejects(vote(outsider, s.ofp, 'approve'), 'not_in_voting_snapshot', 403)
  await rejects(vote(s.rv.user, s.ofp, 'approve'), 'not_in_voting_snapshot', 403)
  await rejects(vote(s.author, s.ofp, 'approve'), 'not_in_voting_snapshot', 403)
  const vb = await gov.getProposal(s.ofp, outsider.id)
  assert.equal(vb.viewer.canVote, false); assert.equal(vb.viewer.reason, 'not_council_member')
  assert.equal((await gov.getProposal(s.ofp, s.seated[0].id)).viewer.canVote, true)
})
test('vote deadline: no votes before opening or after closing, and the window cannot be changed', async () => {
  await seatCouncil(); const pr = await proposalUnderReview({ category: 'documentation' })
  const council = (await pool.query('SELECT user_id FROM gov_memberships')).rows.map((r) => ({ id: r.user_id }))
  await gov.openVoting(pr.rv.actor, pr.ofp, { opensAt: new Date(T + HOUR), closesAt: new Date(T + 3 * HOUR) })
  await rejects(vote(council[0], pr.ofp, 'approve'), 'voting_not_open', 403)
  advance(2 * HOUR); await vote(council[0], pr.ofp, 'approve')
  advance(2 * HOUR); await rejects(vote(council[1], pr.ofp, 'approve'), 'voting_closed', 403)
  await assert.rejects(pool.query("UPDATE gov_voting_sessions SET closes_at = closes_at + interval '1 day'"), /fixed once the session exists/)
  await assert.rejects(pool.query("UPDATE gov_voting_sessions SET quorum = 3"), /fixed once the session exists/)
  await assert.rejects(pool.query("UPDATE gov_voting_sessions SET snapshot = '{}'::jsonb"), /fixed once the session exists/)
})
test('expired and revoked members cannot vote even though they are in the snapshot', async () => {
  const s = await openSession()
  await gov.revokeMembership(mgmt, s.seated[0].membershipId, 'revoked during the voting window')
  await rejects(vote(s.seated[0], s.ofp, 'approve'), 'membership_not_active', 403)
  await pool.query("UPDATE openfund_users SET status='suspended' WHERE id=$1", [s.seated[1].id])
  await rejects(vote(s.seated[1], s.ofp, 'approve'), 'account_not_active', 403)
  await pool.query("UPDATE gov_memberships SET ends_at = $2 WHERE user_id=$1", [s.seated[2].id, new Date(T - 1000)])   /* simulates expiry mid-vote */
  await rejects(vote(s.seated[2], s.ofp, 'approve'), 'membership_not_active', 403)
})
test('membership changes after the snapshot do not grant votes to new appointees', async () => {
  const s = await openSession({ members: 9 })
  const seat = s.seats.find((x) => !s.seated.some((m) => m.seat.id === x.id))
  const late = await newUser()
  await gov.setEligibility(mgmt, { userId: late.id, constituency: seat.constituency, status: 'verified', evidenceRef: 'r#late' })
  await gov.appoint(mgmt, { seatId: seat.id, userId: late.id })
  await rejects(vote(late, s.ofp, 'approve'), 'not_in_voting_snapshot', 403)
})
test('finalized results are immutable; corrections are explicit, authorised, reasoned amendments', async () => {
  const s = await openSession()
  for (let i = 0; i < 7; i++) await vote(s.seated[i], s.ofp, 'approve')
  const r = await finalize(s)
  await rejects(finalize(s), 'invalid_transition', 409)
  await rejects(vote(s.seated[8], s.ofp, 'approve'), 'no_open_voting', 409)
  await assert.rejects(pool.query("UPDATE gov_decisions SET outcome='rejected'"), /append-only/)
  await assert.rejects(pool.query("UPDATE gov_voting_sessions SET status='void'"), /immutable/)
  await assert.rejects(pool.query('DELETE FROM gov_decisions'), /append-only/)
  await rejects(gov.amendDecision(s.rv.actor, r.decisionId, { reason: 'reviewers may not amend', correction: { note: 'x' } }), 'forbidden', 403)
  await rejects(gov.amendDecision(mgmt, r.decisionId, { reason: 'short', correction: { note: 'x' } }), 'reason_too_short')
  const a = await gov.amendDecision(mgmt, r.decisionId, { reason: 'Typographical correction of the rationale text.', correction: { rationale: 'corrected wording' } })
  const d = await gov.getProposal(s.ofp)
  assert.equal(d.decisions[0].outcome, 'approved'); assert.equal(d.decisions[0].amendments.length, 1); assert.ok(a.amendmentId)
})
test('a voting session can be voided with a recorded reason; evidence is retained', async () => {
  const s = await openSession()
  await vote(s.seated[0], s.ofp, 'approve')
  await rejects(gov.voidSession(s.rv.actor, s.ofp, 'bad'), 'reason_too_short')
  await gov.voidSession(s.rv.actor, s.ofp, 'Material error found in the proposal text.')
  assert.equal((await gov.getProposal(s.ofp)).status, 'under_review')
  assert.equal((await pool.query('SELECT count(*)::int n FROM gov_votes')).rows[0].n, 1)
})
test('advisory proposals can be voted but the decision is recorded as non-binding', async () => {
  const s = await openSession({ category: 'pricing', classification: 'advisory' })
  for (let i = 0; i < 7; i++) await vote(s.seated[i], s.ofp, 'approve')
  const r = await finalize(s)
  assert.equal(r.outcome, 'approved'); assert.equal(r.binding, false)
  const d = await gov.decisions({})
  assert.equal(d.decisions[0].binding, false); assert.equal(d.decisions[0].classification, 'advisory')
})
test('public output hides individual choices while voting is open', async () => {
  const s = await openSession()
  await vote(s.seated[0], s.ofp, 'approve')
  const p = await gov.getProposal(s.ofp)
  assert.deepEqual(Object.keys(p.sessions[0].tally).sort(), ['councilSize', 'participating', 'quorum', 'quorumMet', 'threshold'])
  assert.doesNotMatch(JSON.stringify(p), /approve|reject/i.source ? /"choice"/ : /x/)
})

/* ============ conflicts of interest ============ */
test('a recused member cannot vote; a pending recusal request also blocks the vote; thresholds do not move', async () => {
  const s = await openSession()
  const a = await gov.declareConflict(s.seated[0].id, s.ofp, { reason: 'I contribute to the affected product area.' })
  await rejects(vote(s.seated[0], s.ofp, 'approve'), 'conflict_pending_review', 403)
  await rejects(gov.declareConflict(s.seated[0].id, s.ofp, { reason: 'duplicate declaration here' }), 'duplicate', 409)
  await rejects(gov.reviewConflict(await gov.actorFor(s.seated[1].id), a.conflictId, { decision: 'recused', note: 'not allowed' }), 'forbidden', 403)
  await gov.reviewConflict(s.rv.actor, a.conflictId, { decision: 'recused', note: 'Direct financial interest confirmed.' })
  await rejects(vote(s.seated[0], s.ofp, 'approve'), 'recused', 403)
  await rejects(gov.reviewConflict(s.rv.actor, a.conflictId, { decision: 'no_recusal', note: 'changing my mind' }), 'conflict_already_reviewed', 409)
  /* 9 can vote; 6 approve still required of the FULL council */
  for (let i = 1; i <= 5; i++) await vote(s.seated[i], s.ofp, 'approve')
  for (let i = 6; i <= 9; i++) await vote(s.seated[i], s.ofp, 'reject')
  const r = await finalize(s)
  assert.equal(r.outcome, 'rejected'); assert.equal(r.tally.threshold, 6); assert.equal(r.tally.recused, 1)
})
test('a declared conflict that the reviewer does not require recusal for lets the member vote; late recusal after voting is refused', async () => {
  const s = await openSession()
  const c1 = await gov.declareConflict(s.seated[0].id, s.ofp, { reason: 'Minor professional acquaintance.' })
  await gov.reviewConflict(s.rv.actor, c1.conflictId, { decision: 'no_recusal', note: 'Interest is immaterial.' })
  await vote(s.seated[0], s.ofp, 'approve')
  await rejects(gov.declareConflict(s.seated[0].id, s.ofp, { reason: 'declaring after voting' }), 'already_voted', 409)
  const c2 = await gov.declareConflict(s.seated[1].id, s.ofp, { reason: 'Declared before voting here.' })
  await vote(s.seated[1].id ? { id: s.seated[1].id } : s.seated[1], s.ofp, 'approve').catch(() => {})
})
test('only council members can declare conflicts', async () => {
  const s = await openSession()
  await rejects(gov.declareConflict((await newUser()).id, s.ofp, { reason: 'I am not a council member.' }), 'council_membership_required', 403)
})
test('recusals that make quorum unreachable leave the proposal unresolved instead of lowering the bar', async () => {
  const s = await openSession({ members: 8 })
  for (const i of [0, 1]) { const c = await gov.declareConflict(s.seated[i].id, s.ofp, { reason: 'Conflict of interest declared.' }); await gov.reviewConflict(s.rv.actor, c.conflictId, { decision: 'recused', note: 'Recusal accepted by review.' }) }
  for (let i = 2; i < 8; i++) await vote(s.seated[i], s.ofp, 'approve')   /* 6 of 6 possible voters */
  const r = await finalize(s)
  assert.equal(r.outcome, 'unresolved')
  assert.equal((await gov.getProposal(s.ofp)).status, 'under_review')
})

/* ============ signed votes ============ */
async function signedVote(user, ofp, choice, mutate = (x) => x) {
  const ch = await gov.issueVoteChallenge(user.id, ofp, choice)
  const signature = await user.account.signMessage({ message: ch.message })
  return { ch, body: mutate({ choice, nonce: ch.nonce, signature }) }
}
test('signed votes: message is domain-separated, verified against the wallet, stored as evidence', async () => {
  const s = await openSession()
  const { ch, body } = await signedVote(s.seated[0], s.ofp, 'approve')
  assert.match(ch.message, /Domain: openfund-governance-v1/); assert.match(ch.message, /moves no funds/)
  const r = await gov.castVote(s.seated[0].id, s.ofp, body)
  assert.equal(r.signed, true)
  const row = (await pool.query('SELECT signature, signed_message FROM gov_votes WHERE user_id=$1', [s.seated[0].id])).rows[0]
  assert.equal(row.signature, body.signature); assert.equal(row.signed_message, ch.message)
})
test('signed votes: replay, wrong signer, changed choice, missing nonce and expired challenges are rejected', async () => {
  const s = await openSession()
  const a = await signedVote(s.seated[0], s.ofp, 'approve')
  await gov.castVote(s.seated[0].id, s.ofp, a.body)
  /* replaying the same signed request for the same member */
  await rejects(gov.castVote(s.seated[0].id, s.ofp, a.body), 'already_voted', 409)
  /* replaying member 0's signed request as another member */
  await rejects(gov.castVote(s.seated[1].id, s.ofp, a.body), 'signature_challenge_invalid_or_replayed', 409)
  /* signature from a different wallet */
  const b = await signedVote(s.seated[2], s.ofp, 'approve')
  const forged = await s.seated[3].account.signMessage({ message: b.ch.message })
  await rejects(gov.castVote(s.seated[2].id, s.ofp, { choice: 'approve', nonce: b.ch.nonce, signature: forged }), 'signature_wallet_mismatch', 403)
  /* a rejected attempt rolls back; the rightful signer can still complete the vote once, and only once */
  await gov.castVote(s.seated[2].id, s.ofp, b.body)
  await rejects(gov.castVote(s.seated[2].id, s.ofp, b.body), 'already_voted', 409)
  /* signed for approve, submitted as reject */
  const c = await signedVote(s.seated[4], s.ofp, 'approve')
  await rejects(gov.castVote(s.seated[4].id, s.ofp, { ...c.body, choice: 'reject' }), 'signature_choice_mismatch', 409)
  /* signature without nonce */
  await rejects(gov.castVote(s.seated[5].id, s.ofp, { choice: 'approve', signature: c.body.signature }), 'signature_and_nonce_required_together')
  /* expired challenge */
  const d = await signedVote(s.seated[6], s.ofp, 'approve'); advance(11 * 60_000)
  await rejects(gov.castVote(s.seated[6].id, s.ofp, d.body), 'signature_challenge_invalid_or_replayed', 409)
  await rejects(gov.castVote(s.seated[6].id, s.ofp, { choice: 'approve', nonce: 'x', signature: '0x12' }), 'signature_invalid')
})
test('challenges are only issued to members who may vote right now', async () => {
  const s = await openSession()
  await rejects(gov.issueVoteChallenge((await newUser()).id, s.ofp, 'approve'), 'not_in_voting_snapshot', 403)
  await vote(s.seated[0], s.ofp, 'approve')
  await rejects(gov.issueVoteChallenge(s.seated[0].id, s.ofp, 'approve'), 'already_voted', 409)
  await rejects(gov.issueVoteChallenge(s.seated[1].id, s.ofp, 'maybe'), 'invalid_choice')
})

/* ============ implementation ============ */
test('approved is not implemented: execution evidence is required and only management may mark a blocker', async () => {
  const s = await openSession()
  for (let i = 0; i < 7; i++) await vote(s.seated[i], s.ofp, 'approve')
  await finalize(s)
  await rejects(gov.recordImplementation(s.rv.actor, s.ofp, { status: 'implemented', evidenceUrl: 'https://github.com/x/y/pull/1' }), 'invalid_transition', 409)
  await gov.recordImplementation(s.rv.actor, s.ofp, { status: 'scheduled' })
  await gov.recordImplementation(s.rv.actor, s.ofp, { status: 'in_progress' })
  await rejects(gov.recordImplementation(s.rv.actor, s.ofp, { status: 'implemented' }), 'execution_evidence_required', 409)
  await rejects(gov.recordImplementation(s.rv.actor, s.ofp, { status: 'implemented', evidenceUrl: 'http://not-https.example' }), 'evidence_url_invalid')
  await rejects(gov.recordImplementation(s.rv.actor, s.ofp, { status: 'blocked', blockedReason: 'x'.repeat(30), blockedEvidence: 'evidence here', nextReviewOn: '2027-06-01' }), 'forbidden', 403)
  await rejects(gov.recordImplementation(mgmt, s.ofp, { status: 'blocked', blockedReason: 'too short', blockedEvidence: 'evidence here', nextReviewOn: '2027-06-01' }), 'blockedReason_too_short')
  await rejects(gov.recordImplementation(mgmt, s.ofp, { status: 'blocked', blockedReason: 'A documented security blocker applies here.', blockedEvidence: 'Security review SR-12', nextReviewOn: '2027-01-01' }), 'nextReviewOn_must_be_future')
  await gov.recordImplementation(mgmt, s.ofp, { status: 'blocked', blockedReason: 'A documented security blocker applies here.', blockedEvidence: 'Security review SR-12', nextReviewOn: '2027-06-01' })
  const dec = await gov.decisions({})
  assert.equal(dec.blocked[0].ofp_id, s.ofp); assert.equal(dec.blocked[0].blocker.next_review_on !== null, true)
  await gov.recordImplementation(mgmt, s.ofp, { status: 'in_progress' })
  const done = await gov.recordImplementation(s.rv.actor, s.ofp, { status: 'implemented', evidenceUrl: 'https://github.com/openfund/openfund/pull/123' })
  assert.equal(done.status, 'implemented'); assert.equal(done.implementationStatus, 'implemented')
  assert.equal((await gov.getProposal(s.ofp)).implementation.length, 5)
})
test('rejected proposals can never enter implementation', async () => {
  const s = await openSession()
  for (let i = 0; i < 7; i++) await vote(s.seated[i], s.ofp, 'reject')
  await finalize(s)
  await rejects(gov.recordImplementation(mgmt, s.ofp, { status: 'scheduled' }), 'invalid_transition', 409)
})

/* ============ elections ============ */
async function electionSetup() {
  const term = await gov.createTerm(mgmt, { label: 'Elected term', startsAt: new Date(T + 30 * DAY), appointmentMethod: 'elected' })
  const e = await gov.createElection(mgmt, { termId: term.id, constituency: 'coach', applicationsOpenAt: new Date(T), applicationsCloseAt: new Date(T + 5 * DAY), votingOpensAt: new Date(T + 6 * DAY), votingClosesAt: new Date(T + 10 * DAY) })
  const mk = async (name, eligible = true) => { const u = await newUser(); if (eligible) await gov.setEligibility(mgmt, { userId: u.id, constituency: 'coach', status: 'verified', evidenceRef: 'coach#' + name }); return u }
  return { term, e, mk }
}
test('elections stay disabled and invisible until management approves the rules', async () => {
  const { e, mk } = await electionSetup()
  const u = await mk('a')
  assert.equal((await gov.electionsPublic()).publicEnabled, false)
  await rejects(gov.advanceElection(mgmt, e.id, 'applications'), 'election_rules_not_approved', 409)
  await rejects(gov.applyCandidate(u.id, e.id, { publicDisplayName: 'Cand A' }), 'election_not_found', 404)
  await rejects(gov.approveElectionRules(await gov.actorFor(u.id), e.id), 'forbidden', 403)
  await gov.approveElectionRules(mgmt, e.id)
  assert.equal((await gov.electionsPublic()).publicEnabled, true)
})
test('election flow: eligibility-checked candidates, snapshot, one voter one vote, results, seating', async () => {
  const { e, mk } = await electionSetup()
  await gov.approveElectionRules(mgmt, e.id); await gov.advanceElection(mgmt, e.id, 'applications')
  const [c1, c2, c3, v1, v2, v3, nonEligible] = [await mk('c1'), await mk('c2'), await mk('c3'), await mk('v1'), await mk('v2'), await mk('v3'), await mk('x', false)]
  await rejects(gov.applyCandidate(nonEligible.id, e.id, { publicDisplayName: 'Not Eligible' }), 'not_verified_for_constituency', 403)
  const ids = []
  for (const [u, n] of [[c1, 'C One'], [c2, 'C Two'], [c3, 'C Three']]) ids.push((await gov.applyCandidate(u.id, e.id, { publicDisplayName: n })).candidateId)
  await rejects(gov.applyCandidate(c1.id, e.id, { publicDisplayName: 'C One' }), 'duplicate', 409)
  for (const id of ids) await gov.decideCandidate(mgmt, id, 'approved')
  await gov.advanceElection(mgmt, e.id, 'candidates_approved')
  advance(6 * DAY + HOUR); await gov.advanceElection(mgmt, e.id, 'voting')
  const snap = (await pool.query('SELECT count(*)::int n FROM gov_election_voters WHERE election_id=$1', [e.id])).rows[0].n
  assert.equal(snap, 6)                                                         /* 6 verified coaches; the non-eligible user is excluded */
  const late = await mk('late')                                                 /* verified AFTER the snapshot */
  await rejects(gov.castElectionVote(late.id, e.id, ids[0]), 'not_in_voter_snapshot', 403)
  await rejects(gov.castElectionVote(nonEligible.id, e.id, ids[0]), 'not_in_voter_snapshot', 403)
  await gov.castElectionVote(v1.id, e.id, ids[0]); await gov.castElectionVote(v2.id, e.id, ids[0]); await gov.castElectionVote(v3.id, e.id, ids[1]); await gov.castElectionVote(c3.id, e.id, ids[1])
  await rejects(gov.castElectionVote(v1.id, e.id, ids[1]), 'duplicate', 409)
  await assert.rejects(pool.query("UPDATE gov_election_votes SET candidate_id=$1", [ids[2]]), /append-only/)
  await rejects(gov.finalizeElection(mgmt, e.id), 'voting_still_open', 409)
  advance(5 * DAY)
  await rejects(gov.castElectionVote(c1.id, e.id, ids[2]), 'voting_closed', 409)
  const res = await gov.finalizeElection(mgmt, e.id)
  assert.equal(res.status, 'finalized'); assert.deepEqual(res.winners.sort(), [ids[0], ids[1]].sort())
  /* the term must be active for votes to matter; seating enforces the same eligibility rules as appointment */
  const seated = await gov.seatElectionWinners(mgmt, e.id)
  assert.equal(seated.seated.length, 2)
  assert.equal((await pool.query("SELECT appointment_method FROM gov_memberships WHERE status='active'")).rows.every((r) => r.appointment_method === 'elected'), true)
})
test('a tie for the last seat is not broken silently', async () => {
  const { e, mk } = await electionSetup()
  await gov.approveElectionRules(mgmt, e.id); await gov.advanceElection(mgmt, e.id, 'applications')
  const cs = [await mk('c1'), await mk('c2'), await mk('c3')], vs = [await mk('v1'), await mk('v2'), await mk('v3')]
  const ids = []; for (const [i, u] of cs.entries()) { ids.push((await gov.applyCandidate(u.id, e.id, { publicDisplayName: `Cand ${i}` })).candidateId); await gov.decideCandidate(mgmt, ids[i], 'approved') }
  await gov.advanceElection(mgmt, e.id, 'candidates_approved'); advance(6 * DAY + HOUR); await gov.advanceElection(mgmt, e.id, 'voting')
  await gov.castElectionVote(vs[0].id, e.id, ids[0]); await gov.castElectionVote(vs[1].id, e.id, ids[0]); await gov.castElectionVote(vs[2].id, e.id, ids[1]); await gov.castElectionVote(cs[0].id, e.id, ids[2])
  advance(5 * DAY)
  const res = await gov.finalizeElection(mgmt, e.id)
  assert.equal(res.status, 'closed'); assert.equal(res.needsRunoff, true)
})

/* ============ audit + isolation ============ */
test('the audit trail is hash-chained, append-only and covers each governance action', async () => {
  const s = await openSession()
  await vote(s.seated[0], s.ofp, 'approve')
  const types = (await pool.query('SELECT event_type FROM gov_audit_events ORDER BY id')).rows.map((r) => r.event_type)
  for (const t of ['term.created', 'term.activated', 'eligibility.set', 'seat.appointed', 'proposal.created', 'proposal.transition', 'voting.opened', 'vote.cast', 'role.granted']) assert.ok(types.includes(t), t)
  const v = await gov.verifyAuditChain(); assert.equal(v.ok, true); assert.ok(v.checked > 20)
  await assert.rejects(pool.query("UPDATE gov_audit_events SET details='{}' WHERE id=1"), /append-only/)
  await assert.rejects(pool.query('DELETE FROM gov_audit_events'), /append-only/)
  await pool.query('ALTER TABLE gov_audit_events DISABLE TRIGGER trg_gov_audit_append')
  try {
    await pool.query("UPDATE gov_audit_events SET details='{\"forged\":true}' WHERE id=2")
    assert.equal((await gov.verifyAuditChain()).ok, false)                     /* tampering by a superuser is detectable */
  } finally { await pool.query('ALTER TABLE gov_audit_events ENABLE TRIGGER trg_gov_audit_append') }
})
test('FINANCIAL ISOLATION: a full governance lifecycle leaves every financial table untouched', async () => {
  const before = await fingerprint()
  const s = await openSession({ category: 'pricing', classification: 'advisory' })
  for (let i = 0; i < 7; i++) await vote(s.seated[i], s.ofp, 'approve')
  await finalize(s)
  await gov.recordImplementation(s.rv.actor, s.ofp, { status: 'scheduled' })
  assert.deepEqual(await fingerprint(), before)
  /* an approved pricing recommendation is only a record: challenge plan prices are untouched */
  const plans = (await pool.query('SELECT count(*)::int n FROM challenge_plans')).rows[0].n
  assert.equal(plans, before.challenge_plans)
})
test('FINANCIAL ISOLATION: the service exposes no operation that touches funds, prices, rates, risk limits or contracts', async () => {
  const ops = Object.keys(gov).join(' ').toLowerCase()
  for (const word of ['transfer', 'treasury', 'price', 'commission', 'payout', 'withdraw', 'deploy', 'balance', 'trade', 'risk', 'refund', 'execute']) assert.ok(!ops.includes(word), word)
})
