/**
 * Browser-side isolation: every request the page makes to a third party is
 * answered locally, so browser tests never reach api.gains.trade, the CMS,
 * WalletConnect or DePay.
 *   api.gains.trade (HTTPS + WSS) → synthetic Gains server (harness/mock-gains.mjs)
 *   cms.invalid (CMS_PUBLIC_URL)  → empty Directus-shaped JSON
 *   anything else off-origin      → aborted and counted
 */
const MOCK = process.env.GAINS_MOCK || 'http://127.0.0.1:18090'
export async function isolate(context, origin, blocked = []) {
  await context.route(url => !url.href.startsWith(origin), async route => {
    const url = new URL(route.request().url())
    if (url.hostname === 'api.gains.trade') {
      const r = await fetch(MOCK + url.pathname + url.search).catch(() => null)
      if (!r) return route.abort()
      return route.fulfill({ status: r.status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: Buffer.from(await r.arrayBuffer()) })
    }
    if (url.hostname === 'cms.invalid') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"data":[]}' })
    if (url.protocol === 'data:' || url.protocol === 'blob:') return route.continue()
    blocked.push(url.origin)
    return route.abort()
  })
  await context.routeWebSocket(/api\.gains\.trade/, ws => {
    const server = ws.connectToServer(MOCK.replace('http', 'ws') + '/v1/arbitrum/ws')
    void server
  })
}
