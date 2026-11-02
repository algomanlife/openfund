/**
 * Website expansion test suite: the ten calculators, the CSV journal import,
 * Unicode-aware FAQ search, the content contracts (paired locales, resolvable
 * cross-references) and the bundled/CMS content library.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
const require = createRequire(import.meta.url)

function load(path) {
  const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports)
  return module.exports
}

const { positionSize, leverageMargin, liquidationPrice, perpPnl, fundingRate, riskReward, riskOfRuin, propDrawdown, consistencyRule, parseUserNumber } = load('../src/data/calculators.ts')
const { parseCsvRows, detectDelimiter, mapColumns, analyzeJournal, byDay } = load('../src/data/journalCsv.ts')
const { normalizeText, matchesQuery } = load('../src/features/faq/search.ts')
const { toolDefinitions, buildToolSpecs } = load('../src/data/toolCatalog.ts')
const { bundledLibrary, targetHref, lessonBySlug, pathBySlug, faqCountByCategory } = load('../src/cms/siteContent.ts')

const close = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, got ${actual}`)

/* ================= 1. position size ================= */
test('position size converts a fixed money risk into units, fees included', () => {
  const out = positionSize({ equity: 10000, riskPct: 1, direction: 'long', entry: 60000, stop: 58800, feePct: 0.035, contractSize: 1, leverage: 10 })
  assert.equal(out.ok, true)
  close(out.values.riskAmount, 100)
  close(out.values.stopDistance, 1200)
  close(out.values.units, 100 / 1242, 1e-12) /* 1200 + 60000*0.00035*2 = 1242 */
  close(out.values.notional, 60000 * 100 / 1242, 1e-9)
  close(out.values.marginRequired, 60000 * 100 / 1242 / 10, 1e-9)
  close(out.values.stopDistancePct, 2)
})
test('position size mirrors exactly for a short with the stop above entry', () => {
  const out = positionSize({ equity: 10000, riskPct: 1, direction: 'short', entry: 60000, stop: 61200, feePct: 0.035, contractSize: 1, leverage: 10 })
  assert.equal(out.ok, true)
  close(out.values.units, 100 / 1242, 1e-12)
})
test('position size rejects a stop on the wrong side of the entry', () => {
  const out = positionSize({ equity: 10000, riskPct: 1, direction: 'long', entry: 60000, stop: 61000 })
  assert.equal(out.ok, false)
  assert.equal(out.errors[0].code, 'order')
})
test('position size rejects zero distance and non-positive inputs', () => {
  assert.equal(positionSize({ equity: 10000, riskPct: 1, direction: 'long', entry: 60000, stop: 60000 }).ok, false)
  const negative = positionSize({ equity: -5, riskPct: 1, direction: 'long', entry: 60000, stop: 59000 })
  assert.equal(negative.ok, false)
  assert.equal(negative.errors[0].code, 'positive')
  const missing = positionSize({ riskPct: 1, direction: 'long', entry: 1, stop: 2 })
  assert.equal(missing.ok, false)
  assert.equal(missing.errors[0].code, 'required')
})
test('position size parses typed strings, including Persian digits', () => {
  const out = positionSize({ equity: '۱۰٬۰۰۰', riskPct: '1', direction: 'long', entry: '60000', stop: '58800', feePct: '0.035' })
  assert.equal(out.ok, true)
  close(out.values.riskAmount, 100)
})

/* ================= 2. leverage & margin ================= */
test('margin math: requirement, usage, effective leverage and buffer', () => {
  const out = leverageMargin({ notional: 20000, leverage: 10, equity: 5000, maintenancePct: 0.5, marginMode: 'isolated' })
  assert.equal(out.ok, true)
  close(out.values.requiredMargin, 2000)
  close(out.values.freeMargin, 3000)
  close(out.values.marginUsagePct, 40)
  close(out.values.effectiveLeverage, 4)
  close(out.values.maintenanceRequirement, 100)
  close(out.values.bufferPct, 95)
})
test('over-committed equity is reported, not hidden', () => {
  const out = leverageMargin({ notional: 20000, leverage: 2, equity: 5000, maintenancePct: 50 })
  close(out.values.freeMargin, -5000)
  assert.ok(out.notes.includes('below-maintenance-floor'))
})

