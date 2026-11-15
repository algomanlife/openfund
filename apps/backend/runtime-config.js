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

/* The DePay Payment Widget is the official `@depay/widgets` UMD bundle,
   vendored and served from this origin (scripts/upstream/vendor-depay-widgets.mjs);
   its Subresource Integrity hash is compiled into the frontend. It is enabled by
   the public integration id alone; VITE_DEPAY_WIDGET=0 is the kill switch.
   VITE_DEPAY_WIDGET_URL + VITE_DEPAY_WIDGET_INTEGRITY optionally replace the
   vendored file with an externally hosted bundle (https, SRI-pinned). */
export function depayWidgetApproved(env) {
  if (env.VITE_DEPAY_WIDGET === '0' || !/^[A-Za-z0-9-]{8,64}$/.test(env.VITE_DEPAY_INTEGRATION_ID || '')) return false
  return true
}
export function depayExternalBundle(env, production = true) {
  if (!env.VITE_DEPAY_WIDGET_URL) return null
  try {
    const url = new URL(env.VITE_DEPAY_WIDGET_URL)
    /* http is accepted for a loopback host outside production only (browser tests) */
    const loopback = !production && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !loopback) || url.username || url.password) return null
  } catch { return null }
  if (!/^sha(256|384|512)-[A-Za-z0-9+/=]{20,}$/.test(env.VITE_DEPAY_WIDGET_INTEGRITY || '')) return null
  return { url: env.VITE_DEPAY_WIDGET_URL, integrity: env.VITE_DEPAY_WIDGET_INTEGRITY }
}

export function runtimeConfigScript(env, production = false) {
  const cmsUrl = runtimeCmsUrl(env, production)
  const config = {
    cmsUrl,
    walletConnectProjectId: env.VITE_WALLETCONNECT_PROJECT_ID || '',
    telegramCommunityUrl: env.VITE_TELEGRAM_COMMUNITY_URL || '',
    discordCommunityUrl: env.VITE_DISCORD_COMMUNITY_URL || '',
    instagramCommunityUrl: env.VITE_INSTAGRAM_COMMUNITY_URL || '',
    depayWidget: depayWidgetApproved(env),
    /* empty = the vendored same-origin bundle */
    depayWidgetUrl: depayWidgetApproved(env) ? depayExternalBundle(env, production)?.url || '' : '',
    depayWidgetIntegrity: depayWidgetApproved(env) ? depayExternalBundle(env, production)?.integrity || '' : '',
    /* public DePay integration id (app.depay.com); not a secret */
    depayIntegrationId: depayWidgetApproved(env) ? env.VITE_DEPAY_INTEGRATION_ID : '',
    /* Footprint chart plugin (Hyperliquid order-flow analytics); off unless enabled */
    footprint: env.FOOTPRINT_ENABLED === '1',
    /* serving region (ADR 0032/0033): lets region-specific notices tell the truth */
    region: String(env.OPENFUND_REGION || 'GLOBAL').toUpperCase() === 'IRAN' ? 'IRAN' : 'GLOBAL',
  }
  return `window.__OPENFUND_RUNTIME_CONFIG__=${JSON.stringify(config).replaceAll('<', '\\u003c')};\n`
}
