/* Shared browser-test helpers: disposable EIP-6963 wallet, connect / sign-in and
 * cookie-bearing API calls. Same pattern as test-purchase-flow.cjs. */

/** init script (runs in the page): injects an EIP-6963 provider for `address` */
function walletInitScript(address) {
  const events = {}; let permitted = sessionStorage.getItem('purchase-wallet-approved') === 'yes'
  const emit = n => (events[n] || []).forEach(fn => fn())
  const provider = {
    isRabby: true,
    on: (n, fn) => (events[n] || []).push(fn),
    removeListener: (n, fn) => events[n] = (events[n] || []).filter(x => x !== fn),
    request: async ({ method, params }) => {
      if (method === 'eth_accounts') return permitted ? [address] : []
      if (method === 'eth_requestAccounts') { permitted = true; sessionStorage.setItem('purchase-wallet-approved', 'yes'); emit('accountsChanged'); return [address] }
      if (method === 'eth_chainId') return '0xa4b1'
      if (method === 'net_version') return '42161'
      if (method === 'personal_sign') return window.purchaseSign({ raw: params[0] })
      if (method === 'eth_getBalance') return '0x0'
      if (method === 'eth_blockNumber') return '0x1'
      if (['wallet_requestPermissions', 'wallet_getPermissions'].includes(method)) return [{ parentCapability: 'eth_accounts' }]
      if (method === 'eth_sendTransaction' || method === 'eth_signTransaction') throw new Error('Blockchain writes forbidden in this test')
      return null
    }
  }
  const announce = () => dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { uuid: '58d4b098-dbac-4070-8a44-9120c0630d24', name: 'Rabby test signer', rdns: 'io.rabby', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>' }, provider } }))
  addEventListener('eip6963:requestProvider', announce); announce()
}

const NAME = /^(Sign in|Account|ورود به اوپن‌فاند|حساب من)$/
async function walletButton(page, name) {
  const fa = await page.locator('html').getAttribute('lang') === 'fa'
  if (fa) name = ({ 'Sign in': 'ورود به اوپن‌فاند', 'Account': 'حساب من' })[name] || name
  const button = page.getByRole('button', { name, exact: true, includeHidden: true }).first()
  await button.waitFor({ state: 'attached' })
  const menu = button.locator('xpath=ancestor::details[contains(@class,"rk-account-menu")]')
  if (await menu.count() && !await menu.evaluate(el => el.open)) await menu.locator('summary').click()
  return button
}
/* wagmi's EIP-6963 registration and the landing's async legacy boot can race a single click */
async function connect(page) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try { await page.getByRole('button', { name: NAME, includeHidden: true }).first().waitFor({ state: 'attached', timeout: 6000 }); return } catch { /* not connected yet */ }
    const btn = page.locator('.rk-chip-connect')
    if (await btn.count()) await btn.click({ timeout: 3000 })
    if (await page.locator('[data-wallet-picker]').count()) await page.locator('[data-wallet-picker] [data-wallet-id]').first().click()
  }
  await page.getByRole('button', { name: NAME, includeHidden: true }).first().waitFor({ state: 'attached', timeout: 20000 })
}
async function signIn(page) {
  const account = page.getByRole('button', { name: /^(Account|حساب من)$/, includeHidden: true }).first()
  const signInButton = page.getByRole('button', { name: /^(Sign in|ورود به اوپن‌فاند)$/, includeHidden: true }).first()
  for (let attempt = 0; attempt < 3; attempt++) {
    /* after a navigation an existing session is restored asynchronously: the
       header shows "Sign in" briefly and then "Account" — give it a moment
       instead of clicking a button that is about to disappear */
    try { await account.waitFor({ state: 'attached', timeout: 4000 }); return } catch { /* not signed in (yet) */ }
    if (!await signInButton.count()) continue
    try { await (await walletButton(page, 'Sign in')).click({ timeout: 5000 }) } catch { continue }
    try { await (await walletButton(page, 'Account')).waitFor({ state: 'attached', timeout: 15000 }); return } catch { /* retry */ }
  }
  await (await walletButton(page, 'Account')).waitFor({ state: 'attached', timeout: 30000 })
}
/** API calls from the page context (cookie-bearing); retries across reload-based route changes */
const makeCall = (page, API) => async (url, body, method) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await page.evaluate(async ({ url, body, method }) => {
        const response = await fetch(url, { method: method || (body ? 'POST' : 'GET'), credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
        return { status: response.status, data: await response.json() }
      }, { url: API + url, body, method })
    } catch (e) {
      if (attempt >= 4 || !/destroyed|navigation/i.test(String(e))) throw e
      await page.waitForTimeout(1500)
    }
  }
}

/* mirrors the backend seed catalog so the legacy plan builder renders without Directus */
const DIRECTUS_PLAN_FIXTURE = { data: [{
  slug: 'standard', name: 'استاندارد — Standard', status: 'active',
  configuration: {
    accountSizesUsd: [5000, 10000, 25000, 50000, 100000],
    priceUsd: { 5000: 44, 10000: 80, 25000: 216, 50000: 349, 100000: 652 },
    phases: 2, phase1TargetPct: 8, phase2TargetPct: 5, dailyLossPct: 5, dailyLossPctAlt: 3, maxTotalLossPct: 10,
    drawdownMode: 'static', minTradingDays: 3, profitSplitPct: 80, profitSplitMonthlyPct: 100, payoutCapPct: 0,
    firstPayoutDays: 14, minPayoutPct: 1, refundPolicy: 'fourth-reward'
  }
}] }

module.exports = { walletInitScript, walletButton, connect, signIn, makeCall, DIRECTUS_PLAN_FIXTURE }
