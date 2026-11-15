import { labels } from './strings.js'

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
    throw new Error(data.error)
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
      feedback.textContent = labels[error.message] ? t(error.message) : t('unexpected_error')
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
  ['prop', ['users', 'challenges', 'reviews', 'payouts']],
  ['business', ['payments', 'coupons', 'support', 'partners', 'finance', 'system']],
]

function nav(selected) {
  const menuLink = key => {
    const item = link(key)
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
  const submit = el('button', { class: action === 'reject' ? 'danger' : 'primary' }, t('confirm'))
  const feedback = el('p', { role: 'alert' })
  const form = el('form', { on: { submit: async event => {
    event.preventDefault()
    submit.disabled = true
    try {
      await api(section + '/' + row.id, { action, reason: reason.value, password: password.value })
      dialog.close()
      render()
      announce('success')
    } catch (error) {
      feedback.textContent = labels[error.message] ? t(error.message) : t('unexpected_error')
    } finally {
      password.value = ''
      submit.disabled = false
    }
  } } }, el('h2', {}, t(action)), uid(row), action === 'reverify' ? null : field(['reply', 'resolve_appeal'].includes(action) ? 'message' : 'reason', reason), field('password', password),
  feedback, el('div', { class: 'tools' }, button('cancel', () => dialog.close()), submit))
  dialog.replaceChildren(form)
  dialog.showModal()
}

const decisionButtons = (section, row) => el('div', { class: 'tools' },
  button('approve', () => decide(section, row, 'approve')), button('reject', () => decide(section, row, 'reject')))

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
    ['scope', r => t(r.test_mode ? 'test' : 'commercial')], ['audit', r => link('payouts', { id: r.id }, uid(r))], ['action', r => r.status === 'requested' ? decisionButtons('payouts', r) : r.test_mode && r.status === 'approved' ? button('simulate', () => decide('payouts', r, 'simulate')) : '—']],
  payments: [['identity', r => link('payments', { id: r.purchase_order_id }, technical(r.purchase_order_id))], ['transaction', r => technical(r.tx_hash)], ['status', status], ['date', r => date(r.created_at ?? r.last_attempt_at)],
    ['action', r => r.retryable && r.status !== 'confirmed' ? button('reverify', () => decide('payments', r, 'reverify')) : '—']],
  coupons: [['code', r => technical(r.code)], ['status', status], ['discount', r => r.kind === 'percent' ? new Intl.NumberFormat(fmt(), { style: 'percent' }).format(Number(r.value) / 100) : usd(r.value)],
    ['redeemed', r => number(r.uses_consumed)], ['expiry', r => date(r.expires_at)]],
  support: [['reference', r => link('support', { id: r.reference }, technical(r.reference))], ['subject', r => r.subject], ['status', status], ['date', r => date(r.createdAt)]],
  partners: [['wallet', wallet], ['role', r => t(r.role)], ['status', status], ['date', r => date(r.submitted_at)]],
}
const filterStatuses = {
  users: ['active', 'suspended'], challenges: ['created', 'started', 'passed', 'failed', 'expired', 'cancelled'],
  payouts: ['requested', 'approved', 'paid', 'rejected', 'cancelled'], payments: ['pending', 'confirmed', 'rejected'],
  support: ['new', 'in_progress', 'waiting_customer', 'resolved', 'closed'],
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
      wallet(user), uid(user), status(user), el('span', {}, date(user.created_at))),
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
      review?.funded_challenge_id ? link('challenges', { id: review.funded_challenge_id }, t('funded')) : null),
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
    main.append(table('transactions', [['identity', uid], ['wallet', wallet], ['status', status], ['amount', r => usd(r.price_usd)]],
      data.order ? [data.order] : []),
    table('payments', columns.payments, data.attempts),
    table('verified', [['transaction', r => technical(r.tx_hash)], ['status', status], ['date', r => date(r.verified_at)]], data.payments))
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
    table('audit', [['date', r => date(r.ts)], ['status', r => badge(r.to_status)], ['username', r => technical(r.actor)]], data.events))
    return
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
  if (input || select) main.append(el('form', { class: 'filters', on: { submit: e => {
    e.preventDefault()
    const filters = Object.fromEntries([...new FormData(e.target)].filter(([, value]) => value))
    const next = route(section, filters)
    if (location.hash === next) render()
    else location.hash = next
  } } }, input, scope, select, el('button', { class: 'primary' }, t(input ? 'apply' : 'refresh'))))
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
          feedback.textContent = labels[error.message] ? t(error.message) : t('unexpected_error')
          submit.disabled = false
        } finally { password.value = '' }
      } } }, el('h2', {}, t(profile)), action === 'issue' ? field('wallet', address) : null,
      field('password', password), feedback, el('div', { class: 'tools' }, button('cancel', () => { dialog.close(); render() }), submit))
      dialog.replaceChildren(form)
      dialog.showModal()
    }))
  }
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

async function render() {
  const renderId = ++revision
  chrome()
  if (!session) return login()
  let [page, query] = location.hash.replace(/^#\//, '').split('?')
  if (![...groups.flatMap(([, pages]) => pages), 'dashboard'].includes(page)) page = 'dashboard'
  const main = el('main', { id: 'main' })
  workspace.className = 'shell' + (showNav ? ' nav-open' : '') + (collapsed ? ' nav-collapsed' : '')
  workspace.replaceChildren(nav(page), main)
  const layout = el('div', { class: 'page-title' }, el('div', {}, page === 'dashboard' ? null : el('p', { class: 'crumb' }, link('dashboard'), ' / ', t(page)),
    el('h1', {}, t(page))), button('refresh', render))
  const contents = el('div')
  main.append(layout, el('p', { class: 'muted', role: 'status' }, t('loading')), contents)
  try {
    if (page === 'dashboard') await dashboard(contents)
    else if (page === 'system') {
      const data = await api('system')
      contents.append(table(null, [['backend', r => badge(r.backendReady ? 'ready' : 'unknown')], ['region', r => t(r.region)], ['mode', r => t(r.mode)],
        ['epoch', r => number(r.epoch)], ['version', r => technical(r.version)], ['identity', r => technical(r.commit)]], [data]))
    } else if (page === 'finance') {
      const data = await api('finance')
      contents.append(table(null, [['available', r => usd(r.status === 'verified' ? r.availableAllocatableUsd : null)], ['liabilities', r => usd(r.outstandingObligationsUsd)]], [data]))
    } else await directory(contents, page, new URLSearchParams(query))
  } catch (error) {
    if (renderId === revision) contents.replaceChildren(el('p', { role: 'alert' }, labels[error.message] ? t(error.message) : t('unexpected_error')))
  } finally { main.querySelector('[role=status]')?.remove() }
}

dialog.addEventListener('close', () => dialog.replaceChildren())
window.addEventListener('hashchange', () => { showNav = false; announcement.textContent = ''; render() })
try { session = await api('session') } catch {}
render()
