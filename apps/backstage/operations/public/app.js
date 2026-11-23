import { labels } from './strings.js'
import { createMarketing } from './marketing.js'
import { createBounty } from './bounty.js'
import { createGuides } from './guides.js'
import { arrow } from './dir-arrow.js'

let locale = localStorage.getItem('backstage-language') === 'fa' ? 'fa' : 'en'
let theme = localStorage.getItem('backstage-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
let session, revision = 0, showNav = false, collapsed = false
const header = document.querySelector('#header')
const workspace = document.querySelector('#workspace')
const dialog = document.querySelector('#decision')
const announcement = document.querySelector('#announcement')
const t = key => labels[key]?.[locale === 'fa' ? 1 : 0] ?? labels.notReported[locale === 'fa' ? 1 : 0]
const fmt = () => locale === 'fa' ? 'fa-IR' : 'en-US'
const date = value => value ? new Intl.DateTimeFormat(fmt(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
const number = value => value == null ? '—' : new Intl.NumberFormat(fmt()).format(Number(value))
const usd = value => value == null ? '—' : new Intl.NumberFormat(fmt(), { style: 'currency', currency: 'USD' }).format(Number(value))

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag)
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'on') for (const [event, fn] of Object.entries(value)) node.addEventListener(event, fn)
    else node.setAttribute(name, value)
  }
  for (const child of children.flat()) if (child != null) node.append(child instanceof Node ? child : String(child))
  return node
}

const button = (key, handler, cls = '') => el('button', { type: 'button', class: cls, on: { click: handler } }, t(key))
const technical = text => el('bdi', { dir: 'ltr', class: 'tech' }, text ?? '—')
const badge = text => el('span', { class: 'badge', 'data-status': text }, t(text))
const route = (key, params = {}) => '#/' + key + (Object.keys(params).length ? '?' + new URLSearchParams(params) : '')
const link = (key, params, content = t(key)) => el('a', { href: route(key, params) }, content)
const field = (key, input) => el('label', {}, el('span', {}, t(key)), input)

async function api(path, body) {
  const response = await fetch('/api/' + path, {
    method: body ? 'POST' : 'GET',
    ...(body && { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session?.csrf ?? '' }, body: JSON.stringify(body) }),
  })
  const data = await response.json()
  if (!response.ok) {
    if (response.status === 401 && data.error === 'sign_in_required') {
      session = null
      dialog.close()
      render()
    }
    throw Object.assign(new Error(data.error), { details: Array.isArray(data.details) ? data.details : [] })
  }
  return data
}

function chrome() {
  document.documentElement.lang = locale
  document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr'
  document.documentElement.dataset.theme = theme
  document.title = t('brand')
  const language = el('select', { 'aria-label': t('language'), on: { change: e => {
    locale = e.target.value
    localStorage.setItem('backstage-language', locale)
    dialog.close()
    render()
  } } }, el('option', { value: 'en' }, 'English'), el('option', { value: 'fa' }, 'فارسی'))
  language.value = locale
  header.replaceChildren(
    el('div', { class: 'brand' },
      session ? button('menu', () => {
      if (matchMedia('(max-width: 800px)').matches) {
        showNav = !showNav
        workspace.classList.toggle('nav-open', showNav)
      } else {
        collapsed = !collapsed
        workspace.classList.toggle('nav-collapsed', collapsed)
      }
    }) : null,
      el('img', { src: '/mark.svg', alt: '', width: '38', height: '38' }), el('strong', {}, t('brand'))),
    el('div', { class: 'tools' }, language, button(theme === 'light' ? 'dark' : 'light', () => {
      theme = theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('backstage-theme', theme)
      chrome()
    }), session ? button('signOut', async () => {
      try { await api('logout', {}); session = null; render() }
      catch (error) { announce(error.message) }
    }) : null))
}

function announce(key) {
  announcement.textContent = labels[key] ? t(key) : t('unexpected_error')
}

/* error message for a dialog: the known label plus any named reasons
   (backend codes such as settlement_unavailable, or the plan validator's list) */
function errorText(error) {
  const head = labels[error.message] ? t(error.message) : t('unexpected_error')
  const details = (error.details ?? []).map(d => labels[d] ? t(d) : d)
  return details.length ? `${head} — ${details.join(' · ')}` : head
}

function login() {
  const username = el('input', { name: 'username', required: '', autocomplete: 'username', dir: 'ltr' })
  const password = el('input', { name: 'password', required: '', type: 'password', autocomplete: 'current-password', dir: 'ltr' })
  const submit = el('button', { class: 'primary' }, t('signIn'))
  const feedback = el('p', { role: 'alert' })
  const form = el('form', { class: 'panel login', on: { submit: async event => {
    event.preventDefault()
    submit.disabled = true
    feedback.textContent = ''
    try {
      session = await api('login', { username: username.value, password: password.value })
      render()
    } catch (error) {
      feedback.textContent = errorText(error)
    } finally {
      password.value = ''
      submit.disabled = false
    }
  } } }, el('img', { src: '/mark.svg', alt: '', width: '60', height: '60' }),
  el('h1', {}, t('ownerAccess')), field('username', username), field('password', password), submit, feedback)
  workspace.className = 'entry'
  workspace.replaceChildren(form)
}

const groups = [
  ['prop', ['users', 'challenges', 'reviews', 'payouts', 'plans', 'entitlements']],
  ['tournamentGroup', ['tournaments']],
  ['siteSearchGroup', ['siteSearch']],
  ['migrationGroup', ['migrations', 'migrationFirms']],
  ['paymentsGroup', ['paymentOverview', 'paymentSearch', 'payments', 'deposits', 'refunds', 'paymentSettings']],
  ['business', ['coupons', 'support', 'partners', 'commissions']],
  ['financeGroup', ['finance', 'expenses', 'reserves', 'obligations']],
  ['operations', ['audit', 'risk', 'search', 'notifications', 'system']],
  ['contentGroup', ['content']],
  ['marketing', ['campaigns', 'announcements', 'guides']],
  ['securityGroup', ['bugBounty']],
]
/* some section keys collide with existing table labels */
const sectionLabels = { audit: 'auditViewer', search: 'searchx' }
const st = key => t(sectionLabels[key] ?? key)

function nav(selected) {
  const menuLink = key => {
    const item = link(key, {}, st(key))
    if (selected === key) item.setAttribute('aria-current', 'page')
    return item
  }
  return el('aside', { class: 'sidebar' }, el('nav', { 'aria-label': t('menu') }, menuLink('dashboard'),
    groups.map(([key, pages]) => el('details', { open: '' }, el('summary', {}, t(key)), pages.map(menuLink))),
    el('a', { href: session.cms, target: '_blank', rel: 'noopener noreferrer' }, t('cms'))))
}

const wallet = row => technical(row.wallet_address ?? row.recipient_wallet)
const uid = row => technical(row.id)
const plan = row => t(row.plan_slug)
const status = row => badge(row.status ?? 'requested')
const table = (heading, columns, rows) => el('section', { class: 'panel table-box' },
  heading ? el('h2', {}, t(heading)) : null,
  rows.length ? el('div', { class: 'table-scroll', tabindex: '0' }, el('table', {},
    el('thead', {}, el('tr', {}, columns.map(([key]) => el('th', { scope: 'col' }, t(key))))),
    el('tbody', {}, rows.map(row => el('tr', {}, columns.map(([, cell]) => el('td', {}, cell(row)))))))) : el('p', { class: 'empty' }, t('empty')))

function decide(section, row, action) {
  const reason = el('textarea', { required: '', maxlength: '500', rows: '3' })
  const password = el('input', { required: '', type: 'password', dir: 'ltr', autocomplete: 'current-password' })
  const hash = ['settle', 'ib_paid'].includes(action) ? el('input', { required: '', maxlength: '66', pattern: '0x[0-9a-fA-F]{64}', dir: 'ltr', spellcheck: 'false' }) : null
  const policy = action === 'ib_approve' ? el('input', { required: '', maxlength: '80', dir: 'ltr', spellcheck: 'false' }) : null
  const submit = el('button', { class: action === 'reject' ? 'danger' : 'primary' }, t('confirm'))
  const feedback = el('p', { role: 'alert' })
  const form = el('form', { on: { submit: async event => {
    event.preventDefault()
    submit.disabled = true
    try {
      await api(section + '/' + row.id, { action, reason: reason.value, password: password.value,
        ...(hash && { payoutRef: hash.value }), ...(policy && { policyVersion: policy.value }) })
      dialog.close()
      render()
      announce('success')
    } catch (error) {
      feedback.textContent = errorText(error)
    } finally {
      password.value = ''
      submit.disabled = false
    }
  } } }, el('h2', {}, t(action)), uid(row), action === 'reverify' ? null : field(['reply', 'resolve_appeal'].includes(action) ? 'message' : 'reason', reason), hash ? field('transactionHash', hash) : null, policy ? field('policyVersion', policy) : null, field('password', password),
  feedback, el('div', { class: 'tools' }, button('cancel', () => dialog.close()), submit))
  dialog.replaceChildren(form)
  dialog.showModal()
}

const decisionButtons = (section, row) => el('div', { class: 'tools' },
  button('approve', () => decide(section, row, 'approve')), button('reject', () => decide(section, row, 'reject')))

/* generic owner mutation dialog: custom fields + password re-entry; every
   privileged action re-enters the owner password (confirmOwner server-side) */
function operate(section, record, action, fields = [], titleKey = action) {
  const password = el('input', { required: '', type: 'password', dir: 'ltr', autocomplete: 'current-password' })
  const submit = el('button', { class: 'primary' }, t('confirm'))
  const feedback = el('p', { role: 'alert' })
  const form = el('form', { on: { submit: async event => {
    event.preventDefault()
    submit.disabled = true
    try {
      const payload = { action, password: password.value }
      for (const [key, input, read] of fields) {
        const value = read ? read(input) : input.value
        if (value !== undefined) payload[key] = value
      }
      await api(section + '/' + encodeURIComponent(record), payload)
      dialog.close()
      render()
      announce('success')
    } catch (error) {
      feedback.textContent = errorText(error)
    } finally { password.value = ''; submit.disabled = false }
  } } }, el('h2', {}, t(titleKey)),
  fields.map(([key, input, , label]) => input.hasAttribute?.('hidden') ? null : field(label ?? key, input)), field('password', password), feedback,
  el('div', { class: 'tools' }, button('cancel', () => dialog.close()), submit))
  dialog.replaceChildren(form)
  dialog.showModal()
}
const textInput = (attrs = {}) => el('input', { maxlength: '200', ...attrs })
const areaInput = (attrs = {}) => el('textarea', { rows: '3', maxlength: '500', ...attrs })
const selectInput = options => el('select', {}, options.map(option => {
  const [value, label] = Array.isArray(option) ? option : [option, option]
  return el('option', { value }, t(label))
}))
const checkboxInput = () => el('input', { type: 'checkbox' })
const readChecked = input => input.checked === true
const readList = input => input.value.trim() ? input.value.split(',').map(v => v.trim()).filter(Boolean) : null
const readOptional = input => input.value.trim() || undefined

const couponFields = () => [
  ['name', textInput()],
  ['maxRedemptions', textInput({ type: 'number', min: '1' }), readOptional],
  ['perUserLimit', textInput({ type: 'number', min: '1' }), readOptional],
  ['startsAt', textInput({ type: 'date', dir: 'ltr' }), readOptional],
  ['expiresAt', textInput({ type: 'date', dir: 'ltr' }), readOptional],
  ['accountSizes', textInput({ dir: 'ltr' }), input => input.value.trim() ? input.value.split(',').map(Number) : undefined],
  ['challengePlanIds', textInput({ dir: 'ltr', maxlength: '2000' }), input => readList(input) ?? undefined],
  ['allowedUserIds', textInput({ dir: 'ltr', maxlength: '2000' }), input => readList(input) ?? undefined],
]
/* Coupon creation: four quick fields, everything else under "Advanced".
   The backend stays the only authority (code rules, duplicates, limits);
   the result names exactly what happened, including a refused activation. */
