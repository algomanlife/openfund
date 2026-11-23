import { createServer } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { validVerifier, verifyPassword } from './password.js'
import { createContentApi } from './content.js'
import { createCampaignsApi } from './campaigns.js'

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
const payoutHash = /^0x[a-f0-9]{64}$/i
const supportRef = /^OF-[0-9]{6}-[A-Z2-9]{6}$/
const supportStatuses = ['in_progress', 'waiting_customer', 'resolved', 'closed']
const wallet = /^0x[a-f0-9]{40}$/i
const token = () => randomBytes(32).toString('base64url')
const fail = (status, code) => Object.assign(new Error(code), { status })
const PAGE_SIZE = 25
const staticFiles = {
  '/': ['public/index.html', 'text/html; charset=utf-8'],
  '/app.js': ['public/app.js', 'application/javascript; charset=utf-8'],
  '/strings.js': ['public/strings.js', 'application/javascript; charset=utf-8'],
  '/marketing.js': ['public/marketing.js', 'application/javascript; charset=utf-8'],
  '/style.css': ['public/style.css', 'text/css; charset=utf-8'],
  '/dir-arrow.css': ['public/dir-arrow.css', 'text/css; charset=utf-8'],
  '/dir-arrow.js': ['public/dir-arrow.js', 'application/javascript; charset=utf-8'],
  '/mark.svg': ['../../../brand/logos/mark-mint.svg', 'image/svg+xml'],
  /* Dastkhat (SIL OFL 1.1): the same pinned files the site serves, at the same
     same-origin path, so the console needs no extra CSP source. */
  '/assets/fonts/dastkhat/Dastkhat-Variable.woff2': ['../../web-react/public/assets/fonts/dastkhat/Dastkhat-Variable.woff2', 'font/woff2'],
  '/assets/fonts/dastkhat/DastkhatArabic-Variable.woff2': ['../../web-react/public/assets/fonts/dastkhat/DastkhatArabic-Variable.woff2', 'font/woff2'],
  '/assets/fonts/dastkhat/DastkhatFaNum-Variable.woff2': ['../../web-react/public/assets/fonts/dastkhat/DastkhatFaNum-Variable.woff2', 'font/woff2'],
  '/assets/fonts/dastkhat/dastkhat.css': ['../../web-react/public/assets/fonts/dastkhat/dastkhat.css', 'text/css; charset=utf-8'],
  '/assets/fonts/dastkhat/OFL.txt': ['../../web-react/public/assets/fonts/dastkhat/OFL.txt', 'text/plain; charset=utf-8'],
}

const routes = {
  users: ['/admin/users', 'users', ['search', 'status', 'offset']],
  challenges: ['/admin/challenges', 'challenges', ['status', 'user_id', 'offset']],
  reviews: ['/admin/rewards/reviews', 'reviews', []],
  payouts: ['/admin/withdrawals?kind=reward', 'withdrawals', ['status', 'offset', 'scope']],
  payments: ['/admin/payments/attempts', 'attempts', ['status', 'review']],
  /* Openfund Pay operations (ADR 0046) */
  paymentOverview: ['/admin/payments/overview'],
  paymentSearch: ['/admin/payments/search', 'orders', ['orderId', 'wallet', 'txHash', 'chainId', 'method', 'status', 'from', 'to']],
  deposits: ['/admin/payments/transactions?review=open', 'transactions', ['status', 'match']],
  refunds: ['/admin/payments/refunds', 'refunds', ['status']],
  paymentSettings: ['/admin/payments/settings'],
  coupons: ['/admin/coupons', 'coupons', []],
  couponPlans: ['/admin/coupons/plans', 'plans', []],
  controlled: ['/admin/coupons/controlled', 'controlledTests', []],
  support: ['/admin/support/messages', 'messages', ['status', 'department', 'offset']],
  partners: ['/admin/partners/applications', 'applications', ['role', 'status']],
  commissions: ['/admin/partners/commissions', 'ambassadors', []],
  finance: ['/admin/economy/position'],
  expenses: ['/admin/economy/expenses', 'expenses', []],
  reserves: ['/admin/economy/reserves', 'reserves', []],
  obligations: ['/admin/economy/obligations', 'obligations', []],
  allocations: ['/admin/economy/treasury/allocations'],
  audit: ['/admin/operations/audit', 'entries', ['source', 'action', 'entity_id', 'actor', 'offset']],
  risk: ['/admin/operations/risk'],
  search: ['/admin/operations/search', 'results', ['q']],
  notifications: ['/admin/operations/notifications', 'notifications', ['user_id', 'offset']],
  system: ['/admin/runtime'],
  /* console (admin-console.js): plan administration and granted entitlements */
  plans: ['/admin/console/plans', 'plans', []],
  entitlements: ['/admin/console/entitlements', 'entitlements', []],
  /* Openfund Premium League (tournament.js); a record is a tournament slug */
  tournaments: ['/admin/tournaments', 'tournaments', []],
  /* Migration to Openfund (migration.js, ADR 0051) */
  migrations: ['/admin/migration/requests', 'requests', ['status']],
  migrationFirms: ['/admin/migration/firms'],
  /* site search analytics (site-search.js, ADR 0052); record 'export.csv' is the CSV */
  siteSearch: ['/admin/search/analytics', null, ['from', 'to', 'locale', 'q']],
}
const SEARCH_FILTERS = { from: /^\d{4}-\d{2}-\d{2}$/, to: /^\d{4}-\d{2}-\d{2}$/, locale: /^(fa|en|ar|ru|zh-CN)$/, q: /^[^\u0000-\u001f]{1,80}$/u }
const SEARCH_ROUTE = /^[a-z0-9][a-z0-9/-]{0,80}$/

