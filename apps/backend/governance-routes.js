/**
 * Openfund Hybrid Governance v1.0 — HTTP surface.
 *
 *   /governance/*              public reads + session-authenticated participation
 *   /governance/manage/*       governance reviewers / administrators (session roles in gov_roles)
 *   /admin/governance/*        Company Management (ADMIN_API_TOKEN gate in admin.js)
 *
 * Authorization lives in governance.js (assertCan); routes only authenticate,
 * validate and delegate. Directus never reaches these tables.
 */
import { Router } from 'express'
import { createGovernance } from './governance.js'
import { FINANCIAL_FIELDS } from './governance-rules.js'

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

/** reject any payload that carries a financial-shaped key, at any depth */
export function rejectFinancialFields(value, depth = 0) {
  if (depth > 6 || value == null || typeof value !== 'object') return null
  for (const [k, v] of Object.entries(value)) {
    if (FINANCIAL_FIELDS.includes(k.toLowerCase())) return k
    const nested = rejectFinancialFields(v, depth + 1)
    if (nested) return nested
  }
  return null
}
const financialGuard = (req, res, next) => {
  const bad = rejectFinancialFields(req.body) || rejectFinancialFields(req.query)
  if (bad) return res.status(400).json({ error: 'financial_fields_not_accepted', field: bad })
  next()
}

export function governanceRoutes({ pool, requireAuth, limit = () => (req, res, next) => next(), service, audit }) {
  const gov = service || createGovernance({ pool })
  const router = Router()
  router.use(financialGuard)
  const actor = (req) => gov.actorFor(req.user.user_id)
  const act = (fn) => wrap(async (req, res) => res.json(await fn(await actor(req), req)))

  /* ---- public (read-only) ---- */
  router.get('/overview', wrap(async (req, res) => res.set('Cache-Control', 'no-store').json(await gov.overview())))
  router.get('/council', wrap(async (req, res) => res.json(await gov.council())))
  router.get('/proposals', wrap(async (req, res) => res.json(await gov.listProposals(req.query))))
  router.get('/decisions', wrap(async (req, res) => res.json(await gov.decisions(req.query))))
  router.get('/elections', wrap(async (req, res) => res.json(await gov.electionsPublic())))
  router.get('/proposals/:ofp/comments', wrap(async (req, res) => res.json(await gov.comments(req.params.ofp, req.query))))
  /* proposal detail: public for non-drafts; a session (optional) adds the viewer's own eligibility */
  router.get('/proposals/:ofp', wrap(async (req, res) => {
    let viewerId = null
    await new Promise((resolve) => requireAuth(req, { status: () => ({ json: () => resolve() }), setHeader: () => {} }, () => { viewerId = req.user?.user_id || null; resolve() }))
    res.set('Cache-Control', 'no-store').json(await gov.getProposal(req.params.ofp, viewerId))
  }))

  /* ---- authenticated participation ---- */
  router.get('/me', requireAuth, wrap(async (req, res) => res.json(await gov.me(req.user.user_id))))
  router.get('/workspace', requireAuth, wrap(async (req, res) => res.json(await gov.workspace(req.user.user_id))))
  router.get('/my/proposals', requireAuth, wrap(async (req, res) => res.json(await gov.listProposals(req.query, { mine: true, userId: req.user.user_id }))))
  router.post('/proposals', requireAuth, limit(10), wrap(async (req, res) => res.status(201).json(await gov.createProposal(req.user.user_id, req.body || {}))))
  router.patch('/proposals/:ofp', requireAuth, limit(60), wrap(async (req, res) => res.json(await gov.updateProposal(req.user.user_id, req.params.ofp, req.body || {}))))
  router.post('/proposals/:ofp/transition', requireAuth, limit(60), act((a, req) => gov.transition(a, req.params.ofp, req.body?.to, req.body?.note)))
  router.post('/proposals/:ofp/comments', requireAuth, limit(30), wrap(async (req, res) => res.status(201).json(await gov.addComment(req.user.user_id, req.params.ofp, req.body || {}))))
  router.post('/proposals/:ofp/conflicts', requireAuth, limit(20), wrap(async (req, res) => res.status(201).json(await gov.declareConflict(req.user.user_id, req.params.ofp, req.body || {}))))
  router.get('/proposals/:ofp/vote-challenge', requireAuth, limit(30), wrap(async (req, res) => res.json(await gov.issueVoteChallenge(req.user.user_id, req.params.ofp, String(req.query.choice || '')))))
  router.post('/proposals/:ofp/vote', requireAuth, limit(20), wrap(async (req, res) => {
    const out = await gov.castVote(req.user.user_id, req.params.ofp, req.body || {})
    res.status(201).json(out)
  }))
  router.post('/elections/:id/apply', requireAuth, limit(10), wrap(async (req, res) => res.status(201).json(await gov.applyCandidate(req.user.user_id, req.params.id, req.body || {}))))
  router.post('/elections/:id/vote', requireAuth, limit(20), wrap(async (req, res) => res.status(201).json(await gov.castElectionVote(req.user.user_id, req.params.id, req.body?.candidateId))))

  /* ---- governance staff (session roles) ---- */
  const m = Router()
  m.use(requireAuth)
  m.post('/proposals/:ofp/voting', limit(20), act((a, req) => gov.openVoting(a, req.params.ofp, req.body || {})))
  m.post('/proposals/:ofp/finalize', limit(20), act((a, req) => gov.finalizeSession(a, req.params.ofp, req.body || {})))
  m.post('/proposals/:ofp/void', limit(20), act((a, req) => gov.voidSession(a, req.params.ofp, req.body?.reason)))
  m.post('/proposals/:ofp/implementation', limit(30), act((a, req) => gov.recordImplementation(a, req.params.ofp, req.body || {})))
  m.post('/conflicts/:id/review', limit(30), act((a, req) => gov.reviewConflict(a, req.params.id, req.body || {})))
  m.post('/comments/:id/hide', limit(60), act((a, req) => gov.hideComment(a, req.params.id, req.body?.reason)))
  m.post('/decisions/:id/amend', limit(20), act((a, req) => gov.amendDecision(a, req.params.id, req.body || {})))
  m.get('/eligibility', act((a, req) => gov.listEligibility(a, req.query)))
  m.put('/eligibility', limit(60), act((a, req) => gov.setEligibility(a, req.body || {})))
  m.get('/audit', act((a, req) => gov.auditEvents(a, req.query)))
  router.use('/manage', m)
  return router
}

