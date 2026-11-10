import path from 'node:path'

/* Cache policy for the same-origin frontend (react/).

   Why this exists: Cloudflare sits in front of Render with a 4-hour Browser
   Cache TTL. Any response without an explicit, stronger Cache-Control is
   rewritten to `max-age=14400` — including the JSON 404 for a missing asset.
   During a Render deploy cutover the old and new instances briefly serve
   together, so the new HTML can reference `assets/index-<hash>.css` while the
   stylesheet request lands on the old instance and 404s. That 404 was then
   cached for 4 hours (edge + browser) and the whole UI rendered unstyled
   (terminal iframe collapsed to the 300x150 default, raw links). Unhashed
   files (legacy/*.js, legacy/*.css, translations.json, the Vela bundle) were
   likewise cached for 4 hours against a freshly deployed hashed bundle.

   Policy:
   - Vite content-hashed build output (`assets/<name>-<8 char hash>.<ext>`)
     never changes under the same URL → long-lived + immutable.
   - HTML and release metadata → revalidate on every load.
   - Every other (unhashed) file → `no-cache`: the browser keeps it but must
     revalidate (cheap 304 via ETag), so it can never drift from the bundle.
   - Misses → `no-store`, so a transient deploy-window 404 is never cached. */

const HASHED_ASSET = /(^|\/)assets\/[^/]+-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/i

export const IMMUTABLE = 'public, max-age=31536000, immutable'
export const REVALIDATE = 'no-cache'
export const NO_STORE = 'no-store'

export function isHashedAsset(file) {
  return HASHED_ASSET.test(file.split(path.sep).join('/'))
}

export function staticCacheControl(file) {
  if (file.endsWith('.html') || file.endsWith('release-manifest.json')) return 'no-cache, must-revalidate'
  return isHashedAsset(file) ? IMMUTABLE : REVALIDATE
}
