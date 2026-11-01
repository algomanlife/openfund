#!/usr/bin/env node
/**
 * Openfund backstage — PRODUCTION CONTENT SEED (idempotent).
 *
 * Seeds the complete public content layer into Directus:
 *   - ui_messages        ← apps/web-react/public/translations.json (every landing string)
 *   - challenge_plans    ← src/data/challengePlans.ts (the commercial catalog — same table
 *                          the backend reads; Directus is the editing surface)
 *   - trading_rules      ← src/features/rulebook/content.ts (22 Rulebook sections)
 *   - home_content       ← src/cms/seed/homeContent.ts
 *   - faqs               ← src/cms/seed/faqContent.ts
 *   - legal_documents    ← src/cms/seed/legalContent.ts
 *   - footer_links       ← src/cms/seed/marketsContent.ts
 *   - navigation_items   ← public_header (the four public pages)
 *   - pages              ← SEO rows for home/challenges/markets/rulebook/transparency
 *
 * Idempotency: items are matched by natural key (ui_messages.key, plans.slug,
 * rules.section_key, faqs question, legal doc_type, footer destination,
 * pages.slug, nav route). Existing records are NOT overwritten unless
 * `--refresh` is passed (editorial changes made in Directus are preserved).
 *
 * Usage:
 *   node seed_production_content.mjs [--refresh] [--url http://localhost:8055]
 *        [--email admin@openfund.dev] [--password openfund-admin-2026]
 */
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { buildSync } from 'esbuild'

const require6 = createRequire(pathToFileURL(import.meta.url))
const requireWeb = createRequire(pathToFileURL(path.resolve(import.meta.dirname, '../../web-react/package.json')))
const esbuild = requireWeb('esbuild')

const HERE = import.meta.dirname
const WEB = path.resolve(HERE, '../../web-react')

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const BASE = (arg('url', process.env.DIRECTUS_URL || 'http://localhost:8055')).replace(/\/+$/, '')
const EMAIL = arg('email', process.env.DIRECTUS_ADMIN_EMAIL || 'admin@openfund.dev')
const PASSWORD = arg('password', process.env.DIRECTUS_ADMIN_PASSWORD || 'openfund-admin-2026')
const REFRESH = process.argv.includes('--refresh')

