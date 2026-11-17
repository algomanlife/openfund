import fs from 'node:fs';
import path from 'node:path';
import { json, sha256, treeHash, filesIn } from './lib.mjs';
export function verify(dir, {version, commit} = {}) {
  const m = json(path.join(dir,'release-manifest.json'));
  if (version && m.tag !== version || commit && m.commit !== commit) throw Error('Release identity mismatch.');
  if (m.frontend.id !== treeHash(path.join(dir,'react'))) throw Error('Frontend payload hash mismatch.');
  if (JSON.stringify(m) !== JSON.stringify(json(path.join(dir,'react/release-manifest.json')))) throw Error('Frontend/backend manifest mismatch.');
  const checksums=json(path.join(dir,'file-checksums.json'));
  const files=filesIn(dir).filter(f=>f!=='file-checksums.json');
  if (JSON.stringify(files.sort()) !== JSON.stringify(Object.keys(checksums).sort())) throw Error('Unexpected or missing payload files.');
  for (const [file, hash] of Object.entries(checksums)) if (sha256(fs.readFileSync(path.join(dir,file))) !== hash) throw Error(`Payload checksum mismatch: ${file}`);
  return m;
}
/** Live runtime verification of a deployed (or locally booted) release.
 * Confirms the serving application IS the release: /version matched and
 * official with the exact release tag commit, the public frontend manifest
 * identical in version/commit/frontend id, CMS health, and a live SIWE
 * sign-in on every configured domain (with a disallowed-domain rejection).
 * `official` stays required unless the caller explicitly verifies an
 * unofficial local candidate. Nothing here weakens the payload checks above.
 */
export async function verifyRuntime({ baseUrl, cmsUrl, manifest: source, requireOfficial = true, siweDomains, fetchImpl = fetch, siwe }) {
  if (!baseUrl) throw Error('Runtime verification requires the public base URL.');
  if (!source) throw Error('Runtime verification requires the release manifest to compare against.');
  const get = async route => {
    const response = await fetchImpl(new URL(route, baseUrl), { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error(`Runtime verification: ${route} returned ${response.status}.`);
    return response.json();
  };
  const version = await get('/version');
  if (version.status !== 'matched') throw Error(`Runtime verification: /version status is ${version.status}, not matched.`);
  if (requireOfficial && version.manifest?.official !== true) throw Error('Runtime verification: the serving release is not official.');
  if (version.manifest?.tag !== source.tag || version.commit !== source.commit) throw Error('Runtime verification: /version does not serve the release tag commit.');
  const frontend = await get('/react/release-manifest.json');
  if (frontend.version !== source.version || frontend.commit !== source.commit || frontend.frontend?.id !== source.frontend?.id)
    throw Error('Runtime verification: frontend manifest does not match the release version/commit/frontend id.');
  if (!cmsUrl) throw Error('Runtime verification requires the CMS URL for platform health.');
  const cms = await fetchImpl(new URL('/server/health', cmsUrl), { signal: AbortSignal.timeout(20000) });
  if (!cms.ok) throw Error(`Runtime verification: CMS health returned ${cms.status}.`);
  const { liveSiweSmoke, smokeDomains } = await (siwe ? Promise.resolve(siwe) : import('./live-siwe-smoke.mjs'));
  await liveSiweSmoke({ baseUrl, domains: siweDomains || smokeDomains() });
  return { status: 'verified', tag: source.tag, commit: source.commit };
}
if(process.argv[1]?.endsWith('/verify.mjs')) {
  const args = process.argv.slice(2);
  const liveIndex = args.indexOf('--live');
  const dir = path.resolve(args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--live') || '.');
  const manifest = verify(dir);
  console.log(JSON.stringify(manifest, null, 2));
  if (liveIndex !== -1) {
    const baseUrl = args[liveIndex + 1] || process.env.RELEASE_PUBLIC_URL;
    const result = await verifyRuntime({ baseUrl, cmsUrl: process.env.RELEASE_CMS_URL, manifest, requireOfficial: !args.includes('--candidate') });
    console.log(JSON.stringify(result));
  }
}
