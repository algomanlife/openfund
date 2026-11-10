/**
 * Openfund Hybrid Governance v1.0 — pure policy rules.
 *
 * No database, no network, no clock: every function here is deterministic so
 * the policy in GOVERNANCE.md can be tested exhaustively. governance.js applies
 * these rules inside transactions; the database adds a second layer of
 * enforcement (constraints and append-only triggers) for the invariants that
 * matter most.
 *
 * FINANCIAL ISOLATION: this module imports nothing. A governance decision is a
 * record, never an executable instruction. See RESERVED_POWERS.
 */

/* ---------------------------------------------------------------- council */
export const CONSTITUENCIES = Object.freeze([
  'ambassador', 'coach', 'community_trader', 'funded_trader', 'moderator',
])
export const SEATS_PER_CONSTITUENCY = 2
export const COUNCIL_SIZE = CONSTITUENCIES.length * SEATS_PER_CONSTITUENCY /* 10 */
export const TERM_MONTHS = 6

export const CONSTITUENCY_LABELS = Object.freeze({
  ambassador: { en: 'Verified Brand Ambassadors', fa: 'سفیران برند تأییدشده' },
  coach: { en: 'Verified Trading Coaches', fa: 'مربیان معاملاتی تأییدشده' },
  community_trader: { en: 'Community Traders', fa: 'معامله‌گران جامعه' },
  funded_trader: { en: 'Funded Traders', fa: 'معامله‌گران فاندد' },
  moderator: { en: 'Community & Social Media Moderators', fa: 'مدیران جامعه و شبکه‌های اجتماعی' },
})

/* ---------------------------------------------------------------- voting */
export const VOTING = Object.freeze({
  councilSize: COUNCIL_SIZE,
  quorum: 7, /* participating members, ordinary meeting */
  ordinaryThreshold: 6, /* affirmative votes out of the FULL council */
  constitutionalThreshold: 7,
})
export const VOTE_CHOICES = Object.freeze(['approve', 'reject', 'abstain'])

/* ------------------------------------------------------------ categories */
/** Delegated domains: a council decision here is binding. */
export const DELEGATED_CATEGORIES = Object.freeze([
  'product_priority', 'community_policy', 'open_source', 'roadmap',
  'documentation', 'accessibility', 'governance_amendment',
])
/** Reserved company powers: recommendations only, always "Advisory — Non-Binding". */
export const RESERVED_POWERS = Object.freeze([
  'treasury', 'pricing', 'commissions', 'coach_compensation', 'marketing_budget',
  'operating_budget', 'capital_allocation', 'trading_risk', 'payouts', 'liquidity',
  'commercial_partnership', 'contract_deployment', 'other_financial',
])
export const CATEGORIES = Object.freeze([...DELEGATED_CATEGORIES, ...RESERVED_POWERS])
/** Delegated categories whose binding vote needs a management-confirmed capacity envelope. */
export const CAPACITY_CATEGORIES = Object.freeze(['roadmap', 'product_priority'])
export const CONSTITUTIONAL_CATEGORIES = Object.freeze(['governance_amendment'])

export const isReserved = (category) => RESERVED_POWERS.includes(category)
export const isKnownCategory = (category) => CATEGORIES.includes(category)
export const thresholdKindFor = (category) =>
  CONSTITUTIONAL_CATEGORIES.includes(category) ? 'constitutional' : 'ordinary'

/**
 * A reserved company power can never be binding, whatever the author asks for.
 * Returns the permitted classification or throws a coded error.
 */
export function resolveClassification(category, requested = 'advisory') {
  if (!isKnownCategory(category)) throw rule('unknown_category')
  if (!['binding', 'advisory'].includes(requested)) throw rule('invalid_classification')
  if (isReserved(category) && requested === 'binding') throw rule('reserved_power_is_advisory_only')
  return requested
}

/* ------------------------------------------------------------- lifecycle */
export const STATES = Object.freeze([
  'draft', 'discussion', 'submitted', 'under_review', 'voting', 'approved', 'rejected',
  'implementation_scheduled', 'in_progress', 'implemented', 'blocked', 'archived',
])

/**
 * Allowed transitions and who may perform them.
 * Actors: author, reviewer (governance reviewer / administrator), management (Company Management).
 * `via` marks transitions that happen only as a side effect of a dedicated, validated
 * operation (opening a voting session, finalizing it, recording implementation evidence);
 * they are NOT available through the generic transition endpoint.
 */
