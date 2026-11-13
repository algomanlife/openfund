/* Sales-campaign landing (/fa/campaign, /en/campaign) and the two landing
   CTAs into the one shared checkout. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { sanitizeUtm, checkoutHref } from '../src/features/campaign/campaignTracking.ts'

const read = f => readFileSync(new URL(f, import.meta.url), 'utf8')
/* code only: block and line comments removed (explanatory comments may name what the code avoids) */
const code = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const page = read('../src/features/campaign/Campaign.tsx')
const main = read('../src/main.tsx')
const home = read('../src/features/home/Home.tsx')
const wallet = read('../src/wallet/ChallengeWalletPanel.tsx')

test('campaign route: Persian (RTL) and English (LTR) only; other locales go to /en/campaign', () => {
  assert.match(main, /path: '\/:locale\/campaign', element: <Campaign \/>/)
  assert.doesNotMatch(code(main), /'\/react\/[^']*campaign/)
  assert.match(page, /if \(raw !== 'fa' && raw !== 'en'\) return <Navigate to="\/en\/campaign" replace \/>/)
  assert.match(page, /dir=\{lang === 'fa' \? 'rtl' : 'ltr'\} lang=\{lang\}/)
})

test('campaign sections and CTAs: hero, advantages, terminal, challenges, steps, transparency, FAQ, final CTA', () => {
  for (const id of ['cmp-title', 'cmp-why', 'cmp-terminal', 'cmp-plans', 'cmp-steps', 'cmp-trust', 'cmp-faq', 'cmp-final']) assert.ok(page.includes(`id="${id}"`), id)
  assert.match(page, /t\('مشاهده و خرید چالش', 'View & buy a challenge'\)/)
  assert.match(page, /t\('آشنایی با ترمینال', 'Explore the terminal'\)/)
  /* every purchase CTA goes to the shared checkout helper, never a parallel checkout */
  assert.equal((page.match(/to=\{checkout\(/g) || []).length, 3)
  assert.match(page, /checkoutHref\(lang, utm, plan, size\)/)
  /* the five onboarding steps, in order */
  const steps = ['Choose a challenge', 'Connect your wallet', 'Create the order', 'Choose how to pay', 'Receive your challenge account']
  const at = steps.map(s => page.indexOf(`'${s}'`))
  assert.ok(at.every((v, i) => v > 0 && (i === 0 || v > at[i - 1])), JSON.stringify(at))
})

test('campaign content: real prices from the server catalog, rules from the plan catalog, no profit promises', () => {
  assert.match(page, /apiFetch\('\/purchases\/plans'\)/)
  assert.match(page, /publishedPlans\(\)/)
  assert.doesNotMatch(page, /\$\d{2,}|\d+ دلار'/)                     /* no hard-coded price */
  assert.doesNotMatch(code(page).replace(/Profits are not guaranteed/g, ''), /guarantee(d)? (profit|return|payout)|risk[- ]free|success rate|win rate|تضمین سود|بدون ریسک/i)
  assert.match(page, /Profits are not guaranteed/)
  assert.match(page, /Challenge accounts are simulated/)
  /* genuine screenshots referenced by the page exist and are listed in the screenshot manifest */
  const manifest = read('../../../docs/assets/screenshots/manifest.json')
  for (const f of [...new Set([...page.matchAll(/IMG\(`([a-z]+)-\$\{lang\}\.jpg`\)/g)].map(m => m[1]))].flatMap(n => [`${n}-fa.jpg`, `${n}-en.jpg`])) {
    assert.ok(existsSync(new URL(`../public/assets/campaign/${f}`, import.meta.url)), f)
    assert.ok(manifest.includes(`campaign/${f}`), `${f} has no provenance entry`)
  }
})

test('campaign SEO: indexable fa/en page with a share card', () => {
  const seo = read('../src/features/loading/seoHead.ts')
  assert.match(seo, /\|campaign\|/)
  assert.match(seo, /\(\?:whitepaper\|campaign\)/)
  assert.match(page, /og:image/)
  assert.match(page, /twitter:card/)
  assert.match(page, /title=\{t\(/)
  assert.match(page, /description=\{t\(/)
})

test('campaign attribution keeps only safe utm_* values and never personal data', () => {
  assert.deepEqual(sanitizeUtm({ utm_source: 'telegram', utm_medium: 'post', utm_campaign: 'nov-2026', email: 'a@b.c', wallet: '0xabc', utm_term: 'x y<script>' }),
    { utm_source: 'telegram', utm_medium: 'post', utm_campaign: 'nov-2026' })
  assert.equal(checkoutHref('fa', { utm_source: 'x' }, 'standard', 10000), '/fa/checkout?plan=standard&size=10000&utm_source=x')
  assert.equal(checkoutHref('en', {}), '/en/checkout')
  const tracking = read('../src/features/campaign/campaignTracking.ts')
  assert.doesNotMatch(code(tracking), /walletAddress|email|orderId|fetch\(/)
})

test('landing CTA 1: the prop card keeps its button and adds "Buy Challenge" straight to the shared checkout', () => {
  assert.match(home, /c\.propCtaDestination === 'terminal' \? `\/\$\{locale\}\/prop\/trade` : CTA_HREF\.challenges\(locale\)/)
  assert.match(home, /<Link className="button button-secondary home-buy-cta" to=\{CHECKOUT_HREF\(locale\)\}/)
  assert.match(home, /pick\(locale, 'خرید سریع چالش', 'Buy Challenge'\)/)
  assert.match(home, /export const CHECKOUT_HREF = \(locale: string\) => `\/\$\{locale\}\/checkout`/)
})

test('landing CTA 2: the connected-wallet card adds "Buy Challenge" under "Ready to choose a challenge"', () => {
  const ready = wallet.indexOf("t('آماده انتخاب چالش', 'Ready to choose a challenge')")
  const buy = wallet.indexOf("t('خرید چالش', 'Buy Challenge')")
  assert.ok(ready > 0 && buy > ready)
  /* client-side navigation: the wallet connection and the signed-in session are kept */
  assert.match(wallet, /<Link className="button wallet-buy" to=\{`\/\$\{locale\}\/checkout`\}/)
  assert.doesNotMatch(wallet.slice(buy - 300, buy), /signIn|openConnect/)
})