/** one-click "add synonym or suggestion" from the dashboard → a validated Directus item */
export function siteSearchTerm(body) {
  const clean = v => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim() : '')
  if (body?.kind === 'synonym') {
    const terms = [...new Set((Array.isArray(body.terms) ? body.terms : []).map(clean).filter(v => v && v.length <= 60))]
    if (terms.length < 2 || terms.length > 20) throw fail(400, 'invalid_terms')
    return ['/items/search_synonyms', { status: 'published', terms, note: clean(body.note).slice(0, 300) || null }]
  }
  if (body?.kind === 'suggestion') {
    const route = clean(body.route)
    if (!SEARCH_ROUTE.test(route)) throw fail(400, 'invalid_route')
    const fa = clean(body.labelFa), en = clean(body.labelEn)
    if (!fa || !en || fa.length > 80 || en.length > 80) throw fail(400, 'invalid_label')
    return ['/items/search_suggestions', { status: 'published', sort: 100, route,
      translations: [{ language_code: 'fa', label: fa }, { language_code: 'en', label: en }] }]
  }
  throw fail(400, 'invalid_request')
}
const tournamentSlug = /^[a-z0-9][a-z0-9-]{2,59}$/

/* Owner mutations beyond the original decision sections. Every entry is
   dispatched through the same gate as the originals: session + CSRF +
   confirmOwner password re-entry + GLOBAL region. An entry validates its
   own fields and returns [backend path, payload]. */
