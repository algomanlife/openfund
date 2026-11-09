import { run,git,validateEnv,sha256,releaseAssetBytes } from './lib.mjs';
import { manifest } from './manifest.mjs';
import { candidateSource } from './candidate-source.mjs';
// Render accepts a published official tag, or the fully gated current main candidate.
const sha=process.env.RENDER_GIT_COMMIT;
if(!/^[a-f0-9]{40}$/.test(sha || '')||git('rev-parse','HEAD')!==sha)throw Error('Render source SHA is missing or mismatched.');
const api='https://api.github.com/repos/algomanlife/openfund';
const headers={Accept:'application/vnd.github+json','User-Agent':'openfund-render-release-verifier'};
const get=async url=>{
 const response=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`Official release lookup failed: ${response.status}`);
 return response.json();
};
let tag;
for(let page=1;page<=10&&!tag;page++){
 const tags=await get(`${api}/tags?per_page=100&page=${page}`);
 tag=tags.find(t=>t.commit?.sha===sha&&/^v\d+\.\d+\.\d+$/.test(t.name))?.name;
 if(tags.length<100)break;
}
let source;
if(tag){
 const release=await get(`${api}/releases/tags/${tag}`),asset=release.assets.find(a=>a.name==='release-manifest.json');
 if(release.draft||release.prerelease||release.tag_name!==tag||!asset)throw Error('Published official manifest is missing.');
 const bytes=await releaseAssetBytes('algomanlife/openfund',asset.id);
 if(!/^sha256:[a-f0-9]{64}$/.test(asset.digest || ''))throw Error('Published manifest has no SHA-256 digest.');
 if(`sha256:${sha256(bytes)}`!==asset.digest)throw Error('Published manifest digest mismatch.');
 source=JSON.parse(bytes.toString('utf8'));
 if(source.commit!==sha || source.tag!==tag || !source.official || source.verification.status!=='passed')throw Error('Published release identity/verification mismatch.');
} else {
 const candidate=await candidateSource(sha);
 // A candidate deploy updates the running commit without announcing the next
 // public version. The planned candidate version remains inside CI artifacts.
 source={version:candidate.latestOfficial.slice(1),commit:sha,official:false,verification:{status:'passed',source:'github-actions',checks:candidate.checks}};
}
validateEnv({...process.env,RELEASE_VERSION:source.version},'production');
await run('npm',['ci','--include=dev','--prefix','apps/web-react']);
await run('npm',['ci','--prefix','apps/backend']);
for(const key of Object.keys(process.env))if(key.startsWith('VITE_'))delete process.env[key];
process.env.RELEASE_VERSION=source.version;
process.env.RELEASE_SOURCE_COMMIT=sha;
await run('npm',['run','build:web']);
const actual=manifest({version:source.version,commit:sha,official:source.official,verification:source.verification});
if(source.official && (actual.frontend.id!==source.frontend.id || actual.backend.id!==source.backend.id || actual.database.migrationVersion!==source.database.migrationVersion))throw Error('Render rebuild differs from the verified official payload.');
console.log(`Render build matches ${source.official?'official release':'gated candidate'} v${source.version} · ${sha}. Runtime deployment still pending.`);