export const TRANSITIONS = Object.freeze({
  draft: { discussion: ['author'], archived: ['author', 'reviewer'] },
  discussion: { draft: ['author'], submitted: ['author'], archived: ['author', 'reviewer'] },
  submitted: { under_review: ['reviewer'], discussion: ['reviewer'], archived: ['reviewer'] },
  under_review: { discussion: ['reviewer'], archived: ['reviewer'], voting: { via: 'open_voting', actors: ['reviewer'] } },
  voting: {
    under_review: { via: 'void_or_unresolved', actors: ['reviewer'] },
    approved: { via: 'finalize', actors: ['reviewer'] },
    rejected: { via: 'finalize', actors: ['reviewer'] },
  },
  approved: { implementation_scheduled: { via: 'implementation', actors: ['reviewer', 'management'] }, archived: ['reviewer'] },
  rejected: { archived: ['reviewer'] },
  implementation_scheduled: {
    in_progress: { via: 'implementation', actors: ['reviewer', 'management'] },
    blocked: { via: 'implementation', actors: ['management'] },
  },
  in_progress: {
    implemented: { via: 'implementation', actors: ['reviewer', 'management'] },
    blocked: { via: 'implementation', actors: ['management'] },
  },
  blocked: {
    in_progress: { via: 'implementation', actors: ['management'] },
    archived: ['management', 'reviewer'],
  },
  implemented: { archived: ['reviewer'] },
  archived: {},
})

/** Statuses in which an author may still edit the proposal body. */
export const AUTHOR_EDITABLE = Object.freeze(['draft', 'discussion'])
/** Statuses in which the proposal is visible to the public. */
export const PUBLIC_STATUSES = Object.freeze(STATES.filter((s) => s !== 'draft'))

export function transitionRule(from, to) {
  const rule_ = TRANSITIONS[from]?.[to]
  if (!rule_) return null
  return Array.isArray(rule_) ? { via: null, actors: rule_ } : rule_
}

/**
 * Validate a generic transition request.
 * @param {string[]} actorRoles roles held by the actor FOR THIS PROPOSAL ('author','reviewer','management')
 * @param {string|null} via the dedicated operation performing the transition, or null for the generic endpoint
 */
export function assertTransition(from, to, actorRoles, via = null) {
  const r = transitionRule(from, to)
  if (!r) throw rule('invalid_transition', { from, to })
  if ((r.via || null) !== via) throw rule('transition_requires_dedicated_operation', { from, to, via: r.via })
  if (!r.actors.some((a) => actorRoles.includes(a))) throw rule('transition_forbidden', { from, to })
  return r
}

/* ----------------------------------------------------------------- tally */
/**
 * Evaluate a voting session. Deterministic; never lowers a threshold.
 *
 * @param {object} p
 * @param {Array<{choice:string}>} p.votes cast votes
 * @param {number} p.snapshotMembers members holding a seat in the snapshot
 * @param {number} p.recused members recused for this proposal (cannot vote, still counted against the FULL council)
 * @param {number} p.quorum participating members required
 * @param {number} p.threshold affirmative votes required, out of the FULL council
 * @param {boolean} p.closed true once the deadline has passed
 */
export function evaluateSession({ votes, snapshotMembers, recused = 0, quorum, threshold, closed }) {
  const count = (c) => votes.filter((v) => v.choice === c).length
  const approve = count('approve'), reject = count('reject'), abstain = count('abstain')
  const participating = approve + reject + abstain /* abstention is participation */
  const canStillVote = closed ? 0 : Math.max(0, snapshotMembers - recused - participating)
  const quorumMet = participating >= quorum
  const maxApprove = approve + canStillVote
  const maxParticipating = participating + canStillVote
  const base = { approve, reject, abstain, participating, quorum, threshold, councilSize: COUNCIL_SIZE, snapshotMembers, recused, quorumMet }

  if (quorumMet && approve >= threshold) return { ...base, outcome: 'approved', final: true }
  if (maxParticipating < quorum) return { ...base, outcome: 'unresolved', reason: 'quorum_unreachable', final: true }
  if (maxApprove < threshold) {
    return { ...base, outcome: closed && !quorumMet ? 'unresolved' : 'rejected', reason: 'threshold_unreachable', final: true }
  }
  if (closed) {
    return quorumMet
      ? { ...base, outcome: 'rejected', reason: 'threshold_not_reached', final: true }
      : { ...base, outcome: 'unresolved', reason: 'quorum_not_met', final: true }
  }
  return { ...base, outcome: 'pending', final: false }
}

