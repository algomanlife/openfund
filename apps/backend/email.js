/**
 * Transactional e-mail adapter (one provider behind environment variables).
 *
 *   EMAIL_PROVIDER  'resend' (HTTPS API) or 'log' (local development and
 *                   tests only; refused when NODE_ENV=production)
 *   EMAIL_API_KEY   provider API key (secret: render.yaml sync:false)
 *   EMAIL_FROM      sender, e.g. "Openfund <no-reply@openfi.cloud>"
 *
 * Until the provider is configured the adapter reports `configured: false`
 * and every caller must say so to the visitor (registration "opens soon")
 * instead of pretending to send. Messages are plain text; the adapter never
 * logs the recipient or the body in production.
 */
const fail = (status, error) => Object.assign(new Error(error), { status })
const FROM = /^(?:[^<>@\r\n]{1,80} <)?[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+>?$/

export function createEmailSender(env = process.env, { fetchImpl = fetch, log = message => console.log(message) } = {}) {
  const provider = String(env.EMAIL_PROVIDER || '').trim().toLowerCase()
  const from = String(env.EMAIL_FROM || '').trim()
  const key = String(env.EMAIL_API_KEY || '').trim()
  const production = env.NODE_ENV === 'production'
  let configured = false
  if (provider === 'resend') configured = key.length >= 16 && FROM.test(from)
  else if (provider === 'log') configured = !production && FROM.test(from || 'Openfund <dev@localhost.test>')
  /** Last sent message, for tests with the 'log' provider only. */
  const outbox = []
  async function send({ to, subject, text }) {
    if (!configured) throw fail(503, 'email_not_configured')
    if (typeof to !== 'string' || to.length > 254 || /[\r\n]/.test(to + subject)) throw fail(400, 'invalid_email')
    if (provider === 'log') {
      outbox.push({ to, subject, text })
      log(`[email:log] ${subject} → ${to.replace(/^(.).*(@.*)$/, '$1…$2')}`)
      return { id: `log-${outbox.length}` }
    }
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    }).catch(() => { throw fail(502, 'email_unavailable') })
    if (!res.ok) { await res.body?.cancel(); throw fail(502, 'email_rejected') }
    return { id: (await res.json().catch(() => ({}))).id ?? null }
  }
  return { configured, provider: configured ? provider : null, send, outbox }
}