const textOf = (value, max, required = true) => {
  if (value == null || value === '') { if (required) throw fail(400, 'invalid_request'); return null }
  if (typeof value !== 'string' || value.length > max || !value.trim()) throw fail(400, 'invalid_request')
  return value.trim()
}
const moneyOf = value => {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) throw fail(400, 'invalid_request')
  return String(value)
}
const txHashOf = value => {
  const v = textOf(value, 100)
  if (!/^(0x[0-9a-fA-F]{64}|[1-9A-HJ-NP-Za-km-z]{64,90})$/.test(v)) throw fail(400, 'invalid_payout_hash')
  return v
}
const planDraft = (slug, body) => {
  if (!body.configuration || typeof body.configuration !== 'object' || Array.isArray(body.configuration)) throw fail(400, 'invalid_configuration')
  return { slug, nameFa: textOf(body.nameFa, 80), nameEn: textOf(body.nameEn, 80), configuration: body.configuration }
}
const operations = {
  /* unattributed deposits: every action is owner-gated and audited by the
     backend; association needs written proof, nothing is force-confirmed */
  deposits: {
    identifier: uuid,
    actions: ['associate', 'close', 'refundCase', 'reverify'],
    request: (record, body) => {
      const root = `/admin/payments/transactions/${record}`
      if (body.action === 'associate') {
        if (!uuid.test(String(body.orderId || ''))) throw fail(400, 'invalid_request')
        return [root + '/associate', { orderId: body.orderId, note: textOf(body.note, 1000), evidence: textOf(body.evidence, 1000) }]
      }
      if (body.action === 'close') return [root + '/close', { note: textOf(body.note, 1000), resolution: body.resolution === 'ignored' ? 'ignored' : 'resolved' }]
      if (body.action === 'refundCase') return [root + '/refund-case', { note: textOf(body.note, 1000), reason: ['late_payment', 'unmatched', 'operator'].includes(body.reason) ? body.reason : 'operator' }]
      return [root + '/reverify', {}]
    },
  },
  /* refund liabilities: Openfund never sends money; the owner records each
     reviewed step of a refund executed from the treasury */
  refunds: {
    identifier: uuid,
    actions: ['review', 'approve', 'reject', 'sent', 'failed', 'confirm'],
    request: (record, body) => {
      const root = `/admin/payments/refunds/${record}/${body.action}`
      const note = textOf(body.note, 1000)
      if (body.action === 'approve') return [root, { note, destination: textOf(body.destination, 100), chainId: Number(body.chainId) }]
      if (body.action === 'sent') return [root, { note, chainId: Number(body.chainId), refundTxHash: txHashOf(body.refundTxHash) }]
      return [root, { note }]
    },
  },
  paymentSettings: {
    identifier: value => ['wallet', 'manual', 'depay'].includes(value),
    actions: ['enable', 'disable'],
    request: (record, body) => ['/admin/payments/settings', { method: record, enabled: body.action === 'enable', reason: textOf(body.reason, 500) }],
  },
  partners: {
    identifier: uuid,
    actions: ['review', 'approve', 'reject', 'suspend', 'reinstate'],
    request: (record, { action, reason, verification }) => [
      `/admin/partners/applications/${record}/decision`,
      { action, note: textOf(reason, 2000), ...(verification && typeof verification === 'object' && !Array.isArray(verification) ? { verification } : {}) }],
  },
  commissions: {
    identifier: uuid,
    actions: ['payout'],
    request: (record, body) => ['/admin/partners/commissions/payout',
      { ambassadorUserId: record, amountUsd: moneyOf(body.amountUsd), payoutReference: textOf(body.payoutReference, 200) }],
  },
  users: {
    identifier: uuid,
    actions: ['suspend', 'activate'],
    request: (record, { action, reason }) => [
      `/admin/users/${record}/status`,
      { status: action === 'suspend' ? 'suspended' : 'active', reason: textOf(reason, 500) }],
  },
  expenses: {
    identifier: value => value === 'new' || uuid.test(value),
    actions: ['create', 'verify', 'void', 'paid'],
    request: (record, body) => {
      if (body.action === 'create') {
        if (record !== 'new') throw fail(404, 'not_found')
        return ['/admin/economy/expenses', {
          category: textOf(body.category, 60), description: textOf(body.description, 300),
          amount: moneyOf(body.amount), currency: textOf(body.currency, 8), amountUsd: moneyOf(body.amountUsd),
          fxReference: textOf(body.fxReference, 200, false), incurredOn: textOf(body.incurredOn, 10),
          periodStart: textOf(body.periodStart, 10, false), periodEnd: textOf(body.periodEnd, 10, false),
          source: textOf(body.source, 20), invoiceReference: textOf(body.invoiceReference, 200),
          documentUrl: textOf(body.documentUrl, 500, false) }]
      }
      if (!uuid.test(record)) throw fail(404, 'not_found')
      return [`/admin/economy/expenses/${record}/${body.action}`,
        body.action === 'paid' ? { paymentReference: textOf(body.paymentReference, 200) } : {}]
    },
  },
  reserves: {
    identifier: value => value === 'new',
    actions: ['set'],
    request: (record, body) => ['/admin/economy/reserves',
      { kind: textOf(body.kind, 20), amountUsd: String(Number(body.amountUsd) >= 0 ? body.amountUsd : (() => { throw fail(400, 'invalid_request') })()), note: textOf(body.note, 500) }],
  },
  obligations: {
    identifier: value => value === 'new' || uuid.test(value),
    actions: ['create', 'settled', 'void'],
    request: (record, body) => {
      if (body.action === 'create') {
        if (record !== 'new') throw fail(404, 'not_found')
        return ['/admin/economy/obligations', {
          kind: textOf(body.kind, 20), description: textOf(body.description, 300), amountUsd: moneyOf(body.amountUsd),
          dueOn: textOf(body.dueOn, 10, false), reference: textOf(body.reference, 200) }]
      }
      if (!uuid.test(record)) throw fail(404, 'not_found')
      return [`/admin/economy/obligations/${record}/close`, { status: body.action }]
    },
  },
  adjustments: {
    identifier: uuid,
    actions: ['refund', 'chargeback'],
    request: (record, body) => [`/admin/economy/payments/${record}/adjustments`,
      { kind: body.action, amountUsd: moneyOf(body.amountUsd), reference: textOf(body.reference, 200), reason: textOf(body.reason, 500, false) }],
  },
  finance: {
    identifier: value => value === 'treasury',
    actions: ['refresh'],
    request: () => ['/admin/economy/treasury/refresh', {}],
  },
  /* internal user notes (append-only) and operator tags */
  userNotes: {
    identifier: uuid,
    actions: ['add'],
    request: (record, body) => [`/admin/console/users/${record}/notes`, { note: textOf(body.note, 2000) }],
  },
  userTags: {
    identifier: uuid,
    actions: ['set'],
    request: (record, body) => {
      const tags = String(body.tags ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean)
      if (tags.length > 20 || tags.some(v => !/^[a-z0-9][a-z0-9-]{0,31}$/.test(v))) throw fail(400, 'invalid_tags')
      return [`/admin/console/users/${record}/tags`, { tags, reason: textOf(body.reason, 1000) }]
    },
  },
  /* owner decisions on a challenge; the engine refuses settlement without fresh marks */
  challengeActions: {
    identifier: uuid,
    actions: ['extend', 'void', 'fail', 'pass'],
    request: (record, body) => {
      const days = body.action === 'extend' ? Number(body.days) : null
      if (body.action === 'extend' && (!Number.isInteger(days) || days < 1 || days > 90)) throw fail(400, 'invalid_days')
      return [`/admin/console/challenges/${record}/action`, { action: body.action, reason: textOf(body.reason, 500), ...(days ? { days } : {}) }]
    },
  },
  /* issue a challenge or a funded account (single-use internal coupon bound to the wallet) */
  entitlements: {
    identifier: value => value === 'new',
    actions: ['issue'],
    request: (_record, body) => {
      if (typeof body.walletAddress !== 'string' || !wallet.test(body.walletAddress.trim())) throw fail(400, 'invalid_wallet')
      const size = Number(body.accountSizeUsd)
      if (!Number.isFinite(size) || size <= 0) throw fail(400, 'invalid_request')
      return ['/admin/console/entitlements', { walletAddress: body.walletAddress.trim(), planSlug: textOf(body.planSlug, 40), accountSizeUsd: size,
        funded: body.funded === true, expiresDays: Number(body.expiresDays) || 30, reason: textOf(body.reason, 1000) }]
    },
  },
  /* Premium League: schedule/rules before the start, then the owner freezes
     the standings and issues the awards; the backend refuses out-of-order steps */
  tournaments: {
    identifier: value => tournamentSlug.test(value),
    actions: ['configure', 'finalize', 'issueAwards'],
    request: (record, body) => {
      const reason = textOf(body.reason, 1000)
      if (body.action === 'finalize') return [`/admin/tournaments/${record}/finalize`, { reason }]
      if (body.action === 'issueAwards') return [`/admin/tournaments/${record}/awards/issue`, { reason }]
      const out = { reason }
      if (body.startsAt) { const d = new Date(textOf(body.startsAt, 40)); if (Number.isNaN(d.getTime())) throw fail(400, 'invalid_date'); out.startsAt = d.toISOString() }
      if (body.tradingDays != null && body.tradingDays !== '') out.tradingDays = Number(body.tradingDays)
      if (body.status) { if (!['draft', 'registration', 'cancelled'].includes(body.status)) throw fail(400, 'invalid_status'); out.status = body.status }
      return [`/admin/tournaments/${record}/configure`, out]
    },
  },
  tournamentEntries: {
    identifier: uuid,
    actions: ['disqualify'],
    request: (record, body) => {
      if (!tournamentSlug.test(String(body.slug || ''))) throw fail(400, 'invalid_request')
      return [`/admin/tournaments/${body.slug}/registrations/${record}/disqualify`, { reason: textOf(body.reason, 1000) }]
    },
  },
  tournamentAwards: {
    identifier: uuid,
    actions: ['update'],
    request: (record, body) => {
      if (!tournamentSlug.test(String(body.slug || ''))) throw fail(400, 'invalid_request')
      if (!['pending', 'in_progress', 'fulfilled', 'cancelled'].includes(body.status)) throw fail(400, 'invalid_status')
      return [`/admin/tournaments/${body.slug}/awards/${record}`, { status: body.status, note: textOf(body.note, 1000, false), reason: textOf(body.reason, 1000) }]
    },
  },
  /* migration review: a decision needs the checklist, KYC and name match
     (approve) and always a reason; the backend refuses anything else */
  migrations: {
    identifier: uuid,
    actions: ['approve', 'reject'],
    request: (record, body) => {
      const out = { decision: body.action, reason: textOf(body.reason, 1000) }
      if (body.action === 'approve') {
        const size = Number(body.approvedMaxSizeUsd)
        if (!Number.isFinite(size) || size <= 0) throw fail(400, 'invalid_size')
        Object.assign(out, { approvedMaxSizeUsd: size, kycVerified: body.kycVerified === true, nameMatched: body.nameMatched === true })
      }
      return [`/admin/migration/requests/${record}/decide`, out]
    },
  },
  migrationPasses: {
    identifier: uuid,
    actions: ['revoke'],
    request: (record, body) => [`/admin/migration/passes/${record}/revoke`, { reason: textOf(body.reason, 1000) }],
  },
  migrationFirms: {
    identifier: value => value === 'new' || uuid.test(value),
    actions: ['save', 'settings', 'logo', 'removeLogo'],
    request: (record, body) => body.action === 'logo' || body.action === 'removeLogo'
      ? (uuid.test(record) ? [`/admin/migration/firms/${record}/logo`, body.action === 'removeLogo' ? { remove: true, reason: textOf(body.reason, 1000) }
        : { contentType: textOf(body.contentType, 20), dataBase64: textOf(body.dataBase64, 280_000), reason: textOf(body.reason, 1000) }] : (() => { throw fail(400, 'invalid_request') })())
      : body.action === 'save'
      ? ['/admin/migration/firms', { name: textOf(body.name, 60), status: body.status === 'inactive' ? 'inactive' : 'active', websiteUrl: textOf(body.websiteUrl, 200, false),
          programTypes: textOf(body.programTypes, 600, false), evidenceTypes: textOf(body.evidenceTypes, 600, false), reason: textOf(body.reason, 1000) }]
      : ['/admin/migration/settings', { minPayouts: body.minPayouts, windowMonths: body.windowMonths, retentionDays: body.retentionDays, passExpiresDays: body.passExpiresDays,
          plans: Array.isArray(body.plans) ? body.plans : undefined, reason: textOf(body.reason, 1000) }],
  },
  /* plan administration: publish (diff previewed first), retire, reactivate */
  plans: {
    identifier: value => /^[a-z0-9][a-z0-9-]{1,39}$/.test(value),
    actions: ['publish', 'retire', 'reactivate'],
    request: (record, body) => body.action === 'publish'
      ? ['/admin/console/plans/publish', { ...planDraft(record, body), reason: textOf(body.reason, 1000) }]
      : [`/admin/console/plans/${record}/${body.action}`, { reason: textOf(body.reason, 1000) }],
  },
  coupons: {
    identifier: value => value === 'new' || uuid.test(value),
    actions: ['create', 'update', 'activate', 'disable', 'revoke'],
    request: (record, body) => {
      const fields = {}
      for (const key of ['name', 'description']) if (body[key] !== undefined) fields[key] = textOf(body[key], key === 'name' ? 200 : 1000, false)
      for (const key of ['startsAt', 'expiresAt']) if (body[key] !== undefined) fields[key] = body[key] === null ? null : textOf(body[key], 40, false)
      for (const key of ['maxRedemptions', 'perUserLimit']) if (body[key] !== undefined && body[key] !== null) {
        if (!Number.isInteger(Number(body[key])) || Number(body[key]) <= 0) throw fail(400, 'invalid_request')
        fields[key] = Number(body[key])
      }
      for (const key of ['challengePlanIds', 'allowedUserIds']) if (body[key] !== undefined) {
        if (body[key] !== null && (!Array.isArray(body[key]) || body[key].length > 50 || body[key].some(v => !uuid.test(String(v))))) throw fail(400, 'invalid_request')
        fields[key] = body[key]
      }
      if (body.accountSizes !== undefined) {
        if (body.accountSizes !== null && (!Array.isArray(body.accountSizes) || body.accountSizes.some(v => !Number.isFinite(Number(v)) || Number(v) <= 0))) throw fail(400, 'invalid_request')
        fields.accountSizes = body.accountSizes
      }
      if (body.action === 'create') {
        if (record !== 'new') throw fail(404, 'not_found')
        if (!['percent', 'fixed'].includes(body.kind)) throw fail(400, 'invalid_request')
        if (body.activate !== undefined && typeof body.activate !== 'boolean') throw fail(400, 'invalid_request')
        return ['/admin/coupons', { ...fields, code: textOf(body.code, 40), kind: body.kind, value: moneyOf(body.value), activate: body.activate === true }]
      }
      if (!uuid.test(record)) throw fail(404, 'not_found')
      const status = { activate: 'active', disable: 'inactive', revoke: 'revoked' }[body.action]
      return [`/admin/coupons/${record}`, { ...fields, ...(status ? { status } : {}) }]
    },
  },
}