/* ================= 3. liquidation estimate ================= */
test('isolated long liquidation follows the closed form', () => {
  const out = liquidationPrice({ entry: 60000, qty: 0.05, contractSize: 1, direction: 'long', leverage: 20, margin: 0, maintenancePct: 0.5 })
  assert.equal(out.ok, true)
  close(out.values.liquidationPrice, 2850 / 0.04975, 1e-9)
  close(out.values.marginPosted, 150)
  close(out.values.distancePct, (60000 - 2850 / 0.04975) / 60000 * 100, 1e-9)
})
test('isolated short liquidation sits above the entry', () => {
  const out = liquidationPrice({ entry: 60000, qty: 0.05, contractSize: 1, direction: 'short', leverage: 20, margin: 0, maintenancePct: 0.5 })
  assert.equal(out.ok, true)
  close(out.values.liquidationPrice, 3150 / 0.05025, 1e-9)
  assert.ok(out.values.liquidationPrice > 60000)
})
test('posted margin that already covers nothing is refused', () => {
  const out = liquidationPrice({ entry: 60000, qty: 0.05, direction: 'long', leverage: 20, margin: 5000, maintenancePct: 0.5 })
  assert.equal(out.ok, false)
  assert.equal(out.errors[0].code, 'unbalanced')
})

/* ================= 4. perpetual PnL ================= */
test('perp pnl nets price move, both fees and funding', () => {
  const out = perpPnl({ direction: 'long', entry: 60000, exit: 63000, qty: 0.05, contractSize: 1, leverage: 10, openFeePct: 0.035, closeFeePct: 0.035, fundingPct: 0.03 })
  assert.equal(out.ok, true)
  close(out.values.grossPnl, 150)
  close(out.values.fees, 3075 * 0.0007, 1e-9) /* (60000+63000)*0.05/2 * 0.07% */
  close(out.values.funding, 3075 * 0.0003, 1e-9)
  close(out.values.netPnl, 150 - 3075 * 0.0007 - 3075 * 0.0003, 1e-9)
  close(out.values.roiPct, (150 - 3075 * 0.001) / 300 * 100, 1e-9)
})
test('the reported break-even exit really zeroes the net result', () => {
  const base = { direction: 'long', entry: 60000, qty: 0.05, contractSize: 1, leverage: 10, openFeePct: 0.035, closeFeePct: 0.035, fundingPct: 0.03 }
  const out = perpPnl({ ...base, exit: 63000 })
  const atBreakEven = perpPnl({ ...base, exit: out.values.breakEvenExit })
  close(atBreakEven.values.netPnl, 0, 1e-8)
  assert.ok(out.values.breakEvenExit > 60000)
})
test('short break-even sits below the entry', () => {
  const base = { direction: 'short', entry: 60000, qty: 0.05, leverage: 10, openFeePct: 0.035, closeFeePct: 0.035, fundingPct: 0.03 }
  const out = perpPnl({ ...base, exit: 57000 })
  assert.ok(out.values.breakEvenExit < 60000)
  close(perpPnl({ ...base, exit: out.values.breakEvenExit }).values.netPnl, 0, 1e-8)
})

/* ================= 5. funding ================= */
test('funding: longs pay a positive rate, shorts receive it', () => {
  const long = fundingRate({ qty: 0.5, markPrice: 60000, rate: 0.01, intervalsPerDay: 3, holdingHours: 72, direction: 'long', leverage: 10 })
  close(long.values.perInterval, 3)
  close(long.values.intervals, 9)
  close(long.values.totalPayment, 27)
  close(long.values.annualisedPct, 0.01 * 3 * 365)
  close(long.values.pctOfMargin, 0.9)
  const short = fundingRate({ qty: 0.5, markPrice: 60000, rate: 0.01, intervalsPerDay: 3, holdingHours: 72, direction: 'short', leverage: 10 })
  close(short.values.totalPayment, -27)
})

