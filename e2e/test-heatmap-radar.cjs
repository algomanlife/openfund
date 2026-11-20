/* Market Heatmap and Trade Radar browser acceptance (workstream 5).
 *
 * Deterministic: every /radar/* response comes from e2e/fixtures/radar-fixtures.cjs
 * (fixed markets, positions, leaderboard and tape), and the page clock starts
 * at a fixed instant, so the result never depends on the live Hyperliquid feed
 * or on the time of day. The real feed is checked separately and non-blocking
 * by e2e/test-heatmap-radar-live.cjs.
 *
 * Heatmap: readable tiles
 * only (small markets grouped into a proportional "+N more" tile), no empty
 * side panel, tooltip, contextual details and mobile bottom sheet, drill-down
 * and Escape, symbol search into grouped markets, colour metric and range,
 * grouping, eight widths without overflow, and explicit empty and error states.
 * Radar: duplicates collapse, new trades highlight then fade, the reader's
 * scroll position holds while trades arrive, filters apply, wallets copy,
 * the positioning, whale and leaderboard tabs render their fixture rows or
 * their empty and error states, and phones get labelled cards (RTL-safe). */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/heatmap-radar'))
fs.mkdirSync(OUT, { recursive: true })
const results = []
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); results.push(name); console.log('PASS - ' + name) }
const { FIXED_NOW, MARKETS, SMALLEST, EMPTY, V, trade, routeRadar } = require('./fixtures/radar-fixtures.cjs')

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  /* fixtures: false only for the non-radar chart check at the end */
  const open = async (route, width = 1440, height = 900, theme = 'dark', { fixtures = true, radar = {} } = {}) => {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme })
    if (fixtures) {
      await routeRadar(context, radar)
      await context.clock.install({ time: FIXED_NOW })
    }
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(String(e)))
    page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|ERR_|net::/.test(m.text())) errors.push(m.text()) })
    await page.goto(BASE + route, { waitUntil: 'load' })
    return { context, page }
  }
  try {
    /* ---------------- Heatmap ---------------- */
    {
      const { context, page } = await open('/en/prop/heatmap')
      await page.locator('.of-hm-tile').first().waitFor({ timeout: 40000 })
      const s = await page.evaluate(() => ({ tiles: document.querySelectorAll('.of-hm-tile:not(.of-hm-more)').length, small: document.querySelectorAll('.of-hm-tile.is-small').length,
        more: document.querySelectorAll('.of-hm-more').length, panel: document.querySelectorAll('.of-hm-detail').length }))
      ok(`every market tile shows at least its symbol (${s.tiles} tiles, ${s.small} without a label)`, s.tiles >= 6 && s.tiles < MARKETS.length && s.small === 0, JSON.stringify(s))
      ok('small markets are grouped into proportional "+N more" tiles', s.more >= 1)
      ok('no empty details panel before a selection', s.panel === 0)
      await page.screenshot({ path: path.join(OUT, 'heatmap-en-1440.png') })
      const first = page.locator('.of-hm-tile:not(.of-hm-more)').first()
      await first.hover()
      await page.locator('.of-hm-tip').waitFor()
      ok('hover shows a tooltip with the market', (await page.locator('.of-hm-tip').innerText()).includes(await first.getAttribute('data-coin')))
      await first.click()
      await page.locator('.of-hm-detail').waitFor()
      ok('click opens contextual details with real fields', /Mark price/.test(await page.locator('.of-hm-detail').innerText()) && /Hourly funding/.test(await page.locator('.of-hm-detail').innerText()))
      await page.screenshot({ path: path.join(OUT, 'heatmap-en-1440-selected.png') })
      await page.keyboard.press('Escape')
      ok('Escape closes the details', await page.locator('.of-hm-detail').count() === 0)
      await page.locator('.of-hm-more').first().click()
      await page.locator('.of-hm-crumbs').waitFor()
      const inside = await page.locator('.of-hm-tile:not(.of-hm-more)').count()
      ok(`"+N more" opens those markets at readable size (${inside} tiles)`, inside >= 4 && await page.locator('.of-hm-tile.is-small').count() === 0)
      await page.screenshot({ path: path.join(OUT, 'heatmap-en-1440-drilldown.png') })
      while (await page.locator('.of-hm-crumbs').count()) await page.keyboard.press('Escape')
      ok('Escape steps back to all groups', await page.locator('.of-hm-crumbs').count() === 0)
      /* search the fixture's smallest market, which is grouped away at the top level */
      const hidden = SMALLEST
      const where = await page.evaluate(c => ({ shown: !!document.querySelector(`.of-hm-tile[data-coin="${c}"]`),
        listed: [...document.querySelectorAll('#of-hm-coins option')].some(o => o.value === c) }), hidden)
      ok(`the search target ${hidden} is listed but grouped away at the top level`, where.listed && !where.shown, JSON.stringify(where))
      await page.getByLabel('Search symbol').fill(hidden)
      await page.locator(`.of-hm-tile[data-coin="${hidden}"]`).waitFor({ timeout: 15000 })
      ok(`search opens the level holding a grouped market (${hidden}) and selects it`, await page.locator('.of-hm-crumbs').count() === 1 && (await page.locator('.of-hm-detail h2').innerText()).startsWith(hidden))
      for (let i = 0; i < 6 && (await page.locator('.of-hm-crumbs, .of-hm-detail').count()); i++) await page.keyboard.press('Escape')
      const before = await page.locator('.of-hm-tile[data-coin]').first().evaluate(t => t.style.background)
      await page.getByLabel('Colour', { exact: true }).selectOption('funding')
      await page.waitForTimeout(200)
      ok('colour metric switches to hourly funding (separate from size)', /Hourly funding/.test(await page.locator('.of-hm').getAttribute('aria-label')) && /0\.0100%/.test(await page.locator('.of-hm-legend').innerText()))
      ok('tile colours follow the new metric', before !== await page.locator('.of-hm-tile[data-coin]').first().evaluate(t => t.style.background))
      await page.getByLabel('Grouping').selectOption('none')
      await page.waitForTimeout(400)
      ok('grouping "All markets" shows one group', await page.locator('.of-hm-ghead').count() === 1)
      await context.close()
    }
    /* explicit empty and error states (no tiles, a labelled message, no page errors) */
    for (const [label, markets, role, text] of [
      ['an empty market list', () => ({ status: 200, body: EMPTY.markets }), 'status', /Loading…/],
      ['an unavailable market feed', () => ({ status: 503, body: { error: 'upstream_unavailable' } }), 'alert', /Hyperliquid market data is unavailable\./],
    ]) {
      const { context, page } = await open('/en/prop/heatmap', 1440, 900, 'dark', { radar: { markets } })
      const message = page.locator(`.of-hm .of-radar-empty[role="${role}"]`)
      await message.waitFor({ timeout: 20000 })
      if (role === 'alert') await page.locator('.of-radar-fresh[data-kind="down"]').waitFor({ timeout: 20000 })
      else await page.locator('.of-radar-fresh[data-kind="live"]').waitFor({ timeout: 20000 })
      ok(`heatmap with ${label}: no tiles and an explicit ${role} message`, await page.locator('.of-hm-tile').count() === 0 && text.test(await message.innerText()))
      await context.close()
    }
    for (const [width, height] of [[375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080]]) {
      const { context, page } = await open('/en/prop/heatmap', width, height)
      await page.locator('.of-hm-tile').first().waitFor({ timeout: 40000 })
      const m = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, map: Math.round(document.querySelector('.of-hm').getBoundingClientRect().width), small: document.querySelectorAll('.of-hm-tile.is-small').length,
        filtersOpen: document.querySelector('.of-hm-controls').open }))
      ok(`heatmap ${width}px: no overflow, readable tiles, filters ${width <= 720 ? 'folded' : 'open'}`, m.overflow <= 0 && m.map > width * 0.6 && m.small === 0 && m.filtersOpen === (width > 720), JSON.stringify(m))
      if (width <= 430) {
        await page.locator('.of-hm-tile:not(.of-hm-more)').first().click()
        await page.locator('.of-hm-detail.is-sheet').waitFor()
        ok(`heatmap ${width}px: tap opens a bottom sheet`, true)
        if (width === 390) await page.screenshot({ path: path.join(OUT, 'heatmap-en-390-sheet.png') })
        await page.locator('.of-hm-sheet-backdrop').click({ position: { x: 10, y: 10 } })
        ok(`heatmap ${width}px: tapping outside closes the sheet`, await page.locator('.of-hm-detail').count() === 0)
        if (width === 390) await page.screenshot({ path: path.join(OUT, 'heatmap-en-390.png') })
      }
      if (width === 768) await page.screenshot({ path: path.join(OUT, 'heatmap-en-768.png') })
      await context.close()
    }
    {
      const { context, page } = await open('/fa/prop/heatmap', 1440, 900, 'light')
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
      await page.locator('.of-hm-tile').first().waitFor({ timeout: 40000 })
      ok('Persian heatmap renders with the map kept LTR', await page.locator('.of-hm').evaluate(e => getComputedStyle(e).direction) === 'ltr' && await page.evaluate(() => document.documentElement.dir) === 'rtl')
      await page.screenshot({ path: path.join(OUT, 'heatmap-fa-1440-light.png') })
      await context.close()
    }

    /* ---------------- Radar (deterministic tape) ---------------- */
    let round = 0
    const tapeFor = () => {
      round++
      const base = Array.from({ length: 40 }, (_, i) => trade(i + 10, i % 2 ? 'ETH' : 'BTC', i % 3 ? 'buy' : 'sell', 60_000 + i * 5_000))
      const extra = round >= 2 ? [trade(1, 'SOL', 'buy', 750_000, '0x3333333333333333333333333333333333333333', V), trade(2, 'BTC', 'sell', 90_000)] : []
      return { state: 'live', coins: ['BTC', 'ETH', 'SOL'], lastMessageAt: FIXED_NOW, trades: [...extra, ...base, base[0]] }
    }
    {
      const { context, page } = await open('/en/prop/radar', 1440, 900, 'dark', { radar: { tape: () => ({ status: 200, body: tapeFor() }) } })
      const rows = page.locator('.of-radar-table tbody tr')
      await rows.first().waitFor({ timeout: 20000 })
      ok('duplicate trade ids are shown once', await rows.count() === 40)
      const s = await page.evaluate(() => ({ h: Math.round(document.querySelector('.of-radar-table tbody tr').getBoundingClientRect().height), sticky: getComputedStyle(document.querySelector('.of-radar-table th')).position, num: getComputedStyle(document.querySelector('.of-radar-table td.r')).fontVariantNumeric }))
      ok(`compact rows (${s.h}px; 51–57 px before), sticky header, tabular numbers`, s.h <= 40 && s.sticky === 'sticky' && /tabular-nums/.test(s.num), JSON.stringify(s))
      const table = page.locator('.of-radar-table')
      await table.evaluate(e => { e.scrollTop = 300 })
      const anchor = await page.evaluate(() => { const t = document.querySelector('.of-radar-table'); const r = [...t.querySelectorAll('tbody tr')].find(x => x.getBoundingClientRect().top >= t.getBoundingClientRect().top + 40); return { id: r.dataset.id, top: r.getBoundingClientRect().top } })
      await page.locator('.of-radar-table tbody tr.is-new').first().waitFor({ timeout: 10000 })
      ok('new trades arrive with a highlight', await page.locator('.of-radar-table tbody tr.is-new').count() === 2)
      const after = await page.evaluate(id => document.querySelector(`.of-radar-table tbody tr[data-id="${id}"]`)?.getBoundingClientRect().top, anchor.id)
      ok('the reader keeps their place while trades arrive above', Math.abs(after - anchor.top) < 4, `${anchor.top} → ${after}`)
      /* advance the page clock past the 2.4 s highlight instead of sleeping */
      await page.clock.runFor(2500)
      await page.locator('.of-radar-table tbody tr.is-new').first().waitFor({ state: 'detached', timeout: 5000 })
      ok('the highlight fades after a short time', await page.locator('.of-radar-table tbody tr.is-new').count() === 0)
      await table.evaluate(e => { e.scrollTop = 0 })
      await page.screenshot({ path: path.join(OUT, 'radar-en-1440.png') })
      await page.getByLabel('Side').selectOption('short')
      ok('side filter shows only shorts', (await page.locator('.of-radar-table tbody .of-radar-side').allInnerTexts()).every(x => x === 'Short'))
      await page.getByLabel('Side').selectOption('')
      await page.getByRole('textbox', { name: 'Wallet' }).fill('0x3333')
      ok('wallet filter matches the trades of that wallet', await rows.count() === 1)
      await page.getByRole('textbox', { name: 'Wallet' }).fill('')
      const copy = page.locator('.of-radar-copy').first()
      ok('wallet addresses can be copied', await copy.getAttribute('aria-label') === 'Copy address')
      for (const [tab, count] of [['Aggregated positioning', 3], ['Whale positions', 4], ['Leaderboard', 12]]) {
        await page.getByRole('tab', { name: tab }).click()
        await page.locator('.of-radar-panel table tbody tr').first().waitFor({ timeout: 20000 })
        ok(`${tab} tab renders its ${count} fixture rows`, await page.locator('.of-radar-panel table tbody tr').count() === count)
      }
      await context.close()
    }
    /* radar empty and error states, per tab */
    {
      const { context, page } = await open('/en/prop/radar', 1440, 900, 'dark', { radar: {
        tape: () => ({ status: 200, body: EMPTY.tape }), positions: () => ({ status: 200, body: EMPTY.positions }), board: () => ({ status: 503, body: { error: 'upstream_unavailable' } }) } })
      const empty = page.locator('.of-radar-panel .of-radar-empty')
      await page.getByText('No trades match yet. New trades appear automatically.').waitFor({ timeout: 20000 })
      ok('live tape with no trades shows its explicit empty message', await page.locator('.of-radar-panel table').count() === 0)
      for (const tab of ['Aggregated positioning', 'Whale positions']) {
        await page.getByRole('tab', { name: tab }).click()
        await page.getByText('Nothing matches these filters.').waitFor({ timeout: 20000 })
        ok(`${tab} with no rows shows the explicit empty message`, await page.locator('.of-radar-panel table').count() === 0 && await empty.count() === 1)
      }
      await page.getByRole('tab', { name: 'Leaderboard' }).click()
      await page.locator('.of-radar-panel .of-radar-empty.is-error[role="alert"]').waitFor({ timeout: 20000 })
      ok('an unavailable leaderboard shows an alert, not an empty table', /Hyperliquid data is unavailable right now/.test(await empty.innerText()))
      await context.close()
    }
    for (const [route, width, name] of [['/en/prop/radar', 390, 'radar-en-390'], ['/fa/prop/radar', 390, 'radar-fa-390'], ['/en/prop/radar', 768, 'radar-en-768']]) {
      const { context, page } = await open(route, width, 844, 'dark', { radar: { tape: () => ({ status: 200,
        body: { state: 'live', coins: ['BTC'], lastMessageAt: FIXED_NOW, trades: Array.from({ length: 6 }, (_, i) => trade(i, 'BTC', i % 2 ? 'buy' : 'sell', 80_000 + i)) } }) } })
      await page.locator('.of-radar-table tbody tr').first().waitFor({ timeout: 20000 })
      const m = await page.evaluate(() => {
        const row = document.querySelector('.of-radar-table tbody tr'), value = row.querySelector('td.r')
        const label = getComputedStyle(value, '::before').content
        return { overflow: document.documentElement.scrollWidth - innerWidth, display: getComputedStyle(row).display, label, rowDir: document.documentElement.dir, flex: getComputedStyle(value).flexDirection, wallet: row.querySelector('bdi')?.getAttribute('dir') }
      })
      const phone = width <= 640
      ok(`${name}: ${phone ? 'labelled cards' : 'table'}, no overflow${m.rowDir === 'rtl' ? ', RTL labels at the start, values LTR' : ''}`,
        m.overflow <= 0 && (phone ? m.display === 'grid' && m.label.length > 2 : m.display === 'table-row') && m.wallet === 'ltr' && (m.rowDir !== 'rtl' || !phone || m.flex === 'row-reverse'), JSON.stringify(m))
      await page.screenshot({ path: path.join(OUT, name + '.png') })
      await context.close()
    }
    /* the chart and trading terminal still work */
    {
      const { context, page } = await open('/en/prop/chart', 1440, 900, 'dark', { fixtures: false })
      await page.waitForTimeout(6000)
      const frame = await page.evaluate(() => { const f = document.querySelector('iframe'); const r = f?.getBoundingClientRect(); return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null })
      ok('the chart route still renders its chart frame', frame && frame.w > 400 && frame.h > 250, JSON.stringify(frame))
      await context.close()
    }
    ok('no uncaught page errors or console errors', errors.length === 0, errors.slice(0, 4).join(' | '))
    console.log(`${results.length} heatmap and radar checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
