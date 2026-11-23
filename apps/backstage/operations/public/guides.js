/* Backstage → Marketing → Terminal guide (ADR 0056). The server
 * (guides.js) is the authority for every rule; this module collects input,
 * previews a step and shows exact outcomes. Steps are ordered with Move
 * up / Move down; "Remove" archives a step (no deletes). */

export function createGuides({ el, t, labels, button, field, badge, technical, number, dialog, announce, render, csrf }) {
  async function request(path, body) {
    const response = await fetch('/api/guides/' + path, {
      method: body ? 'POST' : 'GET',
      ...(body && { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() }, body: JSON.stringify(body) }),
    })
    const data = await response.json()
    if (!response.ok) throw Object.assign(new Error(data.error), { details: data.details ?? [] })
    return data
  }
  const message = error => {
    const base = labels[error.message] ? t(error.message) : t('unexpected_error')
    const details = (error.details ?? []).map(d => { const [code, n] = d.split(':'); return (labels[code] ? t(code) : code) + (n ? ` (${n})` : '') })
    return details.length ? `${base}: ${details.join(' · ')}` : base
  }
  const pct = v => v == null ? '—' : new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(v)

  function confirmDialog(titleKey, onConfirm) {
    const password = el('input', { required: '', type: 'password', dir: 'ltr', autocomplete: 'current-password' })
    const feedback = el('p', { role: 'alert' }), submit = el('button', { class: 'primary' }, t('confirm'))
    const form = el('form', { on: { submit: async e => {
      e.preventDefault(); submit.disabled = true
      try { await onConfirm(password.value); dialog.close(); render(); announce('success') } catch (error) { feedback.textContent = message(error) } finally { password.value = ''; submit.disabled = false }
    } } }, el('h2', {}, t(titleKey)), field('password', password), feedback, el('div', { class: 'tools' }, button('cancel', () => dialog.close()), submit))
    dialog.replaceChildren(form); dialog.showModal(); password.focus()
  }
  const state = (r, patch, titleKey) => confirmDialog(titleKey, password => request('state', { id: r.id, password, ...patch }))

  async function workspace(main) {
    const [rows, stats] = await Promise.all([request('list').then(r => r.rows), request('stats').catch(() => ({ stats: [] }))])
    const statOf = (id, version) => stats.stats.find(s => s.guide_id === String(id) && s.version === version) ?? { shown: 0, completed: 0, opted_out: 0, completionRate: null }
    main.append(el('div', { class: 'tools' }, button('newGuide', () => editor(null), 'primary')), el('p', { class: 'muted' }, t('guidesIntro')))
    const head = ['internalName', 'status', 'liveState', 'guideVersion', 'guideSteps', 'campaignRegions', 'guideCookieDays', 'guideShown', 'guideCompleted', 'guideOptedOut', 'guideCompletion', 'action']
    const body = rows.map(r => {
      const s = statOf(r.id, r.version ?? 1)
      return el('tr', {},
        el('td', {}, technical(r.internal_name)), el('td', {}, badge(r.status)), el('td', {}, badge(r.status === 'published' && r.active ? 'live' : 'inactive')),
        el('td', {}, number(r.version ?? 1)), el('td', {}, number(r.steps.length)), el('td', {}, technical((r.regions ?? []).join(', '))), el('td', {}, number(r.cookie_days ?? 365)),
        el('td', {}, number(s.shown)), el('td', {}, number(s.completed)), el('td', {}, number(s.opted_out)), el('td', {}, pct(s.completionRate)),
        el('td', {}, el('div', { class: 'tools' },
          button('edit', () => editor(r)),
          r.status !== 'published' ? button('publish', () => state(r, { status: 'published' }, 'publish')) : button('unpublish', () => state(r, { status: 'draft' }, 'unpublish')),
          r.active ? button('deactivate', () => state(r, { active: false }, 'deactivate')) : button('activate', () => state(r, { active: true }, 'activate')),
          button('guideNewVersion', () => state(r, { newVersion: true }, 'guideNewVersion')),
          r.status !== 'archived' ? button('archive', () => state(r, { status: 'archived' }, 'archive'), 'danger') : null)))
    })
    main.append(el('section', { class: 'panel table-box' }, el('h2', {}, t('guidesList')),
      rows.length ? el('div', { class: 'table-scroll' }, el('table', {}, el('thead', {}, el('tr', {}, head.map(h => el('th', {}, t(h))))), el('tbody', {}, body)))
        : el('p', { class: 'muted' }, t('noCampaigns'))),
      el('p', { class: 'muted' }, t('guideCountersNote')))
  }

  /* ---------- editor ---------- */
  const ACCEPT = { video_mp4: 'video/mp4', video_webm: 'video/webm', image: 'image/png,image/jpeg,image/webp', poster: 'image/png,image/jpeg,image/webp', subtitles_fa: 'text/vtt,.vtt', subtitles_en: 'text/vtt,.vtt' }
  const LIMIT = { video_mp4: 8, video_webm: 8, image: 3, poster: 3, subtitles_fa: 0.2, subtitles_en: 0.2 }
  function editor(record) {
    const r = record ?? { status: 'draft', regions: ['GLOBAL', 'IRAN'], cookie_days: 365, steps: [] }
    const steps = (r.steps ?? []).map(s => ({ ...s }))
    const name = el('input', { required: '', dir: 'ltr', pattern: '[a-z0-9][a-z0-9-]{2,59}', value: r.internal_name ?? '' })
    const cookieDays = el('input', { type: 'number', min: '1', max: '730', dir: 'ltr', value: String(r.cookie_days ?? 365) })
    const regionBox = el('fieldset', { class: 'choices' }, el('legend', {}, t('campaignRegions')), ['GLOBAL', 'IRAN'].map(v => {
      const input = el('input', { type: 'checkbox', value: v }); input.checked = (r.regions ?? []).includes(v); return el('label', { class: 'choice' }, input, el('span', {}, v))
    }))
    const list = el('ol', { class: 'guide-steps' })
    const upload = (step, key, status) => el('input', { type: 'file', accept: ACCEPT[key], on: { change: async e => {
      const file = e.target.files?.[0]; if (!file) return
      if (file.size > LIMIT[key] * 1024 * 1024) { status.textContent = t('invalid_media'); return }
      status.textContent = t('uploading')
      const type = key.startsWith('subtitles') ? 'text/vtt' : file.type
      const data = await new Promise(res => { const reader = new FileReader(); reader.onload = () => res(String(reader.result).split(',')[1]); reader.readAsDataURL(file) })
      try { step[key] = (await request('upload', { filename: file.name.replace(/[^\w .()-]/g, '_').slice(0, 80), contentType: type, data })).id; status.textContent = t('uploaded') }
      catch (error) { status.textContent = message(error) }
    } } })
    function draw() {
      list.replaceChildren(...steps.map((step, i) => {
        const kind = el('select', { 'aria-label': t('guideMediaKind'), on: { change: e => { step.media_kind = e.target.value; draw() } } },
          ['video', 'image'].map(v => el('option', { value: v }, t('guideKind_' + v)))); kind.value = step.media_kind ?? 'video'
        const copy = ['title_fa', 'title_en', 'body_fa', 'body_en'].map(k => {
          const input = el(k.startsWith('body') ? 'textarea' : 'input', { dir: k.endsWith('_fa') ? 'rtl' : 'ltr', maxlength: k.startsWith('body') ? '600' : '140', rows: '3',
            on: { input: e => { step[k] = e.target.value } } })
          input.value = step[k] ?? ''
          return field('guide_' + k, input)
        })
        const media = (step.media_kind === 'image' ? ['image', 'poster'] : ['video_mp4', 'video_webm', 'poster']).concat(['subtitles_fa', 'subtitles_en']).map(k => {
          const status = el('span', { class: 'muted', role: 'status' }, step[k] ? t('uploaded') : '')
          return el('div', { class: 'tools' }, field('guide_' + k, upload(step, k, status)), status)
        })
        return el('li', { class: 'panel guide-step' },
          el('div', { class: 'tools' }, el('strong', {}, `${number(i + 1)}.`), field('guideMediaKind', kind),
            button('moveUp', () => { if (i) { [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]]; draw() } }),
            button('moveDown', () => { if (i < steps.length - 1) { [steps[i + 1], steps[i]] = [steps[i], steps[i + 1]]; draw() } }),
            button('guideRemoveStep', () => { steps.splice(i, 1); draw() }, 'danger'),
            button('preview', () => previewStep(step))),
          ...copy, ...media)
      }))
    }
    const password = el('input', { type: 'password', dir: 'ltr', autocomplete: 'current-password', required: '' })
    const feedback = el('p', { role: 'alert' })
    const save = status => async () => {
      if (!password.value) { feedback.textContent = t('passwordRequired'); password.focus(); return }
      feedback.textContent = ''
      const guide = { internal_name: name.value.trim(), pages: ['terminal'], cookie_days: cookieDays.value,
        regions: Array.from(regionBox.querySelectorAll('input:checked'), x => x.value), steps }
      try { await request('save', { id: r.id ?? null, status, password: password.value, guide }); dialog.close(); render(); announce('campaignSaved') }
      catch (error) { feedback.textContent = message(error) } finally { password.value = '' }
    }
    const form = el('form', { class: 'wide', on: { submit: e => e.preventDefault() } },
      el('h2', {}, t(record ? 'editGuide' : 'newGuide')),
      field('internalName', name), field('guideCookieDays', cookieDays), regionBox, el('p', { class: 'muted' }, t('guideRules')),
      list, el('div', { class: 'tools' }, button('guideAddStep', () => { steps.push({ media_kind: 'video' }); draw() })),
      field('password', password), feedback,
      el('div', { class: 'tools' }, button('cancel', () => dialog.close()), button('saveDraft', save('draft')), button('publish', save('published'), 'primary')))
    draw()
    dialog.replaceChildren(form)
    dialog.classList.add('wide-dialog')
    dialog.addEventListener('close', () => dialog.classList.remove('wide-dialog'), { once: true })
    dialog.showModal()
    name.focus()
  }

  /* a step as the terminal shows it (media through the owner session) */
  function previewStep(step) {
    const box = el('div', { class: 'guide-preview' },
      el('p', { class: 'muted' }, t('guidePreviewNote')),
      el('strong', { dir: 'rtl' }, step.title_fa || '…'), el('p', { dir: 'rtl' }, step.body_fa || ''),
      el('strong', { dir: 'ltr' }, step.title_en || '…'), el('p', { dir: 'ltr' }, step.body_en || ''),
      el('p', {}, technical([step.video_mp4 && 'MP4', step.video_webm && 'WebM', step.image && 'image', step.poster && 'poster', step.subtitles_fa && 'fa.vtt', step.subtitles_en && 'en.vtt'].filter(Boolean).join(' · ') || '—')))
    const back = el('dialog', { class: 'guide-preview-dialog' }, box, el('div', { class: 'tools' }, button('close', () => back.close())))
    document.body.append(back)
    back.addEventListener('close', () => back.remove(), { once: true })
    back.showModal()
  }
  return { workspace }
}