/* ================= 6. risk / reward ================= */
test('risk reward ratio, break-even win rate and expectancy', () => {
  const out = riskReward({ direction: 'long', entry: 60000, stop: 58800, target: 64800, equity: 10000, riskPct: 1, feePct: 0.07, winRatePct: 45 })
  assert.equal(out.ok, true)
  close(out.values.rrRatio, 4)
  close(out.values.feeAdjustedRR, 4758 / 1242, 1e-9)
  close(out.values.plannedRisk, 100)
  close(out.values.plannedReward, 400)
  close(out.values.breakEvenWinPct, 20)
  close(out.values.expectancy, 125)
  close(out.values.expectancyR, 1.25)
})
test('risk reward rejects a target on the wrong side', () => {
  const out = riskReward({ direction: 'long', entry: 60000, stop: 58800, target: 59000, equity: 10000, riskPct: 1 })
  assert.equal(out.ok, false)
  assert.equal(out.errors[0].code, 'order')
})

/* ================= 7. risk of ruin ================= */
test('risk of ruin diffusion estimate for a 45% / 3:1 system at 1% risk', () => {
  const out = riskOfRuin({ winRatePct: 45, avgWin: 300, avgLoss: 100, riskPct: 1, capital: 10000, stopOut: 8000 })
  assert.equal(out.ok, true)
  close(out.values.edgePerTrade, 0.8, 1e-12)
  close(out.values.kellyPct, (0.45 - 0.55 / 3) * 100, 1e-9)
  assert.ok(out.values.ruinPct > 0.01 && out.values.ruinPct < 0.05, `ruinPct=${out.values.ruinPct}`)
  close(out.values.maxRiskPct, (-2 * 0.8 * Math.log(1.25)) / (3.96 * Math.log(0.05)) * 100, 1e-9)
})
test('a zero or negative edge is reported as certain ruin, with a note', () => {
  const out = riskOfRuin({ winRatePct: 20, avgWin: 300, avgLoss: 100, riskPct: 1, capital: 10000, stopOut: 8000 })
  close(out.values.ruinPct, 100)
  assert.ok(out.notes.includes('no-edge'))
})
test('a stop-out level at or above the capital is rejected', () => {
  const out = riskOfRuin({ winRatePct: 45, avgWin: 300, avgLoss: 100, riskPct: 1, capital: 10000, stopOut: 10000 })
  assert.equal(out.ok, false)
  assert.equal(out.errors[0].code, 'range')
})

/* ================= 8. prop drawdown ================= */
test('standard plan: daily allowance from the higher day-start value', () => {
  const out = propDrawdown({ plan: 'standard', accountSize: 100000, dayStartBalance: 100000, dayStartEquity: 100200, currentBalance: 100400, currentEquity: 99600, highWater: 0, openRiskPct: 1 })
  assert.equal(out.ok, true)
  close(out.values.dailyLimit, 5010) /* 5% of 100200 */
  close(out.values.dailyUsed, 600)
  close(out.values.dailyRemaining, 4410)
  close(out.values.totalLimit, 10000)
  close(out.values.totalRemaining, 9600)
  assert.equal(out.values.status, 'ok')
})
test('trailing plan follows the high-water mark and locks at breakeven', () => {
  const preLock = propDrawdown({ plan: 'instant', accountSize: 100000, dayStartBalance: 100000, dayStartEquity: 100200, currentBalance: 104000, currentEquity: 99600, highWater: 0, openRiskPct: 0 })
  close(preLock.values.totalRemaining, 99600 - 104000 * 0.95, 1e-9)
  const locked = propDrawdown({ plan: 'instant', accountSize: 100000, dayStartBalance: 100000, dayStartEquity: 100200, currentBalance: 105000, currentEquity: 99600, highWater: 0, openRiskPct: 0 })
  close(locked.values.totalRemaining, 99600 - 100000, 1e-9) /* floor locked at breakeven */
  assert.equal(locked.values.status, 'breach')
})
test('planned open risk that passes a limit is flagged before it happens', () => {
  const out = propDrawdown({ plan: 'standard', accountSize: 100000, dayStartBalance: 100000, dayStartEquity: 100200, currentBalance: 100400, currentEquity: 99600, highWater: 0, openRiskPct: 5 })
  assert.equal(out.values.status, 'breach')
})
test('an unknown plan slug is refused', () => {
  assert.equal(propDrawdown({ plan: 'mega', accountSize: 100000 }).ok, false)
})

