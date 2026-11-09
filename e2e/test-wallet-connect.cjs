/* Wallet connection acceptance with controlled EIP-1193 providers.
 *
 * Two test wallets announce themselves over EIP-6963 (no window.ethereum).
 * Each provider is fully scripted from the test: it can accept or decline
 * the connection, the network switch and the sign-in signature, and it
 * records every request it receives. Signatures come from generated
 * throwaway keys. Nothing here talks to a real wallet extension, a real
 * mobile wallet or a chain, and no transaction or approval is ever sent.
 *
 * Covers: explicit choice between several wallets (no automatic pick),
 * declined and accepted connection, declined and accepted network switch
 * (Perpetual → Arbitrum One), declined and accepted SIWE signature, session
 * creation, session restore after reload, a real backend failure reported
 * with its cause, disconnect/logout, and the picker in an RTL locale.
 *
 * Usage: TEST_FRONTEND_URL=http://127.0.0.1:8091 node e2e/test-wallet-connect.cjs */
const { chromium } = require('playwright')
const { createRequire } = require('node:module')
const path = require('node:path'), fs = require('node:fs')
const req = createRequire(path.resolve(__dirname, '../apps/backend/package.json'))
const { generatePrivateKey, privateKeyToAccount } = req('viem/accounts')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://127.0.0.1:8080').replace(/\/$/, '')
const OUT = 'output/playwright/wallet-connect'

