/**
 * Openfund Hybrid Governance v1.0 — service layer.
 *
 * Authorization is enforced HERE (service level), not in the routes and not in
 * the UI: every mutating function receives an `actor` and calls assertCan().
 *
 * FINANCIAL ISOLATION (see GOVERNANCE.md §8, docs/governance/ROLES_AND_PERMISSIONS.md)
 *  - This module reads/writes `gov_*` tables and reads `openfund_users` ONLY.
 *  - It imports no trading, purchase, payout, treasury or pricing module.
 *  - A decision is a record. Nothing here moves funds, changes prices, rates,
 *    risk limits, balances or contracts, and no code path can be added by data.
 */
import crypto from 'node:crypto'
import { recoverMessageAddress } from 'viem'
import {
  CONSTITUENCIES, COUNCIL_SIZE, SEATS_PER_CONSTITUENCY, TERM_MONTHS, VOTING, VOTE_CHOICES,
  CATEGORIES, CAPACITY_CATEGORIES, AUTHOR_EDITABLE, PUBLIC_STATUSES, CONSTITUENCY_LABELS,
  resolveClassification, thresholdKindFor, assertTransition, evaluateSession, buildVoteMessage,
  electionWinners, addMonths, rule, isReserved, PERMISSIONS,
} from './governance-rules.js'

export { PERMISSIONS }
const SYSTEM_ROLE = 'system'
const TEXT_LIMITS = { title: 160, summary: 600, description: 20000, short: 4000 }
const URL_RE = /^https:\/\/[^\s]{3,500}$/i
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const OFP_RE = /^OFP-\d{4,}$/

const fail = (code, status = 400, extra = {}) => Object.assign(rule(code), { status }, extra)
const str = (v, max, { min = 0, required = false, field = 'field' } = {}) => {
  if (v == null || v === '') { if (required) throw fail(`${field}_required`); return null }
  if (typeof v !== 'string') throw fail(`${field}_invalid`)
  const s = v.trim()
  if (required && !s) throw fail(`${field}_required`)
  if (s.length < min) throw fail(`${field}_too_short`)
  if (s.length > max) throw fail(`${field}_too_long`)
  return s
}
const maskWallet = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || '')
/* canonical form: sorted keys, so a jsonb round-trip cannot change the hash */
const canon = (v) => {
  if (v && typeof v.toJSON === 'function') v = v.toJSON()
  if (Array.isArray(v)) return v.map(canon)
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => [k, canon(v[k])]))
  return v
}
const hashJson = (v) => crypto.createHash('sha256').update(JSON.stringify(canon(v))).digest('hex')

export function pageArgs(query = {}) {
  const num = (v, def, max) => {
    if (v === undefined) return def
    const n = Number(v)
    if (!Number.isInteger(n) || n < 0 || n > max) throw fail('invalid_pagination')
    return n
  }
  return { limit: Math.min(num(query.limit, 25, 100), 100) || 25, offset: num(query.offset, 0, 100000) }
}