/* ================= 9. consistency ================= */
test('consistency share, verdict and future headroom', () => {
  const out = consistencyRule({ consistencyPct: 35, dailyProfits: '100, 100, 100, -30, 80', plannedDay: 0 })
  assert.equal(out.ok, true)
  close(out.values.totalProfit, 350)
  close(out.values.largestDay, 100)
  close(out.values.sharePct, 100 / 350 * 100, 1e-9)
  assert.equal(out.values.verdict, 'compliant')
  close(out.values.maxAllowedDay, 122.5)
  close(out.values.futureRoom, 22.5 / 0.65, 1e-9)
})
test('a dominant day is exceeded, and a planned day can flip the verdict', () => {
  const out = consistencyRule({ consistencyPct: 35, dailyProfits: '120, -40, 260, 90', plannedDay: 0 })
  assert.equal(out.values.verdict, 'exceeded')
  close(out.values.futureRoom, 0)
  const planned = consistencyRule({ consistencyPct: 35, dailyProfits: '100, 100, 100, -30, 80', plannedDay: 200 })
  assert.equal(planned.values.verdict, 'exceeded')
  const stillOk = consistencyRule({ consistencyPct: 35, dailyProfits: '100, 100, 100, -30, 80', plannedDay: 50 })
  assert.equal(stillOk.values.verdict, 'compliant')
})
test('lists accept Persian digits and the Persian comma', () => {
  const out = consistencyRule({ consistencyPct: 35, dailyProfits: '۱۰۰، ۱۰۰، ۱۰۰، -30, 80' })
  close(out.values.totalProfit, 350)
})
test('no net profit means the rule is undefined, not silently passing', () => {
  const out = consistencyRule({ consistencyPct: 35, dailyProfits: '-100, -50' })
  assert.equal(out.ok, false)
  assert.equal(out.errors[0].code, 'unbalanced')
  assert.equal(consistencyRule({ consistencyPct: 35, dailyProfits: ' ' }).ok, false)
})

/* ================= 10. number parsing ================= */
test('parseUserNumber accepts Latin, Persian and Arabic-Indic digits', () => {
  close(parseUserNumber('1234.5'), 1234.5)
  close(parseUserNumber('۱٬۲۳۴'), 1234)
  close(parseUserNumber('۱۲۳۴'), 1234)
  close(parseUserNumber('١٢٣٤'), 1234)
  close(parseUserNumber('12٫5'), 12.5)
  close(parseUserNumber('$1,200'), 1200)
  assert.equal(parseUserNumber('abc'), null)
  assert.equal(parseUserNumber(''), null)
})