const COUPON_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const generateCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return 'OF' + Array.from(bytes, b => COUPON_ALPHABET[b % COUPON_ALPHABET.length]).join('')
}
async function couponWizard() {
  const code = textInput({ required: '', dir: 'ltr', maxlength: '40', pattern: '[A-Za-z0-9][A-Za-z0-9_-]{2,39}', autocomplete: 'off', spellcheck: 'false' })
  const kind = selectInput([['percent', 'percentOff'], ['fixed', 'fixedUsdOff']])
  kind.setAttribute('aria-label', t('kind'))
  const value = textInput({ required: '', dir: 'ltr', inputmode: 'decimal' })
  const activate = el('input', { type: 'checkbox' }); activate.checked = true
  const name = textInput(), description = areaInput({ maxlength: '1000' })
  const maxRedemptions = textInput({ type: 'number', min: '1', dir: 'ltr' }), perUserLimit = textInput({ type: 'number', min: '1', dir: 'ltr', placeholder: '1' })
  const startsAt = textInput({ type: 'date', dir: 'ltr' }), expiresAt = textInput({ type: 'date', dir: 'ltr' })
  const allowedUserIds = textInput({ dir: 'ltr', maxlength: '2000' })
  const planBoxes = el('fieldset', { class: 'choices' }, el('legend', {}, t('eligiblePlans')))
  const sizeBoxes = el('fieldset', { class: 'choices' }, el('legend', {}, t('eligibleSizes')))
  let plans = []
  try { plans = (await api('couponPlans')).rows ?? [] } catch { planBoxes.append(el('p', {}, t('unexpected_error'))) }
  const checked = box => Array.from(box.querySelectorAll('input:checked'), input => input.value)
  const drawSizes = () => {
    const chosen = checked(planBoxes), keep = new Set(checked(sizeBoxes))
    const sizes = [...new Set(plans.filter(p => !chosen.length || chosen.includes(p.id)).flatMap(p => p.accountSizesUsd))].sort((a, b) => a - b)
    sizeBoxes.replaceChildren(el('legend', {}, t('eligibleSizes')), ...sizes.map(size => {
      const input = el('input', { type: 'checkbox', value: String(size) }); input.checked = keep.has(String(size))
      return el('label', { class: 'choice' }, input, el('span', { dir: 'ltr' }, usd(size)))
    }))
  }
  for (const plan of plans) {
    const input = el('input', { type: 'checkbox', value: plan.id, on: { change: drawSizes } })
    planBoxes.append(el('label', { class: 'choice' }, input, el('span', {}, plan.name), plan.status === 'active' ? null : badge(plan.status)))
  }
  drawSizes()
  const hint = el('p', { class: 'muted' })
  const syncHint = () => { hint.textContent = kind.value === 'percent' ? t('percentHint') : t('fixedHint') }
  kind.addEventListener('change', syncHint); syncHint()
  const password = el('input', { required: '', type: 'password', dir: 'ltr', autocomplete: 'current-password' })
  const submit = el('button', { class: 'primary' }, t('createCoupon'))
  const feedback = el('p', { role: 'alert' })
  const form = el('form', { on: { submit: async event => {
    event.preventDefault()
    submit.disabled = true
    feedback.textContent = ''
    try {
      const plansChosen = checked(planBoxes), sizesChosen = checked(sizeBoxes).map(Number)
      const payload = { action: 'create', password: password.value, code: code.value.trim().toUpperCase(), kind: kind.value, value: value.value.trim(), activate: activate.checked }
      for (const [key, input] of [['name', name], ['description', description], ['maxRedemptions', maxRedemptions], ['perUserLimit', perUserLimit], ['startsAt', startsAt], ['expiresAt', expiresAt]])
        if (input.value.trim()) payload[key] = input.value.trim()
      if (plansChosen.length) payload.challengePlanIds = plansChosen
      if (sizesChosen.length) payload.accountSizes = sizesChosen
      const users = readList(allowedUserIds); if (users) payload.allowedUserIds = users
      const result = await api('coupons/new', payload)
      const outcome = result.activation === 'activated' ? 'couponCreatedActive'
        : result.activation === 'failed' ? 'couponCreatedActivationFailed' : 'couponCreatedInactive'
      const reason = result.activationError ? ' — ' + (labels[result.activationError] ? t(result.activationError) : result.activationError) : ''
      form.replaceChildren(el('h2', {}, t('couponWizard')),
        el('p', { role: 'status', class: 'result', 'data-outcome': outcome }, t(outcome), ' ', technical(result.coupon?.code), reason),
        el('div', { class: 'tools' }, button('copyCode', () => navigator.clipboard?.writeText(result.coupon?.code ?? '')), button('close', () => dialog.close(), 'primary')))
      render()
    } catch (error) {
      feedback.textContent = t('couponValidationFailed') + ': ' + (labels[error.message] ? t(error.message) : t('unexpected_error'))
    } finally { password.value = ''; submit.disabled = false }
  } } },
  el('h2', {}, t('couponWizard')),
  el('div', { class: 'code-row' }, field('code', code), button('generateCode', () => { code.value = generateCode(); code.focus() })),
  field('kind', kind), field('value', value), hint,
  el('label', { class: 'choice' }, activate, el('span', {}, t('activateAfterCreate'))),
  el('details', {}, el('summary', {}, t('advancedSettings')),
    field('name', name), field('description', description), field('maxRedemptions', maxRedemptions), field('perUserLimit', perUserLimit),
    field('startsAt', startsAt), field('expiresAt', expiresAt), el('p', { class: 'muted' }, t('couponDatesUtc')),
    planBoxes, sizeBoxes, field('allowedUserIds', allowedUserIds)),
  field('password', password), feedback,
  el('div', { class: 'tools' }, button('cancel', () => dialog.close()), submit))
  dialog.replaceChildren(form)
  dialog.showModal()
  code.focus()
}
const remainingUses = r => r.max_redemptions == null ? t('unlimited') : number(Math.max(0, Number(r.max_redemptions) - Number(r.uses_consumed ?? 0) - Number(r.uses_reserved ?? 0)))
const expenseWizard = () => operate('expenses', 'new', 'create', [
  ['category', selectInput(['render_infrastructure', 'database', 'cms', 'market_data', 'operational_services', 'marketing', 'ambassador_commissions', 'salaries_administration', 'bug_bounty', 'other'])],
  ['description', areaInput({ required: '' })],
  ['amount', textInput({ required: '', dir: 'ltr' }), undefined, 'amountOriginal'],
  ['currency', textInput({ required: '', dir: 'ltr', value: 'USD', maxlength: '8' })],
  ['amountUsd', textInput({ required: '', dir: 'ltr' }), undefined, 'amount'],
  ['incurredOn', textInput({ required: '', type: 'date', dir: 'ltr' })],
  ['source', selectInput(['provider_api', 'invoice', 'receipt', 'contract'])],
  ['invoiceReference', textInput({ required: '', dir: 'ltr' })],
  ['documentUrl', textInput({ dir: 'ltr', maxlength: '500' }), readOptional],
], 'recordExpense')

const challengeLink = r => link('challenges', { id: r.id }, uid(r))
const challengeColumns = [['identity', challengeLink], ['plan', plan], ['stage', r => r.stage === 0 ? t('funded') : number(r.stage)],
  ['status', status], ['amount', r => usd(r.account_size_usd)], ['date', r => date(r.created_at)]]
const columns = {
  users: [['wallet', r => link('users', { id: r.id }, wallet(r))], ['name', r => r.display_name ?? '—'],
    ['status', status], ['challengeCount', r => number(r.challenges)], ['registered', r => date(r.created_at)]],
  challenges: [['wallet', wallet], ...challengeColumns],
  reviews: [['wallet', wallet], ['identity', challengeLink], ['plan', plan], ['amount', r => usd(r.account_size_usd)],
    ['date', r => date(r.completed_at)], ['action', r => decisionButtons('reviews', r)]],
  payouts: [['wallet', r => link('users', { id: r.user_id }, wallet(r))], ['plan', plan],
    ['amount', r => usd(r.amount_usd)], ['status', status], ['date', r => date(r.requested_at)],
    ['scope', r => t(r.test_mode ? 'test' : 'commercial')], ['payoutDetails', r => link('payouts', { id: r.id }, uid(r))], ['action', r => r.status === 'requested' ? decisionButtons('payouts', r) : r.test_mode && r.status === 'approved' ? button('simulate', () => decide('payouts', r, 'simulate')) : '—']],
  payments: [['identity', r => link('payments', { id: r.purchase_order_id }, technical(r.purchase_order_id))], ['transaction', r => technical(r.tx_hash)], ['status', status], ['date', r => date(r.created_at ?? r.last_attempt_at)],
    ['action', r => r.retryable && r.status !== 'confirmed' ? button('reverify', () => decide('payments', r, 'reverify')) : '—']],
  coupons: [['code', r => link('coupons', { id: r.id }, technical(r.code))], ['status', status], ['discount', r => r.kind === 'percent' ? new Intl.NumberFormat(fmt(), { style: 'percent' }).format(Number(r.value) / 100) : usd(r.value)],
    ['redeemed', r => number(r.uses_consumed)], ['remaining', remainingUses], ['expiry', r => date(r.expires_at)], ['created', r => date(r.created_at)],
    ['action', r => r.internal ? '—' : el('div', { class: 'tools' },
      button('copyCode', () => navigator.clipboard?.writeText(r.code)),
      r.status === 'inactive' ? button('activate', () => operate('coupons', r.id, 'activate')) : null,
      r.status === 'active' ? button('disable', () => operate('coupons', r.id, 'disable')) : null,
      r.status !== 'revoked' ? button('couponRevoke', () => operate('coupons', r.id, 'revoke', [], 'couponRevoke'), 'danger') : null,
      r.status !== 'revoked' ? button('couponUpdate', () => operate('coupons', r.id, 'update', couponFields(), 'couponUpdate')) : null)]],
  support: [['reference', r => link('support', { id: r.reference }, technical(r.reference))], ['subject', r => r.subject], ['departmentColumn', r => t(r.department === 'support' ? 'supportDept' : r.department)], ['status', status], ['date', r => date(r.createdAt)]],
  partners: [['wallet', wallet], ['identity', r => link('partners', { id: r.id }, uid(r))], ['role', r => t(r.role)], ['status', status], ['date', r => date(r.submitted_at)]],
  commissions: [['wallet', wallet], ['code', r => technical(r.referral_code)], ['status', status],
    ['earned', r => usd(r.earned)], ['reversedUsd', r => usd(r.reversed)], ['paidOut', r => usd(r.paid)], ['pendingUsd', r => usd(r.pending)],
    ['action', r => button('recordPayout', () => operate('commissions', r.user_id, 'payout', [
      ['amountUsd', textInput({ required: '', dir: 'ltr' }), undefined, 'amount'],
      ['payoutReference', textInput({ required: '', dir: 'ltr' }), undefined, 'paymentReference'],
    ], 'recordPayout'))]],
  expenses: [['category', r => t(r.category)], ['description', r => r.description], ['amount', r => usd(r.amount_usd)],
    ['status', status], ['paymentStatus', r => badge(r.payment_status ?? 'unpaid')], ['incurredOn', r => date(r.incurred_on)],
    ['action', r => el('div', { class: 'tools' },
      r.status === 'recorded' ? button('verify', () => operate('expenses', r.id, 'verify')) : null,
      r.status === 'verified' && r.payment_status === 'unpaid' ? button('markPaid', () => operate('expenses', r.id, 'paid', [
        ['paymentReference', textInput({ required: '', dir: 'ltr' })]], 'markPaid')) : null,
      r.status !== 'void' ? button('void', () => operate('expenses', r.id, 'void')) : null)]],
  reserves: [['kind', r => t({ operational: 'operationalReserve', risk: 'riskReserve', other: 'otherReserve' }[r.kind] ?? r.kind)],
    ['amount', r => usd(r.amount_usd)], ['note', r => r.note], ['recordedBy', r => technical(r.set_by)], ['date', r => date(r.created_at)]],
  obligations: [['kind', r => t(r.kind)], ['description', r => r.description], ['amount', r => usd(r.amount_usd)],
    ['status', status], ['dueOn', r => r.due_on ? date(r.due_on) : '—'], ['reference', r => technical(r.reference)],
    ['action', r => r.status === 'open' ? el('div', { class: 'tools' },
      button('closeSettled', () => operate('obligations', r.id, 'settled', [], 'closeSettled')),
      button('closeVoid', () => operate('obligations', r.id, 'void', [], 'closeVoid'))) : '—']],
  audit: [['date', r => date(r.ts)], ['sourceColumn', r => t(r.source === 'financial' ? 'financial' : 'operationalSource')], ['action', r => technical(r.action)],
    ['actor', r => technical(r.actor ?? r.subject ?? '—')], ['entity', r => technical(r.entity ? `${r.entity}:${r.entity_id}` : r.entity_id ?? '—')]],
  notifications: [['date', r => date(r.created_at)], ['wallet', wallet], ['kind', r => badge(r.kind)],
    ['readAt', r => r.read_at ? date(r.read_at) : t('unreadState')]],
}
const refundAction = (r, action, extra = []) => button(action === 'reject' ? 'refundReject' : 'refund_' + action,
  () => operate('refunds', r.id, action, [['note', areaInput({ required: '' }), undefined, 'reason'], ...extra], 'refund_' + action), action === 'reject' ? 'danger' : undefined)
columns.deposits = [['date', r => date(r.first_seen_at)], ['network', r => technical(String(r.chain_id))], ['transaction', r => technical(r.tx_hash)],
  ['sender', r => technical(r.from_address)], ['amount', r => technical(r.usd == null ? (r.amount ?? '—') : '$' + r.usd)],
  ['matchStatus', r => badge(r.match_status)], ['status', r => badge(r.status === 'observed' ? 'txObserved' : r.status)], ['reason', r => r.review_note ?? r.verification_code ?? '—'],
  ['action', r => el('div', { class: 'tools' },
    r.purchase_order_id ? link('payments', { id: r.purchase_order_id }, t('order')) : null,
    ['unmatched', 'ambiguous'].includes(r.match_status) ? button('associate', () => operate('deposits', r.id, 'associate', [
      ['orderId', textInput({ required: '', dir: 'ltr', maxlength: '36' })], ['note', areaInput({ required: '', minlength: '10' }), undefined, 'reason'],
      ['evidence', areaInput({ required: '', minlength: '10' })]], 'associate'), 'primary') : null,
    r.purchase_order_id || r.detail?.candidateOrderId ? button('reverify', () => operate('deposits', r.id, 'reverify', [], 'reverify')) : null,
    button('refundCase', () => operate('deposits', r.id, 'refundCase', [['reason', selectInput([['unmatched', 'unmatched'], ['late_payment', 'late_payment'], ['operator', 'operator']])],
      ['note', areaInput({ required: '', minlength: '10' }), undefined, 'reason']], 'refundCase')),
    button('closeInvestigation', () => operate('deposits', r.id, 'close', [['resolution', selectInput([['resolved', 'resolved'], ['ignored', 'ignored']])],
      ['note', areaInput({ required: '', minlength: '10' }), undefined, 'reason']], 'closeInvestigation')))]]
