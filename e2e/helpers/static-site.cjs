/* Minimal static host for the built web application (repo-root react/).
 * Serves hashed assets, the SPA fallback and a stub /runtime-config.js, and
 * answers every backend request (/api/*, and any fetch that is not a document
 * or a file) with 503 so pages exercise their published,
 * backend-down fallbacks. It has no dependencies and never proxies to another
 * host: the stub's CMS origin is a second loopback listener that answers 503
 * to everything (Directus unavailable).
 *   const site = await startStaticSite({ root: 'react', port: 0 }); site.url */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.otf': 'font/otf', '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.map': 'application/json',
};

function runtimeConfig(overrides = {}) {
  const config = {
    walletConnectProjectId: '', telegramCommunityUrl: '', discordCommunityUrl: '',
    instagramCommunityUrl: '', depayWidget: false, depayWidgetUrl: '', depayWidgetIntegrity: '', depayIntegrationId: '',
    footprint: false, region: 'GLOBAL', geoLocale: 'en', ...overrides,
  };
  return `window.__OPENFUND_RUNTIME_CONFIG__=${JSON.stringify(config).replaceAll('<', '\\u003c')};\n`;
}

function startStaticSite({ root = 'react', port = 0, host = '127.0.0.1', config } = {}) {
  const dir = path.resolve(root);
  const index = path.join(dir, 'index.html');
  if (!fs.existsSync(index)) throw Error(`${index} is missing — run npm run build:web first`);
  let script = '';
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://local');
    let pathname = decodeURIComponent(url.pathname).replace(/^\/react(?=\/|$)/, '') || '/';
    if (pathname === '/runtime-config.js') {
      res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-store' });
      return res.end(script);
    }
    if (pathname.startsWith('/api/') || pathname === '/api' || pathname.startsWith('/socket') || pathname === '/version') {
      res.writeHead(503, { 'content-type': TYPES['.json'] });
      return res.end('{"error":"backend not running (static responsive matrix host)"}');
    }
    /* backend calls (fetch/XHR: no document Accept and no file extension) get
       the same 503 a stopped backend would give, never the SPA shell */
    if (!path.extname(pathname) && !/text\/html/.test(req.headers.accept || '')) {
      res.writeHead(503, { 'content-type': TYPES['.json'] });
      return res.end('{"error":"backend_unavailable"}');
    }
    const file = path.join(dir, path.normalize(pathname));
    if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
    let target = file;
    try { if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html'); } catch { target = null; }
    if (!target || !fs.existsSync(target)) {
      /* asset-looking misses stay 404 so broken references surface; routes fall back to the shell */
      if (path.extname(pathname)) { res.writeHead(404); return res.end(); }
      target = index;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(target).pipe(res);
  });
  const cms = http.createServer((req, res) => {
    res.writeHead(503, { 'content-type': TYPES['.json'], 'access-control-allow-origin': '*' });
    res.end('{"errors":[{"message":"CMS not running (static responsive matrix host)"}]}');
  });
  const listen = (srv, p) => new Promise((resolve, reject) => { srv.once('error', reject); srv.listen(p, host, () => resolve(srv.address().port)); });
  const stop = srv => new Promise(r => { srv.close(() => r()); srv.closeAllConnections(); });
  return listen(cms, 0).then(cmsPort => listen(server, port).then(bound => {
    script = runtimeConfig({ cmsUrl: `http://${host}:${cmsPort}`, ...config });
    return { url: `http://${host}:${bound}`, close: () => Promise.all([stop(server), stop(cms)]) };
  }));
}

module.exports = { startStaticSite, runtimeConfig };

if (require.main === module) {
  startStaticSite({ port: Number(process.env.PORT || 4173) }).then(site => console.log(`static site on ${site.url}`));
}