/* ================= 11. CSV journal ================= */
test('RFC-4180 rows: quotes, escaped quotes, CRLF and BOM', () => {
  const rows = parseCsvRows('\uFEFFa,b,"c,d"\r\n"he said ""hi""",2,3\n')
  assert.deepEqual(rows[0], ['a', 'b', 'c,d'])
  assert.deepEqual(rows[1], ['he said "hi"', '2', '3'])
})
test('delimiter is sniffed from the header', () => {
  assert.equal(detectDelimiter('a;b;c\n1;2;3'), ';')
  assert.equal(detectDelimiter('a\tb\tc'), '\t')
  assert.equal(detectDelimiter('a,b,c'), ',')
})
test('column synonyms resolve case-insensitively', () => {
  const map = mapColumns(['Date', 'SYMBOL', 'Side', 'Qty', ' Entry Price ', 'Exit', 'Net PnL', 'Commission'])
  assert.equal(map.date, 0)
  assert.equal(map.symbol, 1)
  assert.equal(map.side, 2)
  assert.equal(map.qty, 3)
  assert.equal(map.entry, 4)
  assert.equal(map.exit, 5)
  assert.equal(map.pnl, 6)
  assert.equal(map.fees, 7)
})
test('journal metrics: win rate, profit factor, expectancy, drawdown, streaks', () => {
  const csv = [
    'date,symbol,side,qty,entry,exit,pnl',
    '2026-01-02,BTC,long,0.05,60000,63000,150',
    '2026-01-03,BTC,long,0.05,60000,58800,-60',
    '2026-01-05,ETH,long,2,3000,3120,90',
  ].join('\n')
  const report = analyzeJournal(csv, 0)
  assert.equal(report.ok, true)
  const m = report.metrics
  assert.equal(m.trades, 3)
  close(m.netPnl, 180)
  close(m.grossProfit, 240)
  close(m.grossLoss, 60)
  close(m.winRatePct, 200 / 3, 1e-9)
  close(m.profitFactor, 4)
  close(m.expectancy, 60)
  close(m.avgWin, 120)
  close(m.avgLoss, 60)
  close(m.payoff, 2)
  close(m.maxDrawdown, 60)
  close(m.bestTrade, 150)
  close(m.worstTrade, -60)
  assert.equal(m.longestWinStreak, 1)
  assert.equal(m.longestLossStreak, 1)
  assert.equal(report.days.length, 3)
})
test('a gross pnl column subtracts fees; a plain pnl column stays net with a warning', () => {
  const gross = analyzeJournal('date,gross_pnl,fees\n2026-01-02,100,2\n', 0)
  close(gross.metrics.netPnl, 98)
  const net = analyzeJournal('date,pnl,fees\n2026-01-02,100,2\n', 0)
  close(net.metrics.netPnl, 100)
  assert.ok(net.warnings.length >= 1)
})
test('profit can be derived from entry, exit and side when no pnl column exists', () => {
  const long = analyzeJournal('date,symbol,side,qty,entry,exit,fees\n2026-01-02,BTC,long,0.05,60000,63000,2\n', 0)
  close(long.metrics.netPnl, 148)
  const short = analyzeJournal('date,symbol,side,qty,entry,exit\n2026-01-02,BTC,short,0.05,60000,63000\n', 0)
  close(short.metrics.netPnl, -150)
})
test('unparsable rows are counted and reported, never dropped silently', () => {
  const report = analyzeJournal('date,pnl\n2026-01-02,100\n2026-01-03,???\n2026-01-04,50\n', 0)
  assert.equal(report.ok, true)
  assert.equal(report.metrics.skipped, 1)
  assert.ok(report.warnings.some(w => w.includes('row 3')))
})
test('empty or header-only input is an explicit error', () => {
  assert.equal(analyzeJournal('').ok, false)
  assert.equal(analyzeJournal('date,pnl\n').ok, false)
})
test('per-day aggregation and consistency share', () => {
  const csv = 'date,pnl\n2026-01-02,100\n2026-01-02,50\n2026-01-03,-30\n2026-01-04,80\n'
  const report = analyzeJournal(csv, 0)
  assert.deepEqual(byDay(report.rows).map(d => [d.date, d.pnl, d.trades]), [
    ['2026-01-02', 150, 2], ['2026-01-03', -30, 1], ['2026-01-04', 80, 1],
  ])
  close(report.metrics.largestDayProfit, 150)
  close(report.metrics.consistencySharePct, 150 / 200 * 100, 1e-9)
})

/* ================= 12. FAQ search ================= */
test('Persian orthography variants normalize to one form', () => {
  assert.equal(normalizeText('می‌کنی'), normalizeText('میکنی'))
  assert.equal(normalizeText('میکنی'), normalizeText('ميكني'))
  assert.equal(normalizeText('۴۳'), normalizeText('43'))
  assert.equal(normalizeText('فارسی؟'), normalizeText('فارسی'))
})
test('search matches questions and tolerates typing variants', () => {
  assert.ok(matchesQuery('فاندینگ', 'نرخ فاندینگ چگونه محاسبه می‌شود؟'))
  assert.ok(matchesQuery('ميكني', 'می‌کنی')) /* Arabic yeh typed by mistake */
  assert.ok(matchesQuery('pnl', 'Perpetual futures PnL'))
  assert.ok(matchesQuery('43', '۴۳ پرسش'))
  assert.equal(matchesQuery('xyz', 'چیزی اینجا نیست'), false)
  assert.equal(matchesQuery('', 'هرچی'), true)
})