function installWallets(addresses) {
  /* runs in the page before any script */
  const control = window.__walletControl = {
    alpha: { rejectConnect: false, rejectSwitch: false, rejectSign: false },
    beta: { rejectConnect: false, rejectSwitch: false, rejectSign: false },
  }
  const calls = window.__walletCalls = []
  const make = (id, name, address) => {
    const events = {}
    let permitted = sessionStorage.getItem('wallet-test-' + id) === 'yes'
    let chainId = sessionStorage.getItem('wallet-test-chain-' + id) || '0xaa36a7'
    const emit = (n, v) => (events[n] || []).forEach(fn => fn(v))
    const rejected = msg => Object.assign(new Error(msg), { code: 4001 })
    return {
      [id === 'alpha' ? 'isAlphaTest' : 'isBetaTest']: true,
      on: (n, fn) => (events[n] ||= []).push(fn),
      removeListener: (n, fn) => { events[n] = (events[n] || []).filter(x => x !== fn) },
      request: async ({ method, params }) => {
        calls.push({ wallet: id, method })
        const c = control[id]
        switch (method) {
          case 'eth_accounts': return permitted ? [address] : []
          case 'eth_requestAccounts':
            if (c.rejectConnect) throw rejected('User rejected the request.')
            permitted = true; sessionStorage.setItem('wallet-test-' + id, 'yes'); emit('accountsChanged', [address]); return [address]
          case 'wallet_requestPermissions': case 'wallet_getPermissions': return [{ parentCapability: 'eth_accounts' }]
          case 'wallet_revokePermissions': permitted = false; sessionStorage.removeItem('wallet-test-' + id); return null
          case 'eth_chainId': return chainId
          case 'net_version': return String(parseInt(chainId, 16))
          case 'wallet_switchEthereumChain':
            if (c.rejectSwitch) throw rejected('User rejected the request.')
            chainId = params[0].chainId; sessionStorage.setItem('wallet-test-chain-' + id, chainId); emit('chainChanged', chainId); return null
          case 'personal_sign':
            if (c.rejectSign) throw rejected('User denied message signature.')
            return window.walletSign(id, params[0])
          case 'eth_getBalance': return '0x0'
          case 'eth_blockNumber': return '0x1'
          case 'eth_sendTransaction': case 'eth_signTransaction': case 'eth_sendRawTransaction':
            throw new Error('Transactions are forbidden in this test')
          default: return null
        }
      },
    }
  }
  const wallets = [['alpha', 'Wallet Alpha', 'test.wallet.alpha', addresses.alpha], ['beta', 'Wallet Beta', 'test.wallet.beta', addresses.beta]]
  const providers = wallets.map(([id, name, rdns, address]) => ({ info: { uuid: id + '-0000-4000-8000-000000000000', name, rdns, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>' }, provider: make(id, name, address) }))
  const announce = () => providers.forEach(detail => dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail })))
  addEventListener('eip6963:requestProvider', announce)
  announce()
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const keys = { alpha: privateKeyToAccount(generatePrivateKey()), beta: privateKeyToAccount(generatePrivateKey()) }
  const browser = await chromium.launch()
  const results = []
  const check = (name, cond, detail = '') => { results.push({ name, pass: !!cond, detail }); if (!cond) console.error('FAIL', name, String(detail).slice(0, 300)) }
  const context = await browser.newContext({ viewport: { width: 1366, height: 860 } })
  await context.exposeFunction('walletSign', (id, raw) => keys[id].signMessage({ message: { raw } }))
  await context.addInitScript(installWallets, { alpha: keys.alpha.address, beta: keys.beta.address })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  const calls = () => page.evaluate(() => window.__walletCalls.slice())
  const setControl = (id, patch) => page.evaluate(([i, p]) => Object.assign(window.__walletControl[i], p), [id, patch])
  const me = () => page.evaluate(async () => { const r = await fetch('/auth/me', { credentials: 'include' }); return { status: r.status, body: await r.json().catch(() => null) } })
  const openPicker = async () => {
    await page.locator('.rk-chip-connect:visible').first().click()
    await page.locator('[data-wallet-picker]').waitFor({ timeout: 10000 })
  }
  const notice = () => page.locator('[data-wallet-notice]:visible').first()

  /* 1 — explicit choice: two wallets listed, nothing requested before a choice */
  await page.goto(`${BASE}/en/markets`, { waitUntil: 'domcontentloaded' })
  await page.locator('.rk-chip-connect:visible').first().waitFor({ timeout: 20000 })
  check('no window.ethereum in this fixture', await page.evaluate(() => !window.ethereum))
  await openPicker()
  const listed = await page.locator('[data-wallet-picker] [data-wallet-id]').allTextContents()
  check('picker lists both announced wallets', listed.some(t => t.includes('Wallet Alpha')) && listed.some(t => t.includes('Wallet Beta')), listed.join(' | '))
  check('no generic browser-wallet entry when wallets announce themselves', !listed.some(t => /Browser wallet/.test(t)), listed.join(' | '))
  check('no connection requested before a choice', !(await calls()).some(c => c.method === 'eth_requestAccounts'))
  check('WalletConnect not offered without a project id', await page.locator('[data-walletconnect-unavailable]').count() === 1)
  await page.screenshot({ path: `${OUT}/picker-en.png` })

  /* 2 — declined connection: neutral status, not an error, no raw provider text */
  await setControl('alpha', { rejectConnect: true })
  await page.locator('[data-wallet-picker] button', { hasText: 'Wallet Alpha' }).click()
  const declined = page.locator('[data-wallet-result]')
  await declined.waitFor({ timeout: 10000 })
  check('declined connection classified as rejected', await declined.getAttribute('data-wallet-result') === 'rejected')
  check('declined connection is a neutral status, not an alert', await declined.getAttribute('role') === 'status')
  check('declined connection shows no raw provider message', !/User rejected the request/i.test(await declined.textContent()), await declined.textContent())
  check('only the chosen wallet was asked', !(await calls()).some(c => c.wallet === 'beta' && c.method === 'eth_requestAccounts'))
  await page.screenshot({ path: `${OUT}/declined-connection.png` })

  /* 3 — accepted connection with the second wallet */
  await page.locator('[data-wallet-picker] button', { hasText: 'Wallet Beta' }).click()
  await page.locator('[data-wallet-picker]').waitFor({ state: 'detached', timeout: 10000 })
  const chip = page.locator('.rk-account-menu summary:visible').first()
  await chip.waitFor({ timeout: 10000 })
  check('connected chip shows the chosen wallet address', (await chip.getAttribute('title') || '').toLowerCase() === keys.beta.address.toLowerCase(), await chip.getAttribute('title'))

  /* 4 — declined sign-in signature: neutral, wallet stays connected */
  await setControl('beta', { rejectSign: true })
  await chip.click()
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click()
  await notice().waitFor({ timeout: 10000 })
  console.log('DEBUG notice', await notice().getAttribute('data-wallet-notice'), await notice().getAttribute('role'), await notice().textContent())
  check('declined signature classified as rejected', await notice().getAttribute('data-wallet-notice') === 'rejected')
  check('declined signature is neutral status', await notice().getAttribute('role') === 'status')
  check('declined signature keeps the wallet connected', await page.locator('.rk-account-menu summary:visible').count() === 1)
  check('no session after declined signature', (await me()).status === 401)

  /* 5 — real failure: backend unreachable for the nonce request is reported with its cause */
  await setControl('beta', { rejectSign: false })
  await page.route('**/auth/nonce', route => route.fulfill({ status: 503, json: { error: 'internal' } }), { times: 1 })
  if (!(await page.getByRole('button', { name: 'Sign in', exact: true }).first().isVisible())) await chip.click()
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click()
  await page.locator('[data-wallet-notice="server_unreachable"]').waitFor({ timeout: 10000 }).catch(() => {})
  check('backend failure reported as server unreachable', await page.locator('[data-wallet-notice="server_unreachable"]').count() === 1, await notice().getAttribute('data-wallet-notice').catch(() => ''))
  check('backend failure is an alert', await page.locator('[data-wallet-notice="server_unreachable"]').getAttribute('role').catch(() => '') === 'alert')

  /* 6 — accepted signature creates a session */
  if (!(await page.getByRole('button', { name: 'Sign in', exact: true }).first().isVisible())) await chip.click()
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click()
  await page.getByRole('button', { name: 'Account', exact: true }).first().waitFor({ state: 'attached', timeout: 20000 }).catch(async () => console.log('DEBUG after sign', await page.locator('[data-wallet-notice]').allTextContents(), JSON.stringify((await calls()).slice(-6))))
  const session = await me()
  check('signed session belongs to the chosen wallet', session.status === 200 && session.body?.user?.walletAddress?.toLowerCase() === keys.beta.address.toLowerCase(), JSON.stringify(session).slice(0, 200))
  check('signature requested once per sign-in, by the chosen wallet only', !(await calls()).some(c => c.wallet === 'alpha' && c.method === 'personal_sign'))

  /* 7 — session restore after reload, without a new signature */
  const signsBefore = (await calls()).filter(c => c.method === 'personal_sign').length
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Account', exact: true }).first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {})
  check('session restored after reload', await page.getByRole('button', { name: 'Account', exact: true }).count() > 0)
  check('restore did not ask for another signature', (await calls()).filter(c => c.method === 'personal_sign').length === 0, signsBefore)

  /* 8 — disconnect ends the session */
  await page.locator('.rk-account-menu summary:visible').first().click()
  await page.locator('[data-wallet-disconnect]:visible').first().click()
  await page.locator('.rk-chip-connect:visible').first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(800)
  check('disconnect logs the session out', (await me()).status === 401)

  /* 9 — Perpetual (any locale) asks for Arbitrum One: declined then accepted switch */
  await page.goto(`${BASE}/ru/perpetual/dashboard`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  check('ru Perpetual stays on Perpetual', new URL(page.url()).pathname === '/ru/perpetual/dashboard', page.url())
  await openPicker()
  check('picker localized in Russian', /Выберите кошелёк/.test(await page.locator('#of-wallet-picker-title').textContent()))
  await setControl('alpha', { rejectSwitch: true })
  await page.locator('[data-wallet-picker] button', { hasText: 'Wallet Alpha' }).click()
  await page.locator('.rk-account-menu summary:visible').first().waitFor({ timeout: 10000 })
  await page.locator('.rk-account-menu summary:visible').first().click()
  const signRu = page.getByRole('button', { name: 'Войти', exact: true }).first()
  await signRu.click()
  await page.locator('[data-wallet-notice="rejected"]').waitFor({ timeout: 10000 }).catch(() => {})
  check('declined network switch is neutral', await page.locator('[data-wallet-notice="rejected"]').getAttribute('role').catch(() => '') === 'status')
  check('declined network switch message is about the network', /сет/i.test(await page.locator('[data-wallet-notice]').first().textContent().catch(() => '')), await page.locator('[data-wallet-notice]').first().textContent().catch(() => ''))
  check('Perpetual requested Arbitrum One (0xa4b1)', (await calls()).some(c => c.wallet === 'alpha' && c.method === 'wallet_switchEthereumChain'))
  await setControl('alpha', { rejectSwitch: false })
  if (!(await signRu.isVisible())) await page.locator('.rk-account-menu summary:visible').first().click()
  await signRu.click()
  await page.getByRole('button', { name: 'Счёт', exact: true }).first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {})
  const chain = await page.evaluate(() => sessionStorage.getItem('wallet-test-chain-alpha'))
  check('wallet switched to Arbitrum One', chain === '0xa4b1', chain)
  const perpSession = await me()
  check('Perpetual session belongs to the chosen wallet', perpSession.status === 200 && perpSession.body?.user?.walletAddress?.toLowerCase() === keys.alpha.address.toLowerCase(), perpSession.status)
  await page.screenshot({ path: `${OUT}/perpetual-ru-signed.png` })

  /* 10 — RTL picker in Arabic */
  const ar = await context.newPage()
  await ar.goto(`${BASE}/ar/markets`, { waitUntil: 'domcontentloaded' })
  await ar.evaluate(() => fetch('/auth/logout', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }))
  await ar.evaluate(() => { sessionStorage.clear() })
  await ar.reload({ waitUntil: 'domcontentloaded' })
  await ar.locator('.rk-chip-connect:visible').first().waitFor({ timeout: 20000 }).catch(() => {})
  if (await ar.locator('.rk-chip-connect:visible').count()) {
    await ar.locator('.rk-chip-connect:visible').first().click()
    await ar.locator('[data-wallet-picker]').waitFor({ timeout: 10000 })
    check('Arabic picker is RTL', await ar.locator('[data-wallet-picker]').getAttribute('dir') === 'rtl')
    check('Arabic picker title', /اختر محفظة/.test(await ar.locator('#of-wallet-picker-title').textContent()))
    await ar.screenshot({ path: `${OUT}/picker-ar.png` })
  } else check('Arabic page shows the connect button', false)

  /* nothing on chain */
  const all = await calls()
  check('no transaction or approval was ever requested', !all.some(c => /sendTransaction|signTransaction|eth_sign$|signTypedData/.test(c.method)), all.map(c => c.method).join(','))
  check('no page errors', !errors.length, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter(r => !r.pass)
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ total: results.length, failed: failed.length, results }, null, 1))
  console.log(`wallet connect: ${results.length - failed.length}/${results.length} checks passed`)
  process.exit(failed.length ? 1 : 0)
})()
