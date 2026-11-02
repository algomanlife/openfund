import { useEffect, useRef } from 'react'
import { Navigate, useParams, useLocation } from 'react-router-dom'
import { useInformationLocale } from '../information/InformationShell'
import { text } from '../information/content'

/**
 * Referral link target: /:locale/ref/:code
 *
 * Attaches the code to the visitor's browser (a 30-day first-party cookie the
 * backend reads at account creation) and immediately routes to the gateway.
 * The page itself never stores anything; attribution is written server-side
 * only when a brand-new account is created while this cookie is attached.
 */
const MAX_AGE = 60 * 60 * 24 * 30

export function isValidCode(code: string | undefined): boolean {
  return /^[A-HJ-NP-Z2-9]{6,12}$/.test(String(code || ''))
}

export default function ReferralEntry() {
  const locale = useInformationLocale()
  const { code } = useParams()
  const location = useLocation()
  const applied = useRef(false)

  useEffect(() => {
    if (applied.current) return
    applied.current = true
    if (isValidCode(code)) {
      try { document.cookie = `of_ref=${encodeURIComponent(code)};max-age=${MAX_AGE};path=/;samesite=lax` } catch { /* private browsing */ }
    }
  }, [code])

  return <Navigate to={`/${locale}/home`} replace state={{ from: location.pathname }} />
}

/** human-facing note used when an invalid code arrives */
export const invalidCodeNote = text('That referral code was not valid; no cookie was attached.', 'آن کد معرفی معتبر نبود؛ کوکی‌ای ثبت نشد.')
