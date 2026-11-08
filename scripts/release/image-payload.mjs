// Prepare the Docker build context for the GHCR image from an official
// GitHub Release archive. Applies the same identity and integrity checks as
// `release:local`: published stable release, tag → manifest commit, archive
// SHA256, safe tar entries and the per-file payload verification.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { json, run, sha256 } from './lib.mjs';
import { verify } from './verify.mjs';

const tag = process.argv[2], out = path.resolve(process.argv[3] || 'output/image');
const repo = process.env.GITHUB_REPOSITORY || 'algomanlife/openfund';
if (!/^v\d+\.\d+\.\d+$/.test(tag || '')) throw Error('Select an exact official release tag (vX.Y.Z).');
const release = JSON.parse(execFileSync('gh', ['release', 'view', tag, '--repo', repo, '--json', 'isDraft,isPrerelease,url'], { encoding: 'utf8' }));
if (release.isDraft || release.isPrerelease) throw Error('Images are built only from published stable releases.');

fs.rmSync(out, { recursive: true, force: true });
const downloads = path.join(out, 'release'), payload = path.join(out, 'payload');
fs.mkdirSync(downloads, { recursive: true }); fs.mkdirSync(payload);
const archive = `openfund-${tag}.tar.gz`;
await run('gh', ['release', 'download', tag, '--repo', repo, '--pattern', archive, '--pattern', 'SHA256SUMS', '--pattern', 'release-manifest.json', '--dir', downloads]);
const metadata = json(path.join(downloads, 'release-manifest.json'));
if (!metadata.official || metadata.verification.status !== 'passed' || metadata.tag !== tag) throw Error('Not an accepted official artifact.');
const remote = execFileSync('git', ['ls-remote', `https://github.com/${repo}.git`, `refs/tags/${tag}`, `refs/tags/${tag}^{}`], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const tagCommit = (remote.find(l => l.endsWith('^{}')) || remote[0] || '').split(/\s/)[0];
if (tagCommit !== metadata.commit) throw Error('Release tag does not match artifact commit.');
const archiveSha = sha256(fs.readFileSync(path.join(downloads, archive)));
if (fs.readFileSync(path.join(downloads, 'SHA256SUMS'), 'utf8').trim() !== `${archiveSha}  ${archive}`) throw Error('Archive checksum mismatch.');
const listing = execFileSync('tar', ['-tvzf', path.join(downloads, archive)], { encoding: 'utf8' }).split('\n').filter(Boolean);
if (listing.some(l => !['-', 'd'].includes(l[0]))) throw Error('Release archive contains unsupported links or entries.');
const members = execFileSync('tar', ['-tzf', path.join(downloads, archive)], { encoding: 'utf8' }).trim().split('\n');
if (members.some(f => f.startsWith('/') || f.split('/').includes('..'))) throw Error('Unsafe archive path.');
await run('tar', ['-xzf', path.join(downloads, archive), '-C', payload]);
const m = verify(payload, { version: tag, commit: metadata.commit });

const result = { tag, version: m.version, commit: m.commit, archiveSha256: archiveSha, releaseUrl: release.url, context: out };
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(result).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
console.log(JSON.stringify(result, null, 2));
