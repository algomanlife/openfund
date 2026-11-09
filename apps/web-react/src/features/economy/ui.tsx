import { useEffect, useState, type ReactNode } from 'react'
import { number, text as t, type Localized, type Locale } from '../information/content'
import { translateSource } from '../../i18n/messages'
import { BACKEND_COPY } from './backendCopy'
import { apiFetch } from '../../session/useOpenfundSession'
import './economy.css'

/** Loads a backend JSON resource into a loading / error / ready state. */
export type Remote<T> = { status: 'loading' } | { status: 'error'; code?: string; httpStatus?: number } | { status: 'ready'; data: T }
export function useRemote<T>(path: string | null, deps: unknown[] = []): [Remote<T>, () => void] {
  const [state, setState] = useState<Remote<T>>({ status: 'loading' })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!path) return
    let active = true
    setState({ status: 'loading' })
    void apiFetch(path).then(r => {
      if (!active) return
      setState(r.ok ? { status: 'ready', data: r.data as T } : { status: 'error', code: r.data?.error, httpStatus: r.status })
    }).catch(() => { if (active) setState({ status: 'error' }) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps])
  return [state, () => setTick(v => v + 1)]
}

export const usd = (v: string | number | null | undefined, locale: Locale, digits = 2) =>
  v == null || v === '' ? '—' : number(Number(v), locale, { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits })
export const pct = (v: number | null | undefined, locale: Locale) =>
  v == null ? '—' : number(v, locale, { style: 'percent', maximumFractionDigits: 1 })
export const int = (v: number | null | undefined, locale: Locale) => (v == null ? '—' : number(v, locale))
export const when = (v: string | null | undefined, locale: Locale) =>
  v ? new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—'
export const day = (v: string | null | undefined, locale: Locale) =>
  v ? new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(v)) : '—'

export function Kpi({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'good' | 'warn' }) {
  return <article className={`econ-kpi${tone ? ` ${tone}` : ''}`}><span className="econ-kpi-label">{label}</span><strong><bdi>{value}</bdi></strong>{note && <p>{note}</p>}</article>
}

export function Status({ kind, children }: { kind: 'ok' | 'warn' | 'off' | 'info'; children: ReactNode }) {
  return <span className={`econ-status ${kind}`}>{children}</span>
}

/** Backend-authored definition / provenance text, shown in the reader's language. */
export const backendText = (locale: Locale, english: string) => (BACKEND_COPY[english] || t(english, english))[locale]

export function Source({ locale, children }: { locale: Locale; children: string }) {
  return <p className="econ-source"><span>{t('Source', 'منبع')[locale]}:</span> <bdi dir="ltr">{backendText(locale, children)}</bdi></p>
}

export function StateBlock({ state, locale, empty }: { state: Remote<unknown>; locale: Locale; empty?: string }) {
  if (state.status === 'loading') return <div className="econ-state" role="status" aria-busy="true">{t('Loading verified data…', 'در حال دریافت دادهٔ معتبر…')[locale]}</div>
  if (state.status === 'error') return <div className="econ-state error" role="alert">{t('This data is unavailable right now. No figures are shown instead of guessing.', 'این داده اکنون در دسترس نیست. به‌جای حدس، عددی نمایش داده نمی‌شود.')[locale]}{state.code ? <code dir="ltr"> {state.code}</code> : null}</div>
  return empty ? <div className="econ-state">{empty}</div> : null
}

/** Minimal accessible bar chart over a chronological series. */
export function Bars({ points, locale, label, format }: { points: { key: string; value: number }[]; locale: Locale; label: string; format: (v: number) => string }) {
  if (!points.length) return <p className="econ-empty">{t('No records in this period yet.', 'هنوز در این بازه رکوردی ثبت نشده است.')[locale]}</p>
  const max = Math.max(...points.map(p => Math.abs(p.value)), 1)
  return <figure className="econ-bars" aria-label={label}>
    <div className="econ-bars-plot" dir="ltr">{points.map(p => <div key={p.key} className="econ-bar" title={`${p.key}: ${format(p.value)}`}><i style={{ height: `${Math.max(2, Math.abs(p.value) / max * 100)}%` }} /><span>{p.key.slice(2)}</span></div>)}</div>
    <figcaption>{label}</figcaption>
    <table className="sr-only"><tbody>{points.map(p => <tr key={p.key}><th scope="row">{p.key}</th><td>{format(p.value)}</td></tr>)}</tbody></table>
  </figure>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="econ-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

export const errorCopy = (code: string | undefined, locale: Locale) => {
  const map: Record<string, Localized> = {
    unauthenticated: t('Sign in with your wallet first.', 'ابتدا با کیف پول وارد شو.'),
    terms_not_accepted: t('Accept the program terms to continue.', 'برای ادامه، شرایط برنامه را بپذیر.'),
    application_already_open: t('You already have an open application for this role.', 'برای این نقش درخواست باز داری.'),
    platform_required: t('Add an Instagram or YouTube profile.', 'پروفایل اینستاگرام یا یوتیوب را وارد کن.'),
    invalid_platform_url: t('Use an https:// Instagram or YouTube address.', 'نشانی https:// اینستاگرام یا یوتیوب وارد کن.'),
    invalid_url: t('One of the links is not a valid https:// address.', 'یکی از لینک‌ها نشانی https:// معتبری نیست.'),
    invalid_email: t('Enter a valid email address.', 'ایمیل معتبر وارد کن.'),
    missing_field: t('Complete all required fields.', 'همهٔ فیلدهای الزامی را کامل کن.'),
    coach_not_found: t('No active coach uses that code.', 'کوچ فعالی با این کد وجود ندارد.'),
    coach_link_already_open: t('You already have an open coach relationship.', 'ارتباط باز با یک کوچ داری.'),
    self_coaching_not_allowed: t('You cannot link to your own coach code.', 'نمی‌توانی به کد کوچ خودت متصل شوی.'),
    not_eligible: t('Not all eligibility conditions are met yet.', 'هنوز همهٔ شرایط احراز نشده‌اند.'),
    request_already_open: t('A request is already under review.', 'درخواستی در حال بررسی است.'),
    live_execution_disabled: t('Live execution is not enabled on this deployment.', 'اجرای واقعی در این استقرار فعال نیست.'),
  }
  const m = code ? map[code] : null
  return m ? m[locale] : t('The request could not be completed.', 'درخواست انجام نشد.')[locale] + (code ? ` (${code})` : '')
}