/** Company Management (token-gated by admin.js, which mounts this behind its auth middleware). */
export function governanceAdminRoutes({ pool, service }) {
  const gov = service || createGovernance({ pool })
  const router = Router()
  router.use(financialGuard)
  const mgmt = (req) => gov.managementActor(String(req.headers['x-actor'] || 'company_management').slice(0, 60).replace(/[^\w.@-]/g, '') || 'company_management')
  const run = (fn) => wrap(async (req, res) => res.json(await fn(mgmt(req), req)))

  router.get('/overview', wrap(async (req, res) => res.json(await gov.overview())))
  router.get('/audit', run((a, req) => gov.auditEvents(a, req.query)))
  router.get('/eligibility', run((a, req) => gov.listEligibility(a, req.query)))
  router.get('/users/:id/signals', run((a, req) => gov.challengeSignals(a, req.params.id)))
  router.post('/terms', run((a, req) => gov.createTerm(a, req.body || {})))
  router.post('/terms/:id/activate', run((a, req) => gov.activateTerm(a, req.params.id)))
  router.put('/eligibility', run((a, req) => gov.setEligibility(a, req.body || {})))
  router.post('/seats/:id/appoint', run((a, req) => gov.appoint(a, { ...(req.body || {}), seatId: req.params.id })))
  router.post('/memberships/:id/revoke', run((a, req) => gov.revokeMembership(a, req.params.id, req.body?.reason)))
  router.post('/roles', run((a, req) => gov.grantRole(a, req.body?.userId, req.body?.role)))
  router.delete('/roles', run((a, req) => gov.revokeRole(a, req.body?.userId, req.body?.role)))
  router.post('/proposals/:ofp/capacity', run((a, req) => gov.confirmCapacity(a, req.params.ofp, req.body?.note)))
  router.post('/proposals/:ofp/transition', run((a, req) => gov.transition(a, req.params.ofp, req.body?.to, req.body?.note)))
  router.post('/proposals/:ofp/voting', run((a, req) => gov.openVoting(a, req.params.ofp, req.body || {})))
  router.post('/proposals/:ofp/finalize', run((a, req) => gov.finalizeSession(a, req.params.ofp, req.body || {})))
  router.post('/proposals/:ofp/void', run((a, req) => gov.voidSession(a, req.params.ofp, req.body?.reason)))
  router.post('/proposals/:ofp/implementation', run((a, req) => gov.recordImplementation(a, req.params.ofp, req.body || {})))
  router.post('/conflicts/:id/review', run((a, req) => gov.reviewConflict(a, req.params.id, req.body || {})))
  router.post('/decisions/:id/amend', run((a, req) => gov.amendDecision(a, req.params.id, req.body || {})))
  router.post('/elections', run((a, req) => gov.createElection(a, req.body || {})))
  router.post('/elections/:id/approve-rules', run((a, req) => gov.approveElectionRules(a, req.params.id)))
  router.post('/elections/:id/advance', run((a, req) => gov.advanceElection(a, req.params.id, req.body?.to)))
  router.post('/elections/candidates/:id/decide', run((a, req) => gov.decideCandidate(a, req.params.id, req.body?.decision)))
  router.post('/elections/:id/finalize', run((a, req) => gov.finalizeElection(a, req.params.id)))
  router.post('/elections/:id/seat-winners', run((a, req) => gov.seatElectionWinners(a, req.params.id)))
  return router
}