columns.refunds = [['date', r => date(r.created_at)], ['amount', r => technical('$' + r.usd)], ['reason', r => t(r.reason)], ['status', status],
  ['destination', r => technical(r.destination)], ['network', r => technical(String(r.chain_id))], ['transaction', r => technical(r.original_tx_hash)],
  ['refundTx', r => technical(r.refund_tx_hash ?? '—')],
  ['action', r => el('div', { class: 'tools' },
    ['refund_due', 'refund_failed'].includes(r.status) ? refundAction(r, 'review') : null,
    r.status === 'refund_review' ? refundAction(r, 'approve', [['destination', textInput({ required: '', dir: 'ltr', maxlength: '100' }), undefined, 'confirmDestination'],
      ['chainId', textInput({ required: '', dir: 'ltr', inputmode: 'numeric' }), undefined, 'network']]) : null,
    r.status === 'refund_approved' ? refundAction(r, 'sent', [['chainId', textInput({ required: '', dir: 'ltr', value: String(r.chain_id) }), undefined, 'network'],
      ['refundTxHash', textInput({ required: '', dir: 'ltr', maxlength: '100', spellcheck: 'false' }), undefined, 'transactionHash']]) : null,
    r.status === 'refund_sent' ? refundAction(r, 'confirm') : null,
    r.status === 'refund_sent' ? refundAction(r, 'failed') : null,
    ['refund_due', 'refund_review', 'refund_approved'].includes(r.status) ? refundAction(r, 'reject') : null)]]
const filterStatuses = {
  users: ['active', 'suspended'], challenges: ['created', 'started', 'passed', 'failed', 'expired', 'cancelled'],
  payouts: ['requested', 'approved', 'paid', 'rejected', 'cancelled'], payments: ['pending', 'confirmed', 'rejected'],
  deposits: ['verified', 'rejected', 'reorged'],
  refunds: ['refund_due', 'refund_review', 'refund_approved', 'refund_sent', 'refund_confirmed', 'refund_rejected', 'refund_failed'],
  support: ['new', 'in_progress', 'waiting_customer', 'resolved', 'closed'],
  partners: ['submitted', 'under_review', 'approved', 'rejected', 'suspended'],
}