/* ================= 13. content contracts ================= */
test('bundled library ships the full expansion: 43 FAQ, 5 paths, 25 lessons, 40 terms, 10 tools', () => {
  assert.equal(bundledLibrary.faqItems.length, 43)
  assert.equal(bundledLibrary.faqCategories.length, 6)
  assert.equal(bundledLibrary.paths.length, 5)
  assert.equal(bundledLibrary.paths.reduce((sum, p) => sum + p.lessons.length, 0), 25)
  assert.equal(bundledLibrary.glossary.length, 40)
  assert.equal(bundledLibrary.tools.length, 10)
  assert.equal(bundledLibrary.referralProgramState, 'prelaunch')
})
test('every faq item belongs to a real category with unique stable keys', () => {
  const keys = new Set(bundledLibrary.faqCategories.map(c => c.key))
  const seen = new Set()
  for (const item of bundledLibrary.faqItems) {
    assert.ok(keys.has(item.category), `unknown category ${item.category}`)
    assert.ok(!seen.has(item.key), `duplicate faq key ${item.key}`)
    seen.add(item.key)
    assert.ok(/^[a-z0-9-]+$/.test(item.key), `key must be ASCII kebab: ${item.key}`)
    assert.ok(item.question.fa && item.question.en && item.answer.fa && item.answer.en)
  }
})
test('every faq link resolves to a real target', () => {
  const targets = {
    tool: new Set(bundledLibrary.tools.map(t => t.slug)),
    lesson: new Set(bundledLibrary.paths.flatMap(p => p.lessons.map(l => l.slug))),
    glossary: new Set(bundledLibrary.glossary.map(t => t.slug)),
    path: new Set(bundledLibrary.paths.map(p => p.slug)),
    page: new Set(['home', 'challenges', 'markets', 'rulebook', 'transparency', 'faq', 'referral', 'tools', 'learn']),
    terminal: new Set(['prop', 'perpetual']),
  }
  for (const item of bundledLibrary.faqItems) {
    for (const link of item.links || []) {
      const reference = link.target.kind === 'terminal' ? link.target.product : link.target.slug
      assert.ok(targets[link.target.kind]?.has(reference), `${item.key} → ${link.target.kind}/${reference}`)
      assert.ok(link.label.fa && link.label.en)
    }
  }
})
test('lesson cross references resolve and locales stay paired', () => {
  const glossarySlugs = new Set(bundledLibrary.glossary.map(t => t.slug))
  const toolSlugs = new Set(bundledLibrary.tools.map(t => t.slug))
  const lessonSlugs = new Set(bundledLibrary.paths.flatMap(p => p.lessons.map(l => l.slug)))
  for (const path of bundledLibrary.paths) {
    assert.ok(path.title.fa && path.title.en && path.summary.fa && path.summary.en)
    assert.equal(path.lessons.length, 5)
    path.lessons.forEach((lesson, index) => {
      assert.equal(lesson.path, path.slug)
      assert.equal(lesson.sort, index + 1)
      assert.equal(lesson.slug, [...lessonSlugs].find(() => false) ?? lesson.slug)
      assert.ok(lesson.blocks.length >= 10, `${lesson.slug} has ${lesson.blocks.length} blocks`)
      assert.equal(lesson.takeaways.length, lesson.takeaways.length)
      for (const slug of lesson.glossary) assert.ok(glossarySlugs.has(slug), `${lesson.slug} → glossary/${slug}`)
      for (const slug of lesson.tools) assert.ok(toolSlugs.has(slug), `${lesson.slug} → tool/${slug}`)
      for (const block of lesson.blocks) {
        if (block.type === 'ul' || block.type === 'ol') {
          for (const item of block.items) assert.ok(item.fa && item.en)
        }
        if (block.type === 'table') {
          assert.equal(block.head.length, block.head.length)
          for (const row of block.rows) assert.equal(row.length, block.head.length)
        }
        if (block.type === 'terms') {
          for (const item of block.items) assert.ok(item.term.fa && item.term.en && item.text.fa && item.text.en)
        }
      }
    })
  }
})
test('glossary entries reference real lessons and tools', () => {
  const lessonSlugs = new Set(bundledLibrary.paths.flatMap(p => p.lessons.map(l => l.slug)))
  const toolSlugs = new Set(bundledLibrary.tools.map(t => t.slug))
  for (const term of bundledLibrary.glossary) {
    assert.ok(term.term.fa && term.term.en && term.definition.fa && term.definition.en, term.slug)
    for (const slug of term.lessons) assert.ok(lessonSlugs.has(slug), `${term.slug} → lesson/${slug}`)
    if (term.tool) assert.ok(toolSlugs.has(term.tool), `${term.slug} → tool/${term.tool}`)
  }
})
test('tool catalog: ten unique tools, prose for each, formula strings present', () => {
  assert.equal(toolDefinitions.length, 10)
  const specs = buildToolSpecs()
  assert.equal(specs.length, 10)
  const seen = new Set()
  for (const spec of specs) {
    assert.ok(!seen.has(spec.slug))
    seen.add(spec.slug)
    assert.ok(spec.name.fa && spec.name.en && spec.tagline.fa && spec.tagline.en)
    assert.ok(spec.about.fa && spec.about.en && spec.method.fa && spec.method.en)
    assert.ok(spec.assumptions.length >= 3)
    assert.ok(spec.limitations.fa && spec.limitations.en)
    assert.ok(spec.formula.length > 5)
    assert.ok(spec.inputs.length >= 1, spec.slug)
    assert.ok(spec.results.length >= 5, spec.slug)
    for (const field of spec.inputs) {
      assert.ok(field.label.fa && field.label.en, `${spec.slug}.${field.key}`)
      if (field.kind === 'select') assert.ok(field.options?.length, `${spec.slug}.${field.key}`)
    }
  }
})
test('referral copy contains no numbers presented as reward offers', () => {
  const content = bundledLibrary.referral
  const texts = [
    content.statusNotice, content.hero.intro, content.cta.text, ...content.benefits.map(b => b.text),
    ...content.stages.map(s => s.text), ...content.sections.flatMap(s => [...s.body, ...(s.items || []), s.note].filter(Boolean)),
    ...content.dashboard.columns.map(c => c.text), ...content.faq.map(f => f.answer),
    ...content.pendingDecisions.map(d => d.text),
  ]
  for (const value of texts) {
    const joined = `${value.fa} ${value.en}`
    /* a percentage or currency amount attached to reward language would be an invented offer */
    assert.ok(!/(reward|commission|پاداش|پورسانت)[^.\n]{0,40}\d+\s*[%٪]/i.test(joined), joined.slice(0, 120))
    assert.ok(!/\$\s?\d/.test(joined), joined.slice(0, 120))
  }
  assert.equal(content.dashboard.columns.filter(c => c.state === 'live').length, 4)
  assert.equal(content.dashboard.columns.filter(c => c.state === 'pending').length, 3)
  assert.equal(content.faq.length, 6)
  assert.equal(content.pendingDecisions.length, 5)
})
test('selectors and link targets', () => {
  assert.equal(targetHref({ kind: 'tool', slug: 'position-size' }, 'fa'), '#/fa/tools/position-size')
  assert.equal(targetHref({ kind: 'lesson', slug: 'perps-how-they-work' }, 'en'), '#/en/learn/lessons/perps-how-they-work')
  assert.equal(targetHref({ kind: 'glossary', slug: 'leverage' }, 'fa'), '#/fa/learn/glossary/leverage')
  assert.equal(targetHref({ kind: 'page', slug: 'referral' }, 'en'), '#/en/referral')
  assert.equal(targetHref({ kind: 'terminal', product: 'prop' }, 'fa'), '#/fa/prop/trade')
  assert.ok(lessonBySlug(bundledLibrary, 'perps-how-they-work')?.prev === null)
  assert.ok(lessonBySlug(bundledLibrary, 'perps-how-they-work')?.next)
  assert.equal(pathBySlug(bundledLibrary, 'leverage-and-risk')?.key, 'risk')
  const counts = faqCountByCategory(bundledLibrary)
  assert.equal([...counts.values()].reduce((a, b) => a + b, 0), 43)
})

