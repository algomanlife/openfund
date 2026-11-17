import { run,git,validateEnv } from './lib.mjs';
import { manifest } from './manifest.mjs';
import { renderSource } from './render-source.mjs';
// Render accepts a published official tag, or the fully gated current main candidate.
const sha=process.env.RENDER_GIT_COMMIT;
if(!/^[a-f0-9]{40}$/.test(sha || '')||git('rev-parse','HEAD')!==sha)throw Error('Render source SHA is missing or mismatched.');
const source=await renderSource(sha);
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
