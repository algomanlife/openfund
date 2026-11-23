/* Backstage → Security → Bug bounty (ADR 0057): the reward table and the
 * hall of fame. The server (bounty.js) validates every value; this module
 * collects input and shows exact outcomes. Every write asks for the owner
 * password. */
export function createBounty({ el, t, labels, button, field, badge, technical, number, dialog, announce, render, csrf }) {
  const SEVERITIES = ['critical', 'high', 'medium', 'low']
  async function request(path, body) {
    const response = await fetch('/api/bounty/' + path, {
      method: body ? 'POST' : 'GET',
      ...(body && { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() }, body: JSON.stringify(body) }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    return data
  }
  const message = error => (labels[error.message] ? t(error.message) : t('unexpected_error'))

  function withPassword(titleKey, extra, send) {
    const password = el('input', { required: '', type: 'password', dir: 'ltr', autocomplete: 'current-password' })
    const feedback = el('p', { role: 'alert' }), submit = el('button', { class: 'primary' }, t('confirm'))
    const form = el('form', { on: { submit: async e => {
      e.preventDefault(); submit.disabled = true
      try { await send(password.value); dialog.close(); render(); announce('success') } catch (error) { feedback.textContent = message(error) } finally { password.value = ''; submit.disabled = false }
    } } }, el('h2', {}, t(titleKey)), ...extra, field('password', password), feedback, el('div', { class: 'tools' }, button('cancel', () => dialog.close()), submit))
    dialog.replaceChildren(form); dialog.showModal(); (form.querySelector('input:not([type=hidden])') ?? password).focus()
  }

  async function workspace(main) {
    const { tiers, hall } = await request('list')
    main.append(el('p', { class: 'muted' }, t('bountyIntro')))
    const inputs = Object.fromEntries(SEVERITIES.map(s => {
      const row = tiers.find(r => r.severity === s) ?? {}
      return [s, { min: el('input', { type: 'number', min: '0', max: '100000', step: '1', dir: 'ltr', value: String(row.reward_min_usd ?? '') }),
        max: el('input', { type: 'number', min: '0', max: '100000', step: '1', dir: 'ltr', value: String(row.reward_max_usd ?? '') }) }]
    }))
    main.append(el('section', { class: 'panel table-box' }, el('h2', {}, t('bountyRewards')),
      el('div', { class: 'table-scroll' }, el('table', {},
        el('thead', {}, el('tr', {}, ['severity', 'rewardMin', 'rewardMax'].map(h => el('th', {}, t(h))))),
        el('tbody', {}, SEVERITIES.map(s => el('tr', {}, el('td', {}, t('sev_' + s)),
          el('td', {}, field('rewardMin', inputs[s].min)), el('td', {}, field('rewardMax', inputs[s].max))))))),
      el('div', { class: 'tools' }, button('saveRewards', () => withPassword('saveRewards', [], password => request('tiers', { password,
        tiers: SEVERITIES.map(s => ({ severity: s, reward_min_usd: Number(inputs[s].min.value), reward_max_usd: Number(inputs[s].max.value) })) })), 'primary'))))
    main.append(el('section', { class: 'panel table-box' }, el('h2', {}, t('hallOfFame')), el('p', { class: 'muted' }, t('hallIntro')),
      el('div', { class: 'tools' }, button('newHallEntry', () => hallEditor(null))),
      hall.length ? el('div', { class: 'table-scroll' }, el('table', {},
        el('thead', {}, el('tr', {}, ['displayName', 'year', 'severity', 'status', 'consentRecorded', 'action'].map(h => el('th', {}, t(h))))),
        el('tbody', {}, hall.map(h => el('tr', {}, el('td', { dir: 'auto' }, h.display_name), el('td', {}, number(h.year)),
          el('td', {}, h.severity ? t('sev_' + h.severity) : '—'), el('td', {}, badge(h.status)), el('td', {}, h.consent ? '✓' : '—'),
          el('td', {}, button('edit', () => hallEditor(h)))))))) : el('p', { class: 'muted' }, t('noCampaigns'))))
  }

  function hallEditor(row) {
    const r = row ?? { status: 'draft', year: new Date().getUTCFullYear(), consent: false }
    const name = el('input', { required: '', maxlength: '60', dir: 'auto', value: r.display_name ?? '' })
    const profile = el('input', { dir: 'ltr', maxlength: '300', placeholder: 'https://…', value: r.profile_url ?? '' })
    const year = el('input', { type: 'number', min: '2025', dir: 'ltr', value: String(r.year) })
    const severity = el('select', {}, el('option', { value: '' }, '—'), SEVERITIES.map(s => el('option', { value: s }, t('sev_' + s)))); severity.value = r.severity ?? ''
    const status = el('select', {}, ['draft', 'published', 'archived'].map(s => el('option', { value: s }, t(s)))); status.value = r.status
    const consent = el('input', { type: 'checkbox' }); consent.checked = r.consent === true
    const advisory = el('input', { dir: 'ltr', maxlength: '24', placeholder: 'GHSA-xxxx-xxxx-xxxx', value: r.advisory_reference ?? '' })
    withPassword(row ? 'edit' : 'newHallEntry', [field('displayName', name), field('profileUrl', profile), field('year', year), field('severity', severity),
      field('status', status), el('label', { class: 'check' }, consent, ' ', t('consentRecorded')), field('advisoryReference', advisory)],
    password => request('hall', { id: row?.id ?? null, password, entry: { display_name: name.value, profile_url: profile.value.trim() || null,
      year: Number(year.value), severity: severity.value || null, status: status.value, consent: consent.checked, advisory_reference: advisory.value.trim() || null } }))
  }
  return { workspace }
}