async function directory(main, section, filter) {
  const query = new URLSearchParams(filter)
  query.delete('id')
  if (section === 'payouts' && !query.has('scope')) query.set('scope', 'real')
  const id = filter.get('id')
  const data = await api(section + (id ? '/' + encodeURIComponent(id) : '?' + query))
  if (id && section === 'users') {
    const { user, challenges, purchases, withdrawals } = data
    main.append(el('section', { class: 'panel detail' }, el('h2', {}, user.display_name ?? t('users')),
      wallet(user), uid(user), status(user), el('span', {}, date(user.created_at)),
      el('div', { class: 'tools' }, user.status === 'active'
        ? button('suspendUser', () => operate('users', user.id, 'suspend', [['reason', areaInput({ required: '' })]], 'suspendUser'), 'danger')
        : button('activateUser', () => operate('users', user.id, 'activate', [['reason', areaInput({ required: '' })]], 'activateUser')))),
    await userProfile(main, user),
    table('challenges', challengeColumns, challenges),
    table('transactions', [['identity', r => link('payments', { id: r.id }, uid(r))], ['status', status], ['amount', r => usd(r.price_usd)],
      ['transaction', r => technical(r.payment?.txHash)], ['date', r => date(r.created_at)]], purchases),
    table('payouts', [['identity', r => link('payouts', { id: r.id }, uid(r))], ['status', status],
      ['amount', r => usd(r.amount_usd)], ['date', r => date(r.requested_at)]], withdrawals))
    return
  }
  if (id && section === 'challenges') {
    const { record, review, positions, events } = data
    const rules = record.rules_snapshot
    const pct = value => value == null ? '—' : new Intl.NumberFormat(fmt(), { style: 'percent' }).format(Number(value) / 100)
    main.append(el('section', { class: 'panel detail' }, el('h2', {}, plan(record)),
      link('users', { id: record.user_id }, wallet(record)), uid(record), status(record),
      record.rules_snapshot?.controlledTest ? badge('test') : null,
      record.parent_challenge_id ? link('challenges', { id: record.parent_challenge_id }, technical(record.parent_challenge_id)) : null,
      review?.funded_challenge_id ? link('challenges', { id: review.funded_challenge_id }, t('funded')) : null,
      challengeActions(record)),
    table('tradingAccount', [['identity', r => technical(r.demo_account_id)], ['region', r => t(r.home_region)],
      ['balance', r => usd(r.balance)], ['equity', r => usd(r.equity)], ['pnl', r => usd(r.realized_pnl)],
      ['dailyDrawdown', r => usd(r.daily_drawdown)], ['maxDrawdown', r => usd(r.maximum_drawdown)],
      ['observed', r => date(r.observed_at)]], record.demo_account_id ? [record] : []),
    table('rules', [['targetOne', r => pct(r.phase1TargetPct)], ['targetTwo', r => pct(r.phase2TargetPct)],
      ['minimumDays', r => number(r.minTradingDays)], ['dailyLimit', r => pct(r.dailyLossPct)],
      ['maxLimit', r => pct(r.maxTotalLossPct)]], rules ? [rules] : []),
    table('positions', [['symbol', r => technical(r.market)], ['side', r => t(r.side)], ['status', status],
      ['entry', r => number(r.entry_price)], ['exit', r => number(r.exit_price)], ['leverage', r => number(r.leverage)],
      ['pnl', r => usd(r.realized_pnl)], ['date', r => date(r.opened_at)]], positions),
    table('audit', [['date', r => date(r.created_at)], ['action', r => badge(r.kind)]], events))
    return
  }
  if (id && section === 'payouts') {
    const { record, chain } = data
    const term = (key, value) => el('div', {}, el('dt', {}, t(key)), el('dd', {}, value))
    const evidence = record.payment_evidence
    const split = record.split_pct == null ? '—' : new Intl.NumberFormat(fmt(), { style: 'percent', maximumFractionDigits: 2 }).format(Number(record.split_pct) / 100)
    main.append(el('section', { class: 'panel detail' },
      el('h2', {}, t('payoutDetails')),
      el('dl', { class: 'payout-facts' },
        term('identity', uid(record)),
        term('trader', link('users', { id: record.user_id }, record.display_name || wallet(record))),
        term('challenges', record.challenge_id ? link('challenges', { id: record.challenge_id }, technical(record.challenge_id)) : '—'),
        term('tradingAccount', technical(record.demo_account_id)),
        term('scope', t(record.test_mode ? 'test' : 'commercial')),
        term('region', t(record.home_region)),
        term('date', date(record.requested_at)),
        term('status', status(record)),
        term('grossProfit', usd(record.gross_profit_usd)),
        term('payoutAmount', usd(record.amount_usd)),
        term('eligibleAmount', usd(record.eligible_amount_usd)),
        term('profitShare', split),
        term('destination', technical(record.recipient_wallet)),
        term('approvedBy', technical(record.approved_by)),
        chain ? term('network', t('arbitrum')) : null,
        chain ? term('token', el('span', {}, technical(chain.symbol), ' ', technical(chain.token))) : null,
        chain ? term('transactionHash', technical(record.payout_ref)) : null,
        chain ? term('verification', t(evidence?.finality === 'finalized' ? 'verified' : 'awaitingEvidence')) : null,
        evidence?.transactionAt ? term('verifiedTransferTime', date(evidence.transactionAt)) : null,
        evidence?.blockNumber ? term('settlementBlock', technical(evidence.blockNumber)) : null),
      !record.writable ? badge('readonly') : null,
      record.writable && record.status === 'requested' ? decisionButtons('payouts', record) : null,
      record.writable && record.status === 'approved' && record.test_mode ? button('simulate', () => decide('payouts', record, 'simulate')) : null,
      record.writable && record.status === 'approved' && !record.test_mode ?
        data.realSettlement ? el('div', { class: 'detail' }, el('p', {}, t('settlementHint')), button('settle', () => decide('payouts', record, 'settle'), 'primary')) :
          el('p', { class: 'muted' }, t('settlement_disabled')) : null,
      record.writable && record.status === 'paid' && !record.test_mode && record.payment_evidence?.finality === 'finalized' &&
      Number(record.eligibility?.distribution?.ib ?? 0) > 0 ? el('div', { class: 'detail' },
        record.ib_settlement ? el('dl', { class: 'payout-facts' },
          el('div', {}, el('dt', {}, t('status')), el('dd', {}, badge(record.ib_settlement.status))),
          el('div', {}, el('dt', {}, t('amount')), el('dd', {}, usd(record.ib_settlement.amount))),
          el('div', {}, el('dt', {}, t('destination')), el('dd', {}, technical(record.ib_settlement.recipient)))) : null,
        el('div', { class: 'tools' },
          !record.ib_settlement ? button('ib_approve', () => decide('payouts', record, 'ib_approve')) : null,
          record.ib_settlement && record.ib_settlement.status !== 'paid' ? button('ib_paid', () => decide('payouts', record, 'ib_paid')) : null)) : null))
    main.append(el('section', { class: 'panel detail' }, el('h2', {}, t('correspondence')),
      data.thread.messages.length ? data.thread.messages.map(m => el('article', { class: 'detail' },
        el('strong', {}, t(m.role)), el('span', { class: 'muted' }, date(m.at)), el('p', { class: 'message' }, m.message))) :
        el('p', { class: 'empty' }, t('empty')),
      el('div', { class: 'tools' }, button('reply', () => decide('payouts', { id }, 'reply')),
        data.thread.appealPending ? button('resolve_appeal', () => decide('payouts', { id }, 'resolve_appeal')) : null)),
    table('audit', [['date', r => date(r.ts)], ['action', r => badge(r.after?.status)],
      ['username', r => technical(r.actor)], ['reason', r => r.after?.reason]], data.events))
    return
  }

  if (id && section === 'payments') {
    const l = data.ledger
    main.append(table('transactions', [['identity', uid], ['wallet', wallet], ['status', r => badge(r.lifecycle_state ?? r.status)], ['amount', r => usd(r.price_usd)]],
      data.order ? [data.order] : []),
    l ? table('ledger', [['orderTotal', () => technical('$' + l.totalUsd)], ['received', () => technical('$' + l.receivedUsd)],
      ['remainingBalance', () => technical('$' + l.remainingUsd)], ['excessAmount', () => technical('$' + l.excessUsd)]], [l]) : null,
    table('chainTransactions', [['date', r => date(r.first_seen_at)], ['network', r => technical(String(r.chain_id))], ['transaction', r => technical(r.tx_hash)],
      ['sender', r => technical(r.from_address)], ['amount', r => technical(r.usd == null ? '—' : '$' + r.usd)], ['status', status],
      ['matchStatus', r => technical(`${r.match_status} · ${r.match_method ?? '—'}`)], ['source', r => technical(r.source)]], data.transactions ?? []),
    table('payments', columns.payments, data.attempts),
    table('refunds', columns.refunds.filter(([k]) => k !== 'action'), l?.refunds?.map(r => ({ ...r, chain_id: r.chainId, refund_tx_hash: r.refundTxHash, created_at: r.createdAt })) ?? []),
    table('verified', [['transaction', r => technical(r.tx_hash)], ['status', status], ['date', r => date(r.verified_at)]], data.payments),
    table('timeline', [['date', r => date(r.created_at)], ['action', r => r.kind ? technical(r.kind) : el('span', { class: 'transition' }, technical(r.from_state ?? '∅'), ' ', arrow('forward'), ' ', technical(r.to_state))], ['actor', r => technical(r.actor)]],
      [...(data.orderEvents ?? []), ...(data.events ?? [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))))
    return
  }
  if (id && section === 'support') {
    const item = data.message
    const transitions = {
      new: ['in_progress', 'waiting_customer', 'resolved', 'closed'],
      in_progress: ['waiting_customer', 'resolved', 'closed'],
      waiting_customer: ['in_progress', 'resolved', 'closed'],
      resolved: ['in_progress', 'closed'],
    }
    main.append(el('section', { class: 'panel detail' }, el('h2', {}, item.subject), technical(item.reference),
      item.fullName, technical(item.email), status(item), el('h3', {}, t('message')), el('p', { class: 'message' }, item.message),
      item.internalNotes ? el('div', {}, el('h3', {}, t('internalNotes')), el('p', { class: 'message' }, item.internalNotes)) : null,
      el('div', { class: 'tools' }, (transitions[item.status] ?? []).map(state =>
        button(state, () => decide('support', { id: item.reference }, state))))),
    el('section', { class: 'panel detail' }, el('h2', {}, t('correspondence')), el('p', { class: 'muted' }, t('supportHint')),
      data.thread?.messages?.length ? data.thread.messages.map(m => el('article', { class: 'detail' },
        el('strong', {}, t(m.role)), el('span', { class: 'muted' }, date(m.at)), el('p', { class: 'message' }, m.message))) :
        el('p', { class: 'empty' }, t('empty')),
      item.status !== 'closed' ? el('div', { class: 'tools' }, button('threadReply', () => decide('support', { id: item.reference }, 'reply'), 'primary')) : null),
    table('audit', [['date', r => date(r.ts)], ['status', r => badge(r.to_status)], ['username', r => technical(r.actor)]], data.events))
    return
  }
  if (id && section === 'partners') {
    const { application, events } = data
    const decision = (action, extra = []) => operate('partners', application.id, action, [
      ['reason', areaInput({ required: '', maxlength: '2000' })], ...extra])
    const approveFields = () => {
      if (application.role === 'coach') {
        const reviewed = checkboxInput(), evidence = textInput({ required: '' })
        return [['trackRecordReviewed', reviewed, () => undefined], ['evidence', evidence, () => undefined],
          ['verification', el('span', { hidden: '' }), () => ({ trackRecordReviewed: readChecked(reviewed), evidence: evidence.value }), 'verificationEvidence']]
      }
      const platform = selectInput(['instagram', 'youtube']), count = textInput({ type: 'number', min: '0', dir: 'ltr' })
      const evidence = textInput({ required: '' }), second = checkboxInput(), markets = checkboxInput(), engagement = checkboxInput()
      return [['platform', platform, () => undefined], ['followerCount', count, () => undefined], ['evidence', evidence, () => undefined],
        ['secondPlatformActive', second, () => undefined], ['marketsContent', markets, () => undefined], ['engagementReviewed', engagement, () => undefined],
        ['verification', el('span', { hidden: '' }), () => ({
          audience: [{ platform: platform.value, count: Number(count.value), evidence: evidence.value }],
          secondPlatformActive: readChecked(second), marketsContent: readChecked(markets), engagementReviewed: readChecked(engagement),
        }), 'verificationEvidence']]
    }
    const actions = { submitted: ['review', 'approve', 'reject'], under_review: ['approve', 'reject'], approved: ['suspend'], suspended: ['reinstate'] }
    main.append(el('section', { class: 'panel detail' }, el('h2', {}, t('applicationDetail')),
      technical(application.wallet_address), uid(application), el('span', {}, t(application.role)), status(application),
      el('span', {}, date(application.submitted_at)),
      el('div', {}, el('h3', {}, t('contact')), technical(application.contact_email)),
      el('div', {}, el('h3', {}, t('payload')), el('pre', { class: 'message', dir: 'ltr' }, JSON.stringify(application.payload ?? {}, null, 2))),
      application.verification ? el('div', {}, el('h3', {}, t('verificationEvidence')), el('pre', { class: 'message', dir: 'ltr' }, JSON.stringify(application.verification, null, 2))) : null,
      el('div', { class: 'tools' }, (actions[application.status] ?? []).map(action =>
        button(action, () => decision(action, action === 'approve' ? approveFields() : []))))),
    table('audit', [['date', r => date(r.ts)], ['status', r => badge(r.to_status)], ['username', r => technical(r.actor)], ['reason', r => r.note]], events))
    return
  }
  if (id && section === 'coupons') {
    main.append(
      table('redemptions', [['wallet', wallet], ['status', status], ['amount', r => usd(r.net_price_usd)], ['date', r => date(r.created_at)]], data.redemptions ?? []),
      table('couponOrders', [['identity', r => link('payments', { id: r.id }, uid(r))], ['wallet', wallet], ['status', status],
        ['amount', r => usd(r.price_usd)], ['date', r => date(r.created_at)]], data.orders ?? []),
      table('audit', [['date', r => date(r.created_at)], ['action', r => technical(r.action)], ['username', r => technical(r.actor)]], data.audit ?? []))
    return
  }
  if (id && section === 'tournaments') return tournamentView(main, data)
  if (section === 'tournaments') return tournamentsView(main, data.rows ?? [])
  if (id && section === 'migrations') return migrationView(main, data)
  if (section === 'migrations') return migrationsView(main, data.rows ?? [])
  if (section === 'migrationFirms') return migrationFirmsView(main, data)
  if (section === 'plans') return plansView(main, data.rows ?? [])
  if (section === 'entitlements') return entitlementsView(main, data.rows ?? [])
  if (section === 'coupons') main.append(el('div', { class: 'tools' }, button('createCoupon', () => { void couponWizard() }, 'primary')))
  if (section === 'expenses') main.append(el('div', { class: 'tools' }, button('recordExpense', expenseWizard, 'primary')))
  if (section === 'reserves') main.append(el('div', { class: 'tools' }, button('setReserve', () => operate('reserves', 'new', 'set', [
    ['kind', selectInput([['operational', 'operationalReserve'], ['risk', 'riskReserve'], ['other', 'otherReserve']])],
    ['amountUsd', textInput({ required: '', dir: 'ltr' }), undefined, 'amount'],
    ['note', areaInput({ required: '' })]], 'setReserve'), 'primary')))
  if (section === 'obligations') main.append(el('div', { class: 'tools' }, button('recordObligation', () => operate('obligations', 'new', 'create', [
    ['kind', selectInput(['liability', 'payable', 'other'])],
    ['description', areaInput({ required: '', maxlength: '300' })],
    ['amountUsd', textInput({ required: '', dir: 'ltr' }), undefined, 'amount'],
    ['dueOn', textInput({ type: 'date', dir: 'ltr' }), readOptional],
    ['reference', textInput({ required: '', dir: 'ltr' })]], 'recordObligation'), 'primary')))
  if (section === 'audit') {
    const sourceSelect = el('select', { name: 'source', 'aria-label': t('sourceColumn') },
      el('option', { value: '' }, t('all')), el('option', { value: 'operational' }, t('operationalSource')), el('option', { value: 'financial' }, t('financial')))
    sourceSelect.value = query.get('source') ?? ''
    const actionInput = el('input', { name: 'action', value: query.get('action') ?? '', maxlength: '80', placeholder: t('action'), 'aria-label': t('action'), dir: 'ltr' })
    const actorInput = el('input', { name: 'actor', value: query.get('actor') ?? '', maxlength: '80', placeholder: t('actor'), 'aria-label': t('actor'), dir: 'ltr' })
    main.append(el('form', { class: 'filters', on: { submit: e => {
      e.preventDefault()
      const filters = Object.fromEntries([...new FormData(e.target)].filter(([, value]) => value))
      const next = route(section, filters)
      if (location.hash === next) render()
      else location.hash = next
    } } }, sourceSelect, actionInput, actorInput, el('button', { class: 'primary' }, t('apply'))))
  }
  const input = section === 'users' ? el('input', {
    name: 'search', value: query.get('search') ?? '', maxlength: '80', placeholder: t('search'), 'aria-label': t('search'),
  }) : null
  const statuses = filterStatuses[section]
  const choices = section === 'payouts' && query.get('scope') === 'test' ? [...statuses, 'simulated_settled'] : statuses
  const scope = section === 'payouts' ? el('select', { name: 'scope', 'aria-label': t('scope'), on: { change: e => {
    location.hash = route(section, { scope: e.target.value })
  } } }, el('option', { value: 'real' }, t('commercial')), el('option', { value: 'test' }, t('test'))) : null
  if (scope) scope.value = query.get('scope')
  const select = choices ? el('select', { name: 'status', 'aria-label': t('status') },
    el('option', { value: '' }, t('all')), choices.map(s => el('option', { value: s }, t(s)))) : null
  if (select) select.value = query.get('status') ?? ''
  const department = section === 'support' ? el('select', { name: 'department', 'aria-label': t('department') },
    el('option', { value: '' }, t('department')), ['support', 'legal', 'technical', 'community'].map(d => el('option', { value: d }, t(d === 'support' ? 'supportDept' : d)))) : null
  if (department) department.value = query.get('department') ?? ''
  if (input || select) main.append(el('form', { class: 'filters', on: { submit: e => {
    e.preventDefault()
    const filters = Object.fromEntries([...new FormData(e.target)].filter(([, value]) => value))
    const next = route(section, filters)
    if (location.hash === next) render()
    else location.hash = next
  } } }, input, scope, select, department, el('button', { class: 'primary' }, t(input ? 'apply' : 'refresh'))))
  main.append(table(null, columns[section], data.rows))
  if (section === 'coupons') await controlledCoupons(main)
  if (data.total !== null) {
    const offset = Number(query.get('offset')) || 0
    const page = next => link(section, { ...Object.fromEntries(query), offset: next }, t(next > offset ? 'next' : 'previous'))
    main.append(el('nav', { class: 'pager' }, offset > 0 ? page(Math.max(0, offset - 25)) : null, number(data.total),
      offset + 25 < data.total ? page(offset + 25) : null))
  }
}

async function controlledCoupons(main) {
  let data
  try { data = await api('controlled') } catch { return }
  const section = el('section', { class: 'panel detail' }, el('h2', {}, t('controlled')))
  main.append(section)
  for (const profile of ['instant', 'standard']) {
    const existing = data.rows.find(row => row.profile === profile)
    const row = el('article', { class: 'detail' }, el('h3', {}, t(profile)))
    section.append(row)
    if (existing) row.append(wallet(existing), status(existing), date(existing.expires_at),
      table('challenges', [['identity', uid], ['stage', r => number(r.stage)], ['status', status]], existing.challenges ?? []),
      table('payouts', [['identity', r => link('payouts', { id: r.id }, uid(r))], ['status', status], ['amount', r => usd(r.amountUsd)]], existing.simulated_payouts ?? []))
    if (existing?.status === 'revoked' || existing?.uses_consumed > 0) continue
    const action = existing ? 'revoke' : 'issue'
    row.append(button(action, () => {
      const password = el('input', { required: '', type: 'password', dir: 'ltr', autocomplete: 'current-password' })
      const address = el('input', { name: 'wallet', required: '', dir: 'ltr', pattern: '0x[a-fA-F0-9]{40}' })
      const feedback = el('div', { role: 'status' })
      const submit = el('button', { class: 'primary' }, t(action))
      const form = el('form', { on: { submit: async event => {
        event.preventDefault()
        submit.disabled = true
        try {
          const result = await api('controlled/' + profile, { action, walletAddress: address.value, password: password.value })
          feedback.replaceChildren(result.code ? el('p', {}, t('generated'), ' ', technical(result.code)) : t('success'))
          form.querySelectorAll('input').forEach(input => input.remove())
          submit.remove()
        } catch (error) {
          feedback.textContent = errorText(error)
          submit.disabled = false
        } finally { password.value = '' }
      } } }, el('h2', {}, t(profile)), action === 'issue' ? field('wallet', address) : null,
      field('password', password), feedback, el('div', { class: 'tools' }, button('cancel', () => { dialog.close(); render() }), submit))
      dialog.replaceChildren(form)
      dialog.showModal()
    }))
  }
}

/* ---------- users: full profile, internal notes and tags ---------- */
async function userProfile(main, user) {
  let p
  try { p = await api('userProfile/' + encodeURIComponent(user.id)) } catch (error) { return el('p', { class: 'empty', role: 'alert' }, errorText(error)) }
  return el('div', {},
    el('section', { class: 'panel detail' }, el('h2', {}, t('internalNotes')),
      el('div', { class: 'tools' }, p.tags.length ? p.tags.map(tag => el('span', { class: 'badge' }, tag)) : el('span', { class: 'muted' }, t('noTags')),
        button('setTags', () => operate('userTags', user.id, 'set', [['tags', textInput({ dir: 'ltr', value: p.tags.join(', '), maxlength: '700' })], ['reason', areaInput({ required: '' })]], 'setTags')),
        button('addNote', () => operate('userNotes', user.id, 'add', [['note', areaInput({ required: '', maxlength: '2000', rows: '5' })]], 'addNote'), 'primary'),
        button('issueEntitlement', () => entitlementDialog(user.wallet_address))),
      p.notes.length ? p.notes.map(n => el('article', { class: 'detail' }, el('strong', {}, technical(n.actor)), el('span', { class: 'muted' }, date(n.created_at)), el('p', { class: 'message' }, n.note)))
        : el('p', { class: 'empty' }, t('empty'))),
    table('entitlements', entitlementColumns.filter(([k]) => k !== 'wallet'), p.entitlements),
    table('support', [['reference', r => link('support', { id: r.reference }, technical(r.reference))], ['subject', r => r.subject], ['status', status], ['date', r => date(r.created_at)]], p.support),
    table('certificates', [['identity', r => technical(r.serial)], ['kind', r => t(r.kind)], ['plan', r => technical(r.plan)], ['status', status], ['date', r => date(r.issued_at)]], p.certificates),
    table('tournamentRecords', [['identity', uid], ['status', status], ['name', r => r.nickname ?? '—'], ['date', r => date(r.created_at)]], p.tournament),
    table('migrationRecords', [['identity', r => link('migrations', { id: r.id }, uid(r))], ['status', status], ['firm', r => r.firm], ['date', r => date(r.created_at)]], p.migration))
}

/* ---------- challenges: owner decisions with a required reason ---------- */
function challengeActions(record) {
  const live = ['created', 'started'].includes(record.status)
  if (!live) return null
  const reason = () => ['reason', areaInput({ required: '' })]
  return el('div', { class: 'tools' },
    record.expires_at ? button('extendTime', () => operate('challengeActions', record.id, 'extend', [['days', textInput({ type: 'number', min: '1', max: '90', required: '', dir: 'ltr' }), i => Number(i.value)], reason()], 'extendTime')) : null,
    record.status === 'started' ? button('manualPass', () => operate('challengeActions', record.id, 'pass', [reason()], 'manualPass')) : null,
    record.status === 'started' ? button('manualFail', () => operate('challengeActions', record.id, 'fail', [reason()], 'manualFail'), 'danger') : null,
    button('voidChallenge', () => operate('challengeActions', record.id, 'void', [reason()], 'voidChallenge'), 'danger'),
    el('p', { class: 'muted' }, t('challengeActionsHint')))
}

/* ---------- entitlements: issue a challenge or a funded account ---------- */
const entitlementColumns = [['wallet', wallet], ['plan', plan], ['amount', r => usd(r.account_size_usd)],
  ['stage', r => r.start_stage === 0 ? t('funded') : t('evaluation')], ['source', r => t('source_' + r.source)], ['code', r => technical(r.code)],
  ['status', r => badge(r.uses_consumed ? 'redeemed' : r.coupon_status)], ['date', r => date(r.created_at)]]
function entitlementDialog(walletAddress = '') {
  operate('entitlements', 'new', 'issue', [
    ['walletAddress', textInput({ required: '', dir: 'ltr', pattern: '0x[0-9a-fA-F]{40}', value: walletAddress })],
    ['planSlug', selectInput([['standard', 'standard'], ['one-phase', 'one-phase'], ['instant', 'instant']]), undefined, 'plan'],
    ['accountSizeUsd', textInput({ required: '', type: 'number', min: '1', dir: 'ltr' }), i => Number(i.value), 'amount'],
    ['funded', checkboxInput(), readChecked, 'fundedAccount'],
    ['expiresDays', textInput({ type: 'number', min: '1', max: '365', dir: 'ltr', value: '30' }), i => Number(i.value)],
    ['reason', areaInput({ required: '' })]], 'issueEntitlement')
}
function entitlementsView(main, rows) {
  main.append(el('div', { class: 'tools' }, button('issueEntitlement', () => entitlementDialog(), 'primary')),
    el('p', { class: 'muted' }, t('entitlementHint')), table(null, entitlementColumns, rows))
}

/* ---------- Premium League: schedule, entries, review, standings, awards ---------- */
function tournamentsView(main, rows) {
  main.append(el('p', { class: 'muted' }, t('tournamentHint')),
    table(null, [['name', r => link('tournaments', { id: r.slug }, locale === 'fa' ? r.name_fa : r.name_en)], ['status', status],
      ['startsAt', r => date(r.starts_at)], ['endsAt', r => date(r.ends_at)], ['registered', r => number(r.registered)]], rows))
}
function tournamentView(main, data) {
  const { tournament: tn, registrations = [], standings = [], awards = [], signals = {} } = data
  const reason = () => ['reason', areaInput({ required: '', minlength: '3' })]
  const slugField = ['slug', textInput({ hidden: '', value: tn.slug })]
  const before = Date.parse(tn.starts_at) > Date.now() && ['draft', 'registration'].includes(tn.status)
  const csv = () => {
    const head = ['id', 'status', 'nickname', 'wallet_address', 'email', 'email_verified_at', 'challenge_id', 'out_of_ranking_rule', 'disqualified_reason', 'created_at']
    const esc = v => `"${String(v ?? '').replaceAll('"', '""')}"`
    const blob = new Blob([[head.join(','), ...registrations.map(r => head.map(h => esc(r[h])).join(','))].join('\n') + '\n'], { type: 'text/csv' })
    const a = el('a', { href: URL.createObjectURL(blob), download: `${tn.slug}-registrations.csv` }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  main.append(el('section', { class: 'panel detail' }, el('h2', {}, locale === 'fa' ? tn.name_fa : tn.name_en), technical(tn.slug), status(tn),
    el('span', {}, `${t('startsAt')}: `, date(tn.starts_at)), el('span', {}, `${t('endsAt')}: `, date(tn.ends_at)),
    el('span', {}, `${t('accountSize')}: `, usd(tn.account_size_usd)),
    el('span', {}, `${t('dailyLimit')} ${number(tn.daily_loss_pct)}% · ${t('maxLimit')} ${number(tn.max_loss_pct)}% · ${t('consistency')} ${number(tn.consistency_pct)}%`),
    el('div', { class: 'tools' },
      before ? button('configureTournament', () => operate('tournaments', tn.slug, 'configure', [
        ['startsAt', textInput({ type: 'datetime-local', dir: 'ltr' }), i => i.value ? new Date(i.value).toISOString() : undefined],
        ['tradingDays', textInput({ type: 'number', min: '1', max: '120', dir: 'ltr', value: String(tn.trading_days) }), i => i.value ? Number(i.value) : undefined],
        ['status', selectInput([['registration', 'registration'], ['draft', 'draft'], ['cancelled', 'cancelled']])],
        reason()], 'configureTournament')) : null,
      tn.status === 'finished' ? button('finalizeTournament', () => operate('tournaments', tn.slug, 'finalize', [reason()], 'finalizeTournament'), 'primary') : null,
      tn.status === 'finalized' ? button('issueAwards', () => operate('tournaments', tn.slug, 'issueAwards', [reason()], 'issueAwards'), 'primary') : null,
      registrations.length ? button('exportCsv', csv) : null),
    el('p', { class: 'muted' }, t('tournamentFlowHint'))),
  table('registrations', [['nickname', r => r.nickname ?? '—'], ['wallet', wallet], ['email', r => technical(r.email)], ['status', status],
    ['rule', r => technical(r.out_of_ranking_rule)], ['date', r => date(r.created_at)],
    ['actions', r => r.status === 'disqualified' || tn.status === 'finalized' ? (r.disqualified_reason ?? '—')
      : button('disqualify', () => operate('tournamentEntries', r.id, 'disqualify', [slugField, reason()], 'disqualify'), 'danger')]], registrations),
  table('reviewSignals', [['kind', r => t(r.kind)], ['detail', r => technical(r.detail)]], [
    ...(signals.sharedNetworks ?? []).map(r => ({ kind: 'sharedNetwork', detail: `${r.prefix} × ${r.entries}` })),
    ...(signals.mirroredTrades ?? []).map(r => ({ kind: r.opposite ? 'oppositeTrades' : 'mirroredTrades', detail: `${r.market} · ${r.pairs} · ${r.a} / ${r.b}` })),
    ...(signals.registrationBursts ?? []).map(r => ({ kind: 'registrationBurst', detail: `${r.minute} × ${r.registrations}` }))]),
  table('standings', [['rank', r => r.rank ?? '—'], ['nickname', r => r.nickname ?? '—'], ['wallet', wallet], ['equity', r => usd(r.final_equity)],
    ['maxDrawdown', r => usd(r.max_drawdown_usd)], ['status', r => r.ranked ? badge('ranked') : technical(r.not_ranked_reason)]], standings),
  table('awards', [['rank', r => r.rank ?? '—'], ['nickname', r => r.nickname ?? '—'], ['wallet', wallet], ['kind', r => t('award_' + r.kind)], ['item', r => r.item],
    ['amount', r => r.amount_usd == null ? '—' : usd(r.amount_usd)], ['status', status], ['note', r => r.fulfilment_note ?? '—'],
    ['actions', r => ['cash', 'hardware'].includes(r.kind) ? button('updateAward', () => operate('tournamentAwards', r.id, 'update', [slugField,
      ['status', selectInput([['pending', 'pending'], ['in_progress', 'in_progress'], ['fulfilled', 'fulfilled'], ['cancelled', 'cancelled']])],
      ['note', areaInput({ maxlength: '1000' }), readOptional], reason()], 'updateAward')) : '—']], awards))
}

/* ---------- Migration to Openfund: review queue, decision, pass, firms ---------- */
function migrationsView(main, rows) {
  main.append(el('p', { class: 'muted' }, t('migrationHint')),
    table(null, [['identity', r => link('migrations', { id: r.id }, uid(r))], ['wallet', wallet], ['firm', r => r.firm], ['status', status],
      ['claimedSize', r => usd(r.claimed_max_size_usd)], ['evidence', r => number(r.evidence)], ['date', r => date(r.submitted_at ?? r.created_at)]], rows))
}
function migrationView(main, data) {
  const { request: r, checklist: list, evidence = [], events = [], pass } = data
  const reason = () => ['reason', areaInput({ required: '', minlength: '3' })]
  const check = (ok, key) => el('li', { class: ok ? 'ok' : 'missing' }, (ok ? '✓ ' : '✗ ') + t(key))
  main.append(el('section', { class: 'panel detail' }, el('h2', {}, `${r.firm} · ${t(r.status)}`), technical(r.wallet_address), uid(r), status(r),
    el('span', {}, `${t('claimedSize')}: `, usd(r.claimed_max_size_usd)), r.full_name ? el('span', {}, `${t('fullName')}: ${r.full_name}`) : null,
    r.contact_email ? el('span', {}, `${t('email')}: `, technical(r.contact_email)) : null,
    el('ul', { class: 'checklist' }, check(list.identity, 'checkIdentity'), check(list.fundedAccount, 'checkFunded'),
      el('li', { class: list.payouts ? 'ok' : 'missing' }, `${list.payouts ? '✓' : '✗'} ${t('checkPayouts')}: ${list.payoutCount} / ${list.minPayouts} (${list.windowMonths} ${t('months')})`)),
    el('div', { class: 'tools' },
      r.status === 'submitted' ? button('approveMigration', () => operate('migrations', r.id, 'approve', [
        ['approvedMaxSizeUsd', textInput({ required: '', type: 'number', min: '1', dir: 'ltr', value: String(r.claimed_max_size_usd) }), i => Number(i.value), 'approvedSize'],
        ['kycVerified', checkboxInput(), readChecked, 'kycVerified'], ['nameMatched', checkboxInput(), readChecked, 'nameMatched'], reason()], 'approveMigration'), 'primary') : null,
      r.status === 'submitted' ? button('rejectMigration', () => operate('migrations', r.id, 'reject', [reason()], 'rejectMigration'), 'danger') : null,
      pass?.status === 'issued' ? button('revokePass', () => operate('migrationPasses', pass.id, 'revoke', [reason()], 'revokePass'), 'danger') : null),
    el('p', { class: 'muted' }, t('migrationReviewHint'))),
  table('evidence', [['kind', e => t('ev_' + e.kind)], ['payoutDate', e => e.payoutDate ?? '—'], ['amount', e => e.amountUsd == null ? '—' : usd(e.amountUsd)],
    ['detail', e => e.url ? el('a', { href: e.url, rel: 'noopener noreferrer', target: '_blank' }, t('openLink')) : e.txHash ? technical(`${e.chainId} · ${e.txHash.slice(0, 12)}… · ${e.verification?.verified ? t('verifiedOnChain') : t(e.verification?.reason || 'notVerified')}`) : '—'],
    ['file', e => e.download ? el('a', { href: e.download.url, rel: 'noopener noreferrer' }, `${t('download')} (${Math.round((e.file?.sizeBytes ?? 0) / 1024)} KB)`) : '—']], evidence),
  pass ? table('migrationPass', [['status', status], ['plan', p => p.plans.join(' / ')], ['amount', p => usd(p.max_size_usd)], ['expires', p => date(p.expires_at)], ['order', p => p.purchase_order_id ? link('payments', { id: p.purchase_order_id }, uid({ id: p.purchase_order_id })) : '—']], [pass]) : el('span'),
  table('audit', [['date', e => date(e.created_at)], ['action', e => technical(e.action)], ['username', e => technical(e.actor)]], events))
}
function migrationFirmsView(main, data) {
  const s = data.settings ?? {}
  main.append(el('div', { class: 'tools' },
    button('addFirm', () => firmDialog(), 'primary'),
    button('migrationSettings', () => operate('migrationFirms', 'new', 'settings', [
      ['minPayouts', textInput({ type: 'number', min: '1', max: '20', dir: 'ltr', value: String(s.minPayouts ?? 3) }), i => Number(i.value)],
      ['windowMonths', textInput({ type: 'number', min: '1', max: '36', dir: 'ltr', value: String(s.windowMonths ?? 12) }), i => Number(i.value)],
      ['plans', textInput({ dir: 'ltr', value: (s.plans ?? []).join(', ') }), i => readList(i) ?? undefined, 'eligiblePlans'],
      ['retentionDays', textInput({ type: 'number', min: '7', max: '365', dir: 'ltr', value: String(s.retentionDays ?? 90) }), i => Number(i.value)],
      ['passExpiresDays', textInput({ type: 'number', min: '1', max: '180', dir: 'ltr', value: String(s.passExpiresDays ?? 30) }), i => Number(i.value)],
      ['reason', areaInput({ required: '' })]], 'migrationSettings'))),
  el('p', { class: 'muted' }, `${t('minPayouts')}: ${s.minPayouts} · ${t('windowMonths')}: ${s.windowMonths} · ${t('eligiblePlans')}: ${(s.plans ?? []).join(', ')} · ${t('retentionDays')}: ${s.retentionDays} · ${t('passExpiresDays')}: ${s.passExpiresDays}`),
  el('p', { class: 'muted' }, t('notAffiliatedNote')),
  table(null, [['logo', f => f.has_logo ? el('img', { src: `/api/migrationFirmLogo/${f.id}`, alt: '', width: '32', height: '32', class: 'firm-logo' }) : '—'],
    ['name', f => f.name], ['website', f => f.website_url ? technical(f.website_url) : '—'], ['programTypes', f => (f.program_types ?? []).join(', ') || '—'],
    ['evidenceTypes', f => (f.evidence_types ?? []).join(', ') || '—'], ['status', status],
    ['actions', f => el('div', { class: 'tools' }, button('editFirm', () => firmDialog(f)), button('uploadLogo', () => logoDialog(f)),
      f.has_logo ? button('removeLogo', () => operate('migrationFirms', f.id, 'removeLogo', [['reason', areaInput({ required: '' })]], 'removeLogo'), 'danger') : null)]], data.firms ?? []))
}
function firmDialog(f = null) {
  operate('migrationFirms', 'new', 'save', [
    ['name', textInput({ required: '', maxlength: '60', value: f?.name ?? '' })],
    ['websiteUrl', textInput({ type: 'url', dir: 'ltr', pattern: 'https://.*', value: f?.website_url ?? '' }), readOptional, 'website'],
    ['programTypes', textInput({ maxlength: '600', value: (f?.program_types ?? []).join(', ') }), readOptional],
    ['evidenceTypes', textInput({ maxlength: '600', value: (f?.evidence_types ?? []).join(', ') }), readOptional],
    ['status', selectInput([['active', 'active'], ['inactive', 'inactive']])],
    ['reason', areaInput({ required: '' })]], f ? 'editFirm' : 'addFirm')
}
/* the owner's own logo file: PNG, JPEG or WebP up to 200 KB (never downloaded or recreated here) */
function logoDialog(f) {
  const file = el('input', { type: 'file', required: '', accept: 'image/png,image/jpeg,image/webp' })
  const read = () => new Promise((resolve, reject) => {
    const picked = file.files?.[0]
    if (!picked || picked.size > 204800) return reject(Object.assign(new Error('file_too_large'), { code: 'file_too_large' }))
    const reader = new FileReader()
    reader.onload = () => resolve({ contentType: picked.type, dataBase64: String(reader.result).split(',')[1] })
    reader.onerror = reject
    reader.readAsDataURL(picked)
  })
  const holder = { value: null }
  file.addEventListener('change', () => { read().then(v => { holder.value = v }).catch(() => { holder.value = null }) })
  operate('migrationFirms', f.id, 'logo', [
    ['file', file, () => undefined, 'logoFile'],
    ['contentType', el('span', { hidden: '' }), () => holder.value?.contentType],
    ['dataBase64', el('span', { hidden: '' }), () => holder.value?.dataBase64],
    ['reason', areaInput({ required: '' })]], 'uploadLogo')
}

/* ---------- site search analytics (ADR 0052) ---------- */
function siteSearchAdd(kind, query) {
  const password = el('input', { required: '', type: 'password', dir: 'ltr', autocomplete: 'current-password' })
  const submit = el('button', { class: 'primary' }, t('confirm'))
  const feedback = el('p', { role: 'alert' })
  const terms = areaInput({ required: '', rows: '4', maxlength: '1200' }); terms.value = query + '\n'
  const routeBox = textInput({ required: '', dir: 'ltr', maxlength: '80', pattern: '[a-z0-9][a-z0-9/-]*' })
  const fa = textInput({ required: '', maxlength: '80' }), en = textInput({ required: '', maxlength: '80', dir: 'ltr' })
  const fields = kind === 'synonym' ? [field('synonymTerms', terms)] : [field('suggestionRoute', routeBox), field('labelFa', fa), field('labelEn', en)]
  const form = el('form', { on: { submit: async event => {
    event.preventDefault()
    submit.disabled = true
    try {
      const payload = kind === 'synonym'
        ? { kind, terms: terms.value.split('\n').map(v => v.trim()).filter(Boolean), password: password.value }
        : { kind, route: routeBox.value.trim(), labelFa: fa.value.trim(), labelEn: en.value.trim(), password: password.value }
      await api('siteSearchTerms', payload)
      dialog.close(); render(); announce('success')
    } catch (error) { feedback.textContent = errorText(error) } finally { password.value = ''; submit.disabled = false }
  } } }, el('h2', {}, t(kind === 'synonym' ? 'addSynonym' : 'addSuggestion')), el('p', { class: 'muted' }, technical(query)),
  fields, field('password', password), feedback, el('div', { class: 'tools' }, button('cancel', () => dialog.close()), submit))
  dialog.replaceChildren(form)
  dialog.showModal()
}
async function siteSearchView(main, params) {
  const pick = name => params.get(name) ?? ''
  const from = textInput({ type: 'date', name: 'from', value: pick('from'), dir: 'ltr' }), to = textInput({ type: 'date', name: 'to', value: pick('to'), dir: 'ltr' })
  const localeBox = selectInput([['', 'allLocales'], ...['fa', 'en', 'ar', 'ru', 'zh-CN'].map(l => [l, l])]); localeBox.name = 'locale'; localeBox.value = pick('locale')
  const q = textInput({ name: 'q', value: pick('q'), maxlength: '80' })
  const current = () => Object.fromEntries([['from', from.value], ['to', to.value], ['locale', localeBox.value], ['q', q.value.trim()]].filter(([, v]) => v))
  main.append(el('p', { class: 'muted' }, t('siteSearchHint')),
    el('form', { class: 'filters', on: { submit: e => {
      e.preventDefault()
      const next = route('siteSearch', current())
      if (location.hash === next) render(); else location.hash = next
    } } }, field('fromDate', from), field('toDate', to), field('language', localeBox), field('queryContains', q), el('button', { class: 'primary' }, t('apply')),
      el('a', { class: 'button', href: '/api/siteSearch/export.csv?' + new URLSearchParams(current()), download: 'site-search.csv' }, t('exportCsv'))))
  const data = await api('siteSearch?' + new URLSearchParams(current()))
  const tot = data.totals ?? {}
  main.append(table(null, [['searches', r => number(r.searches)], ['withResults', r => number(r.results)], ['zeroResults', r => number(r.searches - r.results)],
    ['clicks', r => number(r.clicks)], ['distinctQueries', r => number(r.queries)]], [tot]))
  const trend = data.trend ?? []
  if (trend.length) {
    const max = Math.max(1, ...trend.map(r => r.searches)), w = 640, h = 120, step = trend.length > 1 ? w / (trend.length - 1) : 0
    const pts = key => trend.map((r, i) => `${(i * step).toFixed(1)},${(h - (r[key] / max) * (h - 8)).toFixed(1)}`).join(' ')
    const NS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', t('trend'))
    svg.setAttribute('class', 'trend'); svg.style.width = '100%'; svg.style.maxWidth = w + 'px'
    for (const [key, color] of [['searches', '#82e7bd'], ['results', '#e89483'], ['clicks', 'currentColor']]) {
      const line = document.createElementNS(NS, 'polyline'); line.setAttribute('points', pts(key)); line.setAttribute('fill', 'none'); line.setAttribute('stroke', color); line.setAttribute('stroke-width', '2'); svg.append(line)
    }
    main.append(el('section', { class: 'panel' }, el('h2', {}, t('trend')), svg,
      el('p', { class: 'muted' }, `${t('searches')} · ${t('withResults')} · ${t('clicks')}`)),
    table(null, [['day', r => technical(r.day)], ['searches', r => number(r.searches)], ['withResults', r => number(r.results)], ['clicks', r => number(r.clicks)]], trend.slice(-31).reverse()))
  }
  const actions = r => el('div', { class: 'tools' }, button('addSynonym', () => siteSearchAdd('synonym', r.query)), button('addSuggestion', () => siteSearchAdd('suggestion', r.query)))
  const cols = [['query', r => technical(r.query)], ['language', r => technical(r.locale)], ['searches', r => number(r.searches)], ['withResults', r => number(r.results)],
    ['clicks', r => number(r.clicks)], ['actions', actions]]
  main.append(table('topQueries', cols, data.top ?? []), table('zeroResultQueries', cols, data.zeroResults ?? []), table('noClickQueries', cols, data.noClicks ?? []))
}

/* ---------- plans: draft, preview diff, publish, retire ---------- */
function plansView(main, rows) {
  main.append(el('div', { class: 'tools' }, button('createPlan', () => planEditor(null, rows[0]), 'primary')),
    el('p', { class: 'muted' }, t('plansHint')),
    table(null, [['plan', r => technical(r.slug)], ['name', r => r.name], ['status', r => badge(r.status)],
      ['version', r => number(r.configuration?.catalogVersion ?? 1)], ['challenges', r => number(r.challenges)],
      ['action', r => el('div', { class: 'tools' }, button('editPlan', () => planEditor(r)),
        button(r.status === 'active' ? 'retirePlan' : 'reactivatePlan', () => operate('plans', r.slug, r.status === 'active' ? 'retire' : 'reactivate', [['reason', areaInput({ required: '' })]], r.status === 'active' ? 'retirePlan' : 'reactivatePlan'), r.status === 'active' ? 'danger' : ''))]], rows),
    ...rows.filter(r => r.history?.length).map(r => table(null, [['plan', () => technical(r.slug)], ['action', h => el('span', { class: 'badge' }, t({ publish: 'publishPlan', retire: 'retirePlan', reactivate: 'reactivatePlan' }[h.action] ?? h.action))], ['version', h => number(h.version)], ['username', h => technical(h.actor)], ['reason', h => h.reason], ['date', h => date(h.at)]], r.history.slice(0, 10))))
}
function planEditor(record, template) {
  const source = record ?? template ?? { slug: '', name: ' — ', configuration: {} }
  const [fa, en] = String(source.name).split(/\s+—\s+/)
  const slug = textInput({ required: '', dir: 'ltr', pattern: '[a-z0-9][a-z0-9-]{1,39}', value: record ? record.slug : '' })
  if (record) slug.setAttribute('readonly', '')
  const nameFa = textInput({ required: '', dir: 'rtl', maxlength: '80', value: record ? fa ?? '' : '' })
  const nameEn = textInput({ required: '', dir: 'ltr', maxlength: '80', value: record ? en ?? '' : '' })
  const config = el('textarea', { rows: '18', dir: 'ltr', spellcheck: 'false', class: 'code', 'aria-label': t('configuration') })
  const { catalogVersion, ...editable } = source.configuration ?? {}
  config.value = JSON.stringify(editable, null, 2)
  const result = el('div', { class: 'plan-preview', 'aria-live': 'polite' })
  const reason = areaInput({ required: '' }), password = el('input', { type: 'password', dir: 'ltr', autocomplete: 'current-password', required: '' })
  const feedback = el('p', { role: 'alert' })
  const publish = el('button', { class: 'primary', type: 'button', disabled: '' }, t('publishPlan'))
  const draft = () => { try { return { slug: slug.value.trim(), nameFa: nameFa.value, nameEn: nameEn.value, configuration: JSON.parse(config.value) } } catch { throw Object.assign(new Error('invalid_configuration'), { details: [] }) } }
  const preview = async () => {
    feedback.textContent = ''; publish.disabled = true
    try {
      const p = await api('planPreview', draft())
      result.replaceChildren(...[
        el('h3', {}, t('previewDiff')), el('p', {}, t('nextVersion'), ' ', technical(String(p.nextCatalogVersion))),
        p.problems.length ? el('ul', { class: 'problems', role: 'alert' }, p.problems.map(x => el('li', {}, x))) : el('p', { class: 'muted' }, t('planValid')),
        p.diff.length ? table(null, [['field', d => technical(d.field)], ['before', d => el('code', { dir: 'ltr' }, JSON.stringify(d.before))], ['after', d => el('code', { dir: 'ltr' }, JSON.stringify(d.after))]], p.diff)
          : el('p', { class: 'muted' }, t('plan_unchanged')),
        p.nameChanged ? el('p', { class: 'muted' }, t('nameChanged')) : null].filter(Boolean))
      publish.disabled = p.problems.length > 0 || (p.diff.length === 0 && !p.nameChanged)
    } catch (error) { feedback.textContent = errorText(error) }
  }
  publish.addEventListener('click', async () => {
    if (!password.value || !reason.value.trim()) { feedback.textContent = t('passwordRequired'); return }
    publish.disabled = true
    try {
      await api('plans/' + encodeURIComponent(slug.value.trim()), { action: 'publish', ...draft(), reason: reason.value, password: password.value })
      dialog.close(); render(); announce('success')
    } catch (error) { feedback.textContent = errorText(error); publish.disabled = false } finally { password.value = '' }
  })
  const form = el('form', { class: 'wide', on: { submit: e => e.preventDefault(), input: () => { publish.disabled = true } } },
    el('h2', {}, t(record ? 'editPlan' : 'createPlan')), el('p', { class: 'muted' }, t('plansHint')),
    field('plan', slug), el('div', { class: 'tools' }, field('nameFa', nameFa), field('nameEn', nameEn)),
    field('configuration', config), el('div', { class: 'tools' }, button('previewDiff', () => { void preview() })), result,
    field('reason', reason), field('password', password), feedback,
    el('div', { class: 'tools' }, button('cancel', () => dialog.close()), publish))
  dialog.replaceChildren(form)
  dialog.classList.add('wide-dialog')
  dialog.addEventListener('close', () => dialog.classList.remove('wide-dialog'), { once: true })
  dialog.showModal()
}

async function dashboard(main) {
  const items = [
    ['users', 'users'],
    ['challenges', 'challenges?status=started', { status: 'started' }],
    ['reviews', 'reviews'],
    ['payouts', 'payouts?status=requested&scope=real', { status: 'requested', scope: 'real' }],
    ['support', 'support?status=new', { status: 'new' }],
  ]
  const grid = el('div', { class: 'metrics' })
  main.append(el('h2', {}, t('operational')), el('p', { class: 'muted' }, t('queueNote')), grid)
  await Promise.all(items.map(async ([key, endpoint, filter]) => {
    const value = el('strong', {}, '—')
    grid.append(el('article', { class: 'panel metric' }, link(key, filter), value))
    try {
      const result = await api(endpoint)
      value.textContent = number(result.total ?? result.rows.length)
    } catch { value.textContent = t('notReported') }
  }))
}

/* ---------------- Content workspace (editorial copy in Directus) ---------------- */
let contentCatalog
const contentState = { view: 'home', locale: 'fa', q: '', offset: 0, shared: false, surface: null }
function previewPath(route, locale) {
  if (!route) return `/${locale}/home`
  let path = route.path
  if (path === '/' || path === '*' || path.startsWith('/:section') || path.includes('${product}/:page')) return `/${locale}/home`
  if (path.includes('${product}')) return `/${locale}/prop/dashboard`
  if (!path.startsWith('/')) return `/${locale}/prop/${path}`
  path = path.replace(':locale', locale).split('/').filter(part => !part.startsWith(':')).join('/')
  return path || `/${locale}/home`
}
function contentEditor({ title, source, current, locale, onSave }) {
  const value = el('textarea', { rows: '6', maxlength: '20000', required: '', dir: locale === 'fa' || locale === 'ar' ? 'rtl' : 'ltr' })
  value.value = current ?? ''
  const password = el('input', { required: '', type: 'password', dir: 'ltr', autocomplete: 'current-password' })
  const submit = el('button', { class: 'primary' }, t('saveContent'))
  const feedback = el('p', { role: 'alert' })
  const holes = (source.en.match(/\$\{[^}]+\}|\{\{[^}]+\}\}|\{[A-Za-z_][\w.]*\}/g) || [])
  const form = el('form', { on: { submit: async event => {
    event.preventDefault()
    submit.disabled = true
    try {
      await onSave(value.value, password.value)
      dialog.close()
      announce('contentSaved')
      render()
    } catch (error) {
      feedback.textContent = errorText(error)
    } finally { password.value = ''; submit.disabled = false }
  } } }, el('h2', {}, title),
  el('dl', { class: 'payout-facts' },
    el('div', {}, el('dt', {}, t('sourceEnglish')), el('dd', { dir: 'ltr' }, source.en || '—')),
    el('div', {}, el('dt', {}, t('sourcePersian')), el('dd', { dir: 'rtl' }, source.fa || '—'))),
  holes.length ? el('p', { class: 'muted' }, t('keepPlaceholders'), ' ', technical(holes.join(' '))) : null,
  el('p', { class: 'muted' }, t('plainTextOnly')),
  field('valueForLocale', value), field('password', password), feedback,
  el('div', { class: 'tools' }, button('cancel', () => dialog.close()), submit))
  dialog.replaceChildren(form)
  dialog.showModal()
}
function contentStatus(body) {
  const password = el('input', { required: '', type: 'password', dir: 'ltr', autocomplete: 'current-password' })
  const submit = el('button', { class: body.status === 'published' ? 'primary' : 'danger' }, t('confirm'))
  const feedback = el('p', { role: 'alert' })
  const form = el('form', { on: { submit: async event => {
    event.preventDefault()
    submit.disabled = true
    try {
      await api('content/status', { ...body, password: password.value })
      dialog.close(); announce('contentSaved'); render()
    } catch (error) { feedback.textContent = errorText(error) }
    finally { password.value = ''; submit.disabled = false }
  } } }, el('h2', {}, t(body.status === 'published' ? 'publishItem' : 'unpublishItem')),
  el('p', { class: 'muted' }, t(body.status === 'published' ? 'publishHint' : 'unpublishHint')),
  field('password', password), feedback, el('div', { class: 'tools' }, button('cancel', () => dialog.close()), submit))
  dialog.replaceChildren(form)
  dialog.showModal()
}
/* one confirmed content write (create, archive, reorder, mailbox); extra
   inputs are read into the request body */
function contentWrite(action, body, titleKey, inputs = [], hintKey = null) {
  const password = el('input', { required: '', type: 'password', dir: 'ltr', autocomplete: 'current-password' })
  const submit = el('button', { class: action === 'status' && body.status === 'archived' ? 'danger' : 'primary' }, t('confirm'))
  const feedback = el('p', { role: 'alert' })
  const form = el('form', { on: { submit: async event => {
    event.preventDefault(); submit.disabled = true
    try {
      const extra = {}
      for (const [key, input, read] of inputs) extra[key] = read ? read(input) : input.value
      await api('content/' + action, { ...body, ...extra, password: password.value })
      dialog.close(); announce('contentSaved'); render()
    } catch (error) { feedback.textContent = errorText(error) } finally { password.value = ''; submit.disabled = false }
  } } }, el('h2', {}, t(titleKey)), hintKey ? el('p', { class: 'muted' }, t(hintKey)) : null,
  inputs.map(([key, input, , label]) => field(label ?? key, input)), field('password', password), feedback,
  el('div', { class: 'tools' }, button('cancel', () => dialog.close()), submit))
  dialog.replaceChildren(form)
  dialog.showModal()
}
function createItemDialog(surface) {
  const slug = textInput({ dir: 'ltr', pattern: '[a-z0-9][a-z0-9-]{1,79}', maxlength: '80' })
  const inputs = [['slug', slug, i => i.value.trim() || null, 'slug']]
  const copy = { fa: {}, en: {} }
  for (const locale of ['fa', 'en']) for (const f of surface.translatedFields) {
    const input = (/body|answer|definition|summary|about|method|limitations|explanation/.test(f) ? areaInput : textInput)({ dir: locale === 'fa' ? 'rtl' : 'ltr', maxlength: '20000', ...(f === surface.translatedFields[0] ? { required: '' } : {}) })
    copy[locale][f] = input
    inputs.push([`${locale}.${f}`, input, () => undefined, `${f} (${locale})`])
  }
  inputs.push(['copy', el('span', { hidden: '' }), () => Object.fromEntries(Object.entries(copy).map(([l, fields]) => [l, Object.fromEntries(Object.entries(fields).map(([f, i]) => [f, i.value.trim()]).filter(([, v]) => v))]))])
  contentWrite('create', { collection: surface.collection }, 'createItem', inputs, 'createItemHint')
}
async function contentExtras(main, catalog) {
  /* owner-gated protected values: the four department mailboxes */
  try {
    const p = await api('content/protected')
    main.append(el('section', { class: 'panel table-box' }, el('h2', {}, t('protectedSettings')), el('p', { class: 'muted' }, t('protectedHint')),
      table(null, [['fieldName', r => technical(r.field)], ['valueForLocale', r => r.value ? technical(r.value) : el('span', { class: 'muted' }, t('notPublished'))],
        ['action', r => p.writable ? button('editContent', () => contentWrite('protected', { field: r.field }, 'editMailbox',
          [['value', textInput({ type: 'email', dir: 'ltr', maxlength: '254', value: r.value ?? '' }), undefined, 'emailAddress']], 'mailboxHint')) : '—']], p.fields)))
  } catch (error) { main.append(el('p', { class: 'empty', role: 'alert' }, errorText(error))) }
  /* media library (public campaign-media folder) */
  try {
    const m = await api('content/media')
    const input = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', 'aria-label': t('uploadImage'), on: { change: async () => {
      const file = input.files?.[0]; if (!file) return
      if (file.size > 3 * 1024 * 1024) { announce('invalid_image'); return }
      const data = await new Promise(res => { const reader = new FileReader(); reader.onload = () => res(String(reader.result).split(',')[1]); reader.readAsDataURL(file) })
      try { await api('content/upload', { filename: file.name.replace(/[^\w .()-]/g, '_').slice(0, 80), contentType: file.type, data }); announce('uploaded'); render() }
      catch (error) { announcement.textContent = errorText(error) }
    } } })
    main.append(el('section', { class: 'panel table-box' }, el('h2', {}, t('mediaLibrary')), el('p', { class: 'muted' }, t('mediaHint')),
      catalog.writable ? field('uploadImage', input) : null,
      table(null, [['name', r => r.title ?? '—'], ['kind', r => technical(r.type)], ['date', r => date(r.uploaded_on)],
        ['action', r => button('copyUrl', () => { void navigator.clipboard?.writeText(r.url); announce('copied') })]], m.files)))
  } catch (error) { main.append(el('p', { class: 'empty', role: 'alert' }, errorText(error))) }
}

