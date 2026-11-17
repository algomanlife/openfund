import { sha256, releaseAssetBytes } from './lib.mjs';
import { candidateSource } from './candidate-source.mjs';

const api = 'https://api.github.com/repos/algomanlife/openfund';
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'openfund-render-release-verifier' };
const githubGet = async url => {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error(`Official release lookup failed: ${response.status}`);
  return response.json();
};

/** What Render is allowed to build for `sha`: the published official release
 * whose tag points at it (manifest digest and identity verified), otherwise
 * the fully gated current-main candidate (explicitly unofficial). */
export async function renderSource(sha, { get = githubGet, assetBytes = id => releaseAssetBytes('algomanlife/openfund', id), candidate = candidateSource } = {}) {
  let tag;
  for (let page = 1; page <= 10 && !tag; page++) {
    const tags = await get(`${api}/tags?per_page=100&page=${page}`);
    tag = tags.find(t => t.commit?.sha === sha && /^v\d+\.\d+\.\d+$/.test(t.name))?.name;
    if (tags.length < 100) break;
  }
  if (tag) {
    const release = await get(`${api}/releases/tags/${tag}`), asset = release.assets.find(a => a.name === 'release-manifest.json');
    if (release.draft || release.prerelease || release.tag_name !== tag || !asset) throw Error('Published official manifest is missing.');
    const bytes = await assetBytes(asset.id);
    if (!/^sha256:[a-f0-9]{64}$/.test(asset.digest || '')) throw Error('Published manifest has no SHA-256 digest.');
    if (`sha256:${sha256(bytes)}` !== asset.digest) throw Error('Published manifest digest mismatch.');
    const source = JSON.parse(bytes.toString('utf8'));
    if (source.commit !== sha || source.tag !== tag || !source.official || source.verification.status !== 'passed') throw Error('Published release identity/verification mismatch.');
    return source;
  }
  const gated = await candidate(sha);
  // Keep the Render rebuild identical to the gated candidate package. It is
  // explicitly unofficial until a separate publish action creates a release.
  return { version: gated.version, commit: sha, official: false, verification: { status: 'passed', source: 'github-actions', checks: gated.checks } };
}