function origin(value, name) {
  const url = new URL(value)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.href !== url.origin + '/' || url.username || url.password ||
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw new Error('Invalid ' + name)
  return url.origin
}

export function loadConfig(env = process.env) {
  const config = {
    origin: origin(env.BACKSTAGE_ORIGIN, 'BACKSTAGE_ORIGIN'),
    backend: origin(env.BACKSTAGE_BACKEND_ORIGIN, 'BACKSTAGE_BACKEND_ORIGIN'),
    cms: origin(env.BACKSTAGE_DIRECTUS_ORIGIN, 'BACKSTAGE_DIRECTUS_ORIGIN'),
    realSettlement: env.BACKSTAGE_REAL_SETTLEMENT === 'true',
    owner: env.BACKSTAGE_OWNER,
    verifier: env.BACKSTAGE_PASSWORD_VERIFIER,
    credential: env.BACKSTAGE_BACKEND_TOKEN,
    contentToken: env.BACKSTAGE_DIRECTUS_TOKEN || null,
    /* IRAN runtime origin for the read-only regional status (ADR 0043); its
       public endpoints only, so no credential is ever sent to it */
    iranBackend: env.BACKSTAGE_IRAN_ORIGIN ? origin(env.BACKSTAGE_IRAN_ORIGIN, 'BACKSTAGE_IRAN_ORIGIN') : null,
    /* Render sets RENDER_GIT_COMMIT for the deployed commit */
    releaseCommit: /^[0-9a-f]{40}$/.test(env.RENDER_GIT_COMMIT || '') ? env.RENDER_GIT_COMMIT : null,
  }
  if (config.contentToken !== null && !/^[!-~]{16,512}$/.test(config.contentToken)) throw new Error('Invalid BACKSTAGE_DIRECTUS_TOKEN')
  if (!/^[A-Za-z0-9._@-]{2,50}$/.test(config.owner || '') ||
      !validVerifier(config.verifier) ||
      !/^[!-~]{24,256}$/.test(config.credential || '')) throw new Error('Backstage owner provisioning is incomplete')
  if (env.NODE_ENV === 'production' && [config.origin, config.backend, config.cms, config.iranBackend].some(url => url && !url.startsWith('https:')))
    throw new Error('Backstage production origins must use HTTPS')
  return config
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

async function json(req, limit = 8192) {
  if (req.headers['content-type'] !== 'application/json') throw fail(415, 'invalid_request')
  const chunks = []
  let bytes = 0
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length
    if (bytes > limit) throw fail(413, 'invalid_request')
    chunks.push(chunk)
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks))
    if (value && typeof value === 'object' && !Array.isArray(value)) return value
  } catch {}
  throw fail(400, 'invalid_request')
}

