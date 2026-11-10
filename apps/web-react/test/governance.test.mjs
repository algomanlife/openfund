/**
 * Governance website tests: routing, authority wording, read-only vs authorised
 * vote rendering, empty/loading/error states, RTL/LTR, theming hooks and parity
 * with the backend policy module. Rendering uses react-dom/server on the
 * presentational components; no browser or backend is needed.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
const require = createRequire(import.meta.url)
const file = (p) => fileURLToPath(new URL(p, import.meta.url))
const read = (p) => readFileSync(file(p), 'utf8')

function load(path) {
  const { outputFiles } = buildSync({ entryPoints: [file(path)], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, jsx: 'automatic', loader: { '.css': 'empty' } })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports)
  return module.exports
}
const { renderToStaticMarkup } = require('react-dom/server')
const React = require('react')
const model = load('../src/features/governance/governanceModel.ts')
const V = load('../src/features/governance/GovernanceViews.tsx')
const rules = await import('../../backend/governance-rules.js')
const h = React.createElement

/* ---------------- routing & wiring ---------------- */
test('governance routes are registered and use clean locale paths', () => {
  const main = read('../src/main.tsx')
  for (const p of ["'/:locale/governance'", "'/:locale/governance/new'", "'/:locale/governance/workspace'", "'/:locale/governance/proposals/:ofp'"]) assert.ok(main.includes(`path: ${p}`), p)
  assert.ok(main.indexOf("path: '/:locale/governance'") < main.indexOf("path: '/:section'"), 'declared before the legacy catch-all')
})
test('governance is a public, SEO-routable page in navigation, CMS whitelists and the Directus schema', () => {
  assert.match(read('../src/features/loading/seoHead.ts'), /\|governance\|/)
  assert.match(read('../src/features/information/navigation.ts'), /economy = \[[^\n]*'governance'/)
  assert.match(read('../src/features/information/content.ts'), /governance: text\('Governance', 'حاکمیت'\)/)
  const client = read('../src/cms/client.ts')
  assert.match(client, /NAV_ROUTES = new Set\([^)]*'governance'/); assert.match(client, /FOOTER_DESTINATIONS = new Set\([^)]*'governance'/)
  const py = read('../../backstage/scripts/apply_schema.py')
  for (const c of ['governance_milestones', 'governance_content_blocks', 'governance_milestone_translations']) assert.ok(py.includes(c), c)
})
test('Directus holds editorial governance content only', () => {
  const py = read('../../backstage/scripts/apply_schema.py')
  const gov = py.split('governance editorial content')[1].split('public (read-only) permissions')[0]
  assert.doesNotMatch(gov, /gov_(votes|proposals|memberships|eligibility|terms|seats|decisions)/)
  assert.doesNotMatch(read('../../backstage/scripts/register_user_tables.py'), /gov_/)
  const wanted = py.split("('governance_milestones'")[1].split(']')[0]
  assert.doesNotMatch(wanted, /create|update|delete/i)
})

/* ---------------- parity with the backend policy ---------------- */
test('frontend constants mirror the backend policy module', () => {
  assert.equal(model.COUNCIL_SIZE, rules.COUNCIL_SIZE)
  assert.equal(model.QUORUM, rules.VOTING.quorum)
  assert.equal(model.ORDINARY_THRESHOLD, rules.VOTING.ordinaryThreshold)
  assert.equal(model.CONSTITUTIONAL_THRESHOLD, rules.VOTING.constitutionalThreshold)
  assert.deepEqual([...model.CONSTITUENCIES], [...rules.CONSTITUENCIES])
  assert.deepEqual([...model.DELEGATED_CATEGORIES], [...rules.DELEGATED_CATEGORIES])
  assert.deepEqual([...model.RESERVED_CATEGORIES], [...rules.RESERVED_POWERS])
  assert.deepEqual(Object.keys(model.STATUS_LABEL).sort(), [...rules.STATES].sort())
})
test('every category, status, constituency and vote label exists in both Persian and English', () => {
  for (const group of [model.CATEGORY_LABEL, model.STATUS_LABEL, model.CONSTITUENCY_LABEL, model.VOTE_LABEL]) {
    for (const [k, v] of Object.entries(group)) { assert.ok(v.en && v.fa, k); assert.notEqual(v.en, v.fa, k) }
  }
  for (const c of [...model.DELEGATED_CATEGORIES, ...model.RESERVED_CATEGORIES]) assert.ok(model.CATEGORY_LABEL[c], c)
})

/* ---------------- binding vs advisory wording ---------------- */
test('advisory proposals are always labelled "Advisory — Non-Binding" and never as binding', () => {
  assert.equal(model.classificationLabel(false, 'en'), 'Advisory — Non-Binding')
  assert.equal(model.classificationLabel(false, 'fa'), 'مشورتی — غیرالزام‌آور')
  assert.equal(model.classificationLabel(true, 'en'), 'Binding')
  const html = renderToStaticMarkup(h(V.ProposalTable, { locale: 'en', href: (o) => `/en/governance/proposals/${o}`, data: { total: 2, proposals: [
    { ofpId: 'OFP-0001', title: 'Add tooltips', category: 'product_priority', binding: true, status: 'voting', author: '0xabcd…1234', votingDeadline: '2027-03-05T12:00:00Z', commentCount: 3 },
    { ofpId: 'OFP-0002', title: 'Lower prices', category: 'pricing', binding: false, status: 'discussion', author: '0xdcba…4321', votingDeadline: null, commentCount: 0 }] } }))
  assert.match(html, /data-class="binding"[^>]*>Binding</); assert.match(html, /data-class="advisory"[^>]*>Advisory — Non-Binding</)
  assert.match(html, /reserved to management/); assert.match(html, /<caption>Proposals · 2<\/caption>/)
  assert.equal((html.match(/<th scope="col"/g) || []).length, 8)               /* accessible table: column headers */
})

/* ---------------- council: truthful empty state ---------------- */
const emptyCouncil = { term: null, seats: [], seatedCount: 0, vacantCount: 10, config: {} }
test('with no council the page shows ten vacant seats and invents no member', () => {
  const html = renderToStaticMarkup(h(V.CouncilGrid, { data: emptyCouncil, locale: 'en' }))
  assert.equal((html.match(/data-seat-status="vacant"/g) || []).length, 10)
  assert.equal((html.match(/data-seat-status="seated"/g) || []).length, 0)
  assert.match(html, /No council has been seated/); assert.match(html, /0 \/ 10 seats filled/)
  for (const label of Object.values(model.CONSTITUENCY_LABEL)) assert.ok(html.includes(label.en.replace(/&/g, '&amp;')), label.en)
})
test('a seated council shows consented names only and labels an appointed term honestly', () => {
  const seats = []
  for (const c of model.CONSTITUENCIES) for (const n of [1, 2]) seats.push({ constituency: c, seatNo: n, status: c === 'coach' ? 'seated' : 'vacant', displayName: c === 'coach' && n === 1 ? 'Public Coach' : null, nameWithheld: c === 'coach' && n === 2, termStartsAt: '2027-03-01T00:00:00Z', termEndsAt: '2027-09-01T00:00:00Z', membershipType: 'appointed', participation: { votesCast: 2, sessionsEligible: 3 } })
  const html = renderToStaticMarkup(h(V.CouncilGrid, { locale: 'en', data: { term: { label: 'Term 1', startsAt: '2027-03-01T00:00:00Z', endsAt: '2027-09-01T00:00:00Z', appointmentMethod: 'appointed' }, seats, seatedCount: 2, vacantCount: 8, config: {} } }))
  assert.match(html, /Public Coach/); assert.match(html, /Seated — name not published/)
  assert.match(html, /Appointed by company management — not community-elected/); assert.doesNotMatch(html, /Elected by constituency vote/)
  assert.match(html, /2 \/ 10 seats filled/)
})

/* ---------------- voting interface ---------------- */
const session = { id: 's1', kind: 'ordinary', councilSize: 10, quorum: 7, threshold: 6, opensAt: '2027-03-01T00:00:00Z', closesAt: '2099-03-05T00:00:00Z', status: 'active', phase: 'open', tally: { participating: 3 } }
const proposal = (viewer) => ({ ofpId: 'OFP-0001', title: 'Add tooltips', binding: true, status: 'voting', sessions: [session], viewer })
test('unauthorised viewers see a read-only panel with requirements, deadline and no vote buttons', () => {
  for (const [signedIn, viewer] of [[false, { councilMember: false, canVote: false, reason: 'not_council_member' }], [true, { councilMember: false, canVote: false, reason: 'not_council_member' }]]) {
    const html = renderToStaticMarkup(h(V.VotePanel, { proposal: proposal(viewer), locale: 'en', signedIn, sign: false }))
    assert.match(html, /data-vote-mode="readonly"/); assert.doesNotMatch(html, /gv-vote-approve/); assert.doesNotMatch(html, /<form/)
    assert.match(html, /At least 6 affirmative votes from the full 10-seat council/); assert.match(html, /Deadline/); assert.match(html, /data-readonly/)
    assert.match(html, /not an on-chain or token-weighted vote/)
  }
})
test('an eligible council member gets the three options, wallet-signature choice and no-fee wording', () => {
  const html = renderToStaticMarkup(h(V.VotePanel, { proposal: proposal({ councilMember: true, canVote: true, reason: null }), locale: 'en', signedIn: true, sign: true }))
  assert.match(html, /data-vote-mode="vote"/)
  for (const label of ['Approve', 'Reject', 'Abstain']) assert.ok(html.includes(`>${label}</button>`), label)
  assert.match(html, /no transaction, no network fee/); assert.match(html, /cannot be changed/)
  assert.match(html, /individual choices stay hidden/)
})
test('after voting the member sees a confirmation and no further vote controls', () => {
  const html = renderToStaticMarkup(h(V.VotePanel, { proposal: proposal({ councilMember: true, canVote: false, reason: 'already_voted' }), locale: 'en', signedIn: true, sign: true, submitted: { choice: 'approve', signed: true } }))
  assert.match(html, /data-vote-confirmed/); assert.match(html, /wallet signature stored as evidence/); assert.doesNotMatch(html, /gv-vote-approve/)
})
test('a council member who cannot vote is told why (recusal, closed, already voted)', () => {
  for (const [reason, text] of [['recused', /recused/], ['already_voted', /already voted/], ['conflict_pending_review', /awaiting review/]]) {
    const html = renderToStaticMarkup(h(V.VotePanel, { proposal: proposal({ councilMember: true, canVote: false, reason }), locale: 'en', signedIn: true, sign: false }))
    assert.match(html, text); assert.doesNotMatch(html, /gv-vote-approve/)
  }
})
test('vote gate logic: only an authenticated, eligible member during an open session may vote', () => {
  const ok = { canVote: true, reason: null, councilMember: true }
  assert.equal(model.voteGate(ok, session, true), 'vote')
  assert.equal(model.voteGate(ok, session, false), 'readonly')
  assert.equal(model.voteGate(ok, { ...session, phase: 'closed' }, true), 'readonly')
  assert.equal(model.voteGate({ ...ok, canVote: false }, session, true), 'readonly')
  assert.equal(model.voteGate({ ...ok, councilMember: false }, session, true), 'readonly')
  assert.equal(model.voteGate(undefined, session, true), 'readonly')
})
test('no scheduled vote renders an honest empty panel', () => {
  const html = renderToStaticMarkup(h(V.VotePanel, { proposal: { ...proposal(undefined), sessions: [] }, locale: 'en', signedIn: false, sign: false }))
  assert.match(html, /No council vote has been scheduled/)
})
test('deadline helpers handle open, closed and invalid dates', () => {
  const now = Date.parse('2027-03-01T00:00:00Z')
  assert.deepEqual(model.timeLeft('2027-03-02T03:04:00Z', now), { days: 1, hours: 3, minutes: 4 })
  assert.equal(model.timeLeft('2027-02-28T00:00:00Z', now), null)
  assert.equal(model.timeLeft('garbage', now), null)
  assert.equal(model.formatDate(null, 'en'), '—'); assert.equal(model.formatDate('x', 'fa'), '—')
})

/* ---------------- loading / empty / error states ---------------- */
test('loading, error and empty states are explicit, announced and never show guessed data', () => {
  const box = (state, extra = {}) => renderToStaticMarkup(h(V.StateBox, { state, locale: 'en', empty: 'Nothing here.', children: () => 'DATA', ...extra }))
  assert.match(box({ status: 'loading' }), /role="status"[^>]*data-state="loading"/)
  const err = box({ status: 'error', code: 'rate_limited' }, { onRetry: () => {} })
  assert.match(err, /role="alert"/); assert.match(err, /Try again/); assert.doesNotMatch(err, /DATA/)
  assert.match(box({ status: 'ready', data: [] }, { isEmpty: (d) => d.length === 0 }), /data-state="empty"[\s\S]*Nothing here\./)
  assert.match(box({ status: 'ready', data: [1] }), /DATA/)
})
test('error messages exist in both languages and never echo server internals', () => {
  for (const code of ['already_voted', 'voting_closed', 'recused', 'forbidden', 'reserved_power_is_advisory_only']) {
    assert.ok(model.errorMessage(code, 'en').length > 10); assert.ok(model.errorMessage(code, 'fa').length > 5)
  }
  assert.equal(model.errorMessage('sql_syntax_error_at_position_9', 'en'), 'The request could not be completed.')
})

/* ---------------- RTL / LTR and localisation ---------------- */
test('Persian renders Persian copy and Persian numerals; English renders English', () => {
  const fa = renderToStaticMarkup(h(V.CouncilGrid, { data: emptyCouncil, locale: 'fa' }))
  assert.match(fa, /خالی/); assert.match(fa, /۰ \/ ۱۰/); assert.match(fa, /هیچ دورهٔ شورا فعال نیست/)
  assert.doesNotMatch(fa, /Vacant/)
  const authority = renderToStaticMarkup(h(V.AuthorityComparison, { locale: 'fa' }))
  assert.match(authority, /مشورتی — غیرالزام‌آور/); assert.match(authority, /اختیار انحصاری مالی/)
})
test('the shell sets direction from the locale (RTL for fa/ar, LTR otherwise)', () => {
  const locales = load('../src/i18n/locales.ts')
  assert.equal(locales.dirOf('fa'), 'rtl'); assert.equal(locales.dirOf('ar'), 'rtl')
  for (const l of ['en', 'ru', 'zh-CN']) assert.equal(locales.dirOf(l), 'ltr')
  assert.match(read('../src/features/information/InformationShell.tsx'), /document\.documentElement\.dir = dirOf\(locale\)/)
})
test('layout uses logical properties and token-based colours so RTL and both themes work', () => {
  const css = read('../src/features/governance/governance.css')
  assert.doesNotMatch(css, /margin-left|margin-right|padding-left|padding-right|text-align:\s*(left|right)|float:\s*(left|right)/)
  assert.match(css, /padding-inline-start/); assert.match(css, /var\(--mint\)/); assert.match(css, /html\[data-theme=light\]/)
  assert.match(css, /@media \(max-width:640px\)/); assert.match(css, /prefers-reduced-motion/)
  assert.match(css, /min-height:44px/)                                       /* touch target */
  assert.match(css, /:focus-visible/)                                         /* keyboard focus */
  assert.ok((css.match(/#[0-9a-f]{6}\b/gi) || []).length <= 6, 'colours come from the shared tokens; only status accents are literal')
})

/* ---------------- decisions, roadmap, docs, authority ---------------- */
test('decisions show reasons and never equate approval with implementation', () => {
  const html = renderToStaticMarkup(h(V.DecisionList, { locale: 'en', href: (o) => '#' + o, data: {
    decisions: [{ ofpId: 'OFP-0003', title: 'Docs sprint', category: 'documentation', classification: 'binding', outcome: 'approved', binding: true, rationale: 'Clear benefit for new contributors.', decidedAt: '2027-04-01T10:00:00Z', proposalStatus: 'approved', implementationStatus: 'not_started', tally: { approve: 7, reject: 2, abstain: 1 } }],
    blocked: [{ ofp_id: 'OFP-0004', title: 'Plugin API', blocker: { blocked_reason: 'Licence conflict found.', blocked_evidence: 'Legal review L-9', next_review_on: '2027-06-01' } }] } }))
  assert.match(html, /Clear benefit for new contributors/); assert.match(html, /Not started — approval is not implementation/)
  assert.match(html, /Licence conflict found/); assert.match(html, /Next review/); assert.match(html, /approve 7/)
})
test('the bundled roadmap is truthful: no invented dates, on-chain governance is "not planned"', () => {
  assert.ok(V.BUNDLED_MILESTONES.every((m) => m.title.en && m.title.fa && m.body.en && m.body.fa))
  const onchain = V.BUNDLED_MILESTONES.find((m) => m.key === 'onchain'); assert.equal(onchain.status, 'not_planned')
  assert.equal(V.BUNDLED_MILESTONES.find((m) => m.key === 'council').status, 'planned')
  assert.doesNotMatch(JSON.stringify(V.BUNDLED_MILESTONES), /20\d\d-\d\d|Q[1-4] 20\d\d|\bDAO governance is live\b/)
  const html = renderToStaticMarkup(h(V.Roadmap, { items: V.BUNDLED_MILESTONES, locale: 'en' }))
  assert.match(html, /Not planned/); assert.match(html, /Built · not yet in production use/)
})
test('authority comparison keeps financial authority with management and states the boundary', () => {
  const html = renderToStaticMarkup(h('div', null, h(V.AuthorityComparison, { locale: 'en' }), h(V.AuthorityTable, { locale: 'en' }), h(V.ArchitectureDiagram, { locale: 'en' })))
  assert.match(html, /Exclusive financial authority/); assert.match(html, /can never execute anything/)
  assert.match(html, /No — technically and by policy/); assert.match(html, /<caption>Authority comparison<\/caption>/)
  assert.match(html, /<svg[^>]*role="img"[^>]*aria-labelledby/); assert.match(html, /no execution/)
  assert.doesNotMatch(html, /token|stake|DAO vote/i)
})
test('documentation links use repository conventions and the ones that exist are present', () => {
  const html = renderToStaticMarkup(h(V.DocLinks, { locale: 'en' }))
  for (const p of ['GOVERNANCE.md', 'ECONOMY.md', 'CONTRIBUTING.md', 'docs/governance/PROPOSALS.md']) assert.ok(html.includes(model.DOC_BASE + p), p)
  assert.match(html, /rel="noopener noreferrer"/)
  for (const d of model.GOVERNANCE_DOCS) assert.ok(d.path.endsWith('.md'))
})
test('policy facts are derived from the same constants as the backend', () => {
  const html = renderToStaticMarkup(h(V.PolicyFacts, { locale: 'en' }))
  assert.match(html, /<dd>10<\/dd>/); assert.match(html, /<dd>7<\/dd>/); assert.match(html, /<dd>6\/10<\/dd>/); assert.match(html, /<dd>7\/10<\/dd>/)
})
test('page code never presents a wallet address or browser-supplied identity as proof of authority', () => {
  for (const f of ['Governance.tsx', 'ProposalVote.tsx', 'ProposalPage.tsx', 'CouncilWorkspace.tsx', 'NewProposal.tsx', 'api.ts']) {
    const src = read(`../src/features/governance/${f}`)
    assert.doesNotMatch(src, /walletAddress|x-test-user|localStorage|sessionStorage/, f)
  }
  assert.match(read('../src/features/governance/api.ts'), /apiFetch/)           /* credentialed session cookie, no tokens in JS */
})

/* ---------------- whitepaper chapter ---------------- */
test('the whitepaper governance chapter is bilingual, WpChapter-shaped and consistent with approved policy', () => {
  const { governanceChapter: ch } = load('../src/features/governance/whitepaperChapter.ts')
  assert.equal(ch.slug, 'governance'); assert.equal(ch.sort, 16)
  for (const k of ['kicker', 'title', 'summary']) assert.ok(ch[k].en && ch[k].fa, k)
  const allowed = new Set(['lead', 'p', 'h3', 'list', 'callout', 'definitions', 'table', 'refs'])
  const walk = (v, f) => { if (v && typeof v === 'object') { if ('en' in v && 'fa' in v) f(v); else for (const x of Object.values(v)) walk(x, f) } }
  for (const b of ch.blocks) assert.ok(allowed.has(b.type), b.type)
  let n = 0; walk(ch.blocks, (bi) => { n++; assert.ok(bi.en.length && bi.fa.length) }); assert.ok(n > 25)
  const en = JSON.stringify(ch)
  for (const must of ['ten-seat', 'Not a DAO'.toLowerCase() === '' ? '' : 'not a DAO', 'no governance token', 'six affirmative votes', 'seven', 'Advisory — Non-Binding', 'appointed', 'not yet in production use', 'not “implemented”']) assert.ok(en.includes(must), must)
  assert.doesNotMatch(en, /live on-chain|token holders|stak/i)
})
