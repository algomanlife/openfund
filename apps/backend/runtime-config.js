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

export function depayWidgetApproved(env, production = true) {
  if (env.VITE_DEPAY_WIDGET !== '1' || !env.VITE_DEPAY_INTEGRATION_ID) return false
  try {
    const url = new URL(env.VITE_DEPAY_WIDGET_URL || '')
    /* http is accepted for a loopback host outside production only (browser tests) */
    const loopback = !production && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !loopback) || url.username || url.password) return false
  } catch { return false }
  return /^sha(256|384|512)-[A-Za-z0-9+/=]{20,}$/.test(env.VITE_DEPAY_WIDGET_INTEGRITY || '')
}

export function runtimeConfigScript(env, production = false) {
  const cmsUrl = runtimeCmsUrl(env, production)
  const config = {
    cmsUrl,
    walletConnectProjectId: env.VITE_WALLETCONNECT_PROJECT_ID || '',
    telegramCommunityUrl: env.VITE_TELEGRAM_COMMUNITY_URL || '',
    discordCommunityUrl: env.VITE_DISCORD_COMMUNITY_URL || '',
    instagramCommunityUrl: env.VITE_INSTAGRAM_COMMUNITY_URL || '',
    /* the external widget is enabled only with an https URL AND a
       Subresource Integrity hash pinning the exact approved bundle */
    depayWidget: depayWidgetApproved(env, production),
    depayWidgetUrl: depayWidgetApproved(env, production) ? env.VITE_DEPAY_WIDGET_URL : '',
    depayWidgetIntegrity: depayWidgetApproved(env, production) ? env.VITE_DEPAY_WIDGET_INTEGRITY : '',
    /* public DePay integration id (app.depay.com); not a secret */
    depayIntegrationId: depayWidgetApproved(env, production) ? env.VITE_DEPAY_INTEGRATION_ID : '',
    /* Footprint chart plugin (Hyperliquid order-flow analytics); off unless enabled */
    footprint: env.FOOTPRINT_ENABLED === '1',
  }
  return `window.__OPENFUND_RUNTIME_CONFIG__=${JSON.stringify(config).replaceAll('<', '\\u003c')};\n`
}
