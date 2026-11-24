import { createServer } from 'node:http';
/** Local-only research API. No production mounting, CORS or external publication. */
export function createOracleServer(engine, adapters = []) {
  const clients = new Map();
  const server = createServer((req, res) => {
    const send = (status, value) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(value)); };
    if (req.headers.host && !/^localhost(?::\d+)?$|^127\.0\.0\.1(?::\d+)?$/.test(req.headers.host)) return send(403, { error: 'LOCAL_ONLY' });
    if (req.method !== 'GET') return send(405, { error: 'READ_ONLY' });
    if (req.headers.origin && !['http://localhost', 'http://127.0.0.1'].some(origin => req.headers.origin === origin || req.headers.origin.startsWith(origin + ':'))) return send(403, { error: 'LOCAL_ONLY' });
    let url; try { url = new URL(req.url, 'http://localhost'); } catch { return send(400, { error: 'BAD_URL' }); }
    if (url.pathname === '/v1/stream') {
      if (clients.size >= 32) return send(503, { error: 'SUBSCRIBER_CAPACITY' });
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' }); res.write(': open-oracle\n\n');
      const unsubscribe = engine.subscribe(event => { if (!res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`)) res.destroy(); });
      const heartbeat = setInterval(() => { if (!res.write(': heartbeat\n\n')) res.destroy(); }, 15000); heartbeat.unref();
      let cleaned = false;
      const cleanup = () => { if (cleaned) return; cleaned = true; clearInterval(heartbeat); unsubscribe(); clients.delete(res); };
      clients.set(res, cleanup); res.once('close', cleanup); return;
    }
    const parts = url.pathname.split('/').filter(Boolean); let id;
    try { id = parts[2] ? decodeURIComponent(parts[2]) : null; } catch { return send(400, { error: 'BAD_ID' }); }
    if (parts[0] !== 'v1' || parts.length > 3) return send(404, { error: 'NOT_FOUND' });
    if (parts[1] === 'markets') return send(id && !engine.registry.entries.has(id) ? 404 : 200, id ? engine.registry.entries.get(id) ?? { error: 'NOT_FOUND' } : engine.registry.list());
    if (parts[1] === 'prices') return send(id && !engine.prices.has(id) ? 404 : 200, id ? engine.prices.get(id) ?? { error: 'NOT_FOUND' } : [...engine.prices.values()]);
    if (parts[1] === 'candles' && id) return send(200, engine.candles.list(id, url.searchParams.get('timeframe') ?? '1m'));
    if (parts[1] === 'sources') return send(200, adapters.map(a => a.health()));
    if (parts[1] === 'health') return send(200, { protocol: 'open-oracle', productionIntegrated: false, lastEvaluation: engine.lastEvaluation, ...engine.metrics });
    if (parts[1] === 'methodology') return send(200, engine.config);
    return send(404, { error: 'NOT_FOUND' });
  });
  server.on('close', () => { for (const [res, cleanup] of clients) { cleanup(); res.destroy(); } });
  return { server, async listen(port = 0) { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); return server.address(); },
    async close() { for (const [res, cleanup] of clients) { cleanup(); res.destroy(); } await new Promise(resolve => server.close(resolve)); } };
}
