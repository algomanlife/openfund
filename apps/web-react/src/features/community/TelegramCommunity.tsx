import type { Locale } from '../information/content'
import './community.css'

/** Only an owner-verified Telegram destination may be configured at build time. */
export function communityUrl(value?: string): string | null {
  if (!value?.trim()) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.hostname !== 't.me' || url.username || url.password || url.port) return null
    // Accept named communities and invitation links, never Telegram's homepage.
    if (!/^\/(?:[a-zA-Z][a-zA-Z0-9_]{4,}|\+[a-zA-Z0-9_-]+|joinchat\/[a-zA-Z0-9_-]+)\/?$/.test(url.pathname)) return null
    if (/^\/(?:share|proxy|socks|login|iv)\/?$/i.test(url.pathname) || url.search || url.hash) return null
    return url.href
  } catch { return null }
}

export const community = { url: communityUrl(import.meta.env.VITE_TELEGRAM_COMMUNITY_URL) }
const copy = {
  fa: { label: 'جامعه معامله‌گران', unavailable: 'به‌زودی', destination: 'لینک جامعهٔ اوپن‌فاند هنوز اعلام نشده است' },
  en: { label: 'Traders talk on', unavailable: 'Coming Soon', destination: 'Openfund community link has not been announced' },
}
export default function TelegramCommunity({ locale }: { locale: Locale }) {
  const t = copy[locale]
  const contents = <>
    <span>{t.label}</span>
    <img src={`${import.meta.env.BASE_URL}assets/telegram-logo.svg`} width="26" height="26" alt="Telegram" />
    {!community.url && <small>{t.unavailable}</small>}
  </>
  return community.url
    ? <a data-locale-owned="react" className="telegram-community" href={community.url} target="_blank" rel="noopener noreferrer" aria-label={`${t.label} — Telegram`}>{contents}</a>
    : <button data-locale-owned="react" className="telegram-community" type="button" aria-disabled="true"
        title={t.destination} aria-label={`${t.label} — ${t.destination}`}>{contents}</button>
}
