export interface PublicRuntimeConfig {
  cmsUrl?: string
  walletConnectProjectId?: string
  telegramCommunityUrl?: string
  discordCommunityUrl?: string
  instagramCommunityUrl?: string
  depayWidget?: boolean
  depayWidgetUrl?: string
  depayWidgetIntegrity?: string
  depayIntegrationId?: string
}

export function publicRuntimeConfig(): PublicRuntimeConfig {
  if (typeof window === 'undefined') return {}
  return (window as Window & { __OPENFUND_RUNTIME_CONFIG__?: PublicRuntimeConfig }).__OPENFUND_RUNTIME_CONFIG__ || {}
}
