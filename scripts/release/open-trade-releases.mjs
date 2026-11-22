/* Turns the verified Open Trade build record (builds.json) into website
   download entries (releases.json) for a published GitHub Release tag.
   Run only AFTER the owner has published that release:
     node scripts/release/open-trade-releases.mjs open-trade-v0.0.4 2026-11-21T11:09:23Z
   The website validator (features/applications/releases.ts) still rejects
   any entry that is not on the canonical repository's release assets. */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
const BUILDS = `${root}apps/web-react/src/features/applications/builds.json`
const RELEASES = `${root}apps/web-react/src/features/applications/releases.json`
const BASE = 'https://github.com/algomanlife/openfund'

export function releaseEntries(builds, tag, releasedAt) {
  if (!/^[\w.-]+$/.test(tag || '')) throw Error('A published release tag is required.')
  if (!Number.isFinite(Date.parse(releasedAt || ''))) throw Error('The release date is required (YYYY-MM-DD).')
  return builds.files.map(f => ({
    platform: f.platform, version: builds.version, channel: builds.channel, architecture: f.architecture,
    format: f.format, bytes: f.bytes, releasedAt, tag, file: f.file, sha256: f.sha256,
    downloadUrl: `${BASE}/releases/download/${tag}/${f.file}`, notesUrl: `${BASE}/releases/tag/${tag}`,
    guideUrl: `${BASE}/blob/main/docs/releases/OPEN_TRADE_INSTALL.md`, verified: true, signed: builds.signed === true,
  }))
}

if (process.argv[1]?.endsWith('open-trade-releases.mjs')) {
  const [tag, date] = process.argv.slice(2)
  const builds = JSON.parse(fs.readFileSync(BUILDS, 'utf8'))
  const manifest = JSON.parse(fs.readFileSync(RELEASES, 'utf8'))
  manifest.releases = releaseEntries(builds, tag, date); manifest.verifiedOn = date
  fs.writeFileSync(RELEASES, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`releases.json: ${manifest.releases.length} entries for ${tag}`)
}