async function contentWorkspace(main) {
  contentCatalog ??= await api('content/catalog')
  const catalog = contentCatalog
  const routes = catalog.routes.filter(r => r.areas.length || r.collections.some(c => c !== 'ui_messages'))
  if (!routes.some(r => r.view === contentState.view)) contentState.view = routes[0]?.view
  const route = routes.find(r => r.view === contentState.view)
  const path = previewPath(route, contentState.locale)

  const steps = el('ol', { class: 'wizard-steps' }, ['stepPage', 'stepLanguage', 'stepField', 'stepPublish'].map(k => el('li', {}, t(k))))
  const routeSelect = el('select', { 'aria-label': t('stepPage'), on: { change: e => { contentState.view = e.target.value; contentState.offset = 0; contentState.surface = null; render() } } },
    routes.map(r => el('option', { value: r.view }, `${r.path} — ${r.view}`)))
  routeSelect.value = contentState.view
  const localeSelect = el('select', { 'aria-label': t('stepLanguage'), on: { change: e => { contentState.locale = e.target.value; render() } } },
    catalog.locales.map(l => el('option', { value: l }, l)))
  localeSelect.value = contentState.locale
  const sharedBox = el('input', { type: 'checkbox', on: { change: e => { contentState.shared = e.target.checked; contentState.offset = 0; render() } } })
  sharedBox.checked = contentState.shared
  const visual = el('a', { href: `${catalog.cms}/admin/visual/${catalog.site}${path}`, target: '_blank', rel: 'noopener noreferrer', class: 'button' }, t('visualMode'))
  main.append(steps,
    el('section', { class: 'panel detail' },
      el('div', { class: 'filters' }, field('stepPage', routeSelect), field('stepLanguage', localeSelect), field('includeShared', sharedBox)),
      catalog.writable ? null : el('p', { role: 'status', class: 'muted' }, t('contentReadOnly')),
      el('div', { class: 'tools' }, visual)),
    el('section', { class: 'panel content-preview' }, el('h2', {}, t('livePreview')), technical(catalog.site + path),
      el('iframe', { src: catalog.site + path, title: t('livePreview'), sandbox: 'allow-scripts allow-same-origin', loading: 'lazy', referrerpolicy: 'no-referrer' })))

  /* step 3a: interface copy */
  const params = new URLSearchParams({ view: contentState.view, locale: contentState.locale, offset: String(contentState.offset), shared: contentState.shared ? '1' : '0', q: contentState.q })
  const data = await api('content/fields?' + params)
  const search = el('input', { value: contentState.q, maxlength: '80', placeholder: t('contentSearch'), 'aria-label': t('contentSearch') })
  const editMessage = row => contentEditor({ title: t('editInterfaceCopy'), source: row, current: row.value ?? (contentState.locale === 'fa' ? row.fa : contentState.locale === 'en' ? row.en : ''), locale: contentState.locale,
    onSave: (value, password) => api('content/save', { kind: 'message', key: row.key, locale: contentState.locale, value, password }) })
  main.append(el('section', { class: 'panel table-box' }, el('h2', {}, t('interfaceCopy')),
    el('form', { class: 'filters', on: { submit: e => { e.preventDefault(); contentState.q = search.value; contentState.offset = 0; render() } } }, search, el('button', { class: 'primary' }, t('apply'))),
    data.fields.length ? el('div', { class: 'table-scroll', tabindex: '0' }, el('table', {},
      el('thead', {}, el('tr', {}, ['sourceEnglish', 'valueForLocale', 'status', 'action'].map(k => el('th', { scope: 'col' }, t(k))))),
      el('tbody', {}, data.fields.map(row => el('tr', {},
        el('td', { dir: 'ltr' }, row.en),
        el('td', { dir: contentState.locale === 'fa' || contentState.locale === 'ar' ? 'rtl' : 'ltr' }, row.value ?? el('span', { class: 'muted' }, t('noTranslation'))),
        el('td', {}, badge(row.status)),
        el('td', {}, catalog.writable && row.status !== 'not_seeded' ? el('div', { class: 'tools' },
          button('editContent', () => editMessage(row)),
          row.status === 'published' ? button('unpublishItem', () => contentStatus({ collection: 'ui_messages', key: row.key, status: 'draft' }))
            : button('publishItem', () => contentStatus({ collection: 'ui_messages', key: row.key, status: 'published' }), 'primary')) : '—')))))) :
      el('p', { class: 'empty' }, t('empty')),
    el('nav', { class: 'pager' },
      data.offset > 0 ? button('previous', () => { contentState.offset = Math.max(0, data.offset - data.pageSize); render() }) : null,
      number(data.total),
      data.offset + data.pageSize < data.total ? button('next', () => { contentState.offset = data.offset + data.pageSize; render() }) : null)))

  /* step 3b: structured surfaces owned by this route */
  const surfaces = route.collections.filter(c => catalog.surfaces.some(s => s.collection === c))
  if (surfaces.length) {
    main.append(el('section', { class: 'panel detail' }, el('h2', {}, t('structuredContent')),
      el('div', { class: 'tools' }, surfaces.map(c => button(c === contentState.surface ? 'selectedSurface' : 'openSurface', () => { contentState.surface = c; render() }, c === contentState.surface ? 'primary' : '')).map((b, i) => { b.textContent = surfaces[i]; return b }))))
    if (contentState.surface && surfaces.includes(contentState.surface)) {
      const surface = await api('content/surface?' + new URLSearchParams({ collection: contentState.surface, locale: contentState.locale }))
      const rows = surface.items.flatMap(item => [
        ...surface.translatedFields.map(f => ({ item, field: f, value: item.values[f], en: item.english[f], shared: false })),
        ...surface.sharedFields.map(f => ({ item, field: f, value: item.values[f], en: item.values[f], shared: true }))])
      const ids = surface.items.map(i => i.id)
      const itemActions = !surface.singleton && catalog.writable ? el('section', { class: 'panel table-box' }, el('h2', {}, t('itemsAndOrder')),
        el('div', { class: 'tools' }, button('createItem', () => createItemDialog(surface), 'primary')),
        table(null, [['identity', i => technical(String(i.id))], ['valueForLocale', i => i.values[surface.translatedFields[0]] ?? i.english[surface.translatedFields[0]] ?? '—'], ['status', i => i.status ? badge(i.status) : '—'],
          ['action', i => { const at = ids.indexOf(i.id); return el('div', { class: 'tools' },
            at > 0 ? button('moveUp', () => contentWrite('reorder', { collection: surface.collection, item: String(i.id), to: String(ids[at - 1]) }, 'moveUp')) : null,
            at < ids.length - 1 ? button('moveDown', () => contentWrite('reorder', { collection: surface.collection, item: String(i.id), to: String(ids[at + 1]) }, 'moveDown')) : null,
            i.status !== 'archived' ? button('archiveItem', () => contentWrite('status', { collection: surface.collection, item: i.id, status: 'archived' }, 'archiveItem', [], 'archiveHint'), 'danger')
              : button('restoreDraft', () => contentWrite('status', { collection: surface.collection, item: i.id, status: 'draft' }, 'restoreDraft'))) }]], surface.items)) : null
      main.append(...(itemActions ? [itemActions] : []), el('section', { class: 'panel table-box' }, el('h2', {}, technical(surface.collection)),
        surface.readOnlyFields.length ? el('p', { class: 'muted' }, t('jsonInStudio'), ' ', technical(surface.readOnlyFields.join(', '))) : null,
        rows.length ? el('div', { class: 'table-scroll', tabindex: '0' }, el('table', {},
          el('thead', {}, el('tr', {}, ['identity', 'fieldName', 'valueForLocale', 'status', 'action'].map(k => el('th', { scope: 'col' }, t(k))))),
          el('tbody', {}, rows.map(row => el('tr', {},
            el('td', {}, technical(String(row.item.id))), el('td', {}, technical(row.field)),
            el('td', {}, row.value ?? el('span', { class: 'muted' }, t('noTranslation'))),
            el('td', {}, row.item.status ? badge(row.item.status) : '—'),
            el('td', {}, catalog.writable ? el('div', { class: 'tools' },
              button('editContent', () => contentEditor({ title: `${surface.collection} · ${row.field}`, source: { en: row.en ?? '', fa: '' }, current: row.value, locale: contentState.locale,
                onSave: (value, password) => api('content/save', { kind: 'surface', collection: surface.collection, item: row.item.id, field: row.field, locale: contentState.locale, value, password }) })),
              row.item.status && !surface.singleton ? (row.item.status === 'published'
                ? button('unpublishItem', () => contentStatus({ collection: surface.collection, item: row.item.id, status: 'draft' }))
                : button('publishItem', () => contentStatus({ collection: surface.collection, item: row.item.id, status: 'published' }), 'primary')) : null) : '—')))))) :
          el('p', { class: 'empty' }, t('empty'))))
    }
  }
  await contentExtras(main, catalog)
}

