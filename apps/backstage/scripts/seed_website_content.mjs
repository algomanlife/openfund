#!/usr/bin/env node
/**
 * Openfund backstage — WEBSITE EXPANSION CONTENT SEED (idempotent).
 *
 * Seeds the four new public sections into Directus:
 *   - faq_categories + faqs (page 'faq')     ← src/cms/seed/faqSiteContent.ts
 *   - learning_paths + lessons + glossary    ← src/cms/seed/learning/*
 *   - tools (prose only, maths stay in code) ← src/cms/seed/toolsCopy.ts
 *   - referral_content (singleton)           ← src/cms/seed/referralContent.ts
 *   - navigation_items + footer_links + pages rows for the new routes
 *
 * Idempotency: rows are matched by natural key (category slug, faq slug,
 * path slug, lesson slug, term slug, tool slug, nav route, footer destination,
 * page slug). Existing records are NOT overwritten unless `--refresh` is
 * passed, so editorial edits made in Directus are preserved.
 *
 * Usage:
 *   node seed_website_content.mjs [--refresh] [--url http://localhost:8055]
 *        [--email admin@openfund.dev] [--password openfund-admin-2026]
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const requireWeb = createRequire(pathToFileURL(path.resolve(import.meta.dirname, '../../web-react/package.json')))
const { buildSync } = requireWeb('esbuild')
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

/** bundle a TypeScript seed module to CJS and evaluate it (app-test pattern) */
function load(rel) {
  const { outputFiles } = buildSync({
    entryPoints: [path.resolve(WEB, rel)],
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputFiles[0].text)(requireWeb, module, module.exports)
  return module.exports
}

const { faqCategories, faqItems } = load('src/cms/seed/faqSiteContent.ts')
const { pathA } = load('src/cms/seed/learning/pathA.ts')
const { pathB } = load('src/cms/seed/learning/pathB.ts')
const { pathC } = load('src/cms/seed/learning/pathC.ts')
const { pathD } = load('src/cms/seed/learning/pathD.ts')
const { pathE } = load('src/cms/seed/learning/pathE.ts')
const { glossaryTerms } = load('src/cms/seed/learning/glossary.ts')
const { toolsCopy } = load('src/cms/seed/toolsCopy.ts')
const { referralContent } = load('src/cms/seed/referralContent.ts')
const { toolDefinitions } = load('src/data/toolCatalog.ts')

const paths = [pathA, pathB, pathC, pathD, pathE].sort((a, b) => a.sort - b.sort)

let TOKEN
const stats = {}
const note = (name, r) => { stats[name] = stats[name] || { created: 0, updated: 0, kept: 0 }; stats[name][r.action]++ }
const all = async (collection, fields = '*') => (await req('GET', `${BASE}/items/${collection}?fields=${fields}&limit=-1`, TOKEN)).data || []

async function upsert(collection, filter, payload, existing) {
  const hit = existing.find(x => Object.entries(filter).every(([k, v]) => String(x[k]) === String(v)))
  if (hit) {
    if (REFRESH) {
      if (Array.isArray(payload.translations)) {
        try {
          const cur = (await req('GET', `${BASE}/items/${collection}/${hit.id}?fields=translations.id,translations.language_code`, TOKEN)).data
          const byLang = new Map((cur.translations || []).map(t => [t.language_code, t.id]))
          for (const t of payload.translations) if (byLang.has(t.language_code)) t.id = byLang.get(t.language_code)
        } catch { /* collection without a translations alias */ }
      }
      await req('PATCH', `${BASE}/items/${collection}/${hit.id}`, TOKEN, payload)
      return { action: 'updated', id: hit.id }
    }
    return { action: 'kept', id: hit.id }
  }
  const created = await req('POST', `${BASE}/items/${collection}`, TOKEN, payload)
  return { action: 'created', id: created.data?.id ?? created.data }
}

/** one lesson block in ONE locale (Directus stores blocks per translation row) */
function blockTo(block, locale) {
  const out = { type: block.type }
  if (block.type === 'formula') {
    out.expr = block.expr
    if (block.text) out.text = block.text[locale]
  } else if (block.type === 'table') {
    out.caption = block.caption[locale]
    out.head = block.head.map(cell => cell[locale])
    out.rows = block.rows.map(row => row.map(cell => cell[locale]))
  } else if (block.type === 'terms') {
    out.items = block.items.map(item => ({ term: item.term[locale], text: item.text[locale] }))
  } else if (block.type === 'ul' || block.type === 'ol') {
    out.items = block.items.map(item => item[locale])
  } else {
    out.text = block.text[locale]
  }
  return out
}

/** FAQ related links in ONE locale (labels are per-locale, targets are shared) */
function linksTo(links, locale) {
  if (!links?.length) return null
  return links.map(link => ({ target: link.target, label: { [locale]: link.label[locale] } }))
}

async function main() {
  TOKEN = (await req('POST', `${BASE}/auth/login`, null, { email: EMAIL, password: PASSWORD })).data.access_token
  console.log('login OK (refresh:', REFRESH + ')')

  /* ---------- faq_categories ---------- */
  const cats = await all('faq_categories', 'id,slug')
  const catIds = new Map()
  for (const cat of faqCategories) {
    const payload = {
      slug: cat.key, sort: cat.sort, icon: cat.icon, status: 'published',
      translations: ['fa', 'en'].map(locale => ({ language_code: locale, label: cat.label[locale], description: cat.description[locale] })),
    }
    const r = await upsert('faq_categories', { slug: cat.key }, payload, cats)
    catIds.set(cat.key, r.id)
    note('faq_categories', r)
  }

  /* ---------- faqs (page 'faq', grouped by category) ---------- */
  const faqs = await all('faqs', 'id,slug,page')
  for (const item of faqItems) {
    const payload = {
      slug: item.key, sort: item.sort, page: 'faq', status: 'published',
      category: catIds.get(item.category) || null,
      translations: ['fa', 'en'].map(locale => ({
        language_code: locale,
        question: item.question[locale],
        answer: item.answer[locale],
        links: linksTo(item.links, locale),
      })),
    }
    note('faqs', await upsert('faqs', { slug: item.key }, payload, faqs))
  }

  /* ---------- learning_paths + lessons ---------- */
  const pathRows = await all('learning_paths', 'id,slug')
  const pathIds = new Map()
  for (const path of paths) {
    const payload = {
      slug: path.slug, path_key: path.key, sort: path.sort, level: path.level, status: 'published',
      translations: ['fa', 'en'].map(locale => ({
        language_code: locale,
        eyebrow: path.eyebrow[locale], title: path.title[locale],
        summary: path.summary[locale], outcomes: path.outcomes.map(o => o[locale]),
      })),
    }
    const r = await upsert('learning_paths', { slug: path.slug }, payload, pathRows)
    pathIds.set(path.slug, r.id)
    note('learning_paths', r)
  }

  const lessonRows = await all('lessons', 'id,slug,path_id')
  for (const path of paths) {
    for (const lesson of path.lessons) {
      const payload = {
        slug: lesson.slug, path_id: pathIds.get(path.slug), sort: lesson.sort,
        minutes: lesson.minutes, status: 'published',
        glossary: lesson.glossary, tools: lesson.tools,
        translations: ['fa', 'en'].map(locale => ({
          language_code: locale,
          title: lesson.title[locale], summary: lesson.summary[locale],
          takeaways: lesson.takeaways.map(t => t[locale]),
          blocks: lesson.blocks.map(block => blockTo(block, locale)),
        })),
      }
      note('lessons', await upsert('lessons', { slug: lesson.slug }, payload, lessonRows))
    }
  }

  /* ---------- glossary_terms ---------- */
  const termRows = await all('glossary_terms', 'id,slug')
  for (const term of glossaryTerms) {
    const payload = {
      slug: term.slug, sort: term.sort, status: 'published',
      lessons: term.lessons, tool: term.tool || null,
      translations: ['fa', 'en'].map(locale => ({
        language_code: locale,
        term: term.term[locale], short: term.short[locale], definition: term.definition[locale],
      })),
    }
    note('glossary_terms', await upsert('glossary_terms', { slug: term.slug }, payload, termRows))
  }

  /* ---------- tools (prose only) ---------- */
  const toolRows = await all('tools', 'id,slug')
  for (const def of toolDefinitions) {
    const copy = toolsCopy[def.slug]
    if (!copy) continue
    const payload = {
      slug: def.slug, category: def.category, sort: def.sort, status: 'published',
      translations: ['fa', 'en'].map(locale => ({
        language_code: locale,
        name: copy.name[locale], tagline: copy.tagline[locale], about: copy.about[locale],
        method: copy.method[locale], assumptions: copy.assumptions.map(a => a[locale]),
        limitations: copy.limitations[locale],
      })),
    }
    note('tools', await upsert('tools', { slug: def.slug }, payload, toolRows))
  }

  /* ---------- referral_content (singleton) ---------- */
  {
    const current = (await req('GET', `${BASE}/items/referral_content?fields=id,translations.id,translations.language_code&single=1`, TOKEN).catch(() => ({ data: null }))).data
    const translations = ['fa', 'en'].map(locale => ({
      language_code: locale,
      hero_eyebrow: referralContent.hero.eyebrow[locale],
      hero_title: referralContent.hero.title[locale],
      hero_accent: referralContent.hero.accent[locale],
      hero_intro: referralContent.hero.intro[locale],
      status_notice: referralContent.statusNotice[locale],
      dashboard_title: referralContent.dashboard.title[locale],
      dashboard_intro: referralContent.dashboard.intro[locale],
      dashboard_columns: referralContent.dashboard.columns.map(column => ({ state: column.state, title: column.title[locale], text: column.text[locale] })),
      benefits: referralContent.benefits.map(b => ({ icon: b.icon, title: b.title[locale], text: b.text[locale] })),
      stages: referralContent.stages.map(s => ({ title: s.title[locale], text: s.text[locale] })),
      sections: referralContent.sections.map(s => ({ key: s.key, title: s.title[locale], body: s.body.map(p => p[locale]), items: s.items?.map(i => i[locale]) || null, note: s.note ? s.note[locale] : null })),
      faq: referralContent.faq.map(f => ({ key: f.key, category: f.category, sort: f.sort, question: f.question[locale], answer: f.answer[locale] })),
      pending_decisions: referralContent.pendingDecisions.map(d => ({ title: d.title[locale], text: d.text[locale] })),
      cta_title: referralContent.cta.title[locale],
      cta_text: referralContent.cta.text[locale],
      cta_primary: referralContent.cta.primary[locale],
      cta_secondary: referralContent.cta.secondary[locale],
      seo_title: `${referralContent.hero.title[locale]} | Openfund`,
      seo_description: referralContent.hero.intro[locale],
    }))
    const payload = { status: 'published', program_state: 'prelaunch', translations }
    if (current?.id) {
      if (REFRESH) {
        const byLang = new Map((current.translations || []).map(t => [t.language_code, t.id]))
        for (const t of translations) if (byLang.has(t.language_code)) t.id = byLang.get(t.language_code)
        await req('PATCH', `${BASE}/items/referral_content`, TOKEN, payload)
        note('referral_content', { action: 'updated' })
      } else note('referral_content', { action: 'kept' })
    } else {
      /* Directus singletons are created and updated through the same PATCH route */
      await req('PATCH', `${BASE}/items/referral_content`, TOKEN, payload)
      note('referral_content', { action: 'created' })
    }
  }

  /* ---------- navigation_items: the four new sections ---------- */
  const nav = await all('navigation_items', 'id,route,location,sort')
  const navSeeds = [
    { route: '/faq', sort: 5, label: { fa: 'پرسش‌های متداول', en: 'FAQ' } },
    { route: '/tools', sort: 6, label: { fa: 'ابزارها', en: 'Tools' } },
    { route: '/learn', sort: 7, label: { fa: 'آموزش', en: 'Learn' } },
    { route: '/referral', sort: 8, label: { fa: 'همیار رشد', en: 'Growth Partner' } },
  ]
  for (const item of navSeeds) {
    const payload = {
      location: 'public_header', sort: item.sort, route: item.route, visible: true, status: 'published',
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
      } else note('navigation_items', { action: 'kept' })
    } else {
      await req('POST', `${BASE}/items/navigation_items`, TOKEN, payload)
      note('navigation_items', { action: 'created' })
    }
  }

  /* ---------- footer_links ---------- */
  const footer = await all('footer_links', 'id,destination')
  const footerSeeds = [
    { destination: 'faq', label: { fa: 'پرسش‌های متداول', en: 'FAQ' } },
    { destination: 'tools', label: { fa: 'ابزارها', en: 'Tools' } },
    { destination: 'learn', label: { fa: 'آموزش', en: 'Learn' } },
    { destination: 'referral', label: { fa: 'همیار رشد', en: 'Growth Partner' } },
  ]
  for (const link of footerSeeds) {
    const payload = {
      destination: link.destination, sort: 5 + footerSeeds.indexOf(link), status: 'published',
      translations: ['fa', 'en'].map(locale => ({ language_code: locale, label: link.label[locale] })),
    }
    note('footer_links', await upsert('footer_links', { destination: link.destination }, payload, footer))
  }

  /* ---------- pages: SEO rows ---------- */
  const pages = await all('pages', 'id,slug')
  const pageSeeds = [
    { slug: 'faq', tr: locale => locale === 'fa'
      ? { title: 'پرسش‌های متداول', description: 'پاسخ پرسش‌های رایج دربارهٔ محصولات اوپن‌فاند، شرایط چلنج‌ها، برداشت، معرفی، ترمینال و شفافیت.', seo_title: 'پرسش‌های متداول اوپن‌فاند', seo_description: '۴۳ پرسش و پاسخ دربارهٔ محصولات، شرایط و ترمینال اوپن‌فاند — دسته‌بندی‌شده و قابل جست‌وجو.' }
      : { title: 'FAQ', description: 'Answers about the Openfund products, challenge terms, payouts, referrals, the trading terminal and transparency.', seo_title: 'Openfund FAQ', seo_description: '43 answers about Openfund products, terms and the terminal — grouped and searchable.' } },
    { slug: 'tools', tr: locale => locale === 'fa'
      ? { title: 'ابزارها', description: 'ده محاسبه‌گر معاملاتی در مرورگر: حجم موقعیت، مارجین، لیکوئید، سود و زیان، فاندینگ، ریسک و تحلیل‌گر ژورنال.', seo_title: 'ابزارهای محاسباتی اوپن‌فاند', seo_description: 'ده محاسبه‌گر معاملاتی — در مرورگر تو، با فرمولِ نمایان و بدون بارگذاری داده.' }
      : { title: 'Tools', description: 'Ten browser-side trading calculators: position size, margin, liquidation, PnL, funding, risk and a journal analyzer.', seo_title: 'Openfund Tools Center', seo_description: 'Ten trading calculators that run in your browser, with the formulas shown and nothing uploaded.' } },
    { slug: 'learn', tr: locale => locale === 'fa'
      ? { title: 'آموزش', description: 'پنج مسیر یادگیری از مکانیک معاملات آنی تا شفافیت درون‌زنجیره‌ای، با واژه‌نامهٔ ۴۰ اصطلاح.', seo_title: 'مركز آموزش اوپن‌فاند', seo_description: 'پنج مسیر یادگیری، ۲۵ درس و واژه‌نامهٔ ۴۰ اصطلاح — آموزش مکانیک، نه وعدهٔ سود.' }
      : { title: 'Learn', description: 'Five learning paths from perpetual futures mechanics to on-chain transparency, with a 40-term glossary.', seo_title: 'Openfund Learning Center', seo_description: 'Five learning paths, 25 lessons and a 40-term glossary — mechanics, not promises.' } },
    { slug: 'referral', tr: locale => locale === 'fa'
      ? { title: 'همیار رشد', description: 'برنامهٔ معرفی اوپن‌فاند — انتساب فعال امروز، شرایط پاداش پیش از عرضه اعلام می‌شود.', seo_title: 'همیار رشد اوپن‌فاند', seo_description: 'لینک و کد دعوت با انتساب سمت سرویس؛ پاداش‌ها فقط پس از تصویب شرایط تجاری.' }
      : { title: 'Growth Partner', description: 'The Openfund referral program — attribution works today, reward terms are published before launch.', seo_title: 'Openfund Growth Partner', seo_description: 'Your invite link and code with server-side attribution; rewards only after the business terms are approved.' } },
  ]
  for (const p of pageSeeds) {
    const payload = { slug: p.slug, template: 'website', status: 'published', translations: ['fa', 'en'].map(l => ({ language_code: l, ...p.tr(l) })) }
    note('pages', await upsert('pages', { slug: p.slug }, payload, pages))
  }

  console.log('\nwebsite content seed summary:')
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: created ${v.created} · updated ${v.updated} · kept ${v.kept}`)
  console.log('\nNOTE: re-run with --refresh to overwrite Directus edits from the code seeds.')
}

main().catch(e => { console.error(e); process.exit(1) })