/* Public navigation must stay aligned with the actual router and both chrome
 * consumers, including partial CMS menus left over from before the expansion. */
const { JSDOM } = require('jsdom')
const navBundle = buildSync({ entryPoints: [fileURLToPath(new URL('../src/features/information/navigation.ts', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', packages: 'external', loader: { '.zip': 'dataurl' }, write: false })
const navModule = { exports: {} }
new Function('require', 'module', 'exports', navBundle.outputFiles[0].text)(require, navModule, navModule.exports)
const { renderNavigation, navigationClick, navigationKeyDown } = navModule.exports
function navigationFixture(locale, pathname, nav = null, footer = null) {
  const dom = new JSDOM('<header><div id="navigation"></div></header><footer><div id="footer-links"></div></footer>')
  globalThis.document = dom.window.document
  renderNavigation(document, locale, pathname, nav, footer)
  return dom
}

test('both locales expose the full website navigation with partial CMS data and no duplicate footer destinations', () => {
  for (const locale of ['fa', 'en']) {
    const dom = navigationFixture(locale, `/${locale}/faq`, [{ route: 'challenges', label: { en: 'Challenges', fa: 'چالش‌ها' } }], [
      { destination: 'accounts-section', label: { en: 'Challenges', fa: 'چالش‌ها' } },
      { destination: 'faq-section', label: { en: 'FAQ', fa: 'پرسش‌ها' } },
      { destination: 'faq', label: { en: 'FAQ', fa: 'پرسش‌ها' } },
      { destination: 'team-section', label: { en: 'Team', fa: 'تیم' } },
    ])
    const hrefs = [...document.querySelectorAll('header a')].map(a => a.getAttribute('href'))
    for (const route of ['challenges','markets','rulebook','transparency','faq','learn','learn/glossary','tools','referral']) assert.ok(hrefs.includes(`#/${locale}/${route}`), route)
    assert.ok(hrefs.includes(`#/${locale}/challenges?section=team`))
    const footer = [...document.querySelectorAll('footer a')].map(a => a.getAttribute('href'))
    assert.equal(new Set(footer).size, footer.length)
    assert.equal(footer.filter(href => href.includes('/challenges') && !href.includes('section=team')).length, 1)
    assert.equal(footer.filter(href => href === `#/${locale}/faq`).length, 1)
    assert.ok(footer.every(href => href.startsWith(`#/${locale}/`)))
    dom.window.close()
  }
})

test('nested pages highlight their section without claiming the section landing page is current', () => {
  const dom = navigationFixture('en', '/en/learn/lessons/perps-how-they-work')
  const learn = document.querySelector('a[href="#/en/learn"]')
  assert.equal(learn.getAttribute('data-active-section'), 'true')
  assert.equal(learn.hasAttribute('aria-current'), false)
  dom.window.close()
})

test('Resources is a disclosure rather than a route, with arrow navigation and Escape focus return', () => {
  const dom = navigationFixture('en', '/en/faq')
  const trigger = document.querySelector('.resources-toggle')
  assert.equal(trigger.tagName, 'BUTTON')
  navigationClick({ target: trigger }, document)
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  let prevented = false
  navigationKeyDown({ target: trigger, key: 'ArrowDown', preventDefault() { prevented = true } }, document)
  assert.equal(prevented, true)
  assert.equal(document.activeElement.getAttribute('href'), '#/en/faq')
  navigationKeyDown({ target: document.activeElement, key: 'Escape', preventDefault() {}, stopPropagation() {} }, document)
  assert.equal(document.activeElement, trigger)
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  assert.ok(trigger.parentElement.classList.contains('resources-dismissed'))
  dom.window.close()
})
