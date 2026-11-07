export function runtimeCmsUrl(env, production = false) {
  const raw = env.CMS_PUBLIC_URL || (env.VITE_DIRECTUS_HOST ? `https://${env.VITE_DIRECTUS_HOST}` : '')
  if (!raw) {
    if (production) throw Error('CMS_PUBLIC_URL or VITE_DIRECTUS_HOST is required in production')
    return 'http://localhost:8055'
  }
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || (production && url.protocol !== 'https:'))
    throw Error('CMS public URL must be a credential-free HTTPS origin in production')
  return url.origin
}

export function runtimeConfigScript(env, production = false) {
  const cmsUrl = runtimeCmsUrl(env, production)
  const config = {
    cmsUrl,
    walletConnectProjectId: env.VITE_WALLETCONNECT_PROJECT_ID || '',
    telegramCommunityUrl: env.VITE_TELEGRAM_COMMUNITY_URL || '',
    discordCommunityUrl: env.VITE_DISCORD_COMMUNITY_URL || '',
    instagramCommunityUrl: env.VITE_INSTAGRAM_COMMUNITY_URL || '',
    depayWidget: env.VITE_DEPAY_WIDGET === '1',
    depayWidgetUrl: env.VITE_DEPAY_WIDGET_URL || '',
  }
  return `window.__OPENFUND_RUNTIME_CONFIG__=${JSON.stringify(config).replaceAll('<', '\\u003c')};\n`
}