let marketingModule, bountyModule, guidesModule
const marketing = () => (marketingModule ??= createMarketing({ el, t, labels, button, field, badge, technical, number, date, dialog, announce,
  render: () => render(), csrf: () => session?.csrf ?? '' }))
const bountyUi = () => (bountyModule ??= createBounty({ el, t, labels, button, field, badge, technical, number, dialog, announce,
  render: () => render(), csrf: () => session?.csrf ?? '' }))
const guidesUi = () => (guidesModule ??= createGuides({ el, t, labels, button, field, badge, technical, number, dialog, announce,
  render: () => render(), csrf: () => session?.csrf ?? '' }))

async function render() {
  const renderId = ++revision
  chrome()
  if (!session) return login()
  let [page, query] = location.hash.replace(/^#\//, '').split('?')
  if (![...groups.flatMap(([, pages]) => pages), 'dashboard'].includes(page)) page = 'dashboard'
  const main = el('main', { id: 'main' })
  workspace.className = 'shell' + (showNav ? ' nav-open' : '') + (collapsed ? ' nav-collapsed' : '')
  workspace.replaceChildren(nav(page), main)
  const layout = el('div', { class: 'page-title' }, el('div', {}, page === 'dashboard' ? null : el('p', { class: 'crumb' }, link('dashboard'), ' / ', st(page)),
    el('h1', {}, st(page))), button('refresh', render))
  const contents = el('div')
  main.append(layout, el('p', { class: 'muted', role: 'status' }, t('loading')), contents)
  try {
    if (page === 'dashboard') await dashboard(contents)
    else if (page === 'content') await contentWorkspace(contents)
    else if (page === 'bugBounty') await bountyUi().workspace(contents)
    else if (page === 'guides') await guidesUi().workspace(contents)
    else if (page === 'campaigns' || page === 'announcements') await marketing().workspace(contents, page === 'campaigns' ? 'modal' : 'announcement_bar')
    else if (page === 'system') {
      const data = await api('system')
      contents.append(table(null, [['backend', r => badge(r.backendReady ? 'ready' : 'unknown')], ['region', r => t(r.region)], ['mode', r => t(r.mode)],
        ['epoch', r => number(r.epoch)], ['version', r => technical(r.version)], ['identity', r => technical(r.commit)]], [data]))
      /* both operating regions side by side (ADR 0043): release identity must match */
      if (data.regions?.length > 1) contents.append(table('regions', [['region', r => technical(r.name)],
        ['backend', r => badge(!r.reachable ? 'unknown' : r.ready ? 'ready' : 'unknown')], ['mode', r => r.mode ? t(r.mode) : '—'],
        ['engineRunning', r => badge(r.engine ? 'ready' : 'unknown')], ['marketData', r => technical(r.freshMarks == null ? '—' : `${number(r.freshMarks)} · ${r.execution ?? ''}`)],
        ['version', r => technical(r.version)], ['identity', r => technical(r.commit)],
        ['sameRelease', r => badge(r.commit && r.commit === data.regions[0].commit ? 'ready' : 'unknown')]], data.regions))
    } else if (page === 'paymentOverview') {
      const d = await api('paymentOverview')
      const metric = (key, value) => el('article', { class: 'panel metric' }, el('span', {}, t(key)), el('strong', {}, String(value ?? '—')))
      contents.append(
        el('div', { class: 'metrics' },
          metric('paymentIntents', d.orders?.intents_total), metric('settledOrders', d.orders?.settled), metric('partiallyPaid', d.orders?.partially_paid),
          metric('pendingTransactions', d.transactions?.pending), metric('unmatchedDeposits', d.transactions?.unmatched), metric('ambiguousDeposits', d.transactions?.ambiguous),
          metric('rejectedPayments', d.rejectedAttempts), metric('overpayments', '$' + (d.refunds?.overpayment_usd ?? '0')), metric('refundLiabilities', '$' + (d.refunds?.open_usd ?? '0')),
          metric('refundsAwaitingReview', d.refunds?.awaiting_review), metric('delayedPayments', d.attempts?.pending_over_20m), metric('provisioningFailures', d.attempts?.provisioning_failures)),
        table('alerts', [['alert', r => badge(r)]], d.alerts ?? []),
        table('watcher', [['network', r => technical(String(r.chainId))], ['lagBlocks', r => number(r.lagBlocks)], ['lastSuccess', r => r.secondsSinceSuccess == null ? '—' : number(r.secondsSinceSuccess) + 's'],
          ['status', r => badge(r.failing ? 'failing' : 'ready')]], d.watcher ?? []),
        table('paymentMethods', [['method', r => t(r.method)], ['status', r => badge(r.enabled ? 'active' : 'inactive')], ['source', r => t(r.source)]],
          Object.entries(d.methods ?? {}).map(([method, v]) => ({ method, ...v }))))
    } else if (page === 'paymentSettings') {
      const d = await api('paymentSettings')
      contents.append(el('p', { class: 'muted' }, t('paymentSettingsNote')),
        table(null, [['method', r => t(r.method)], ['status', r => badge(r.enabled ? 'active' : 'inactive')], ['source', r => t(r.source)],
          ['recordedBy', r => technical(r.updatedBy ?? '—')], ['date', r => r.updatedAt ? date(r.updatedAt) : '—'],
          ['action', r => button(r.enabled ? 'disable' : 'activate', () => operate('paymentSettings', r.method, r.enabled ? 'disable' : 'enable',
            [['reason', areaInput({ required: '' })]], r.enabled ? 'disable' : 'activate'), r.enabled ? 'danger' : 'primary')]],
        Object.entries(d.methods ?? {}).map(([method, v]) => ({ method, ...v }))))
    } else if (page === 'paymentSearch') {
      const params = new URLSearchParams(query)
      const inputs = ['orderId', 'wallet', 'txHash', 'chainId', 'method', 'status', 'from', 'to'].map(name =>
        el('input', { name, value: params.get(name) ?? '', maxlength: '80', placeholder: t(name), 'aria-label': t(name), dir: 'ltr', type: ['from', 'to'].includes(name) ? 'date' : 'text' }))
      contents.append(el('form', { class: 'filters', on: { submit: e => {
        e.preventDefault()
        const filters = Object.fromEntries([...new FormData(e.target)].filter(([, v]) => String(v).trim()))
        const next = route('paymentSearch', filters)
        if (location.hash === next) render(); else location.hash = next
      } } }, inputs, el('button', { class: 'primary' }, t('apply'))))
      if ([...params.keys()].length) {
        const data = await api('paymentSearch?' + params)
        contents.append(table('result', [['identity', r => link('payments', { id: r.id }, technical(r.id))], ['wallet', wallet], ['status', r => badge(r.lifecycle_state)],
          ['amount', r => usd(r.price_usd)], ['received', r => technical('$' + r.received_usd)], ['excessAmount', r => technical('$' + r.excess_usd)],
          ['chainTransactions', r => number(r.transactions)], ['date', r => date(r.created_at)]], data.rows ?? []))
      }
    } else if (page === 'finance') {
      const data = await api('finance')
      contents.append(
        el('div', { class: 'tools' }, button('treasuryRefresh', () => operate('finance', 'treasury', 'refresh', [], 'treasuryRefresh'), 'primary')),
        table(null, [['positionStatus', r => badge(r.status ?? 'unknown')], ['available', r => usd(r.availableAllocatableUsd)],
          ['liabilities', r => usd(r.outstandingObligationsUsd)], ['treasuryTotal', r => usd(r.treasury?.totalUsd)],
          ['date', r => date(r.calculatedAt)]], [data]))
      try {
        const { policies, entries } = await api('allocations')
        contents.append(table('allocations', [['date', r => date(r.created_at ?? r.effective_at)], ['treasuryTotal', r => usd(r.treasury_usd)],
          ['available', r => usd(r.operations_usd)], ['reference', r => technical(r.purchase_order_id ?? r.version)]], [...(entries ?? []), ...(policies ?? [])].slice(0, 50)))
      } catch { /* allocations are optional */ }
    } else if (page === 'risk') {
      const data = await api('risk')
      contents.append(
        table('engineLoop', [['lastPass', r => date(r.engineLoop?.lastPassAt)], ['lag', r => r.engineLoop?.lagMs == null ? '—' : number(Math.round(r.engineLoop.lagMs / 100) / 10) + 's'],
          ['feedHealth', r => technical(`${number(r.feed?.fresh)} / ${number(r.feed?.markets)}`)]], [data]),
        table('openPositions', [['wallet', wallet], ['plan', plan], ['identity', r => link('challenges', { id: r.challenge_id }, technical(r.challenge_id))],
          ['openPositions', r => number(r.open_positions)], ['equity', r => usd(r.last_equity)],
          ['dailyDistance', r => usd(r.daily_breach_distance_usd)], ['maxDistance', r => usd(r.max_breach_distance_usd)],
          ['observed', r => date(r.observed_at)]], data.accounts ?? []),
        table('notional', [['symbol', r => technical(r.market)], ['openPositions', r => number(r.positions)],
          ['longShort', r => technical(`${number(r.long_positions)} / ${number(r.short_positions)}`)],
          ['notional', r => usd(r.notional_usd)], ['margin', r => usd(r.margin_usd)]], data.exposure ?? []))
    } else if (page === 'search') {
      const params = new URLSearchParams(query)
      const q = params.get('q') ?? ''
      const box = el('input', { name: 'q', value: q, maxlength: '100', placeholder: t('searchHint'), 'aria-label': t('searchx'), dir: 'ltr' })
      contents.append(el('form', { class: 'filters', on: { submit: e => {
        e.preventDefault()
        const next = route('search', box.value.trim() ? { q: box.value.trim() } : {})
        if (location.hash === next) render()
        else location.hash = next
      } } }, box, el('button', { class: 'primary' }, t('apply'))), el('p', { class: 'muted' }, t('searchHint')))
      if (q) {
        const data = await api('search?' + new URLSearchParams({ q }))
        const open = r => r.kind === 'user' ? link('users', { id: r.id }, t('users'))
          : r.kind === 'challenge' ? link('challenges', { id: r.id }, t('challenges'))
          : r.kind === 'support' ? link('support', { id: r.reference }, t('support'))
          : r.kind === 'payout' ? link('payouts', { id: r.id }, t('payouts'))
          : r.kind === 'payment' || r.kind === 'order' ? link('payments', { id: r.purchase_order_id ?? r.id }, t('payments')) : '—'
        contents.append(table('result', [['result', open], ['identity', r => technical(r.id ?? r.reference)],
          ['wallet', r => technical(r.wallet_address ?? r.tx_hash ?? r.payout_ref ?? '—')], ['status', status]], data.rows ?? []))
      }
    } else if (page === 'siteSearch') {
      await siteSearchView(contents, new URLSearchParams(query))
    } else await directory(contents, page, new URLSearchParams(query))
  } catch (error) {
    if (renderId === revision) contents.replaceChildren(el('p', { role: 'alert' }, labels[error.message] ? t(error.message) : t('unexpected_error')))
  } finally { main.querySelector('[role=status]')?.remove() }
}

dialog.addEventListener('close', () => dialog.replaceChildren())
window.addEventListener('hashchange', () => { showNav = false; announcement.textContent = ''; render() })
try { session = await api('session') } catch {}
render()