export function createBackstage(config, { now = Date.now, audit = event => console.log(JSON.stringify(event)), contentFetch } = {}) {
  const content = createContentApi({ cms: config.cms, token: config.contentToken, ...(contentFetch ? { fetchImpl: contentFetch } : {}) })
  /* `backend` is a hoisted function declaration below */
  const campaigns = createCampaignsApi({ cms: config.cms, token: config.contentToken, backend: (...a) => backend(...a), ...(contentFetch ? { fetchImpl: contentFetch } : {}) })
  const secure = config.origin.startsWith('https:')
  const cookieName = secure ? '__Host-openfund-backstage' : 'openfund-backstage-local'
  const duration = 8 * 60 * 60_000
  const idleDuration = 30 * 60_000
  const windowSize = 5 * 60_000
  let session, attempts = { until: 0, count: 0 }, hashing = 0
  const cookie = (id, maxAge) => `${cookieName}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`

  async function authenticate(password, usernameMatches = true) {
    if (attempts.until <= now()) attempts = { until: now() + windowSize, count: 0 }
    if (attempts.count >= 10 || hashing >= 2) throw fail(429, 'try_later')
    attempts.count++
    hashing++
    try {
      if (!(await verifyPassword(password, config.verifier)) || !usernameMatches) throw fail(401, 'invalid_credentials')
      attempts.count = 0
    } finally { hashing-- }
  }

  /* Public regional status of another region (no Authorization, no cookies,
     no redirects followed): /runtime/status, /ready and /version. */
  async function publicProbe(base, path) {
    const res = await fetch(new URL(path, base), { redirect: 'error', signal: AbortSignal.timeout(8_000), headers: { Accept: 'application/json' } })
    if (!res.ok && res.status !== 503) { await res.body?.cancel(); throw fail(502, 'region_unreachable') }
    return res.json()
  }
  const regionRow = (name, runtime, readiness, version) => ({
    name, reachable: runtime.status === 'fulfilled', region: runtime.value?.region, mode: runtime.value?.mode, epoch: runtime.value?.epoch,
    roles: runtime.value?.roles, ready: readiness.value?.ok === true, database: readiness.value?.database?.ok === true,
    engine: readiness.value?.engine?.running === true, freshMarks: readiness.value?.marketData?.freshMarks ?? null,
    execution: readiness.value?.marketData?.execution ?? null, version: version.value?.version, commit: version.value?.commit,
  })

  async function backend(path, method = 'GET', body, correlationId, { text = false } = {}) {
    const target = new URL(config.backend)
    const queryStart = path.indexOf('?')
    // Assign URL components independently so operation data cannot change the origin.
    target.pathname = queryStart === -1 ? path : path.slice(0, queryStart)
    if (queryStart !== -1) target.search = path.slice(queryStart)
    try {
      const res = await fetch(target, {
        method, redirect: 'error', signal: AbortSignal.timeout(12_000),
        headers: { Authorization: `Bearer ${config.credential}`, 'X-Admin-Actor': config.owner,
          'X-Request-Id': correlationId, ...(body && { 'Content-Type': 'application/json' }) },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        /* a plan the shared validator rejects: pass its problem list through */
        if (res.status === 422) {
          const body = await res.json().catch(() => ({}))
          throw Object.assign(fail(422, 'plan_invalid'), { details: Array.isArray(body.details) ? body.details.slice(0, 50).map(String) : [] })
        }
        /* name the reason (a bounded snake_case code, never free text) so the
           console can show it, e.g. settlement_unavailable or no_time_limit */
        if ([400, 404, 409].includes(res.status)) {
          const code = String((await res.json().catch(() => ({}))).error ?? '')
          throw Object.assign(fail(res.status, 'backend_rejected'), /^[a-z][a-z0-9_]{2,60}$/.test(code) ? { details: [code] } : {})
        }
        await res.body?.cancel()
        throw fail(res.status === 429 ? 429 : 502, 'backend_rejected')
      }
      return text ? await res.text() : await res.json()
    } catch (error) {
      if (error.status) throw error
      throw fail(502, 'backend_unavailable')
    }
  }

  async function confirmOwner(current, password, correlationId) {
    await authenticate(password)
    const runtime = await backend('/runtime/status', 'GET', undefined, correlationId)
    if (runtime.region !== 'GLOBAL' || runtime.mode !== 'GLOBAL_CONNECTED') throw fail(409, 'wrong_region')
    if (current !== session || now() >= Math.min(current.expires, current.idle)) throw fail(401, 'sign_in_required')
  }

  const server = createServer(async (req, res) => {
    const correlationId = randomUUID()
    const log = (action, outcome, target) => audit({ event: 'backstage', timestamp: new Date(now()).toISOString(),
      actor: config.owner, action, outcome, target, correlationId })
    res.setHeader('X-Request-Id', correlationId)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow')
    /* frame-src: the read-only site preview in the Content workspace only */
    res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' blob: data:; connect-src 'self'; frame-src ${config.backend}; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`)
    if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000')
    try {
      const url = new URL(req.url, config.origin)
      const path = url.pathname
      /* release identity (public, like the site's /version): the release
         deployment refuses to finish until Backstage runs the released commit */
      if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true, commit: config.releaseCommit })
      if (req.headers.host !== new URL(config.origin).host || url.origin !== config.origin) throw fail(404, 'not_found')
      if (req.method === 'GET' && Object.hasOwn(staticFiles, path)) {
        const [file, contentType] = staticFiles[path]
        const data = await readFile(new URL(file, import.meta.url))
        res.writeHead(200, { 'Content-Type': contentType })
        return res.end(data)
      }
      if (!path.startsWith('/api/')) throw fail(404, 'not_found')
      if (!['GET', 'POST'].includes(req.method)) throw fail(405, 'not_found')
      if (req.method === 'POST' && req.headers.origin !== config.origin) throw fail(403, 'invalid_origin')

      if (path === '/api/login' && req.method === 'POST') {
        try {
          const { username, password } = await json(req)
          await authenticate(password, username === config.owner)
          session = { id: token(), csrf: token(), expires: now() + duration, idle: now() + idleDuration }
          res.setHeader('Set-Cookie', cookie(session.id, duration / 1000))
          log('sign_in', 'success')
          return send(res, 200, { owner: config.owner, csrf: session.csrf, cms: config.cms })
        } catch (error) {
          log('sign_in', 'denied')
          throw error
        }
      }

      const id = (req.headers.cookie || '').split(/;\s*/).find(value => value.startsWith(cookieName + '='))?.slice(cookieName.length + 1)
      const current = session
      if (!current || id !== current.id || now() >= Math.min(current.expires, current.idle))
        throw fail(401, 'sign_in_required')
      if (req.method === 'POST' && req.headers['x-csrf-token'] !== current.csrf) throw fail(403, 'invalid_origin')
      current.idle = now() + idleDuration
      if (path === '/api/session' && req.method === 'GET')
        return send(res, 200, { owner: config.owner, csrf: current.csrf, cms: config.cms })
      if (path === '/api/logout' && req.method === 'POST') {
        session = undefined
        res.setHeader('Set-Cookie', cookie('', 0))
        log('sign_out', 'success')
        return send(res, 200, { ok: true })
      }

      /* Marketing: promotional popups and announcement bars (campaigns.js).
         Reads need the owner session; writes also need CSRF (checked above)
         and password re-entry in the GLOBAL region, like every content write. */
      if (path.startsWith('/api/campaigns/')) {
        const action = path.slice('/api/campaigns/'.length)
        if (req.method === 'GET') {
          const q = url.searchParams
          if (action === 'list') return send(res, 200, { rows: await campaigns.list(q.get('placement')) })
          if (action === 'stats') return send(res, 200, await campaigns.stats(correlationId))
          if (action === 'coupon') return send(res, 200, { promotable: await campaigns.couponStatus(String(q.get('code') || '').trim().toUpperCase().slice(0, 40), correlationId) })
          if (action.startsWith('asset/')) {
            const image = await campaigns.asset(action.slice('asset/'.length), q.get('w'))
            res.writeHead(200, { 'Content-Type': image.type, 'Cache-Control': 'private, max-age=300' })
            return res.end(image.body)
          }
          throw fail(404, 'not_found')
        }
        if (action === 'upload') {
          const body = await json(req, 4.5 * 1024 * 1024)
          const file = await campaigns.upload(body)
          log('campaigns.upload', 'success', file.id)
          return send(res, 200, file)
        }
        if (!['save', 'state'].includes(action)) throw fail(404, 'not_found')
        const body = await json(req, 65536)
        const write = action === 'save' ? await campaigns.prepareSave(body, correlationId) : await campaigns.prepareState(body, correlationId)
        try {
          await confirmOwner(current, body.password, correlationId)
          const id = await write.apply()
          log('campaigns.' + action, 'success', String(id))
          return send(res, 200, { ok: true, id })
        } catch (error) {
          log('campaigns.' + action, 'denied', String(write.target))
          throw error
        }
      }

      if (path.startsWith('/api/content/')) {
        const action = path.slice('/api/content/'.length)
        if (req.method === 'GET') {
          const q = url.searchParams
          if (action === 'catalog') return send(res, 200, { ...(await content.catalog()), writable: content.writable, site: config.backend, cms: config.cms })
          if (action === 'fields') return send(res, 200, await content.fields({ view: q.get('view'), locale: q.get('locale'),
            q: q.get('q') ?? '', offset: q.get('offset') ?? 0, shared: q.get('shared') === '1' }))
          if (action === 'surface') return send(res, 200, await content.surface({ collection: q.get('collection'), locale: q.get('locale') }))
          if (action === 'protected') return send(res, 200, await content.protectedSettings())
          if (action === 'media') return send(res, 200, await content.media())
          throw fail(404, 'not_found')
        }
        if (action === 'upload') {
          const file = await content.upload(await json(req, 4.5 * 1024 * 1024))
          log('content.upload', 'success', file.id)
          return send(res, 200, file)
        }
        const prepare = { save: content.prepareSave, status: content.prepareStatus, create: content.prepareCreate, reorder: content.prepareReorder, protected: content.prepareProtected }[action]
        if (!prepare) throw fail(404, 'not_found')
        const body = await json(req, 65536)
        const write = await prepare(body)
        try {
          await confirmOwner(current, body.password, correlationId)
          await content.apply(write)
          log('content.' + action, 'success', write.target)
          return send(res, 200, { ok: true })
        } catch (error) {
          log('content.' + action, 'denied', write.target)
          throw error
        }
      }

      if (path === '/api/planPreview' && req.method === 'POST') {
        const body = await json(req, 65536)
        if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(String(body.slug || ''))) throw fail(400, 'invalid_slug')
        return send(res, 200, await backend('/admin/console/plans/preview', 'POST', planDraft(body.slug, body), correlationId))
      }
      if (path.startsWith('/api/userProfile/') && req.method === 'GET') {
        const id = path.slice('/api/userProfile/'.length)
        if (!uuid.test(id)) throw fail(404, 'not_found')
        return send(res, 200, await backend('/admin/console/users/' + id + '/profile', 'GET', undefined, correlationId))
      }
      /* firm logos (public bytes from the backend; images only, never HTML) */
      if (path.startsWith('/api/migrationFirmLogo/') && req.method === 'GET') {
        const id = path.slice('/api/migrationFirmLogo/'.length)
        if (!uuid.test(id)) throw fail(404, 'not_found')
        const upstream = await fetch(new URL('/migration/firms/' + id + '/logo', config.backend), { redirect: 'error', signal: AbortSignal.timeout(10_000) }).catch(() => null)
        const type = upstream?.headers.get('content-type') || ''
        if (!upstream?.ok || !['image/png', 'image/jpeg', 'image/webp'].includes(type)) { await upstream?.body?.cancel(); throw fail(404, 'not_found') }
        const bytes = Buffer.from(await upstream.arrayBuffer())
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': bytes.length, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' })
        return res.end(bytes)
      }
      if (path === '/api/siteSearchTerms' && req.method === 'POST') {
        const body = await json(req)
        const [itemPath, item] = siteSearchTerm(body)
        if (!config.contentToken) throw fail(409, 'content_read_only')
        try {
          await confirmOwner(current, body.password, correlationId)
          const target = new URL(config.cms)
          target.pathname = itemPath
          const r = await fetch(target, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12_000),
            headers: { Authorization: `Bearer ${config.contentToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
          if (!r.ok) { await r.body?.cancel(); throw fail(502, 'cms_rejected') }
          const created = (await r.json())?.data
          log('siteSearch.' + body.kind, 'success', String(created?.id ?? ''))
          return send(res, 200, { ok: true, id: created?.id ?? null })
        } catch (error) {
          log('siteSearch.' + body.kind, 'denied', '')
          throw error
        }
      }
      const [, , section, record, extra] = path.split('/')
      /* write-only sections (notes, tags, challenge decisions) have no list route */
      const writeOnly = req.method === 'POST' && Object.hasOwn(operations, section)
      if (extra !== undefined || (!Object.hasOwn(routes, section) && !writeOnly)) throw fail(404, 'not_found')
      const [endpoint, list, filters] = routes[section] ?? []
      if (req.method === 'GET') {
        if (section === 'siteSearch' && record !== undefined) {
          if (record !== 'export.csv') throw fail(404, 'not_found')
          const q = new URLSearchParams()
          for (const [name, re] of Object.entries(SEARCH_FILTERS)) { const v = url.searchParams.get(name); if (v !== null && re.test(v)) q.set(name, v) }
          const csv = await backend('/admin/search/export.csv?' + q, 'GET', undefined, correlationId, { text: true })
          res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="site-search.csv"', 'Cache-Control': 'no-store' })
          return res.end(csv)
        }
        if (section === 'support' && supportRef.test(record || ''))
          return send(res, 200, await backend(endpoint + '/' + encodeURIComponent(record), 'GET', undefined, correlationId))
        if (section === 'payments' && uuid.test(record || ''))
          return send(res, 200, await backend('/admin/payments/lookup?orderId=' + encodeURIComponent(record), 'GET', undefined, correlationId))
        if (section === 'tournaments' && record !== undefined) {
          if (!tournamentSlug.test(record)) throw fail(404, 'not_found')
          const root = '/admin/tournaments/' + record
          const [list, registrations, standings, awards, signals] = await Promise.all([
            backend('/admin/tournaments', 'GET', undefined, correlationId),
            backend(root + '/registrations', 'GET', undefined, correlationId),
            backend(root + '/standings', 'GET', undefined, correlationId),
            backend(root + '/awards', 'GET', undefined, correlationId),
            backend(root + '/correlation', 'GET', undefined, correlationId),
          ])
          const tournament = list.tournaments?.find(row => row.slug === record)
          if (!tournament) throw fail(404, 'not_found')
          return send(res, 200, { tournament, ...registrations, ...standings, ...awards, signals })
        }
        if (record !== undefined && !uuid.test(record)) throw fail(404, 'not_found')
        if (section === 'migrations' && record) return send(res, 200, await backend('/admin/migration/requests/' + encodeURIComponent(record), 'GET', undefined, correlationId))
        if (section === 'challenges' && record) return send(res, 200, await backend('/admin/backstage/challenges/' + encodeURIComponent(record), 'GET', undefined, correlationId))
        if (section === 'users' && record) return send(res, 200, await backend(endpoint + '/' + encodeURIComponent(record), 'GET', undefined, correlationId))
        if (section === 'partners' && record) return send(res, 200, await backend(endpoint + '/' + encodeURIComponent(record), 'GET', undefined, correlationId))
        if (section === 'coupons' && record) {
          const root = endpoint + '/' + encodeURIComponent(record)
          const [redemptions, orders, trail] = await Promise.all([
            backend(root + '/redemptions', 'GET', undefined, correlationId),
            backend(root + '/orders', 'GET', undefined, correlationId),
            backend(root + '/audit', 'GET', undefined, correlationId),
          ])
          return send(res, 200, { ...redemptions, ...orders, ...trail })
        }
        if (section === 'payouts' && record) {
          const root = '/admin/withdrawals/' + encodeURIComponent(record)
          const [detail, trail, thread] = await Promise.all([
            backend(root + '/reward', 'GET', undefined, correlationId),
            backend(root + '/audit', 'GET', undefined, correlationId),
            backend(root + '/thread', 'GET', undefined, correlationId),
          ])
          return send(res, 200, { ...detail, ...trail, thread, realSettlement: config.realSettlement === true })
        }
        if (record !== undefined) throw fail(404, 'not_found')
        if (section === 'system') {
          const [runtime, readiness, version] = await Promise.allSettled([
            backend(endpoint, 'GET', undefined, correlationId),
            backend('/ready', 'GET', undefined, correlationId),
            backend('/version', 'GET', undefined, correlationId),
          ])
          const r = runtime.value
          const regions = [regionRow('GLOBAL', runtime, readiness, version)]
          if (config.iranBackend) regions.push(regionRow('IRAN', ...await Promise.allSettled(
            ['/runtime/status', '/ready', '/version'].map(p => publicProbe(config.iranBackend, p)))))
          return send(res, 200, { region: r?.region, mode: r?.mode, epoch: r?.epoch,
            backendReady: readiness.value?.ok === true, version: version.value?.version, commit: version.value?.commit, regions })
        }
        const target = new URL(endpoint, config.backend)
        for (const name of filters || []) {
          const value = url.searchParams.get(name)
          if (value !== null && value.length <= 80) target.searchParams.set(name, value)
        }
        if (filters?.includes('offset')) target.searchParams.set('limit', String(PAGE_SIZE))
        const data = await backend(target.pathname + target.search, 'GET', undefined, correlationId)
        if (section === 'payouts' && target.searchParams.get('scope') === 'test' &&
            data.withdrawals?.some(row => row.test_mode !== true))
          return send(res, 200, { rows: [], total: 0 })
        return send(res, 200, list ? { rows: data[list], total: data.total ?? null } : data)
      }
      if (section === 'controlled' && ['instant', 'standard'].includes(record)) {
        const { action, walletAddress, password } = await json(req)
        if (!['issue', 'revoke'].includes(action) || (action === 'issue' && (typeof walletAddress !== 'string' || !wallet.test(walletAddress))))
          throw fail(400, 'invalid_request')
        try {
          await confirmOwner(current, password, correlationId)
          const revoke = action === 'revoke'
          const data = await backend(endpoint + (revoke ? '/' + record + '/revoke' : ''), 'POST',
            revoke ? {} : { profile: record, walletAddress }, correlationId)
          log('controlled.' + action, 'success', data.id)
          return send(res, 200, data)
        } catch (error) {
          log('controlled.' + action, 'denied', record)
          throw error
        }
      }
      /* table-driven owner mutations (same session/CSRF/password/region gate) */
      if (Object.hasOwn(operations, section)) {
        const spec = operations[section]
        const body = await json(req, section === 'plans' ? 65536 : section === 'migrationFirms' ? 300_000 : 8192)
        if (!spec.actions.includes(body.action) || typeof record !== 'string' ||
            !(spec.identifier instanceof RegExp ? spec.identifier.test(record) : spec.identifier(record)))
          throw fail(400, 'invalid_request')
        const [destination, payload] = spec.request(record, body)
        try {
          await confirmOwner(current, body.password, correlationId)
          const data = await backend(destination, 'POST', payload, correlationId)
          log(section + '.' + body.action, 'success', record)
          return send(res, 200, data ?? { ok: true })
        } catch (error) {
          log(section + '.' + body.action, 'denied', record)
          throw error
        }
      }
      const permitted = {
        reviews: ['approve', 'reject'],
        payouts: ['approve', 'reject', 'simulate', 'settle', 'reply', 'resolve_appeal', 'ib_approve', 'ib_paid'],
        support: [...supportStatuses, 'reply'],
        payments: ['reverify'],
      }
      const identifier = section === 'support' ? supportRef : uuid
      if (!Object.hasOwn(permitted, section) || !identifier.test(record || '')) throw fail(404, 'not_found')
      const { action, reason, password, payoutRef, policyVersion } = await json(req)
      if (!permitted[section].includes(action) || (action !== 'reverify' && (typeof reason !== 'string' || reason.length > 500 || !reason.trim())))
        throw fail(400, 'invalid_request')
      const settlement = action === 'settle'
      if (settlement && config.realSettlement !== true) throw fail(409, 'settlement_disabled')
      if ((settlement || action === 'ib_paid') && (typeof payoutRef !== 'string' || !payoutHash.test(payoutRef.trim())))
        throw fail(400, 'invalid_payout_hash')
      if (action === 'ib_paid' && config.realSettlement !== true) throw fail(409, 'settlement_disabled')
      if (action === 'ib_approve' && (typeof policyVersion !== 'string' || !policyVersion.trim() || policyVersion.length > 80))
        throw fail(400, 'invalid_request')
      const note = action === 'reverify' ? undefined : reason.trim()
      const payout = section === 'payouts'
      const correspondence = ['reply', 'resolve_appeal'].includes(action) && payout
      const ibSettlement = ['ib_approve', 'ib_paid'].includes(action)
      const supportReply = section === 'support' && action === 'reply'
      const destination = payout ? `/admin/withdrawals/${encodeURIComponent(record)}/${settlement ? 'settle-reward' : correspondence ? 'thread' : ibSettlement ? 'ib-settlement' : 'review'}` :
        section === 'payments' ? endpoint + '/' + encodeURIComponent(record) + '/reverify' :
        supportReply ? endpoint + '/' + encodeURIComponent(record) + '/thread' : endpoint + '/' + encodeURIComponent(record)
      const payload = correspondence ? { action, message: note } :
        settlement ? { action: 'paid', note, payoutRef: payoutRef.trim().toLowerCase() } :
        ibSettlement ? (action === 'ib_approve' ? { action: 'approve', policyVersion: policyVersion.trim() } : { action: 'paid', payoutRef: payoutRef.trim().toLowerCase() }) :
        payout ? { action, note } :
        supportReply ? { action: 'reply', message: note } :
        section === 'support' ? { status: action, internalNote: note } :
        section === 'payments' ? {} : { decision: action, note }
      try {
        await confirmOwner(current, password, correlationId)
        await backend(destination, 'POST', payload, correlationId)
        log(section + '.' + action, 'success', record)
        return send(res, 200, { ok: true })
      } catch (error) {
        log(section + '.' + action, 'denied', record)
        throw error
      }
    } catch (error) {
      if (!res.headersSent) send(res, error.status || 500, { error: error.status ? error.message : 'unexpected_error', ...(error.status && Array.isArray(error.details) ? { details: error.details } : {}) })
    }
  })
  server.requestTimeout = 20_000
  server.headersTimeout = 10_000
  return server
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    createBackstage(loadConfig()).listen(Number(process.env.PORT || 8400), '0.0.0.0', () => console.log('Backstage is listening'))
  } catch {
    console.error('Backstage configuration is incomplete or invalid')
    process.exitCode = 1
  }
}
