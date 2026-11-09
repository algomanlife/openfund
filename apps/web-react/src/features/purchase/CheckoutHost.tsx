import { normalizeLocale, pick } from '../../i18n/locales'
const currentUiLocale = () => normalizeLocale((window as any).ofUiLang ?? (window as any).ofLang, 'fa')
import { useEffect, useState } from 'react'
import { CheckoutPanel } from './CheckoutPanel'
import { apiFetch } from '../../session/useOpenfundSession'

/**
 * Bridge between the legacy landing runtime (challenges page) and the React
 * checkout panel.
 *
 * The legacy page's own summary dialog (#selection-dialog, the
 * "start challenge" review) stays
 * untouched. When its confirm button (#dialog-done) is clicked AND the backend
 * reports payments enabled, we open the React checkout panel with the builder's
 * current selection (active preset + #account-value). The legacy files
 * themselves are never modified — the hook is added from the React side.
 *
 * Also exposes window.__ofOpenCheckout(slug, size) for programmatic use and
 * re-labels the legacy dialog note/button when purchasing is actually enabled.
 */
interface CheckoutRequest { planSlug: string, accountSize: number }

export function CheckoutHost() {
  const [checkout, setCheckout] = useState<CheckoutRequest | null>(null)
  const [paymentsEnabled, setPaymentsEnabled] = useState(false)

  /* probe purchase availability (cheap; unauthenticated returns the catalog gate) */
  useEffect(() => {
    void apiFetch('/purchases/plans').then(r => {
      if (r.ok) setPaymentsEnabled(!!r.data?.paymentsEnabled)
    }).catch(() => {})
  }, [])

  /* programmatic entry point */
  useEffect(() => {
    const w = window as any
    w.__ofOpenCheckout = (planSlug: string, accountSize: number) => {
      if (typeof planSlug === 'string' && Number.isFinite(Number(accountSize))) setCheckout({ planSlug, accountSize: Number(accountSize) })
    }
    return () => { if (w.__ofOpenCheckout) delete w.__ofOpenCheckout }
  }, [])

  /* re-label the legacy dialog when purchasing is enabled (fa/en via ofLang) */
  useEffect(() => {
    if (!paymentsEnabled) return
    const relabel = () => {
      const root = document.getElementById('builder')
      if (!root?.isConnected) return
      /* displayed locale (ofUiLang: fa/en/ar/ru/zh-CN) */
      const locale = currentUiLocale()
      const note = document.querySelector('#selection-dialog .dialog-note') as HTMLElement | null
      const done = document.getElementById('dialog-done')
      const sample = document.querySelector('.sample-note') as HTMLElement | null
      const orderNote = document.querySelector('#challenge-order p:last-child') as HTMLElement | null
      if (note) note.textContent = pick(locale, 'با ادامه، سفارش پرداخت روی زنجیره ایجاد و پس از تأیید سرور، حساب چالش فعال می‌شود.', 'Continuing creates a server-priced order; the challenge account is provisioned after on-chain payment is verified.')
      if (done) done.textContent = pick(locale, 'ادامه و پرداخت ←', 'Continue to payment →')
      if (sample) sample.textContent = pick(locale, 'هزینهٔ ارزیابی یک‌باره است. پرداخت روی زنجیره انجام و پس از تأیید سرور، چالش فعال می‌شود؛ حساب فاندشده با سهم سود تا ۸۰٪ — و در چلنج آنی تا ۹۵٪.', 'The evaluation fee is one-time. Payment settles on-chain; the challenge activates after server verification. Funded accounts carry up to an 80% profit split — 95% on the Instant challenge.')
      if (orderNote) orderNote.textContent = pick(locale, 'پس از پرداخت و تأیید، چالش فعال می‌شود.', 'The challenge activates after payment is verified.')
    }
    relabel()
    const timer = setInterval(relabel, 2000) /* legacy re-renders (locale switch, CMS) may restore old labels */
    addEventListener('of-language', relabel)
    return () => { clearInterval(timer); removeEventListener('of-language', relabel) }
  }, [paymentsEnabled])

  /* intercept the legacy dialog confirm button */
  useEffect(() => {
    if (!paymentsEnabled) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.id !== 'dialog-done') return
      if (!document.getElementById('builder')?.isConnected) return
      const presetBtn = document.querySelector('.account-presets [data-preset].active') as HTMLElement | null
      const planSlug = presetBtn?.dataset.preset
      const sizeText = document.getElementById('account-value')?.textContent || ''
      const accountSize = Number(sizeText.replace(/[^0-9]/g, ''))
      if (planSlug && accountSize > 0) setCheckout({ planSlug, accountSize })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [paymentsEnabled])

  if (!checkout) return null
  return <CheckoutPanel planSlug={checkout.planSlug} accountSize={checkout.accountSize} onClose={() => setCheckout(null)} />
}