async function req(method, url, token, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${method} ${url}\n${(await res.text()).slice(0, 400)}`)
  const text = await res.text()
  return text ? JSON.parse(text) : {}
}

/** load a TypeScript seed module (bundle to CJS, evaluate) — same pattern as the app tests */
function load(rel) {
  const { outputFiles } = buildSync({
    entryPoints: [path.resolve(WEB, rel)],
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputFiles[0].text)(requireWeb, module, module.exports)
  return module.exports
}

const translationsJson = JSON.parse(require6('node:fs').readFileSync(path.join(WEB, 'public/translations.json'), 'utf8'))

const { challengePlans } = load('src/data/challengePlans.ts')
const { ruleSections, rulebookIntro, rulebookNotice } = load('src/features/rulebook/content.ts')
const { faqSeed } = load('src/cms/seed/faqContent.ts')
const { legalSeed } = load('src/cms/seed/legalContent.ts')
const { homeSeed } = load('src/cms/seed/homeContent.ts')
const { marketsSeed, footerLinkSeed, navSeed } = load('src/cms/seed/marketsContent.ts')

async function upsert(collection, filter, payload, existing) {
  const hit = existing.find(x => {
    return Object.entries(filter).every(([k, v]) => String(x[k]) === String(v))
  })
  if (hit) {
    if (REFRESH) {
      /* re-seeding with nested translations: attach existing child ids so the
         PATCH updates the translation rows instead of creating FK-less ones */
      if (Array.isArray(payload.translations)) {
        try {
          const cur = (await req('GET', `${BASE}/items/${collection}/${hit.id}?fields=translations.id,translations.language_code`, TOKEN)).data
          const byLang = new Map((cur.translations || []).map(t => [t.language_code, t.id]))
          for (const t of payload.translations) if (byLang.has(t.language_code)) t.id = byLang.get(t.language_code)
        } catch { /* collection without translations alias */ }
      }
      await req('PATCH', `${BASE}/items/${collection}/${hit.id}`, TOKEN, payload)
      return { action: 'updated', id: hit.id }
    }
    return { action: 'kept', id: hit.id }
  }
  const created = await req('POST', `${BASE}/items/${collection}`, TOKEN, payload)
  return { action: 'created', id: created.data?.id ?? created.data }
}

let TOKEN
const stats = {}
const note = (name, r) => { stats[name] = stats[name] || { created: 0, updated: 0, kept: 0 }; stats[name][r.action]++ }

async function all(collection, fields = '*') {
  return (await req('GET', `${BASE}/items/${collection}?fields=${fields}&limit=-1`, TOKEN)).data || []
}

async function main() {
  TOKEN = (await req('POST', `${BASE}/auth/login`, null, { email: EMAIL, password: PASSWORD })).data.access_token
  console.log('login OK (refresh:', REFRESH + ')')

  /* ---------- ui_messages: every public string, fa→en + editable fa ---------- */
  const msgs = await all('ui_messages', 'id,key,namespace')
  let created = 0
  for (const [fa, en] of Object.entries(translationsJson)) {
    if (msgs.some(m => m.key === fa && m.namespace === 'landing')) continue
    await req('POST', `${BASE}/items/ui_messages`, TOKEN, {
      key: fa, namespace: 'landing', status: 'published',
      translations: [
        { language_code: 'fa', value: fa },
        { language_code: 'en', value: en },
      ],
    })
    created++
  }
  stats['ui_messages'] = { created: created, updated: 0, kept: Math.max(0, Object.keys(translationsJson).length - created) }
  console.log(`ui_messages: +${created}`)

  /* ---------- challenge_plans: the commercial catalog (backend table) ---------- */
  const plans = await all('challenge_plans', 'id,slug')
  for (const p of challengePlans) {
    const payload = {
      slug: p.slug, name: `${p.name.fa} — ${p.name.en}`, status: 'active',
      configuration: {
        accountSizesUsd: p.accountSizesUsd, priceUsd: p.priceUsd, phases: p.phases,
        phase1TargetPct: p.phase1TargetPct, phase2TargetPct: p.phase2TargetPct,
        dailyLossPct: p.dailyLossPct, dailyLossPctAlt: p.dailyLossPctAlt ?? null,
        maxTotalLossPct: p.maxTotalLossPct, drawdownMode: p.drawdownMode,
        trailingLockAtProfitPct: p.trailingLockAtProfitPct ?? null,
        minTradingDays: p.minTradingDays, profitableDaysPer30: p.profitableDaysPer30 ?? null,
        consistencyPct: p.consistencyPct ?? null,
        profitSplitPct: p.profitSplitPct, profitSplitMonthlyPct: p.profitSplitMonthlyPct ?? null,
        payoutCapPct: p.payoutCapPct, firstPayoutDays: p.firstPayoutDays ?? null,
        minPayoutPct: p.minPayoutPct ?? null, timeLimitDays: p.timeLimitDays,
        trialDaysPerPhase: p.trialDaysPerPhase ?? null,
        refundPolicy: p.refundPolicy, referenceLeverageX: p.referenceLeverageX, free: p.free,
        status: p.status, slugName: p.slug, name: p.name, tagline: p.tagline,
      },
    }
    note('challenge_plans', await upsert('challenge_plans', { slug: p.slug }, payload, plans))
  }
  /* retire catalog slugs that are no longer published (old draft plans) */
  const liveSlugs = new Set(challengePlans.map(p => p.slug))
  for (const row of plans) {
    if (!liveSlugs.has(row.slug) && row.slug !== 'starter' && row.slug !== 'single-phase') continue
    if (!liveSlugs.has(row.slug)) {
      await req('PATCH', `${BASE}/items/challenge_plans/${row.id}`, TOKEN, { status: 'inactive' })
      console.log(`challenge_plans: ${row.slug} → inactive (legacy)`)
    }
  }

  /* ---------- trading_rules: the Rulebook ---------- */
  const rules = await all('trading_rules', 'id,section_key')
  for (const [i, section] of ruleSections.entries()) {
    const payload = {
      section_key: section.id, sort: i + 1, review_status: section.status, status: 'published',
      translations: ['fa', 'en'].map(locale => ({
        language_code: locale,
        title: section.title[locale],
        paragraphs: section.paragraphs.map(p => p[locale]),
        formula: section.formula || null,
        explanation_title: section.explanation?.title[locale] || null,
        explanation_body: section.explanation?.body[locale] || null,
        table: section.table ? {
          caption: section.table.caption[locale],
          columns: section.table.columns.map(c => c[locale]),
          rows: section.table.rows.map(r => r.map(c => c[locale])),
        } : null,
      })),
    }
    note('trading_rules', await upsert('trading_rules', { section_key: section.id }, payload, rules))
  }

  /* ---------- home_content (singleton — direct object endpoint) ---------- */
  let homeRow = null
  {
    /* singleton: object response (no list). id may be null — detect via content */
    const res = await req('GET', `${BASE}/items/home_content`, TOKEN)
    homeRow = Array.isArray(res.data) ? res.data[0] : res.data
  }
  const homePayload = {
    status: homeSeed.status,
    prop_cta_destination: homeSeed.propCtaDestination,
    perpetual_cta_destination: homeSeed.perpetualCtaDestination,
    translations: ['fa', 'en'].map(locale => ({
      language_code: locale,
      headline: homeSeed.translations[locale].headline,
      sub: homeSeed.translations[locale].sub,
      note: homeSeed.translations[locale].note,
      prop_title: homeSeed.translations[locale].propTitle,
      prop_description: homeSeed.translations[locale].propDescription,
      prop_cta: homeSeed.translations[locale].propCta,
      perpetual_title: homeSeed.translations[locale].perpetualTitle,
      perpetual_description: homeSeed.translations[locale].perpetualDescription,
      perpetual_cta: homeSeed.translations[locale].perpetualCta,
      seo_title: homeSeed.translations[locale].seoTitle,
      seo_description: homeSeed.translations[locale].seoDescription,
    })),
  }
  const homeExists = !!(homeRow && homeRow.status)
  if (homeExists) {
    if (REFRESH) {
      /* singleton: PATCH the collection route directly (no row id).
         Attach existing translation ids so children update instead of FK-less create. */
      try {
        const cur = (await req('GET', `${BASE}/items/home_content?fields=translations.id,translations.language_code`, TOKEN)).data
        const byLang = new Map((cur.translations || []).map(t => [t.language_code, t.id]))
        for (const t of homePayload.translations) if (byLang.has(t.language_code)) t.id = byLang.get(t.language_code)
      } catch { /* no translations yet */ }
      await req('PATCH', `${BASE}/items/home_content`, TOKEN, homePayload)
      stats['home_content'] = { created: 0, updated: 1, kept: 0 }
    } else stats['home_content'] = { created: 0, updated: 0, kept: 1 }
  } else {
    await req('POST', `${BASE}/items/home_content`, TOKEN, homePayload)
    stats['home_content'] = { created: 1, updated: 0, kept: 0 }
  }

  /* ---------- faqs ---------- */
  const faqs = await all('faqs', 'id,translations.question')
  const flatFaqs = faqs.map(f => ({ id: f.id, question: f.translations?.[0]?.question || '' }))
  for (const [i, item] of faqSeed.entries()) {
    const payload = {
      sort: i + 1, page: 'challenges', status: 'published',
      translations: [
        { language_code: 'fa', question: item.question.fa, answer: item.answer.fa },
        { language_code: 'en', question: item.question.en, answer: item.answer.en },
      ],
    }
    note('faqs', await upsert('faqs', { question: item.question.fa }, payload, flatFaqs))
  }

  /* ---------- legal_documents ---------- */
  const legal = await all('legal_documents', 'id,doc_type')
  const legalFlat = legal.map(l => ({ id: l.id, doc_type: l.doc_type }))
  for (const [i, doc] of legalSeed.entries()) {
    const payload = {
      doc_type: doc.docType, sort: i + 1, version: '2026-11', status: 'published',
      translations: ['fa', 'en'].map(locale => ({
        language_code: locale,
        title: doc.title[locale],
        paragraphs: doc.paragraphs.map(p => p[locale]),
      })),
    }
    note('legal_documents', await upsert('legal_documents', { doc_type: doc.docType }, payload, legalFlat))
  }

  /* ---------- footer_links ---------- */
  const footer = await all('footer_links', 'id,destination')
  const footerFlat = footer.map(f => ({ id: f.id, destination: f.destination }))
  for (const [i, link] of footerLinkSeed.entries()) {
    const payload = {
      destination: link.destination, sort: i + 1, status: 'published',
      translations: ['fa', 'en'].map(locale => ({ language_code: locale, label: link.label[locale] })),
    }
    note('footer_links', await upsert('footer_links', { destination: link.destination }, payload, footerFlat))
  }

  /* ---------- navigation_items (public_header: the four pages) ---------- */
  const nav = await all('navigation_items', 'id,route,location')
  for (const [i, item] of navSeed.entries()) {
    const payload = {
      location: 'public_header', sort: i + 1, route: `/${item.route}`, visible: true, status: 'published',
      translations: ['fa', 'en'].map(locale => ({ language_code: locale, label: item.label[locale] })),
    }
    const hit = nav.find(n => n.location === 'public_header' && n.route === payload.route)
    if (hit) {
      if (REFRESH) {
        const cur = (await req('GET', `${BASE}/items/navigation_items/${hit.id}?fields=translations.id,translations.language_code`, TOKEN)).data
        const byLang = new Map((cur.translations || []).map(t => [t.language_code, t.id]))
        for (const t of payload.translations) if (byLang.has(t.language_code)) t.id = byLang.get(t.language_code)
        await req('PATCH', `${BASE}/items/navigation_items/${hit.id}`, TOKEN, payload)
        note('navigation_items', { action: 'updated' })
      }
      else note('navigation_items', { action: 'kept' })
    } else {
      await req('POST', `${BASE}/items/navigation_items`, TOKEN, payload)
      note('navigation_items', { action: 'created' })
    }
  }

  /* ---------- pages: SEO/meta rows for the public pages ---------- */
  const pages = await all('pages', 'id,slug')
  const pageSeeds = [
    { slug: 'home', template: 'home', tr: locale => locale === 'fa'
      ? { title: 'خانه', description: homeSeed.translations.fa.seoDescription, seo_title: homeSeed.translations.fa.seoTitle, seo_description: homeSeed.translations.fa.seoDescription }
      : { title: 'Home', description: homeSeed.translations.en.seoDescription, seo_title: homeSeed.translations.en.seoTitle, seo_description: homeSeed.translations.en.seoDescription } },
    { slug: 'challenges', template: 'landing', tr: locale => locale === 'fa'
      ? { title: 'چلنج‌های معاملاتی', description: 'چلنج‌های پراپ اوپن‌فاند: استاندارد، تک‌مرحله‌ای، آنی و تست رایگان — با اهداف و سقف‌های ضرر شفاف.', seo_title: 'چلنج‌های معاملاتی اوپن‌فاند', seo_description: 'چلنج‌های پراپ اوپن‌فاند — استاندارد، تک‌مرحله‌ای، آنی و تست رایگان ۱۴روزه.' }
      : { title: 'Trading Challenges', description: 'Openfund prop challenges: Standard, One-phase, Instant and a free trial — with clear targets and loss limits.', seo_title: 'Openfund Trading Challenges', seo_description: 'Openfund prop challenges — Standard, One-phase, Instant and a 14-day free trial.' } },
    { slug: 'markets', template: 'markets', tr: locale => locale === 'fa'
      ? { title: marketsSeed.subtitle.fa, subtitle: marketsSeed.title.fa, description: marketsSeed.description.fa, seo_title: marketsSeed.seoTitle.fa, seo_description: marketsSeed.seoDescription.fa }
      : { title: marketsSeed.subtitle.en, subtitle: marketsSeed.title.en, description: marketsSeed.description.en, seo_title: marketsSeed.seoTitle.en, seo_description: marketsSeed.seoDescription.en } },
    { slug: 'rulebook', template: 'rulebook', tr: locale => locale === 'fa'
      ? { title: 'قوانین معاملاتی', description: rulebookIntro.fa, seo_title: 'قوانین معاملاتی اوپن‌فاند', seo_description: 'شرایط کامل چلنج‌های اوپن‌فاند — اهداف، سقف‌های ضرر، سهم سود و تست رایگان.' }
      : { title: 'Trading Rules', description: rulebookIntro.en, seo_title: 'Openfund Trading Rules', seo_description: 'The complete terms of the Openfund challenges — targets, loss limits, reward sharing and the free trial.' } },
    { slug: 'transparency', template: 'transparency', tr: locale => locale === 'fa'
      ? { title: 'شفافیت', description: 'داشبورد نمونهٔ گزارش‌دهی آیندهٔ اوپن‌فاند.', seo_title: 'شفافیت اوپن‌فاند', seo_description: 'نمایش رابط گزارش‌دهی آیندهٔ اوپن‌فاند با دادهٔ نمونه.' }
      : { title: 'Transparency', description: 'A sample view of Openfund’s future reporting interface.', seo_title: 'Openfund Transparency', seo_description: 'A sample view of Openfund’s future reporting interface.' } },
  ]
  for (const p of pageSeeds) {
    const payload = { slug: p.slug, template: p.template, status: 'published', translations: ['fa', 'en'].map(l => ({ language_code: l, ...p.tr(l) })) }
    note('pages', await upsert('pages', { slug: p.slug }, payload, pages))
  }

  console.log('\nseed summary:')
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: created ${v.created} · updated ${v.updated} · kept ${v.kept}`)
  console.log('\nNOTE: re-run with --refresh to overwrite Directus edits from the code seeds.')
}

main().catch(e => { console.error(e); process.exit(1) })
