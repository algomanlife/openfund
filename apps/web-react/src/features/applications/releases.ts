import manifest from './releases.json'
export type Platform = 'macos' | 'windows' | 'linux'
export interface ApplicationRelease {
  platform: Platform; version: string; channel: 'stable' | 'beta'; architecture: 'arm64' | 'x64' | 'universal'
  format: string; bytes: number; releasedAt: string; tag: string; file: string; sha256: string
  downloadUrl: string; notesUrl: string; guideUrl: string; verified: boolean; signed: boolean
}
/** Reviewed release metadata is separate from editable copy. CMS URLs cannot
 * become executable downloads. Empty means no public installer is verified. */
export function validatedRelease(value: unknown): ApplicationRelease | null {
  const r = value as ApplicationRelease
  if (!r || !['macos', 'windows', 'linux'].includes(r.platform) || !['stable', 'beta'].includes(r.channel)
    || !['arm64', 'x64', 'universal'].includes(r.architecture) || r.verified !== true
    || (r.channel === 'stable' && r.signed !== true) || !Number.isSafeInteger(r.bytes) || r.bytes <= 0
    || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(r.version) || !/^[a-f0-9]{64}$/.test(r.sha256)
    || !Number.isFinite(Date.parse(r.releasedAt)) || !/^[\w.-]+$/.test(r.tag) || !/^[\w.-]+$/.test(r.file)) return null
  const formats: Record<Platform, string[]> = { macos: ['dmg', 'pkg'], windows: ['exe', 'msi'], linux: ['AppImage', 'deb', 'rpm'] }
  if (!formats[r.platform].includes(r.format) || !r.file.endsWith(`.${r.format}`)) return null
  const releaseBase = 'https://github.com/algomanlife/openfund/releases'
  if (r.downloadUrl !== `${releaseBase}/download/${r.tag}/${r.file}` || r.notesUrl !== `${releaseBase}/tag/${r.tag}`) return null
  if (!/^https:\/\/github\.com\/algomanlife\/openfund\/blob\/[\w.-]+\/docs\/[\w./-]+\.md$/.test(r.guideUrl)) return null
  return r
}
export const applicationReleases = manifest.releases.map(validatedRelease).filter((r): r is ApplicationRelease => r !== null)
