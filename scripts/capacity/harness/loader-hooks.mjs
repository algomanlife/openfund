/**
 * Node module-load hook (test harness only — the application source is not
 * modified). Rewrites the hard-coded Gains endpoints in
 * apps/backend/market-data.js to the local synthetic server so a load test
 * never touches api.gains.trade.
 */
const API = process.env.GAINS_API || 'http://127.0.0.1:18090/v1/arbitrum'
const WSS = process.env.GAINS_WSS || 'ws://127.0.0.1:18090/v1/arbitrum/ws'

export async function load(url, context, next) {
  const out = await next(url, context)
  if (url.endsWith('/apps/backend/market-data.js')) {
    let src = String(out.source)
    const before = src
    src = src.replace("'https://api.gains.trade/v1/arbitrum'", JSON.stringify(API))
             .replace("'wss://api.gains.trade/v1/arbitrum/ws'", JSON.stringify(WSS))
    if (src === before || src.includes('api.gains.trade/v1/arbitrum\'')) throw new Error('[harness] could not redirect Gains endpoints — refusing to start')
    return { ...out, source: src }
  }
  return out
}