export function createGovernance({ pool, clock = () => new Date(), recoverSigner = recoverMessageAddress } = {}) {
  const now = () => clock()

  /* ------------------------------------------------------------ plumbing */
  async function tx(fn) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const out = await fn(client)
      await client.query('COMMIT')
      return out
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      if (e.code === '23505') throw fail('duplicate', 409)
      if (e.code === '23000') throw fail('immutable_record', 409)
      if (e.code === '23514') throw fail('constraint_violation', 400)
      throw e
    } finally { client.release() }
  }
  const one = async (c, sql, p = []) => (await c.query(sql, p)).rows[0] || null
  const many = async (c, sql, p = []) => (await c.query(sql, p)).rows

  /** hash-chained, append-only audit trail (serialised with an advisory lock) */
  async function audit(c, { type, actor, subjectType, subjectId = null, details = {} }) {
    await c.query("SELECT pg_advisory_xact_lock(hashtext('gov_audit_chain'))")
    const prev = (await one(c, 'SELECT hash FROM gov_audit_events ORDER BY id DESC LIMIT 1'))?.hash || 'GENESIS'
    const at = now().toISOString()
    const body = [prev, type, actor?.userId || null, actor?.label || SYSTEM_ROLE, subjectType, subjectId, details, at]
    await c.query(
      `INSERT INTO gov_audit_events (event_type, actor_user_id, actor_role, subject_type, subject_id, details, prev_hash, hash, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [type, actor?.userId || null, actor?.label || SYSTEM_ROLE, subjectType, subjectId, JSON.stringify(details), prev, hashJson(body), at])
  }
  async function verifyAuditChain() {
    const rows = await many(pool, 'SELECT * FROM gov_audit_events ORDER BY id')
    let prev = 'GENESIS'
    for (const r of rows) {
      const body = [prev, r.event_type, r.actor_user_id, r.actor_role, r.subject_type, r.subject_id, r.details, r.created_at.toISOString()]
      if (r.prev_hash !== prev || r.hash !== hashJson(body)) return { ok: false, brokenAt: Number(r.id), checked: rows.length }
      prev = r.hash
    }
    return { ok: true, checked: rows.length }
  }

  /* -------------------------------------------------------------- actors */
  /** Company Management acting through the protected admin API (service token). */
  const managementActor = (label = 'company_management') => ({ userId: null, label, roles: new Set(['management']) })

  async function liveMembership(c, userId, at = now()) {
    return one(c,
      `SELECT m.*, s.constituency, s.seat_no, s.term_id FROM gov_memberships m JOIN gov_seats s ON s.id = m.seat_id
        WHERE m.user_id=$1 AND m.status='active' AND m.starts_at <= $2 AND m.ends_at > $2`, [userId, at])
  }
  /** Resolve what a signed-in user may do. Council authority is derived, never stored. */
  async function actorFor(userId, c = pool) {
    const roles = new Set(['member'])
    const user = await one(c, 'SELECT id, status FROM openfund_users WHERE id=$1', [userId])
    if (!user || user.status !== 'active') return { userId, label: 'anonymous', roles: new Set(), suspended: true }
    for (const r of await many(c, 'SELECT role FROM gov_roles WHERE user_id=$1 AND revoked_at IS NULL', [userId])) roles.add(r.role)
    const seat = await liveMembership(c, userId)
    if (seat) roles.add('council')
    return { userId, label: [...roles].filter((r) => r !== 'member').join('+') || 'member', roles, seat }
  }
  const can = (actor, action) => (PERMISSIONS[action] || []).some((r) => actor.roles.has(r)
    || (r === 'reviewer' && actor.roles.has('administrator')))
  const assertCan = (actor, action) => { if (!can(actor, action)) throw fail('forbidden', 403, { action }) }

  /* ---------------------------------------------------------- proposals */
  const PROPOSAL_COLS = `p.id, p.ofp_id, p.title, p.summary, p.description, p.category, p.classification, p.product_area,
    p.technical_implications, p.resource_requirements, p.expected_benefits, p.risks, p.documentation_links,
    p.github_issue_url, p.github_pr_url, p.status, p.revision, p.capacity_confirmed, p.decision, p.decision_rationale,
    p.implementation_status, p.created_at, p.updated_at, p.author_id, u.wallet_address AS author_wallet`
  const projectProposal = (r, extra = {}) => ({
    ofpId: r.ofp_id, title: r.title, summary: r.summary, description: r.description, category: r.category,
    classification: r.classification, /* 'binding' | 'advisory' — advisory is rendered "Advisory — Non-Binding" */
    binding: r.classification === 'binding', reservedPower: isReserved(r.category),
    productArea: r.product_area, technicalImplications: r.technical_implications,
    resourceRequirements: r.resource_requirements, expectedBenefits: r.expected_benefits, risks: r.risks,
    documentation: r.documentation_links, githubIssue: r.github_issue_url, githubPullRequest: r.github_pr_url,
    status: r.status, revision: r.revision, capacityConfirmed: r.capacity_confirmed, decision: r.decision,
    decisionRationale: r.decision_rationale, implementationStatus: r.implementation_status,
    author: maskWallet(r.author_wallet), createdAt: r.created_at, updatedAt: r.updated_at, ...extra,
  })
  const loadProposal = async (c, ofp, { lock = false } = {}) => {
    if (!OFP_RE.test(String(ofp))) throw fail('proposal_not_found', 404)
    const p = await one(c, `SELECT ${PROPOSAL_COLS} FROM gov_proposals p JOIN openfund_users u ON u.id=p.author_id WHERE p.ofp_id=$1 ${lock ? 'FOR UPDATE OF p' : ''}`, [ofp])
    if (!p) throw fail('proposal_not_found', 404)
    return p
  }
  const proposalRoles = (actor, p) => {
    const r = []
    if (actor.userId && actor.userId === p.author_id) r.push('author')
    if (can(actor, 'proposal.review')) r.push('reviewer')
    if (actor.roles.has('management')) r.push('management')
    return r
  }
  const snapshotOf = (p) => ({
    title: p.title, summary: p.summary, description: p.description, category: p.category, classification: p.classification,
    productArea: p.product_area, technicalImplications: p.technical_implications, resourceRequirements: p.resource_requirements,
    expectedBenefits: p.expected_benefits, risks: p.risks, documentation: p.documentation_links,
    githubIssue: p.github_issue_url, githubPullRequest: p.github_pr_url,
  })
  const logHistory = (c, p, from, to, actor, note) => c.query(
    `INSERT INTO gov_proposal_history (proposal_id, from_status, to_status, actor_id, actor_role, note) VALUES ($1,$2,$3,$4,$5,$6)`,
    [p.id, from, to, actor.userId || null, actor.label, note || null])
  const setStatus = async (c, p, to, actor, note, extraSql = '', extraParams = []) => {
    await c.query(`UPDATE gov_proposals SET status=$2 ${extraSql} WHERE id=$1`, [p.id, to, ...extraParams])
    await logHistory(c, p, p.status, to, actor, note)
  }

  function cleanProposalInput(input, { partial = false } = {}) {
    const out = {}
    const set = (k, v) => { if (!partial || input[k] !== undefined) out[k] = v }
    set('title', str(input.title, TEXT_LIMITS.title, { min: 5, required: !partial || input.title !== undefined, field: 'title' }))
    set('summary', str(input.summary, TEXT_LIMITS.summary, { min: 10, required: !partial || input.summary !== undefined, field: 'summary' }))
    set('description', str(input.description, TEXT_LIMITS.description, { field: 'description' }) ?? '')
    for (const [k, col] of [['productArea', 'product_area'], ['technicalImplications', 'technical_implications'], ['resourceRequirements', 'resource_requirements'], ['expectedBenefits', 'expected_benefits'], ['risks', 'risks']]) {
      if (!partial || input[k] !== undefined) out[col] = str(input[k], TEXT_LIMITS.short, { field: k })
    }
    if (!partial || input.githubIssue !== undefined) out.github_issue_url = input.githubIssue ? (URL_RE.test(input.githubIssue) ? input.githubIssue : (() => { throw fail('githubIssue_invalid') })()) : null
    if (!partial || input.githubPullRequest !== undefined) out.github_pr_url = input.githubPullRequest ? (URL_RE.test(input.githubPullRequest) ? input.githubPullRequest : (() => { throw fail('githubPullRequest_invalid') })()) : null
    if (!partial || input.documentation !== undefined) {
      const docs = input.documentation ?? []
      if (!Array.isArray(docs) || docs.length > 20 || docs.some((d) => typeof d !== 'string' || !URL_RE.test(d))) throw fail('documentation_invalid')
      out.documentation_links = JSON.stringify(docs)
    }
    return out
  }

  async function createProposal(userId, input) {
    const actor = await actorFor(userId)
    if (!actor.roles.has('member')) throw fail('forbidden', 403)
    const category = input.category
    if (!CATEGORIES.includes(category)) throw fail('unknown_category')
    const classification = resolveClassification(category, input.classification || 'advisory')
    const f = cleanProposalInput(input)
    return tx(async (c) => {
      const p = await one(c,
        `INSERT INTO gov_proposals (author_id, title, summary, description, category, classification, product_area, technical_implications,
           resource_requirements, expected_benefits, risks, documentation_links, github_issue_url, github_pr_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING ofp_id`,
        [userId, f.title, f.summary, f.description, category, classification, f.product_area, f.technical_implications,
          f.resource_requirements, f.expected_benefits, f.risks, f.documentation_links, f.github_issue_url, f.github_pr_url])
      const row = await loadProposal(c, p.ofp_id)
      await logHistory(c, row, null, 'draft', actor, 'created')
      await audit(c, { type: 'proposal.created', actor, subjectType: 'proposal', subjectId: row.ofp_id, details: { category, classification } })
      return projectProposal(row)
    })
  }

  async function updateProposal(userId, ofp, patch) {
    const actor = await actorFor(userId)
    return tx(async (c) => {
      const p = await loadProposal(c, ofp, { lock: true })
      if (p.author_id !== userId) throw fail('forbidden', 403)
      if (!AUTHOR_EDITABLE.includes(p.status)) throw fail('proposal_locked', 409, { hint: 'material_amendment_requires_new_revision' })
      /* the binding/advisory class and category follow the same rule as creation */
      const category = patch.category ?? p.category
      const classification = resolveClassification(category, patch.classification ?? p.classification)
      const f = cleanProposalInput(patch, { partial: true })
      const cols = { ...f, category, classification }
      const names = Object.keys(cols)
      await c.query(`UPDATE gov_proposals SET ${names.map((n, i) => `${n}=$${i + 2}`).join(', ')} WHERE id=$1`, [p.id, ...names.map((n) => cols[n])])
      let row = await loadProposal(c, ofp)
      if (p.status === 'discussion') { /* every change after publication is a new immutable revision */
        await c.query('UPDATE gov_proposals SET revision = revision + 1 WHERE id=$1', [p.id])
        row = await loadProposal(c, ofp)
        await c.query('INSERT INTO gov_proposal_revisions (proposal_id, revision, snapshot, created_by) VALUES ($1,$2,$3,$4)', [p.id, row.revision, JSON.stringify(snapshotOf(row)), userId])
      }
      await audit(c, { type: 'proposal.updated', actor, subjectType: 'proposal', subjectId: ofp, details: { fields: names, revision: row.revision } })
      return projectProposal(row)
    })
  }

  function assertSubmittable(p) {
    if (!p.description || p.description.length < 30) throw fail('description_required_to_submit', 409)
    if (!p.expected_benefits) throw fail('expected_benefits_required_to_submit', 409)
    if (!p.risks) throw fail('risks_required_to_submit', 409)
  }

  /** generic transitions only — voting/finalize/implementation have dedicated, validated operations */
  async function transition(actor, ofp, to, note) {
    return tx(async (c) => {
      const p = await loadProposal(c, ofp, { lock: true })
      assertTransition(p.status, to, proposalRoles(actor, p), null)
      if (to === 'submitted') assertSubmittable(p)
      if (to === 'discussion' && p.status === 'draft') {
        await c.query('INSERT INTO gov_proposal_revisions (proposal_id, revision, snapshot, created_by) VALUES ($1,$2,$3,$4)', [p.id, p.revision, JSON.stringify(snapshotOf(p)), p.author_id])
      }
      if (to === 'discussion' && ['submitted', 'under_review'].includes(p.status) && !str(note, 1000, { min: 5 })) throw fail('note_required', 400)
      await setStatus(c, p, to, actor, str(note, 1000))
      await audit(c, { type: 'proposal.transition', actor, subjectType: 'proposal', subjectId: ofp, details: { from: p.status, to } })
      return projectProposal(await loadProposal(c, ofp))
    })
  }

  async function confirmCapacity(actor, ofp, note) {
    assertCan(actor, 'capacity.confirm')
    return tx(async (c) => {
      const p = await loadProposal(c, ofp, { lock: true })
      if (!CAPACITY_CATEGORIES.includes(p.category)) throw fail('capacity_not_applicable', 409)
      if (!['submitted', 'under_review'].includes(p.status)) throw fail('invalid_transition', 409)
      await c.query('UPDATE gov_proposals SET capacity_confirmed=true, capacity_confirmed_by=$2 WHERE id=$1', [p.id, actor.label])
      await audit(c, { type: 'proposal.capacity_confirmed', actor, subjectType: 'proposal', subjectId: ofp, details: { note: str(note, 1000) } })
      return projectProposal(await loadProposal(c, ofp))
    })
  }

  /* ------------------------------------------------------------ council */
  async function snapshotCouncil(c, at) {
    const term = await one(c, "SELECT * FROM gov_terms WHERE status='active'")
    if (!term) return { term: null, seats: [], seated: 0 }
    const seats = await many(c,
      `SELECT s.id AS seat_id, s.constituency, s.seat_no, m.id AS membership_id, m.user_id, m.ends_at, m.appointment_method
         FROM gov_seats s LEFT JOIN gov_memberships m ON m.seat_id=s.id AND m.status='active' AND m.starts_at <= $2 AND m.ends_at > $2
         LEFT JOIN openfund_users u ON u.id=m.user_id
        WHERE s.term_id=$1 AND (m.id IS NULL OR u.status='active') ORDER BY s.constituency, s.seat_no`, [term.id, at])
    return {
      term: { id: term.id, label: term.label, startsAt: term.starts_at, endsAt: term.ends_at },
      seats: seats.map((s) => ({ seatId: s.seat_id, constituency: s.constituency, seatNo: s.seat_no, membershipId: s.membership_id, userId: s.user_id })),
      seated: seats.filter((s) => s.user_id).length,
    }
  }

  async function council() {
    const term = await one(pool, "SELECT * FROM gov_terms WHERE status='active'")
    const planned = await many(pool, "SELECT id, label, starts_at, ends_at, appointment_method FROM gov_terms WHERE status='planned' ORDER BY starts_at")
    const config = { councilSize: COUNCIL_SIZE, seatsPerConstituency: SEATS_PER_CONSTITUENCY, termMonths: TERM_MONTHS, ...VOTING, constituencies: CONSTITUENCIES.map((k) => ({ key: k, seats: SEATS_PER_CONSTITUENCY, label: CONSTITUENCY_LABELS[k] })) }
    if (!term) return { term: null, plannedTerms: planned, seats: [], seatedCount: 0, vacantCount: COUNCIL_SIZE, config }
    const at = now()
    const rows = await many(pool,
      `SELECT s.id AS seat_id, s.constituency, s.seat_no, m.id AS membership_id, m.public_display_name, m.public_consent,
              m.starts_at, m.ends_at, m.appointment_method, m.user_id,
              (SELECT count(*)::int FROM gov_votes v JOIN gov_voting_sessions vs ON vs.id=v.session_id WHERE v.user_id=m.user_id AND vs.status='finalized') AS votes_cast,
              (SELECT count(*)::int FROM gov_voting_sessions vs WHERE vs.status='finalized' AND vs.snapshot @> jsonb_build_object('seats', jsonb_build_array(jsonb_build_object('userId', m.user_id)))) AS sessions_eligible
         FROM gov_seats s
         LEFT JOIN gov_memberships m ON m.seat_id=s.id AND m.status='active' AND m.starts_at <= $2 AND m.ends_at > $2
        WHERE s.term_id=$1 ORDER BY s.constituency, s.seat_no`, [term.id, at])
    const seats = rows.map((r) => ({
      seatId: r.seat_id, constituency: r.constituency, constituencyLabel: CONSTITUENCY_LABELS[r.constituency], seatNo: r.seat_no,
      status: r.membership_id ? 'seated' : 'vacant',
      /* a name is public only with the member's recorded consent */
      displayName: r.membership_id ? (r.public_consent ? r.public_display_name : null) : null,
      nameWithheld: Boolean(r.membership_id && !r.public_consent),
      termStartsAt: r.membership_id ? r.starts_at : null, termEndsAt: r.membership_id ? r.ends_at : null,
      membershipType: r.membership_id ? r.appointment_method : null,
      participation: r.membership_id ? { votesCast: r.votes_cast, sessionsEligible: r.sessions_eligible } : null,
    }))
    const seatedCount = seats.filter((s) => s.status === 'seated').length
    return { term: { id: term.id, label: term.label, startsAt: term.starts_at, endsAt: term.ends_at, appointmentMethod: term.appointment_method }, plannedTerms: planned, seats, seatedCount, vacantCount: COUNCIL_SIZE - seatedCount, config }
  }

  async function expireMemberships(c) {
    await c.query("UPDATE gov_memberships SET status='ended' WHERE status='active' AND ends_at <= $1", [now()])
    await c.query("UPDATE gov_terms SET status='ended' WHERE status='active' AND ends_at <= $1", [now()])
  }

  async function createTerm(actor, { label, startsAt, appointmentMethod = 'appointed', notes }) {
    assertCan(actor, 'term.create')
    const start = new Date(startsAt)
    if (Number.isNaN(start.getTime())) throw fail('startsAt_invalid')
    if (!['appointed', 'elected'].includes(appointmentMethod)) throw fail('appointment_method_invalid')
    const end = addMonths(start, TERM_MONTHS)
    return tx(async (c) => {
      const term = await one(c, 'INSERT INTO gov_terms (label, starts_at, ends_at, appointment_method, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [str(label, 80, { min: 3, required: true, field: 'label' }), start, end, appointmentMethod, str(notes, 1000)])
      for (const k of CONSTITUENCIES) for (let n = 1; n <= SEATS_PER_CONSTITUENCY; n++) {
        await c.query('INSERT INTO gov_seats (term_id, constituency, seat_no) VALUES ($1,$2,$3)', [term.id, k, n])
      }
      await audit(c, { type: 'term.created', actor, subjectType: 'term', subjectId: term.id, details: { label, startsAt: start, endsAt: end, appointmentMethod, seats: COUNCIL_SIZE } })
      return { id: term.id, label: term.label, startsAt: term.starts_at, endsAt: term.ends_at, status: term.status, seats: COUNCIL_SIZE }
    })
  }

  async function activateTerm(actor, termId) {
    assertCan(actor, 'term.activate')
    return tx(async (c) => {
      await expireMemberships(c)
      const term = await one(c, 'SELECT * FROM gov_terms WHERE id=$1 FOR UPDATE', [termId])
      if (!term) throw fail('term_not_found', 404)
      if (term.status !== 'planned') throw fail('term_not_planned', 409)
      if (term.ends_at <= now()) throw fail('term_already_over', 409)
      await c.query("UPDATE gov_terms SET status='ended' WHERE status='active'")
      await c.query("UPDATE gov_terms SET status='active' WHERE id=$1", [termId])
      await audit(c, { type: 'term.activated', actor, subjectType: 'term', subjectId: termId, details: {} })
      return { id: termId, status: 'active' }
    })
  }

  async function setEligibility(actor, { userId, constituency, status, personRef, evidenceRef, expiresAt, source }) {
    assertCan(actor, 'eligibility.manage')
    if (!CONSTITUENCIES.includes(constituency)) throw fail('unknown_constituency')
    if (!['pending', 'verified', 'rejected', 'revoked'].includes(status)) throw fail('invalid_status')
    if (!UUID_RE.test(String(userId))) throw fail('user_not_found', 404)
    if (status === 'verified' && !str(evidenceRef, 300, { min: 3 })) throw fail('evidence_ref_required')
    return tx(async (c) => {
      if (!(await one(c, 'SELECT 1 FROM openfund_users WHERE id=$1', [userId]))) throw fail('user_not_found', 404)
      const row = await one(c,
        `INSERT INTO gov_eligibility (user_id, constituency, status, person_ref, evidence_ref, source, decided_by, decided_at, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,now(),$8)
         ON CONFLICT (user_id, constituency) DO UPDATE SET status=$3, person_ref=$4, evidence_ref=$5, source=$6, decided_by=$7, decided_at=now(), expires_at=$8
         RETURNING *`,
        [userId, constituency, status, str(personRef, 120), str(evidenceRef, 300), str(source, 60) || 'management_review', actor.label, expiresAt ? new Date(expiresAt) : null])
      await audit(c, { type: 'eligibility.set', actor, subjectType: 'user', subjectId: userId, details: { constituency, status } })
      return { id: row.id, userId, constituency, status: row.status, expiresAt: row.expires_at }
    })
  }

  async function appoint(actor, { seatId, userId, publicDisplayName, publicConsent = false }) {
    assertCan(actor, 'seat.appoint')
    return tx(async (c) => {
      await expireMemberships(c)
      const seat = await one(c, 'SELECT s.*, t.starts_at, t.ends_at, t.status AS term_status, t.appointment_method FROM gov_seats s JOIN gov_terms t ON t.id=s.term_id WHERE s.id=$1', [seatId])
      if (!seat) throw fail('seat_not_found', 404)
      if (!['planned', 'active'].includes(seat.term_status)) throw fail('term_not_open', 409)
      const user = await one(c, 'SELECT id, status FROM openfund_users WHERE id=$1', [userId])
      if (!user) throw fail('user_not_found', 404)
      if (user.status !== 'active') throw fail('user_not_active', 409)
      const elig = await one(c, "SELECT * FROM gov_eligibility WHERE user_id=$1 AND constituency=$2 AND status='verified' AND (expires_at IS NULL OR expires_at > $3)", [userId, seat.constituency, now()])
      if (!elig) throw fail('not_verified_for_constituency', 409)
      /* separation of duties: whoever finalises votes cannot hold a vote */
      if (await one(c, "SELECT 1 FROM gov_roles WHERE user_id=$1 AND revoked_at IS NULL AND role IN ('reviewer','administrator')", [userId])) throw fail('governance_staff_cannot_hold_seat', 409)
      /* one person, one seat — across wallets sharing a management-assigned person_ref, and across terms */
      const dup = await one(c,
        `SELECT 1 FROM gov_memberships WHERE status='active' AND (user_id=$1 OR (person_ref IS NOT NULL AND person_ref=$2))`, [userId, elig.person_ref])
      if (dup) throw fail('already_holds_active_seat', 409)
      if (await one(c, "SELECT 1 FROM gov_memberships WHERE seat_id=$1 AND status='active'", [seatId])) throw fail('seat_occupied', 409)
      const consent = publicConsent === true
      const name = consent ? str(publicDisplayName, 80, { min: 2, required: true, field: 'publicDisplayName' }) : null
      const m = await one(c,
        `INSERT INTO gov_memberships (seat_id, user_id, person_ref, starts_at, ends_at, appointment_method, appointed_by, public_display_name, public_consent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [seatId, userId, elig.person_ref, seat.starts_at, seat.ends_at, seat.appointment_method, actor.label, name, consent])
      await audit(c, { type: 'seat.appointed', actor, subjectType: 'seat', subjectId: seatId, details: { userId, constituency: seat.constituency, method: seat.appointment_method, publicConsent: consent } })
      return { membershipId: m.id, seatId, userId, constituency: seat.constituency, startsAt: m.starts_at, endsAt: m.ends_at }
    })
  }

  async function revokeMembership(actor, membershipId, reason) {
    assertCan(actor, 'membership.revoke')
    return tx(async (c) => {
      const m = await one(c, 'SELECT * FROM gov_memberships WHERE id=$1 FOR UPDATE', [membershipId])
      if (!m) throw fail('membership_not_found', 404)
      if (m.status !== 'active') throw fail('membership_not_active', 409)
      await c.query("UPDATE gov_memberships SET status='revoked', revoked_at=now(), revoked_reason=$2 WHERE id=$1", [membershipId, str(reason, 500, { min: 5, required: true, field: 'reason' })])
      await audit(c, { type: 'membership.revoked', actor, subjectType: 'membership', subjectId: membershipId, details: { reason, userId: m.user_id } })
      return { membershipId, status: 'revoked' }
    })
  }

  async function grantRole(actor, userId, role) {
    assertCan(actor, 'role.grant')
    if (!['moderator', 'reviewer', 'administrator'].includes(role)) throw fail('invalid_role')
    return tx(async (c) => {
      if (!(await one(c, 'SELECT 1 FROM openfund_users WHERE id=$1', [userId]))) throw fail('user_not_found', 404)
      if (role !== 'moderator' && await liveMembership(c, userId)) throw fail('council_member_cannot_be_governance_staff', 409)
      await c.query('INSERT INTO gov_roles (user_id, role, granted_by) VALUES ($1,$2,$3)', [userId, role, actor.label])
      await audit(c, { type: 'role.granted', actor, subjectType: 'user', subjectId: userId, details: { role } })
      return { userId, role }
    })
  }
  async function revokeRole(actor, userId, role) {
    assertCan(actor, 'role.grant')
    return tx(async (c) => {
      const r = await c.query('UPDATE gov_roles SET revoked_at=now() WHERE user_id=$1 AND role=$2 AND revoked_at IS NULL', [userId, role])
      if (!r.rowCount) throw fail('role_not_found', 404)
      await audit(c, { type: 'role.revoked', actor, subjectType: 'user', subjectId: userId, details: { role } })
      return { userId, role, revoked: true }
    })
  }

  /* ------------------------------------------------------------ voting */
  const sessionPhase = (s, at = now()) => (s.status !== 'active' ? s.status : at < s.opens_at ? 'scheduled' : at < s.closes_at ? 'open' : 'closed')

  async function openVoting(actor, ofp, { opensAt, closesAt }) {
    assertCan(actor, 'voting.open')
    const opens = new Date(opensAt), closes = new Date(closesAt)
    if (Number.isNaN(opens.getTime()) || Number.isNaN(closes.getTime())) throw fail('voting_window_invalid')
    if (closes - opens < 60_000 || closes - opens > 30 * 86_400_000) throw fail('voting_window_out_of_range')
    if (opens < new Date(now().getTime() - 60_000)) throw fail('voting_window_in_past')
    return tx(async (c) => {
      await expireMemberships(c)
      const p = await loadProposal(c, ofp, { lock: true })
      assertTransition(p.status, 'voting', proposalRoles(actor, p), 'open_voting')
      if (p.classification === 'binding' && CAPACITY_CATEGORIES.includes(p.category) && !p.capacity_confirmed) throw fail('capacity_confirmation_required', 409)
      const snap = await snapshotCouncil(c, opens)
      if (!snap.term) throw fail('no_active_term', 409)
      /* never silently lower the bar: an under-seated council cannot reach quorum, so no vote is opened */
      if (snap.seated < VOTING.quorum) throw fail('council_below_quorum', 409, { seated: snap.seated, quorum: VOTING.quorum })
      const kind = thresholdKindFor(p.category)
      const threshold = kind === 'constitutional' ? VOTING.constitutionalThreshold : VOTING.ordinaryThreshold
      const snapshot = { term: snap.term, seats: snap.seats, takenAt: now().toISOString(), proposalRevision: p.revision }
      const session = await one(c,
        `INSERT INTO gov_voting_sessions (proposal_id, revision, threshold_kind, council_size, quorum, threshold, opens_at, closes_at, snapshot, snapshot_hash, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [p.id, p.revision, kind, COUNCIL_SIZE, VOTING.quorum, threshold, opens, closes, JSON.stringify(snapshot), hashJson(snapshot), actor.label])
      await setStatus(c, p, 'voting', actor, `session ${session.id}`)
      await audit(c, { type: 'voting.opened', actor, subjectType: 'proposal', subjectId: ofp, details: { sessionId: session.id, kind, threshold, quorum: VOTING.quorum, opens, closes, snapshotHash: session.snapshot_hash, seated: snap.seated } })
      return sessionView(session)
    })
  }

  const sessionView = (s) => ({
    id: s.id, revision: s.revision, kind: s.threshold_kind, councilSize: s.council_size, quorum: s.quorum, threshold: s.threshold,
    opensAt: s.opens_at, closesAt: s.closes_at, status: s.status, phase: sessionPhase(s), snapshotHash: s.snapshot_hash,
  })
  const activeSession = (c, proposalId, lock = false) => one(c, `SELECT * FROM gov_voting_sessions WHERE proposal_id=$1 AND status='active' ${lock ? 'FOR UPDATE' : ''}`, [proposalId])

  /** Everything that decides whether THIS user may vote RIGHT NOW (live state, not just the snapshot). */
  async function votingEligibility(c, userId, session, p) {
    const user = await one(c, 'SELECT status FROM openfund_users WHERE id=$1', [userId])
    if (!user || user.status !== 'active') return { ok: false, reason: 'account_not_active' }
    const phase = sessionPhase(session)
    if (phase !== 'open') return { ok: false, reason: phase === 'scheduled' ? 'voting_not_open' : 'voting_closed' }
    const seatInSnapshot = session.snapshot.seats.find((s) => s.userId === userId)
    if (!seatInSnapshot) return { ok: false, reason: 'not_in_voting_snapshot' }
    const live = await liveMembership(c, userId)
    if (!live || live.seat_id !== seatInSnapshot.seatId) return { ok: false, reason: 'membership_not_active' }
    const conflict = await one(c, 'SELECT status, seeks_recusal FROM gov_conflicts WHERE proposal_id=$1 AND user_id=$2', [p.id, userId])
    if (conflict?.status === 'recused') return { ok: false, reason: 'recused' }
    if (conflict?.status === 'declared' && conflict.seeks_recusal) return { ok: false, reason: 'conflict_pending_review' }
    const voted = await one(c, 'SELECT choice FROM gov_votes WHERE session_id=$1 AND user_id=$2', [session.id, userId])
    if (voted) return { ok: false, reason: 'already_voted' }
    return { ok: true, seatId: seatInSnapshot.seatId, wallet: null }
  }

  async function issueVoteChallenge(userId, ofp, choice) {
    if (!VOTE_CHOICES.includes(choice)) throw fail('invalid_choice')
    return tx(async (c) => {
      const p = await loadProposal(c, ofp)
      const session = await activeSession(c, p.id)
      if (!session) throw fail('no_open_voting', 409)
      const el = await votingEligibility(c, userId, session, p)
      if (!el.ok) throw fail(el.reason, el.reason === 'already_voted' ? 409 : 403)
      const wallet = (await one(c, 'SELECT wallet_address FROM openfund_users WHERE id=$1', [userId])).wallet_address
      const nonce = crypto.randomBytes(16).toString('hex')
      const issuedAt = now(), expiresAt = new Date(Math.min(issuedAt.getTime() + 10 * 60_000, new Date(session.closes_at).getTime()))
      const message = buildVoteMessage({ ofpId: p.ofp_id, sessionId: session.id, seatId: el.seatId, wallet, choice, nonce, issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString() })
      await c.query('INSERT INTO gov_vote_challenges (nonce, user_id, session_id, message, expires_at) VALUES ($1,$2,$3,$4,$5)', [nonce, userId, session.id, message, expiresAt])
      return { nonce, message, expiresAt }
    })
  }

  async function castVote(userId, ofp, { choice, nonce, signature } = {}) {
    if (!VOTE_CHOICES.includes(choice)) throw fail('invalid_choice')
    if ((nonce || signature) && !(nonce && signature)) throw fail('signature_and_nonce_required_together')
    return tx(async (c) => {
      const p = await loadProposal(c, ofp)
      const session = await activeSession(c, p.id, true)
      if (!session) throw fail('no_open_voting', 409)
      const el = await votingEligibility(c, userId, session, p)
      if (!el.ok) throw fail(el.reason, el.reason === 'already_voted' ? 409 : 403)
      let signedMessage = null
      if (signature) {
        if (typeof nonce !== 'string' || typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature)) throw fail('signature_invalid')
        /* single-use: the UPDATE only succeeds once, so a replayed signature is rejected atomically */
        const ch = await one(c, 'UPDATE gov_vote_challenges SET used_at=now() WHERE nonce=$1 AND user_id=$2 AND session_id=$3 AND used_at IS NULL AND expires_at > $4 RETURNING message',
          [nonce, userId, session.id, now()])
        if (!ch) throw fail('signature_challenge_invalid_or_replayed', 409)
        if (!ch.message.includes(`\nChoice: ${choice}\n`)) throw fail('signature_choice_mismatch', 409)
        const wallet = (await one(c, 'SELECT wallet_address FROM openfund_users WHERE id=$1', [userId])).wallet_address
        let signer
        try { signer = (await recoverSigner({ message: ch.message, signature })).toLowerCase() } catch { throw fail('signature_invalid') }
        if (signer !== wallet) throw fail('signature_wallet_mismatch', 403)
        signedMessage = ch.message
      }
      const v = await one(c,
        'INSERT INTO gov_votes (session_id, seat_id, user_id, choice, nonce, signed_message, signature, cast_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, cast_at',
        [session.id, el.seatId, userId, choice, signature ? nonce : null, signedMessage, signature || null, now()])
      await audit(c, { type: 'vote.cast', actor: { userId, label: 'council' }, subjectType: 'voting_session', subjectId: session.id, details: { ofpId: ofp, seatId: el.seatId, choice, signed: Boolean(signature) } })
      return { voteId: v.id, ofpId: ofp, choice, castAt: v.cast_at, signed: Boolean(signature), final: true }
    })
  }

  async function sessionTally(c, session, { closed } = {}) {
    const votes = await many(c, 'SELECT choice FROM gov_votes WHERE session_id=$1', [session.id])
    const recused = (await one(c, "SELECT count(*)::int n FROM gov_conflicts WHERE proposal_id=$1 AND status='recused'", [session.proposal_id])).n
    return evaluateSession({
      votes, snapshotMembers: session.snapshot.seats.filter((s) => s.userId).length, recused,
      quorum: session.quorum, threshold: session.threshold, closed: closed ?? now() >= session.closes_at,
    })
  }

  async function finalizeSession(actor, ofp, { rationale } = {}) {
    assertCan(actor, 'voting.finalize')
    return tx(async (c) => {
      const p = await loadProposal(c, ofp, { lock: true })
      if (p.status !== 'voting') throw fail('invalid_transition', 409)
      const session = await activeSession(c, p.id, true)
      if (!session) throw fail('no_open_voting', 409)
      const result = await sessionTally(c, session)
      if (!result.final) throw fail('voting_still_open', 409, { tally: result })
      /* a council member who is also the finalizer would be able to steer the outcome */
      const text = str(rationale, 2000, { min: 10, required: true, field: 'rationale' })
      const decision = await one(c,
        'INSERT INTO gov_decisions (proposal_id, session_id, outcome, binding, rationale, tally, decided_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [p.id, session.id, result.outcome, p.classification === 'binding', text, JSON.stringify(result), actor.label])
      await c.query("UPDATE gov_voting_sessions SET status='finalized', finalized_at=now() WHERE id=$1", [session.id])
      if (result.outcome === 'unresolved') {
        await setStatus(c, p, 'under_review', actor, `unresolved:${result.reason}; reschedule requires a new voting session`)
      } else {
        await setStatus(c, p, result.outcome, actor, `session ${session.id}`, ', decision=$3, decision_rationale=$4', [result.outcome, text])
      }
      await audit(c, { type: 'voting.finalized', actor, subjectType: 'proposal', subjectId: ofp, details: { sessionId: session.id, outcome: result.outcome, tally: result, decisionId: decision.id } })
      return { decisionId: decision.id, outcome: result.outcome, binding: decision.binding, tally: result }
    })
  }

  async function voidSession(actor, ofp, reason) {
    assertCan(actor, 'voting.void')
    return tx(async (c) => {
      const p = await loadProposal(c, ofp, { lock: true })
      if (p.status !== 'voting') throw fail('invalid_transition', 409)
      const session = await activeSession(c, p.id, true)
      if (!session) throw fail('no_open_voting', 409)
      await c.query("UPDATE gov_voting_sessions SET status='void', void_reason=$2 WHERE id=$1", [session.id, str(reason, 1000, { min: 10, required: true, field: 'reason' })])
      await setStatus(c, p, 'under_review', actor, `voting session void: ${reason}`)
      await audit(c, { type: 'voting.voided', actor, subjectType: 'proposal', subjectId: ofp, details: { sessionId: session.id, reason } })
      return { sessionId: session.id, status: 'void' }
    })
  }

  async function amendDecision(actor, decisionId, { reason, correction }) {
    assertCan(actor, 'decision.amend')
    if (!correction || typeof correction !== 'object' || Array.isArray(correction)) throw fail('correction_invalid')
    return tx(async (c) => {
      if (!(await one(c, 'SELECT 1 FROM gov_decisions WHERE id=$1', [decisionId]))) throw fail('decision_not_found', 404)
      const a = await one(c, 'INSERT INTO gov_decision_amendments (decision_id, amended_by, reason, correction) VALUES ($1,$2,$3,$4) RETURNING id, created_at',
        [decisionId, actor.label, str(reason, 2000, { min: 10, required: true, field: 'reason' }), JSON.stringify(correction)])
      await audit(c, { type: 'decision.amended', actor, subjectType: 'decision', subjectId: decisionId, details: { reason, amendmentId: a.id } })
      return { amendmentId: a.id, decisionId, createdAt: a.created_at }
    })
  }

  /* ----------------------------------------------------------- conflicts */
  async function declareConflict(userId, ofp, { reason, seeksRecusal = true }) {
    return tx(async (c) => {
      const live = await liveMembership(c, userId)
      if (!live) throw fail('council_membership_required', 403)
      const p = await loadProposal(c, ofp)
      if (!['submitted', 'under_review', 'voting'].includes(p.status)) throw fail('conflicts_not_accepted_in_status', 409)
      const session = p.status === 'voting' ? await activeSession(c, p.id) : null
      if (session && await one(c, 'SELECT 1 FROM gov_votes WHERE session_id=$1 AND user_id=$2', [session.id, userId])) throw fail('already_voted', 409)
      const row = await one(c, 'INSERT INTO gov_conflicts (proposal_id, seat_id, user_id, reason, seeks_recusal) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [p.id, live.seat_id, userId, str(reason, 1000, { min: 5, required: true, field: 'reason' }), seeksRecusal !== false])
      await audit(c, { type: 'conflict.declared', actor: { userId, label: 'council' }, subjectType: 'proposal', subjectId: ofp, details: { conflictId: row.id, seeksRecusal: row.seeks_recusal } })
      return { conflictId: row.id, status: row.status, seeksRecusal: row.seeks_recusal }
    })
  }
  async function reviewConflict(actor, conflictId, { decision, note }) {
    assertCan(actor, 'conflict.review')
    if (!['recused', 'no_recusal'].includes(decision)) throw fail('invalid_decision')
    return tx(async (c) => {
      const cf = await one(c, 'SELECT * FROM gov_conflicts WHERE id=$1 FOR UPDATE', [conflictId])
      if (!cf) throw fail('conflict_not_found', 404)
      if (cf.status !== 'declared') throw fail('conflict_already_reviewed', 409)
      const session = await one(c, "SELECT id FROM gov_voting_sessions WHERE proposal_id=$1 AND status='active'", [cf.proposal_id])
      if (decision === 'recused' && session && await one(c, 'SELECT 1 FROM gov_votes WHERE session_id=$1 AND user_id=$2', [session.id, cf.user_id])) throw fail('already_voted', 409)
      await c.query('UPDATE gov_conflicts SET status=$2, reviewed_by=$3, review_note=$4, reviewed_at=now() WHERE id=$1', [conflictId, decision, actor.label, str(note, 1000, { min: 5, required: true, field: 'note' })])
      await audit(c, { type: 'conflict.reviewed', actor, subjectType: 'conflict', subjectId: conflictId, details: { decision } })
      return { conflictId, status: decision }
    })
  }

  /* ----------------------------------------------------- implementation */
  const IMPL_TO_STATUS = { scheduled: 'implementation_scheduled', in_progress: 'in_progress', implemented: 'implemented', blocked: 'blocked' }
  async function recordImplementation(actor, ofp, input) {
    const target = IMPL_TO_STATUS[input.status]
    if (!target) throw fail('invalid_status')
    assertCan(actor, input.status === 'blocked' ? 'implementation.block' : 'implementation.record')
    return tx(async (c) => {
      const p = await loadProposal(c, ofp, { lock: true })
      assertTransition(p.status, target, proposalRoles(actor, p), 'implementation')
      if (p.classification !== 'binding' && target === 'implementation_scheduled') { /* advisory items may still be tracked */ }
      const rec = { evidenceUrl: null, evidenceNote: str(input.evidenceNote, 2000), blockedReason: null, blockedEvidence: null, nextReviewOn: null }
      if (input.evidenceUrl) { if (!URL_RE.test(input.evidenceUrl)) throw fail('evidence_url_invalid'); rec.evidenceUrl = input.evidenceUrl }
      if (input.status === 'implemented' && !rec.evidenceUrl) throw fail('execution_evidence_required', 409) /* approved ≠ implemented */
      if (input.status === 'blocked') {
        rec.blockedReason = str(input.blockedReason, 2000, { min: 20, required: true, field: 'blockedReason' })
        rec.blockedEvidence = str(input.blockedEvidence, 2000, { min: 10, required: true, field: 'blockedEvidence' })
        const next = new Date(input.nextReviewOn)
        if (Number.isNaN(next.getTime()) || next <= now()) throw fail('nextReviewOn_must_be_future')
        rec.nextReviewOn = next.toISOString().slice(0, 10)
      }
      await c.query(
        `INSERT INTO gov_implementation_log (proposal_id, status, evidence_url, evidence_note, blocked_reason, blocked_evidence, next_review_on, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [p.id, input.status, rec.evidenceUrl, rec.evidenceNote, rec.blockedReason, rec.blockedEvidence, rec.nextReviewOn, actor.label])
      await setStatus(c, p, target, actor, `implementation:${input.status}`, ', implementation_status=$3', [input.status])
      await audit(c, { type: 'implementation.recorded', actor, subjectType: 'proposal', subjectId: ofp, details: { status: input.status, evidenceUrl: rec.evidenceUrl, nextReviewOn: rec.nextReviewOn } })
      return projectProposal(await loadProposal(c, ofp))
    })
  }

  /* ----------------------------------------------------------- comments */
  async function addComment(userId, ofp, { body, stance }) {
    const actor = await actorFor(userId)
    if (!actor.roles.has('member')) throw fail('forbidden', 403)
    if (stance != null && !['support', 'oppose', 'neutral'].includes(stance)) throw fail('invalid_stance')
    return tx(async (c) => {
      const p = await loadProposal(c, ofp)
      if (!PUBLIC_STATUSES.includes(p.status) || p.status === 'archived') throw fail('comments_closed', 409)
      const row = await one(c, 'INSERT INTO gov_comments (proposal_id, user_id, body, stance) VALUES ($1,$2,$3,$4) RETURNING id, created_at',
        [p.id, userId, str(body, 2000, { min: 1, required: true, field: 'body' }), stance || null])
      await audit(c, { type: 'comment.created', actor, subjectType: 'proposal', subjectId: ofp, details: { commentId: row.id } })
      return { id: row.id, createdAt: row.created_at }
    })
  }
  async function hideComment(actor, commentId, reason) {
    assertCan(actor, 'comment.moderate')
    return tx(async (c) => {
      const r = await c.query("UPDATE gov_comments SET status='hidden' WHERE id=$1 AND status='visible'", [commentId])
      if (!r.rowCount) throw fail('comment_not_found', 404)
      await audit(c, { type: 'comment.hidden', actor, subjectType: 'comment', subjectId: commentId, details: { reason: str(reason, 500) } })
      return { id: commentId, status: 'hidden' }
    })
  }

  /* ------------------------------------------------------------- reads */
  async function listProposals(query = {}, viewer = null) {
    const { limit, offset } = pageArgs(query)
    const where = ['p.status = ANY($1)'], params = [PUBLIC_STATUSES]
    if (viewer?.mine) { where.length = 0; params.length = 0; params.push(viewer.userId); where.push(`p.author_id=$${params.length}`) }
    if (query.status) { if (!PUBLIC_STATUSES.includes(query.status) && !viewer?.mine) throw fail('invalid_status'); params.push(query.status); where.push(`p.status=$${params.length}`) }
    if (query.category) { if (!CATEGORIES.includes(query.category)) throw fail('unknown_category'); params.push(query.category); where.push(`p.category=$${params.length}`) }
    if (query.classification) { if (!['binding', 'advisory'].includes(query.classification)) throw fail('invalid_classification'); params.push(query.classification); where.push(`p.classification=$${params.length}`) }
    const W = where.join(' AND ')
    const total = (await one(pool, `SELECT count(*)::int n FROM gov_proposals p WHERE ${W}`, params)).n
    const rows = await many(pool,
      `SELECT ${PROPOSAL_COLS},
         (SELECT row_to_json(s) FROM (SELECT id, closes_at, opens_at, status FROM gov_voting_sessions vs WHERE vs.proposal_id=p.id ORDER BY created_at DESC LIMIT 1) s) AS latest_session,
         (SELECT count(*)::int FROM gov_comments cm WHERE cm.proposal_id=p.id AND cm.status='visible') AS comment_count
       FROM gov_proposals p JOIN openfund_users u ON u.id=p.author_id WHERE ${W}
       ORDER BY p.ofp_number DESC LIMIT ${limit} OFFSET ${offset}`, params)
    return { total, limit, offset, proposals: rows.map((r) => projectProposal({ ...r, description: undefined }, {
      votingDeadline: r.latest_session && r.status === 'voting' ? r.latest_session.closes_at : null, commentCount: r.comment_count })) }
  }

  async function getProposal(ofp, viewerId = null) {
    const p = await loadProposal(pool, ofp)
    const actor = viewerId ? await actorFor(viewerId) : null
    if (p.status === 'draft' && !(actor && (p.author_id === actor.userId || can(actor, 'proposal.review')))) throw fail('proposal_not_found', 404)
    const history = await many(pool, 'SELECT from_status, to_status, actor_role, note, created_at FROM gov_proposal_history WHERE proposal_id=$1 ORDER BY id', [p.id])
    const revisions = await many(pool, 'SELECT revision, created_at FROM gov_proposal_revisions WHERE proposal_id=$1 ORDER BY revision', [p.id])
    const sessions = []
    for (const s of await many(pool, 'SELECT * FROM gov_voting_sessions WHERE proposal_id=$1 ORDER BY created_at', [p.id])) {
      const view = sessionView(s)
      view.tally = s.status === 'active' ? await tallyPublic(s) : (await one(pool, 'SELECT tally FROM gov_decisions WHERE session_id=$1', [s.id]))?.tally || null
      if (s.status === 'active') view.progress = view.tally && { cast: view.tally.participating, quorum: s.quorum, threshold: s.threshold }
      sessions.push(view)
    }
    const decisions = await many(pool, `SELECT d.id, d.outcome, d.binding, d.rationale, d.tally, d.decided_at,
        (SELECT json_agg(json_build_object('reason', a.reason, 'correction', a.correction, 'at', a.created_at) ORDER BY a.created_at) FROM gov_decision_amendments a WHERE a.decision_id=d.id) AS amendments
      FROM gov_decisions d WHERE d.proposal_id=$1 ORDER BY d.decided_at`, [p.id])
    const implementation = await many(pool, 'SELECT status, evidence_url, evidence_note, blocked_reason, blocked_evidence, next_review_on, created_at FROM gov_implementation_log WHERE proposal_id=$1 ORDER BY id', [p.id])
    const out = projectProposal(p, { history, revisions, sessions, decisions, implementation })
    if (actor?.seat) {
      const s = await activeSession(pool, p.id)
      if (s) {
        const el = await votingEligibility(pool, actor.userId, s, p)
        out.viewer = { councilMember: true, constituency: actor.seat.constituency, canVote: el.ok, reason: el.ok ? null : el.reason }
      } else out.viewer = { councilMember: true, canVote: false, reason: 'no_open_voting' }
    } else out.viewer = { councilMember: false, canVote: false, reason: 'not_council_member' }
    if (actor) out.viewer.roles = [...actor.roles]
    return out
  }
  /** counts only — individual choices stay out of public output until the decision is final */
  async function tallyPublic(s) {
    const t = await sessionTally(pool, s)
    return { participating: t.participating, quorum: t.quorum, threshold: t.threshold, councilSize: t.councilSize, quorumMet: t.quorumMet }
  }

  async function comments(ofp, query = {}) {
    const { limit, offset } = pageArgs(query)
    const p = await loadProposal(pool, ofp)
    if (p.status === 'draft') throw fail('proposal_not_found', 404)
    const rows = await many(pool,
      `SELECT c.id, c.body, c.stance, c.created_at, u.wallet_address FROM gov_comments c JOIN openfund_users u ON u.id=c.user_id
        WHERE c.proposal_id=$1 AND c.status='visible' ORDER BY c.created_at LIMIT ${limit} OFFSET ${offset}`, [p.id])
    return { notice: 'Community feedback is not a council vote and has no binding effect.', comments: rows.map((r) => ({ id: r.id, body: r.body, stance: r.stance, author: maskWallet(r.wallet_address), createdAt: r.created_at })) }
  }

  async function decisions(query = {}) {
    const { limit, offset } = pageArgs(query)
    const rows = await many(pool,
      `SELECT p.ofp_id, p.title, p.category, p.classification, p.status, p.implementation_status, d.outcome, d.binding, d.rationale, d.tally, d.decided_at,
              (SELECT row_to_json(i) FROM (SELECT status, blocked_reason, blocked_evidence, next_review_on, evidence_url FROM gov_implementation_log l WHERE l.proposal_id=p.id ORDER BY l.id DESC LIMIT 1) i) AS latest_implementation
         FROM gov_decisions d JOIN gov_proposals p ON p.id=d.proposal_id ORDER BY d.decided_at DESC LIMIT ${limit} OFFSET ${offset}`)
    const blocked = await many(pool, `SELECT p.ofp_id, p.title, p.status, p.implementation_status,
         (SELECT row_to_json(i) FROM (SELECT blocked_reason, blocked_evidence, next_review_on FROM gov_implementation_log l WHERE l.proposal_id=p.id AND l.status='blocked' ORDER BY l.id DESC LIMIT 1) i) AS blocker
       FROM gov_proposals p WHERE p.status='blocked' ORDER BY p.updated_at DESC`)
    return {
      decisions: rows.map((r) => ({ ofpId: r.ofp_id, title: r.title, category: r.category, classification: r.classification, outcome: r.outcome, binding: r.binding, rationale: r.rationale,
        tally: r.tally, decidedAt: r.decided_at, proposalStatus: r.status, implementationStatus: r.implementation_status, latestImplementation: r.latest_implementation })),
      blocked,
    }
  }

  async function overview() {
    const c = await council()
    const counts = await many(pool, 'SELECT status, count(*)::int n FROM gov_proposals GROUP BY status')
    const elections = await electionsPublic()
    const open = await many(pool,
      `SELECT p.ofp_id, p.title, p.category, p.classification, vs.closes_at FROM gov_voting_sessions vs JOIN gov_proposals p ON p.id=vs.proposal_id
        WHERE vs.status='active' AND vs.closes_at > $1 ORDER BY vs.closes_at`, [now()])
    return {
      model: { name: 'hybrid', dao: false, token: false, onChainVoting: false, tagline: 'Community-Governed Development. Company-Managed Treasury.' },
      version: '1.0', council: c,
      proposalCounts: Object.fromEntries(counts.map((r) => [r.status, r.n])),
      openVotes: open.map((r) => ({ ofpId: r.ofp_id, title: r.title, category: r.category, classification: r.classification, closesAt: r.closes_at })),
      elections,
      initialCouncilNote: c.term ? (c.term.appointmentMethod === 'appointed' ? 'This term was appointed by company management; it was not elected by the community.' : 'This term was elected.') : 'No council term is active. No council has been seated.',
    }
  }

  async function workspace(userId) {
    const actor = await actorFor(userId)
    if (!actor.seat) throw fail('council_membership_required', 403)
    const seat = actor.seat
    const open = await many(pool,
      `SELECT vs.*, p.ofp_id, p.title, p.category, p.classification FROM gov_voting_sessions vs JOIN gov_proposals p ON p.id=vs.proposal_id
        WHERE vs.status='active' AND vs.closes_at > $1 ORDER BY vs.closes_at`, [now()])
    const responsibilities = []
    for (const s of open) {
      const p = await loadProposal(pool, s.ofp_id)
      const el = await votingEligibility(pool, userId, s, p)
      const mine = await one(pool, 'SELECT choice, cast_at FROM gov_votes WHERE session_id=$1 AND user_id=$2', [s.id, userId])
      responsibilities.push({ ofpId: s.ofp_id, title: s.title, category: s.category, classification: s.classification, session: sessionView(s), canVote: el.ok, reason: el.ok ? null : el.reason, myVote: mine ? { choice: mine.choice, castAt: mine.cast_at } : null })
    }
    const history = await many(pool,
      `SELECT p.ofp_id, p.title, d.outcome, d.decided_at, v.choice AS my_choice FROM gov_decisions d JOIN gov_proposals p ON p.id=d.proposal_id
         LEFT JOIN gov_votes v ON v.session_id=d.session_id AND v.user_id=$1 ORDER BY d.decided_at DESC LIMIT 50`, [userId])
    const conflicts = await many(pool, 'SELECT cf.id, p.ofp_id, cf.reason, cf.status, cf.review_note, cf.created_at FROM gov_conflicts cf JOIN gov_proposals p ON p.id=cf.proposal_id WHERE cf.user_id=$1 ORDER BY cf.created_at DESC', [userId])
    const participation = await one(pool,
      `SELECT (SELECT count(*)::int FROM gov_votes WHERE user_id=$1) AS votes_cast,
              (SELECT count(*)::int FROM gov_voting_sessions vs WHERE vs.status IN ('finalized') AND vs.snapshot @> jsonb_build_object('seats', jsonb_build_array(jsonb_build_object('userId', $1::text)))) AS sessions_eligible`, [userId])
    return {
      seat: { constituency: seat.constituency, constituencyLabel: CONSTITUENCY_LABELS[seat.constituency], seatNo: seat.seat_no, startsAt: seat.starts_at, endsAt: seat.ends_at, membershipType: seat.appointment_method },
      responsibilities, deadlines: responsibilities.filter((r) => !r.myVote).map((r) => ({ ofpId: r.ofpId, closesAt: r.session.closesAt })),
      history: history.map((h) => ({ ofpId: h.ofp_id, title: h.title, outcome: h.outcome, decidedAt: h.decided_at, myChoice: h.my_choice })),
      conflicts, participation: { votesCast: participation.votes_cast, sessionsEligible: participation.sessions_eligible },
    }
  }

  async function me(userId) {
    const actor = await actorFor(userId)
    const eligibility = await many(pool, "SELECT constituency, status, expires_at FROM gov_eligibility WHERE user_id=$1", [userId])
    return {
      roles: [...actor.roles], councilMember: Boolean(actor.seat),
      seat: actor.seat ? { constituency: actor.seat.constituency, seatNo: actor.seat.seat_no, endsAt: actor.seat.ends_at } : null,
      eligibility: eligibility.map((e) => ({ constituency: e.constituency, status: e.status, expiresAt: e.expires_at })),
    }
  }

  async function auditEvents(actor, query = {}) {
    assertCan(actor, 'audit.read')
    const { limit, offset } = pageArgs(query)
    const rows = await many(pool, `SELECT id, event_type, actor_role, subject_type, subject_id, details, hash, created_at FROM gov_audit_events ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`)
    return { events: rows, chain: await verifyAuditChain() }
  }

  /* ---------------------------------------------------------- elections */
  const ELECTION_COLS = 'id, term_id, constituency, status, rules_approved, applications_open_at, applications_close_at, voting_opens_at, voting_closes_at, snapshot_taken_at, result'
  const electionView = (e) => ({ id: e.id, termId: e.term_id, constituency: e.constituency, status: e.status, rulesApproved: e.rules_approved, applicationsOpenAt: e.applications_open_at, applicationsCloseAt: e.applications_close_at, votingOpensAt: e.voting_opens_at, votingClosesAt: e.voting_closes_at, snapshotTakenAt: e.snapshot_taken_at, result: e.result })

  async function electionsPublic() {
    /* an election is publicly visible only after management approved its rules */
    const rows = await many(pool, `SELECT ${ELECTION_COLS.split(', ').map((x) => `e.${x}`).join(', ')}, t.label AS term_label,
        (SELECT count(*)::int FROM gov_election_candidates k WHERE k.election_id=e.id AND k.status='approved') AS candidates
      FROM gov_elections e JOIN gov_terms t ON t.id=e.term_id WHERE e.rules_approved ORDER BY e.voting_opens_at NULLS LAST`)
    return { publicEnabled: rows.length > 0, elections: rows.map((r) => ({ ...electionView(r), termLabel: r.term_label, approvedCandidates: r.candidates })),
      note: rows.length ? null : 'No election is scheduled. Elections open only after company management approves the election rules and voter criteria.' }
  }

  async function createElection(actor, { termId, constituency, applicationsOpenAt, applicationsCloseAt, votingOpensAt, votingClosesAt }) {
    assertCan(actor, 'election.manage')
    if (!CONSTITUENCIES.includes(constituency)) throw fail('unknown_constituency')
    const d = (v, f) => { const x = new Date(v); if (Number.isNaN(x.getTime())) throw fail(`${f}_invalid`); return x }
    const a1 = d(applicationsOpenAt, 'applicationsOpenAt'), a2 = d(applicationsCloseAt, 'applicationsCloseAt'), v1 = d(votingOpensAt, 'votingOpensAt'), v2 = d(votingClosesAt, 'votingClosesAt')
    if (!(a1 < a2 && a2 <= v1 && v1 < v2)) throw fail('election_schedule_invalid')
    return tx(async (c) => {
      const term = await one(c, 'SELECT * FROM gov_terms WHERE id=$1', [termId])
      if (!term) throw fail('term_not_found', 404)
      if (term.status !== 'planned' || term.appointment_method !== 'elected') throw fail('election_requires_planned_elected_term', 409)
      const e = await one(c, 'INSERT INTO gov_elections (term_id, constituency, applications_open_at, applications_close_at, voting_opens_at, voting_closes_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [termId, constituency, a1, a2, v1, v2])
      await audit(c, { type: 'election.created', actor, subjectType: 'election', subjectId: e.id, details: { constituency, termId } })
      return electionView(e)
    })
  }
  async function approveElectionRules(actor, electionId) {
    assertCan(actor, 'election.approve_rules')
    return tx(async (c) => {
      const e = await one(c, 'UPDATE gov_elections SET rules_approved=true, rules_approved_by=$2 WHERE id=$1 AND status=$3 RETURNING *', [electionId, actor.label, 'draft'])
      if (!e) throw fail('election_not_found_or_not_draft', 404)
      await audit(c, { type: 'election.rules_approved', actor, subjectType: 'election', subjectId: electionId, details: {} })
      return electionView(e)
    })
  }
  async function advanceElection(actor, electionId, to) {
    assertCan(actor, 'election.manage')
    const order = { applications: ['draft'], candidates_approved: ['applications'], voting: ['candidates_approved'] }
    if (!order[to]) throw fail('invalid_status')
    return tx(async (c) => {
      const e = await one(c, 'SELECT * FROM gov_elections WHERE id=$1 FOR UPDATE', [electionId])
      if (!e) throw fail('election_not_found', 404)
      if (!e.rules_approved) throw fail('election_rules_not_approved', 409) /* no public election before management approval */
      if (!order[to].includes(e.status)) throw fail('invalid_transition', 409)
      if (to === 'candidates_approved' && !(await one(c, "SELECT 1 FROM gov_election_candidates WHERE election_id=$1 AND status='approved'", [electionId]))) throw fail('no_approved_candidates', 409)
      if (to === 'voting') { /* voter eligibility snapshot, taken once, immutable */
        const voters = await c.query(
          `INSERT INTO gov_election_voters (election_id, user_id)
           SELECT $1, g.user_id FROM gov_eligibility g JOIN openfund_users u ON u.id=g.user_id
            WHERE g.constituency=$2 AND g.status='verified' AND (g.expires_at IS NULL OR g.expires_at > $3) AND u.status='active'
              AND NOT EXISTS (SELECT 1 FROM gov_eligibility h WHERE h.person_ref IS NOT NULL AND h.person_ref=g.person_ref AND h.user_id < g.user_id AND h.constituency=g.constituency AND h.status='verified')`,
          [electionId, e.constituency, now()])
        await c.query('UPDATE gov_elections SET snapshot_taken_at=$2 WHERE id=$1', [electionId, now()])
        await audit(c, { type: 'election.snapshot', actor, subjectType: 'election', subjectId: electionId, details: { voters: voters.rowCount } })
      }
      const u = await one(c, 'UPDATE gov_elections SET status=$2 WHERE id=$1 RETURNING *', [electionId, to])
      await audit(c, { type: 'election.advanced', actor, subjectType: 'election', subjectId: electionId, details: { to } })
      return electionView(u)
    })
  }
  async function applyCandidate(userId, electionId, { statement, publicDisplayName }) {
    return tx(async (c) => {
      const e = await one(c, 'SELECT * FROM gov_elections WHERE id=$1', [electionId])
      if (!e || !e.rules_approved) throw fail('election_not_found', 404)
      if (e.status !== 'applications' || now() < e.applications_open_at || now() >= e.applications_close_at) throw fail('applications_closed', 409)
      if (!(await one(c, "SELECT 1 FROM gov_eligibility WHERE user_id=$1 AND constituency=$2 AND status='verified' AND (expires_at IS NULL OR expires_at > $3)", [userId, e.constituency, now()]))) throw fail('not_verified_for_constituency', 403)
      const k = await one(c, 'INSERT INTO gov_election_candidates (election_id, user_id, statement, public_display_name) VALUES ($1,$2,$3,$4) RETURNING id',
        [electionId, userId, str(statement, 2000), str(publicDisplayName, 80, { min: 2, required: true, field: 'publicDisplayName' })])
      await audit(c, { type: 'election.candidate_applied', actor: { userId, label: 'member' }, subjectType: 'election', subjectId: electionId, details: { candidateId: k.id } })
      return { candidateId: k.id, status: 'applied' }
    })
  }
  async function decideCandidate(actor, candidateId, decision) {
    assertCan(actor, 'election.manage')
    if (!['approved', 'rejected'].includes(decision)) throw fail('invalid_decision')
    return tx(async (c) => {
      const k = await one(c, `SELECT k.*, e.status AS election_status FROM gov_election_candidates k JOIN gov_elections e ON e.id=k.election_id WHERE k.id=$1 FOR UPDATE OF k`, [candidateId])
      if (!k) throw fail('candidate_not_found', 404)
      if (!['applications', 'candidates_approved'].includes(k.election_status) || k.status !== 'applied') throw fail('invalid_transition', 409)
      await c.query('UPDATE gov_election_candidates SET status=$2, decided_by=$3 WHERE id=$1', [candidateId, decision, actor.label])
      await audit(c, { type: 'election.candidate_decided', actor, subjectType: 'candidate', subjectId: candidateId, details: { decision } })
      return { candidateId, status: decision }
    })
  }
  async function castElectionVote(userId, electionId, candidateId) {
    return tx(async (c) => {
      const e = await one(c, 'SELECT * FROM gov_elections WHERE id=$1', [electionId])
      if (!e || !e.rules_approved) throw fail('election_not_found', 404)
      if (e.status !== 'voting' || now() < e.voting_opens_at || now() >= e.voting_closes_at) throw fail('voting_closed', 409)
      if (!(await one(c, 'SELECT 1 FROM gov_election_voters WHERE election_id=$1 AND user_id=$2', [electionId, userId]))) throw fail('not_in_voter_snapshot', 403)
      if (!(await one(c, "SELECT 1 FROM gov_election_candidates WHERE id=$1 AND election_id=$2 AND status='approved'", [candidateId, electionId]))) throw fail('candidate_not_found', 404)
      await c.query('INSERT INTO gov_election_votes (election_id, voter_id, candidate_id) VALUES ($1,$2,$3)', [electionId, userId, candidateId])
      await audit(c, { type: 'election.vote', actor: { userId, label: 'member' }, subjectType: 'election', subjectId: electionId, details: {} }) /* choice deliberately not audited: ballots stay secret */
      return { electionId, cast: true, final: true }
    })
  }
  async function finalizeElection(actor, electionId) {
    assertCan(actor, 'election.finalize')
    return tx(async (c) => {
      const e = await one(c, 'SELECT * FROM gov_elections WHERE id=$1 FOR UPDATE', [electionId])
      if (!e) throw fail('election_not_found', 404)
      if (e.status !== 'voting') throw fail('invalid_transition', 409)
      if (now() < e.voting_closes_at) throw fail('voting_still_open', 409)
      const rows = await many(c, `SELECT k.id AS "candidateId", k.user_id, count(v.id)::int AS votes FROM gov_election_candidates k
          LEFT JOIN gov_election_votes v ON v.candidate_id=k.id WHERE k.election_id=$1 AND k.status='approved' GROUP BY k.id, k.user_id`, [electionId])
      const { winners, tie, needsRunoff } = electionWinners(rows)
      const result = { tally: rows.map((r) => ({ candidateId: r.candidateId, votes: r.votes })), winners, tie, needsRunoff, voters: (await one(c, 'SELECT count(*)::int n FROM gov_election_voters WHERE election_id=$1', [electionId])).n }
      if (needsRunoff) { /* a tie for the last seat is never broken silently */
        await c.query("UPDATE gov_elections SET status='closed', result=$2 WHERE id=$1", [electionId, JSON.stringify(result)])
        await audit(c, { type: 'election.tie', actor, subjectType: 'election', subjectId: electionId, details: result })
        return { status: 'closed', ...result }
      }
      await c.query("UPDATE gov_elections SET status='finalized', result=$2 WHERE id=$1", [electionId, JSON.stringify(result)])
      await audit(c, { type: 'election.finalized', actor, subjectType: 'election', subjectId: electionId, details: result })
      return { status: 'finalized', ...result, seatAllocation: 'pending_appointment' }
    })
  }
  /** seat the winners of a finalized election (still requires verified eligibility at seating time) */
  async function seatElectionWinners(actor, electionId) {
    assertCan(actor, 'seat.appoint')
    const e = await one(pool, 'SELECT * FROM gov_elections WHERE id=$1', [electionId])
    if (!e || e.status !== 'finalized') throw fail('election_not_finalized', 409)
    const seated = []
    for (const candidateId of e.result.winners) {
      const k = await one(pool, 'SELECT * FROM gov_election_candidates WHERE id=$1', [candidateId])
      const seat = await one(pool, `SELECT s.id FROM gov_seats s WHERE s.term_id=$1 AND s.constituency=$2
          AND NOT EXISTS (SELECT 1 FROM gov_memberships m WHERE m.seat_id=s.id AND m.status='active') ORDER BY s.seat_no LIMIT 1`, [e.term_id, e.constituency])
      if (!seat) break
      seated.push(await appoint(actor, { seatId: seat.id, userId: k.user_id, publicDisplayName: k.public_display_name, publicConsent: true }))
    }
    return { seated }
  }

  async function listEligibility(actor, query = {}) {
    assertCan(actor, 'eligibility.manage')
    const { limit, offset } = pageArgs(query)
    return { eligibility: await many(pool, `SELECT g.id, g.user_id, g.constituency, g.status, g.person_ref, g.evidence_ref, g.source, g.expires_at, g.decided_by, u.wallet_address
      FROM gov_eligibility g JOIN openfund_users u ON u.id=g.user_id ORDER BY g.created_at DESC LIMIT ${limit} OFFSET ${offset}`) }
  }
  /** read-only signal for reviewers; it NEVER qualifies anyone automatically */
  async function challengeSignals(actor, userId) {
    assertCan(actor, 'eligibility.manage')
    return one(pool, `SELECT count(*) FILTER (WHERE status='passed')::int AS passed_challenges, count(*) FILTER (WHERE status='started')::int AS active_challenges
      FROM openfund_challenges WHERE user_id=$1`, [userId])
  }

  return {
    // reads
    overview, council, listProposals, getProposal, comments, decisions, electionsPublic, workspace, me, auditEvents, verifyAuditChain, listEligibility, challengeSignals,
    // proposals
    createProposal, updateProposal, transition, confirmCapacity, openVoting, finalizeSession, voidSession, amendDecision,
    issueVoteChallenge, castVote, declareConflict, reviewConflict, recordImplementation, addComment, hideComment,
    // council
    createTerm, activateTerm, setEligibility, appoint, revokeMembership, grantRole, revokeRole, expireMemberships: () => tx(expireMemberships),
    // elections
    createElection, approveElectionRules, advanceElection, applyCandidate, decideCandidate, castElectionVote, finalizeElection, seatElectionWinners,
    // identity
    actorFor, managementActor, sessionTally: (s) => sessionTally(pool, s),
  }
}