/* --------------------------------------------------------- vote message */
export const VOTE_DOMAIN = 'openfund-governance-v1'
/** Canonical text a council member signs. Domain-separated and single-use. */
export function buildVoteMessage({ ofpId, sessionId, seatId, wallet, choice, nonce, issuedAt, expiresAt }) {
  return [
    'Openfund Governance Vote',
    `Domain: ${VOTE_DOMAIN}`,
    `Proposal: ${ofpId}`,
    `Session: ${sessionId}`,
    `Seat: ${seatId}`,
    `Wallet: ${wallet}`,
    `Choice: ${choice}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expires At: ${expiresAt}`,
    'This signature records a governance vote only. It authorises no transaction and moves no funds.',
  ].join('\n')
}

/* ------------------------------------------------------------- elections */
/** Plurality within a constituency: each voter casts one vote, top seatCount candidates win. */
export function electionWinners(tallyRows, seats = SEATS_PER_CONSTITUENCY) {
  const sorted = [...tallyRows].sort((a, b) => b.votes - a.votes || String(a.candidateId).localeCompare(String(b.candidateId)))
  if (sorted.length > seats && sorted[seats - 1].votes === sorted[seats].votes && sorted[seats].votes > 0) {
    return { winners: sorted.slice(0, seats - 1).map((r) => r.candidateId), tie: sorted.filter((r) => r.votes === sorted[seats - 1].votes).map((r) => r.candidateId), needsRunoff: true }
  }
  return { winners: sorted.slice(0, seats).filter((r) => r.votes > 0).map((r) => r.candidateId), tie: [], needsRunoff: false }
}

/** Add whole calendar months in UTC (end of month clamps). */
export function addMonths(date, months) {
  const d = new Date(date)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d
}

export function rule(code, extra = {}) {
  const e = new Error(code)
  e.status = ['transition_forbidden'].includes(code) ? 403 : code.includes('not_found') ? 404 : ['invalid_transition', 'already_voted', 'duplicate'].includes(code) ? 409 : 400
  e.code = code
  Object.assign(e, extra)
  return e
}

/* ----------------------------------------------------------- permissions */
/**
 * Action → roles allowed. Roles: reviewer, administrator (implies reviewer),
 * moderator, management (Company Management via the protected admin API).
 * Council seats and proposal authorship are DERIVED roles and are deliberately
 * absent: a council member can vote and declare conflicts, and can finalize,
 * appoint or amend nothing. No action here concerns money.
 */
export const PERMISSIONS = Object.freeze({
  'proposal.review': ['reviewer', 'management'],
  'voting.open': ['reviewer', 'management'],
  'voting.finalize': ['reviewer', 'management'],
  'voting.void': ['reviewer', 'management'],
  'conflict.review': ['reviewer', 'management'],
  'comment.moderate': ['moderator', 'reviewer', 'management'],
  'implementation.record': ['reviewer', 'management'],
  'implementation.block': ['management'],
  'capacity.confirm': ['management'],
  'eligibility.manage': ['administrator', 'management'],
  'term.create': ['administrator', 'management'],
  'term.activate': ['management'],
  'seat.appoint': ['management'],
  'membership.revoke': ['management'],
  'role.grant': ['management'],
  'election.manage': ['administrator', 'management'],
  'election.approve_rules': ['management'],
  'election.finalize': ['administrator', 'management'],
  'decision.amend': ['administrator', 'management'],
  'audit.read': ['administrator', 'management'],
})

/** request-body keys that no governance endpoint ever accepts (defence in depth) */
export const FINANCIAL_FIELDS = Object.freeze([
  'amount', 'amountusd', 'price', 'priceusd', 'commission', 'commissionrate', 'payout', 'transfer', 'treasury',
  'balance', 'risklimit', 'leverage', 'order', 'contractaddress', 'calldata', 'recipient', 'txhash', 'privatekey', 'seed', 'mnemonic',
])
