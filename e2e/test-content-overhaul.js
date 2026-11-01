/* E2E: content overhaul — bilingual copy, single-source plan numbers,
   prototype-language removal, RTL/LTR, viewports (build on :4173) */
const { chromium } = require('playwright-core')
const results = []
const R = (n, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} - ${n}${extra ? '  [' + extra + ']' : ''}`)
const SHOTS = '/Users/algoman/.qwenwork/workspace/mvw61rrm1ic7idr4/shots4'
const BASE = 'http://127.0.0.1:4173/react'
const fs = require('fs')
fs.mkdirSync(SHOTS, { recursive: true })

const widths = [375, 768, 1024, 1440]

;(async () => {
  const browser = await chromium.launch({
    executablePath: `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
    headless: true
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = []
  page.on('pageerror', e => errs.push(e.message.slice(0, 160)))

  /* ============ LANDING (fa) — catalog-driven builder ============ */
  await page.goto(`${BASE}/#/fa/challenges`, { waitUntil: 'load' })
  await page.waitForTimeout(2600)
  const builder = await page.evaluate(() => ({
    target: document.querySelector('#target')?.textContent,
    maxLoss: document.querySelector('#max-loss')?.textContent,
    split: document.querySelector('#profit-split')?.textContent,
    cap: document.querySelector('#cap')?.textContent,
    price: document.querySelector('#builder-price')?.textContent,
    feeLabel: document.querySelector('.price-summary span')?.textContent,
    cardPreset: document.querySelector('#card-preset')?.textContent,
    facts: [...document.querySelectorAll('.builder-facts span')].map(e => e.textContent.trim()),
    sampleNote: document.querySelector('.sample-note')?.textContent,
    heroAccountLabel: document.querySelector('.hero-account-meta span')?.textContent,
    pill: document.querySelector('.hero-account .pill')?.textContent,
    cta: document.querySelector('.hero-actions .button')?.textContent.trim(),
  }))
  R('builder fa: standard defaults from CMS catalog (8%+5%, 10%, 80%, $652)',
    builder.target === '۸٪ + ۵٪' && builder.maxLoss === '۱۰٪' && builder.split === '۸۰٪' && builder.price === '$652',
    JSON.stringify([builder.target, builder.maxLoss, builder.split, builder.price]))
  R('builder fa: cap without limit', builder.cap === 'بدون سقف', builder.cap)
  R('builder fa: card preset label', builder.cardPreset === 'چلنج استاندارد · دومرحله‌ای', builder.cardPreset)
  R('builder fa: evaluation-fee label (no «نمونه»)', builder.feeLabel === 'هزینهٔ ارزیابی · یک‌باره', builder.feeLabel)
  R('builder fa: daily loss terminology', builder.facts.some(f => f.includes('سقف ضرر روزانه')), JSON.stringify(builder.facts))
  R('builder fa: honest sample note (no «پرداخت امن»)', /فعال‌سازی خرید در این نسخه فراهم نیست/.test(builder.sampleNote || ''), (builder.sampleNote || '').slice(0, 60))
  R('hero fa: evaluation account size + challenge pill', builder.heroAccountLabel === 'اندازهٔ حساب ارزیابی' && builder.pill === 'چلنج معاملاتی', `${builder.heroAccountLabel} | ${builder.pill}`)
  R('hero fa: CTA wording', builder.cta === 'چلنج مناسبم را پیدا کنم ←', builder.cta)

  /* preset switch → one-phase values propagate */
  await page.click('[data-preset="one-phase"]')
  await page.waitForTimeout(400)
  const onePhase = await page.evaluate(() => ({
    target: document.querySelector('#target')?.textContent,
    maxLoss: document.querySelector('#max-loss')?.textContent,
    split: document.querySelector('#profit-split')?.textContent,
    price: document.querySelector('#builder-price')?.textContent,
    sizes: [...document.querySelectorAll('#builder-sizes button')].map(b => b.textContent.trim()),
    cardPreset: document.querySelector('#card-preset')?.textContent,
  }))
  R('builder fa: one-phase preset from CMS catalog', onePhase.target === '۱۲٪' && onePhase.maxLoss === '۱۲٪' && onePhase.split === '۸۰٪' && onePhase.price === '$666',
    JSON.stringify([onePhase.target, onePhase.maxLoss, onePhase.split, onePhase.price]))
  R('builder fa: one-phase sizes from catalog', JSON.stringify(onePhase.sizes) === JSON.stringify(['5k', '10k', '25k', '50k', '100k']), JSON.stringify(onePhase.sizes))

  /* instant preset */
  await page.click('[data-preset="instant"]')
  await page.waitForTimeout(400)
  const instant = await page.evaluate(() => ({
    target: document.querySelector('#target')?.textContent,
    price: document.querySelector('#builder-price')?.textContent,
    maxLoss: document.querySelector('#max-loss')?.textContent,
    cardPreset: document.querySelector('#card-preset')?.textContent,
    sizes: [...document.querySelectorAll('#builder-sizes button')].map(b => b.textContent.trim()),
  }))
  R('builder fa: instant preset (no target, trailing, $444 @100k)', instant.target === '—' && instant.price === '$444' && instant.maxLoss === '۵٪ شناور', JSON.stringify([instant.target, instant.price, instant.maxLoss]))
  R('builder fa: instant sizes incl. 200k', JSON.stringify(instant.sizes) === JSON.stringify(['5k', '10k', '25k', '50k', '100k', '200k']), JSON.stringify(instant.sizes))

  /* return to standard before the details checks */
  await page.click('[data-preset="standard"]')
  await page.waitForTimeout(400)

  /* details tables derive from catalog */
  const details = await page.evaluate(() => ({
    eval1: document.querySelector('#evaluation-rules dt')?.textContent,
    eval1v: document.querySelector('#evaluation-rules dd')?.textContent,
    daily: [...document.querySelectorAll('#evaluation-rules div')].map(d => d.textContent.trim()).find(x => x.includes('سقف ضرر روزانه')),
    order: document.querySelector('#challenge-order')?.textContent.trim(),
    payout: [...document.querySelectorAll('#funded-rules div')].map(d => d.textContent.trim()).find(x => x.includes('زمان و حداقل برداشت')),
  }))
  R('details fa: phase-1 target with USD amount', /هدف مرحلهٔ اول/.test(details.eval1 || '') && /8%/.test(details.eval1v || ''), JSON.stringify(details.eval1v))
  R('details fa: daily loss limit row from catalog', /سقف ضرر روزانه\s*5%/.test(details.daily || ''), details.daily)
  R('details fa: payout timing from catalog (14d / 1%)', /۱۴ روز/.test(details.payout || ''), details.payout)
  R('details fa: honest order note (no instant activation)', /فعال‌سازی خرید در این نسخه فراهم نیست/.test(details.order || ''), details.order)

  /* compare view */
  await page.click('[data-challenge-view="compare"]')
  await page.waitForTimeout(400)
  const compare = await page.evaluate(() => ({
    headers: [...document.querySelectorAll('#challenge-comparison thead th')].map(t => t.textContent.trim()),
    lossRow: [...document.querySelectorAll('#challenge-comparison tbody tr')].find(r => r.textContent.includes('سقف ضرر کل'))?.textContent.trim(),
  }))
  R('compare fa: columns from catalog names', JSON.stringify(compare.headers) === JSON.stringify(['ویژگی', 'استاندارد', 'تک‌مرحله‌ای', 'آنی']), JSON.stringify(compare.headers))
  R('compare fa: total loss row 10/12/5 trailing', /10%/.test(compare.lossRow || '') && /12%/.test(compare.lossRow || '') && /trailing/.test(compare.lossRow || ''), (compare.lossRow || '').replace(/\s+/g, ''))
  await page.click('[data-challenge-view="plans"]')

  /* dialog honest summary */
  await page.click('#review-selection')
  await page.waitForTimeout(400)
  const dialog = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('#selection-summary div')].map(d => d.textContent.trim()),
    note: document.querySelector('.dialog-note')?.textContent.trim(),
  }))
  R('dialog fa: evaluation-fee row (no «هزینهٔ نمونه»)', dialog.rows.some(r => r.includes('هزینهٔ ارزیابی')), JSON.stringify(dialog.rows))
  R('dialog fa: loss terminology row', dialog.rows.some(r => r.includes('سقف ضرر کل / روزانه')), '')
  R('dialog fa: honest note', /فعال نیست/.test(dialog.note || ''), dialog.note)
  await page.click('#dialog-done').catch(() => {})
  await page.keyboard.press('Escape')

  /* prototype language sweep */
  const faqCount = await page.evaluate(() => document.querySelectorAll('#rules-list details').length)
  const sweep = await page.evaluate(() => {
    const text = document.body.innerText
    return {
      fakeNames: ['آرمان نیک‌پی', 'رها مهرآیین', 'کیان رادمنش', 'نیلوفر شایان', 'سامان فرهمند'].filter(n => text.includes(n)),
      sampleFee: ['هزینهٔ نمونه', 'هزینهٔ یک‌بارهٔ نمونه', 'اهرم نمونه', 'پرداخت امن'].filter(s => text.includes(s)),
      faqNew: document.querySelectorAll('#rules-list details').length === 9 && document.body.innerText.includes('سه مدل خریدنی'),
      roles: ['راهبرد و توسعهٔ کسب‌وکار', 'محصول و تجربهٔ کاربری', 'فناوری و زیرساخت', 'تحلیل بازار و مدیریت ریسک', 'جامعهٔ معامله‌گران و پشتیبانی'].filter(r => text.includes(r)).length,
      honestLegal: text.includes('شبیه‌سازی‌شده') && text.includes('آخرین به‌روزرسانی: نوامبر ۲۰۲۶'),
    }
  })
  R('landing fa: no fabricated team names', sweep.fakeNames.length === 0, sweep.fakeNames.join(','))
  const trial = await page.evaluate(() => !!document.querySelector('.trial-banner'))
  R('landing fa: free-trial banner rendered', trial)
  R('landing fa: no prototype fee/payment wording', sweep.sampleFee.length === 0, sweep.sampleFee.join(','))
  R('landing fa: FAQ rendered from CMS (9 items)', faqCount === 9, String(faqCount))
  R('landing fa: five role cards present', sweep.roles === 5, String(sweep.roles))
  R('landing fa: legal kept honest + dated', sweep.honestLegal)
  await page.screenshot({ path: `${SHOTS}/challenges-fa-1440.png` })

  /* ============ LANDING (en) ============ */
  await page.click('[data-preset="standard"]')
  await page.waitForTimeout(300)
  await page.click('#language-toggle')
  await page.waitForTimeout(1600)
  const en = await page.evaluate(() => ({
    url: location.hash,
    cta: document.querySelector('.hero-actions .button')?.textContent.trim(),
    feeLabel: document.querySelector('.price-summary span')?.textContent,
    sampleNote: document.querySelector('.sample-note')?.textContent,
    target: document.querySelector('#target')?.textContent,
    faq: [...document.querySelectorAll('.rules-list summary')].map(s => s.textContent.trim())[0],
    role: document.querySelector('.team-identity h3')?.textContent,
    footerLink: [...document.querySelectorAll('.footer-top a')].map(a => a.textContent.trim()),
    order: document.querySelector('#challenge-order')?.textContent.trim(),
    compareHeaders: [...document.querySelectorAll('#challenge-comparison thead th')].map(t => t.textContent.trim()),
    legal: document.querySelector('#legal')?.textContent.trim(),
  }))
  R('landing en: URL synced', en.url.includes('#/en/challenges'), en.url)
  R('landing en: CTA translated', en.cta === 'Find my challenge→', en.cta)
  R('landing en: fee label translated', en.feeLabel === 'Evaluation fee · one-time', en.feeLabel)
  R('landing en: honest sample note translated', /not available in this release/.test(en.sampleNote || ''), (en.sampleNote || '').slice(0, 70))
  R('landing en: builder numbers (8% + 5%)', en.target === '8% + 5%', en.target)
  R('landing en: FAQ translated', /What challenge models/.test((en.faq || '').replace(/\+$/, '')), en.faq)
  R('landing en: role cards translated', en.role === 'Strategy & business development', en.role)
  R('landing en: footer translated', en.footerLink.includes('Challenges'), JSON.stringify(en.footerLink))
  R('landing en: order note translated', /not enabled in this release/.test(en.order || ''), (en.order || '').slice(0, 60))
  R('landing en: compare headers translated', JSON.stringify(en.compareHeaders) === JSON.stringify(['Feature', 'Standard', 'One-phase', 'Instant']), JSON.stringify(en.compareHeaders))
  R('landing en: legal date updated', /November 2026/.test(en.legal || ''), en.legal)
  await page.screenshot({ path: `${SHOTS}/challenges-en-1440.png` })

  /* ============ RULEBOOK — catalog-derived configuration table ============ */
  await page.goto(`${BASE}/#/fa/rulebook`, { waitUntil: 'load' })
  await page.waitForTimeout(1600)
  const rb = await page.evaluate(() => {
    const table = [...document.querySelectorAll('.rule-section table')].find(t => t.querySelector('caption')?.textContent.includes('چلنج'))
    return {
      caption: table?.querySelector('caption')?.textContent,
      rows: table ? [...table.querySelectorAll('tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()) : [],
      terminology: document.body.innerText.includes('چلنج معاملاتی'),
      sections: document.querySelectorAll('.rule-section').length,
    }
  })
  R('rulebook fa: catalog-derived configuration table', !!rb.caption && rb.rows.length === 4, rb.caption)
  R('rulebook fa: standard row values', /۵٪ \/ ۱۰٪/.test(rb.rows[0] || '') && /۵٬۰۰۰/.test(rb.rows[0] || ''), rb.rows[0])
  R('rulebook fa: one-phase row 12% target', /۱۲٪/.test(rb.rows[1] || ''), rb.rows[1])
  R('rulebook fa: instant row trailing', /شناور/.test(rb.rows[2] || ''), rb.rows[2])
  R('rulebook fa: challenge terminology in glossary', rb.terminology)
  R('rulebook fa: 22 CMS sections + catalog table', rb.sections === 23, String(rb.sections))
  await page.screenshot({ path: `${SHOTS}/rulebook-fa-1440.png` })

  await page.click('#language-toggle')
  await page.waitForTimeout(1000)
  const rbEn = await page.evaluate(() => {
    const table = [...document.querySelectorAll('.rule-section table')].find(t => t.querySelector('caption')?.textContent.toLowerCase().includes('challenge catalog'))
    return {
      rows: table ? [...table.querySelectorAll('tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()) : [],
      url: location.hash,
    }
  })
  R('rulebook en: URL synced', rbEn.url.includes('#/en/rulebook'), rbEn.url)
  R('rulebook en: catalog table translated (4 plans)', rbEn.rows.length === 4 && /3% \/ 12%/.test(rbEn.rows[1] || ''), rbEn.rows[1])
  await page.screenshot({ path: `${SHOTS}/rulebook-en-1440.png` })

  /* ============ HOME — preserved + polished ============ */
  await page.goto(`${BASE}/#/fa/home`, { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  const home = await page.evaluate(() => ({
    h1: document.querySelector('.home-stage h1')?.textContent,
    note: document.querySelector('.home-note')?.textContent.trim(),
    ctas: [...document.querySelectorAll('.home-panel .button')].map(a => a.textContent.trim()),
  }))
  R('home fa: headline preserved', home.h1 === 'همه بازارها در یک پلتفرممعاملاتی', home.h1)
  R('home fa: honest product note', /شبیه‌سازی/.test(home.note || ''), home.note)
  R('home fa: CTAs preserved', home.ctas[0] === 'چلنج‌های پراپ←' && home.ctas[1].includes('پرپچوال'), JSON.stringify(home.ctas))
  await page.screenshot({ path: `${SHOTS}/home-fa-1440.png` })

  /* ============ RTL/LTR + viewport audit ============ */
  const pages = [
    { hash: '#/fa/challenges', name: 'challenges-fa' },
    { hash: '#/en/challenges', name: 'challenges-en' },
    { hash: '#/fa/markets', name: 'markets-fa' },
    { hash: '#/fa/home', name: 'home-fa' },
    { hash: '#/fa/rulebook', name: 'rulebook-fa' },
  ]
  for (const p of pages) {
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: w === 375 ? 760 : 900 })
      await page.goto(`${BASE}/${p.hash}`, { waitUntil: 'load' })
      await page.waitForTimeout(w === 375 ? 2200 : 2800)
      const audit = await page.evaluate(() => {
        const doc = document.documentElement
        const overflow = doc.scrollWidth - window.innerWidth
        const dir = doc.getAttribute('dir')
        const rtl = dir === 'rtl'
        /* LTR isolation: numeric/price cells must stay isolated left-to-right */
        let numerics = 0, badNumerics = 0
        document.querySelectorAll('.numeric, #builder-price, #account-value, .mk-price, .price-cell').forEach(e => {
          numerics++
          if (getComputedStyle(e).direction !== 'ltr' || getComputedStyle(e).unicodeBidi === 'normal') badNumerics++
        })
        return { overflow, dir, numerics, badNumerics }
      })
      R(`${p.name} @${w}: dir correct`, (p.hash.includes('/fa/') ? audit.dir === 'rtl' : audit.dir === 'ltr'), audit.dir)
      R(`${p.name} @${w}: no horizontal overflow`, audit.overflow <= 1, String(audit.overflow))
      if (audit.numerics) R(`${p.name} @${w}: numerics LTR-isolated`, audit.badNumerics === 0, `${audit.badNumerics}/${audit.numerics}`)
      if (w === 375 || w === 1440) await page.screenshot({ path: `${SHOTS}/${p.name}-${w}.png` })
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })

  /* terminal regression: untouched */
  await page.goto(`${BASE}/#/terminal`, { waitUntil: 'load' })
  await page.waitForTimeout(7000)
  const term = await page.evaluate(() => ({ pair: document.querySelector('#cur-pair')?.textContent.trim(), btn: document.querySelector('#market-select-btn[disabled]') ? 'disabled' : 'ready' }))
  R('terminal: boots normally (untouched)', term.pair === 'BTC/USD' && term.btn === 'ready', JSON.stringify(term))

  /* transparency untouched */
  await page.goto(`${BASE}/#/fa/transparency`, { waitUntil: 'load' })
  await page.waitForTimeout(1800)
  const tr = await page.evaluate(() => ({ metrics: document.querySelectorAll('.metric-card').length, sample: document.body.innerText.includes('دادهٔ نمونه') }))
  R('transparency: sample dashboard untouched', tr.metrics === 6 && tr.sample, JSON.stringify(tr))

  R('no page errors', errs.length === 0, errs.slice(0, 4).join(' | '))

  console.log(results.join('\n'))
  const failed = results.filter(r => r.startsWith('FAIL')).length
  console.log(`\n${failed === 0 ? 'ALL PASS' : failed + ' FAILURES'} (${results.length} checks)`)
  await browser.close()
  process.exit(failed === 0 ? 0 : 1)
})().catch(e => { console.error(e); process.exit(1) })
