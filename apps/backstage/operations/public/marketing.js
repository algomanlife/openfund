/* Backstage → Marketing: promotional popups (placement "modal") and
 * announcement bars (placement "announcement_bar") on one shared campaign
 * model. The server (campaigns.js) is the authority for every rule; this
 * module only collects input, previews it and shows exact outcomes. */
const LOCALES = [['fa', 'فارسی', 'rtl'], ['en', 'English', 'ltr'], ['ar', 'العربية', 'rtl'], ['ru', 'Русский', 'ltr'], ['zh-CN', '简体中文', 'ltr']]
const PAGES = ['all', 'home', 'challenges', 'information'], REGIONS = ['GLOBAL', 'IRAN']

export function createMarketing({ el, t, labels, button, field, badge, technical, number, date, dialog, announce, render, csrf }) {
  async function request(path, body) {
    const response = await fetch('/api/campaigns/' + path, {
      method: body ? 'POST' : 'GET',
      ...(body && { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() }, body: JSON.stringify(body) }),
    })
    const data = await response.json()
    if (!response.ok) throw Object.assign(new Error(data.error), { details: data.details ?? [] })
    return data
  }
  const message = error => {
    const base = labels[error.message] ? t(error.message) : t('unexpected_error')
    const details = (error.details ?? []).map(d => {
      const [code, locale] = d.split(':')
      return (labels[code] ? t(code) : code) + (locale ? ` (${locale})` : '')
    })
    return details.length ? `${base}: ${details.join(' · ')}` : base
  }
  const checkboxes = (name, values, checked, label = v => v) => el('fieldset', { class: 'choices' }, el('legend', {}, t(name)),
    values.map(v => { const input = el('input', { type: 'checkbox', value: v, name }); input.checked = checked.includes(v); return el('label', { class: 'choice' }, input, el('span', {}, label(v))) }))
  const checkedOf = box => Array.from(box.querySelectorAll('input:checked'), i => i.value)
  const isoLocal = iso => iso ? new Date(iso).toISOString().slice(0, 16) : ''
  const fromLocal = value => value ? new Date(value + ':00Z').toISOString() : null
  const assetUrl = (id, w = 640) => `/api/campaigns/asset/${encodeURIComponent(id)}?w=${w}`

  /* ---------- list ---------- */
  async function workspace(main, placement) {
    const isModal = placement === 'modal'
    const [rows, stats] = await Promise.all([request('list?placement=' + placement).then(r => r.rows), request('stats').catch(() => ({ stats: [] }))])
    const statOf = id => stats.stats.find(s => s.campaign_id === String(id) && s.placement === placement) ?? { impressions: 0, clicks: 0, closes: 0, ctr: null }
    main.append(el('div', { class: 'tools' }, button(isModal ? 'newCampaign' : 'newAnnouncement', () => editor(placement, null), 'primary')),
      el('p', { class: 'muted' }, t(isModal ? 'campaignsIntro' : 'announcementsIntro')))
    const head = ['internalName', 'status', 'liveState', 'locales', 'campaignRegions', 'schedule', 'priority', 'impressions', 'clicks', 'closes', 'ctr', 'coupon', 'action']
    const body = rows.map(r => {
      const s = statOf(r.id)
      const coupon = r.coupon_code ? el('span', {}, technical(r.coupon_code), ' ', badge('checking')) : '—'
      if (r.coupon_code) request('coupon?code=' + encodeURIComponent(r.coupon_code)).then(c => coupon.replaceChildren(technical(r.coupon_code), ' ', badge(c.promotable ? 'couponPromotable' : 'couponNotPromotable'))).catch(() => {})
      const live = r.status === 'published' && r.active && (!r.ends_at || new Date(r.ends_at) > new Date()) && (!r.starts_at || new Date(r.starts_at) <= new Date())
      return el('tr', {},
        el('td', {}, technical(r.internal_name)), el('td', {}, badge(r.status)), el('td', {}, badge(live ? 'live' : r.active ? 'scheduledOrDraft' : 'inactive')),
        el('td', {}, technical((r.locales ?? []).join(', '))), el('td', {}, technical((r.regions ?? []).join(', '))),
        el('td', {}, r.starts_at || r.ends_at ? `${date(r.starts_at)} → ${date(r.ends_at)}` : t('always')), el('td', {}, number(r.priority)),
        el('td', {}, number(s.impressions)), el('td', {}, number(s.clicks)), el('td', {}, number(s.closes)),
        el('td', {}, s.ctr == null ? '—' : new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(s.ctr)), el('td', {}, coupon),
        el('td', {}, el('div', { class: 'tools' },
          button('edit', () => editor(placement, r)),
          r.status !== 'published' ? button('publish', () => state(r, { status: 'published' }, 'publish')) : button('unpublish', () => state(r, { status: 'draft' }, 'unpublish')),
          r.active ? button('deactivate', () => state(r, { active: false }, 'deactivate')) : button('activate', () => state(r, { active: true }, 'activate')),
          r.status !== 'archived' ? button('archive', () => state(r, { status: 'archived' }, 'archive'), 'danger') : null)))
    })
    main.append(el('section', { class: 'panel table-box' }, el('h2', {}, t(isModal ? 'campaignsList' : 'announcementsList')),
      rows.length ? el('div', { class: 'table-scroll' }, el('table', {}, el('thead', {}, el('tr', {}, head.map(h => el('th', {}, t(h))))), el('tbody', {}, body)))
        : el('p', { class: 'muted' }, t('noCampaigns'))))
  }

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

  /* ---------- editor with live preview ---------- */
  function editor(placement, record) {
    const isModal = placement === 'modal'
    const r = record ?? { placement, status: 'draft', active: true, priority: 0, locales: ['fa'], regions: ['GLOBAL', 'IRAN'], pages: ['all'],
      template: 'split', style: 'mint', delay_seconds: 12, frequency: 'session', frequency_days: 7, translations: [] }
    const name = el('input', { required: '', dir: 'ltr', pattern: '[a-z0-9][a-z0-9-]{2,59}', value: r.internal_name ?? '' })
    const template = el('select', { 'aria-label': t('template') }, ['split', 'image'].map(v => el('option', { value: v }, t('template_' + v)))); template.value = r.template ?? 'split'
    const style = el('select', { 'aria-label': t('barStyle') }, ['mint', 'neutral', 'notice'].map(v => el('option', { value: v }, t('style_' + v)))); style.value = r.style ?? 'mint'
    const priority = el('input', { type: 'number', min: '-1000', max: '1000', dir: 'ltr', value: String(r.priority ?? 0) })
    const starts = el('input', { type: 'datetime-local', dir: 'ltr', value: isoLocal(r.starts_at) }), ends = el('input', { type: 'datetime-local', dir: 'ltr', value: isoLocal(r.ends_at) })
    const locales = checkboxes('locales', LOCALES.map(l => l[0]), r.locales ?? [], v => LOCALES.find(l => l[0] === v)[1])
    const regions = checkboxes('campaignRegions', REGIONS, r.regions ?? [])
    const pages = checkboxes('pages', PAGES, r.pages ?? [], v => t('page_' + v))
    const cta = el('input', { dir: 'ltr', maxlength: '500', placeholder: 'https://… or /fa/checkout', value: r.cta_url ?? '' })
    const coupon = el('input', { dir: 'ltr', maxlength: '40', value: r.coupon_code ?? '' }), couponState = el('span', { class: 'muted', role: 'status' })
    const checkCoupon = async () => {
      const code = coupon.value.trim().toUpperCase()
      if (!code) { couponState.textContent = ''; return }
      couponState.textContent = t('checking')
      try { couponState.textContent = t((await request('coupon?code=' + encodeURIComponent(code))).promotable ? 'couponPromotable' : 'couponNotPromotable') } catch { couponState.textContent = t('unexpected_error') }
    }
    coupon.addEventListener('change', checkCoupon); if (r.coupon_code) void checkCoupon()
    const delay = el('input', { type: 'number', min: '3', max: '120', dir: 'ltr', value: String(r.delay_seconds ?? 12) })
    const frequency = el('select', { 'aria-label': t('frequency') }, ['session', 'interval'].map(v => el('option', { value: v }, t('frequency_' + v)))); frequency.value = r.frequency ?? 'session'
    const days = el('input', { type: 'number', min: '1', max: '90', dir: 'ltr', value: String(r.frequency_days ?? 7) })
    const images = { image_desktop: r.image_desktop ?? null, image_mobile: r.image_mobile ?? null }
    const imagePicker = key => {
      const status = el('span', { class: 'muted', role: 'status' }), thumb = el('img', { alt: '', class: 'thumb' })
      const show = () => { if (images[key]) { thumb.src = assetUrl(images[key], 320); thumb.hidden = false } else thumb.hidden = true }
      const input = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', on: { change: async () => {
        const file = input.files?.[0]; if (!file) return
        if (file.size > 3 * 1024 * 1024) { status.textContent = t('invalid_image'); return }
        status.textContent = t('uploading')
        const data = await new Promise(res => { const reader = new FileReader(); reader.onload = () => res(String(reader.result).split(',')[1]); reader.readAsDataURL(file) })
        try { images[key] = (await request('upload', { filename: file.name.replace(/[^\w .()-]/g, '_').slice(0, 80), contentType: file.type, data })).id; status.textContent = t('uploaded'); show(); preview() }
        catch (error) { status.textContent = message(error) }
      } } })
      show()
      return el('div', { class: 'image-pick' }, field(key, input), el('div', { class: 'tools' }, thumb, status,
        button('removeImage', () => { images[key] = null; show(); preview() })))
    }
    /* per-locale copy: shown for eligible locales; others are kept but hidden */
    const copy = Object.fromEntries(LOCALES.map(([code, label, dir]) => {
      const t0 = (r.translations ?? []).find(x => x.language_code === code) ?? {}
      const inputs = {
        headline: el('input', { dir, maxlength: '140', value: t0.headline ?? '' }), body: el('textarea', { dir, rows: '3', maxlength: '400' }),
        cta_label: el('input', { dir, maxlength: '40', value: t0.cta_label ?? '' }), image_alt: el('input', { dir, maxlength: '160', value: t0.image_alt ?? '' }),
      }
      inputs.body.value = t0.body ?? ''
      const box = el('fieldset', { class: 'locale-copy', 'data-locale': code }, el('legend', {}, label),
        field('headline', inputs.headline), isModal ? field('body', inputs.body) : null, field('ctaLabel', inputs.cta_label), isModal ? field('imageAlt', inputs.image_alt) : null)
      return [code, { inputs, box }]
    }))
    const previewLocale = el('select', { 'aria-label': t('previewLocale') }), previewBox = el('div', { class: 'preview-box', 'aria-live': 'polite' })
    const syncLocales = () => {
      const chosen = checkedOf(locales)
      for (const [code, { box }] of Object.entries(copy)) box.hidden = !chosen.includes(code)
      const keep = previewLocale.value
      previewLocale.replaceChildren(...chosen.map(c => el('option', { value: c }, LOCALES.find(l => l[0] === c)[1])))
      if (chosen.includes(keep)) previewLocale.value = keep
      preview()
    }
    function preview() {
      const code = previewLocale.value || checkedOf(locales)[0]
      if (!code) { previewBox.replaceChildren(el('p', { class: 'muted' }, t('chooseLocale'))); return }
      const { inputs } = copy[code], dir = LOCALES.find(l => l[0] === code)[2]
      const ctaText = inputs.cta_label.value || '—'
      if (!isModal) {
        previewBox.replaceChildren(el('div', { class: `pv-bar pv-${style.value}`, dir }, el('span', {}, inputs.headline.value || '…'),
          el('span', { class: 'pv-cta' }, ctaText), el('span', { class: 'pv-close', 'aria-hidden': 'true' }, '×')))
        return
      }
      const img = images.image_desktop ? el('img', { src: assetUrl(images.image_desktop, 640), alt: inputs.image_alt.value }) : el('div', { class: 'pv-noimg' }, t('noImage'))
      previewBox.replaceChildren(el('div', { class: `pv-modal pv-${template.value}`, dir },
        el('div', { class: 'pv-media' }, img),
        el('div', { class: 'pv-copy' }, el('strong', {}, inputs.headline.value || '…'), template.value === 'split' ? el('p', {}, inputs.body.value) : null,
          coupon.value ? el('code', { dir: 'ltr' }, coupon.value.toUpperCase()) : null, el('span', { class: 'pv-cta' }, ctaText))))
    }
    const password = el('input', { type: 'password', dir: 'ltr', autocomplete: 'current-password', required: '' })
    const feedback = el('p', { role: 'alert' })
    const save = status => async () => {
      if (!password.value) { feedback.textContent = t('passwordRequired'); password.focus(); return }
      feedback.textContent = ''
      const campaign = {
        internal_name: name.value.trim(), placement, template: template.value, style: style.value, priority: priority.value,
        starts_at: fromLocal(starts.value), ends_at: fromLocal(ends.value), locales: checkedOf(locales), regions: checkedOf(regions), pages: checkedOf(pages),
        cta_url: cta.value.trim() || null, coupon_code: coupon.value.trim() || null, delay_seconds: delay.value, frequency: frequency.value, frequency_days: days.value,
        image_desktop: images.image_desktop, image_mobile: images.image_mobile, active: r.active !== false,
        translations: checkedOf(locales).map(code => ({ language_code: code, ...Object.fromEntries(Object.entries(copy[code].inputs).map(([k, v]) => [k, v.value.trim() || null])) })),
      }
      try {
        const result = await request('save', { id: r.id ?? null, status, password: password.value, campaign })
        dialog.close(); render(); announce(status === 'published' ? 'campaignPublished' : 'campaignSaved')
        return result
      } catch (error) { feedback.textContent = message(error) } finally { password.value = '' }
    }
    const form = el('form', { class: 'wide', on: { submit: e => e.preventDefault(), input: preview, change: e => { if (e.target.closest?.('fieldset.choices')) syncLocales(); else preview() } } },
      el('h2', {}, t(record ? (isModal ? 'editCampaign' : 'editAnnouncement') : (isModal ? 'newCampaign' : 'newAnnouncement'))),
      el('div', { class: 'editor-grid' },
        el('div', { class: 'editor-fields' },
          field('internalName', name), isModal ? field('template', template) : field('barStyle', style), field('priority', priority),
          el('div', { class: 'tools' }, field('campaignStartsAt', starts), field('campaignEndsAt', ends)), el('p', { class: 'muted' }, t('scheduleUtc')),
          locales, regions, pages, field('ctaUrl', cta), el('div', { class: 'tools' }, field('couponCode', coupon), couponState),
          isModal ? el('div', { class: 'tools' }, field('delaySeconds', delay), field('frequency', frequency), field('frequencyDays', days)) : el('p', { class: 'muted' }, t('barDismissNote')),
          isModal ? imagePicker('image_desktop') : null, isModal ? imagePicker('image_mobile') : null,
          Object.values(copy).map(c => c.box)),
        el('aside', { class: 'editor-preview' }, el('h3', {}, t('preview')), field('previewLocale', previewLocale), previewBox, el('p', { class: 'muted' }, t('previewNote')))),
      field('password', password), feedback,
      el('div', { class: 'tools' }, button('cancel', () => dialog.close()), button('saveDraft', save('draft')), button('publish', save('published'), 'primary')))
    dialog.replaceChildren(form)
    dialog.classList.add('wide-dialog')
    dialog.addEventListener('close', () => dialog.classList.remove('wide-dialog'), { once: true })
    dialog.showModal()
    syncLocales()
    name.focus()
  }
  return { workspace }
}
