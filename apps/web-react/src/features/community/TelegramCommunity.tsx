import { useEffect, useState } from 'react'
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

/** Host/path validation is not evidence of community ownership. */
export function discordCommunityUrl(value?: string): string | null {
  if (!value?.trim()) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return null
    const invite = url.hostname === 'discord.gg' ? /^\/[a-zA-Z0-9-]+\/?$/
      : url.hostname === 'discord.com' ? /^\/invite\/[a-zA-Z0-9-]+\/?$/ : null
    return invite?.test(url.pathname) ? url.href : null
  } catch { return null }
}

/** Validate profile syntax, never infer that the profile belongs to Openfund. */
export function instagramCommunityUrl(value?: string): string | null {
  if (!value?.trim()) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.hostname !== 'instagram.com' || url.username || url.password || url.port || url.search || url.hash) return null
    const username = /^\/([a-zA-Z0-9_](?:[a-zA-Z0-9_.]{0,28}[a-zA-Z0-9_])?)\/?$/.exec(url.pathname)?.[1]
    if (!username || username.includes('..') || /^(?:accounts|explore|reels?|stories|direct|p|tv|about|developer|developers|legal|privacy|terms|oauth|api|web)$/i.test(username)) return null
    return `https://instagram.com/${username}/`
  } catch { return null }
}

// Preserve the Telegram URL export for existing consumers.
export const community = { url: communityUrl(import.meta.env.VITE_TELEGRAM_COMMUNITY_URL) }
export const communityProviders = [
  { id: 'telegram', name: 'Telegram', icon: 'telegram-logo.svg', url: community.url, labels: { fa: 'جامعه معامله‌گران', en: 'Traders talk on' } },
  { id: 'discord', name: 'Discord', icon: 'discord-logo.svg', url: discordCommunityUrl(import.meta.env.VITE_DISCORD_COMMUNITY_URL), labels: { fa: 'جامعه معامله‌گران', en: 'Traders talk on' } },
  { id: 'instagram', name: 'Instagram', icon: 'instagram-logo.svg', url: instagramCommunityUrl(import.meta.env.VITE_INSTAGRAM_COMMUNITY_URL), labels: { fa: 'اخبار، آموزش و سرگرمی', en: 'News, Education & Entertainment' } },
] as const
const copy = {
  fa: { label: 'جامعه معامله‌گران', unavailable: 'به‌زودی', destination: 'لینک جامعهٔ اوپن‌فاند هنوز اعلام نشده است', group: 'جامعهٔ معامله‌گران اوپن‌فاند' },
  en: { label: 'Traders talk on', unavailable: 'Coming Soon', destination: 'Openfund community link has not been announced', group: 'Openfund trader communities' },
}

export function CommunityButton({ locale, provider }: { locale: Locale; provider: typeof communityProviders[number] }) {
  const [light, setLight] = useState(() => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light')
  useEffect(() => {
    const root = document.documentElement
    const sync = () => setLight(root.dataset.theme === 'light')
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  const t = copy[locale]
  const text = provider.labels[locale]
  const label = `${text} — ${provider.name}${provider.url ? '' : ` — ${t.destination}`}`
  const icon = provider.id === 'instagram' && !light ? 'instagram-logo-white.svg' : provider.icon
  const contents = <>
    <img src={`${import.meta.env.BASE_URL}assets/${icon}`} width="20" height="20" alt={provider.name} />
    <span className="community-copy"><span>{text}</span>{!provider.url && <small>{t.unavailable}</small>}</span>
  </>
  const className = `community-button ${provider.id}-community`
  return provider.url
    ? <a data-locale-owned="react" data-provider={provider.id} className={className} href={provider.url} target="_blank" rel="noopener noreferrer" aria-label={label}>{contents}</a>
    : <button data-locale-owned="react" data-provider={provider.id} className={className} type="button" aria-disabled="true"
        title={`${provider.name} — ${t.destination}`} aria-label={label}>{contents}</button>
}

// Existing public layouts import this default; every slot uses the shared provider registry.
export default function TelegramCommunity({ locale }: { locale: Locale }) {
  return <div className="community-group" data-locale-owned="react" role="group" aria-label={copy[locale].group}>
    {communityProviders.map(provider => <CommunityButton key={provider.id} locale={locale} provider={provider} />)}
  </div>
}
