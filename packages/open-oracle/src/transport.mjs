import { setTimeout as delay } from 'node:timers/promises';
export class ProviderError extends Error {
  constructor(code, details = {}) { super(code); this.code = code; Object.assign(this, details); }
}
/** Bounded body, timeout, retry budget, sequential request admission and abortable rate backoff. */
export class PublicTransport {
  constructor({ fetchImpl = fetch, now = Date.now, sleep = delay, maxBytes = 8 * 1024 * 1024,
    retries = 2, minIntervalMs = 250, timeoutMs = 10000 } = {}) {
    Object.assign(this, { fetchImpl, now, sleep, maxBytes, retries, minIntervalMs, timeoutMs });
    this.lastRequest = 0; this.pending = 0; this.tail = Promise.resolve();
    this.metrics = { requests: 0, failures: 0, rateLimits: 0, bytes: 0 };
  }
  async request(url, body, signal) {
    if (this.pending >= 32) throw new ProviderError('BACKPRESSURE');
    this.pending++;
    const prior = this.tail;
    let release; this.tail = new Promise(resolve => { release = resolve; });
    try {
      await prior;
      for (let attempt = 0; attempt <= this.retries; attempt++) {
        signal?.throwIfAborted();
        await this.sleep(Math.max(0, this.minIntervalMs - (this.now() - this.lastRequest)), undefined, { signal });
        this.lastRequest = this.now(); this.metrics.requests++;
        try {
          const timeout = AbortSignal.timeout(this.timeoutMs);
          const res = await this.fetchImpl(url, { method: body === undefined ? 'GET' : 'POST',
            headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
          if (!res.ok) {
            if (res.status === 429) this.metrics.rateLimits++;
            const retryAfter = res.headers.get('retry-after');
            const ms = retryAfter && /^\d+(?:\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 :
              retryAfter ? Math.max(0, Date.parse(retryAfter) - this.now()) : 0;
            await res.body?.cancel();
            throw new ProviderError(res.status === 429 ? 'RATE_LIMIT' : 'HTTP_ERROR', { status: res.status, retryMs: Number.isFinite(ms) ? Math.min(ms, 30000) : 0 });
          }
          const chunks = []; let length = 0;
          if (!res.body) throw new ProviderError('EMPTY_BODY');
          for await (const chunk of res.body) {
            length += chunk.length;
            if (length > this.maxBytes) throw new ProviderError('BODY_LIMIT');
            chunks.push(chunk);
          }
          this.metrics.bytes += length;
          try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
          catch { throw new ProviderError('SCHEMA_INVALID'); }
        } catch (error) {
          this.metrics.failures++;
          if (signal?.aborted) throw error;
          const code = error.code ?? (error.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK');
          if (attempt === this.retries || ['BODY_LIMIT', 'SCHEMA_INVALID'].includes(code) || (error.status && error.status < 500 && error.status !== 429))
            throw error instanceof ProviderError ? error : new ProviderError(code, { cause: error });
          await this.sleep(Math.max(error.retryMs ?? 0, Math.min(30000, 500 * 2 ** attempt)), undefined, { signal });
        }
      }
    } finally { this.pending--; release(); }
  }
}
export function array(value) {
  if (!Array.isArray(value)) throw new ProviderError('SCHEMA_INVALID');
  return value;
}
export function timestamp(value) {
  const n = typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value) ? Date.parse(value) : Number(value);
  const ms = n < 100000000000 ? n * 1000 : n;
  return Number.isSafeInteger(ms) && ms > 0 ? ms : null;
}
