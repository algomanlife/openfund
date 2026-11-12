import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { run, json, sha256, validateEnv, healthy } from './lib.mjs';
import { verify } from './verify.mjs';
const args=process.argv.slice(2);
let version=args.includes('--version') ? args[args.indexOf('--version')+1] : 'current';
if(version==='current') version=JSON.parse(execFileSync('gh',['release','view','--repo','algomanlife/openfund','--json','tagName'],{encoding:'utf8'})).tagName;
if(!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version || ''))throw Error('Select an official vMAJOR.MINOR.PATCH tag or current.');
console.log(`Resolved official Openfund release: ${version}`);
if (Number(process.versions.node.split('.')[0]) !== 26) throw Error('Official local releases require Node.js 26.');
validateEnv(process.env,'local');
if(process.env.SIM_TEST_MODE)throw Error('Official local releases do not enable test-only execution endpoints.');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),`openfund-${version}-`));
const repo='algomanlife/openfund',archive=`openfund-${version}.tar.gz`;
await run('gh',['release','download',version,'--repo',repo,'--pattern',archive,'--pattern','SHA256SUMS','--pattern','release-manifest.json','--dir',dir]);
const metadata=json(path.join(dir,'release-manifest.json'));
if(!metadata.official || metadata.verification.status!=='passed' || metadata.tag!==version)throw Error('Not an accepted official artifact.');
const remote=execFileSync('git',['ls-remote',`https://github.com/${repo}.git`,`refs/tags/${version}`,`refs/tags/${version}^{}`],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const tag=(remote.find(line=>line.endsWith('^{}')) || remote[0] || '').split(/\s/)[0];
if(tag!==metadata.commit)throw Error('Release tag does not match artifact commit.');
const sums=fs.readFileSync(path.join(dir,'SHA256SUMS'),'utf8').trim();
if(sums!==`${sha256(fs.readFileSync(path.join(dir,archive)))}  ${archive}`)throw Error('Archive checksum mismatch.');
const members=execFileSync('tar',['-tzf',path.join(dir,archive)],{encoding:'utf8'}).trim().split('\n');
if(members.some(f=>f.startsWith('/')||f.split('/').includes('..')))throw Error('Unsafe archive path.');
// Official payloads are generated without symbolic links; reject link entries before extraction.
const listing=execFileSync('tar',['-tvzf',path.join(dir,archive)],{encoding:'utf8'}).split('\n').filter(Boolean);
if(listing.some(line=>!['-','d'].includes(line[0])))throw Error('Release archive contains unsupported links or entries.');
const payload=path.join(dir,'application');fs.mkdirSync(payload);
await run('tar',['-xzf',path.join(dir,archive),'-C',payload]);
const release=verify(payload,{version,commit:metadata.commit});
await run('npm',['ci','--omit=dev','--prefix','apps/backend','--no-audit','--no-fund'],{cwd:payload});
// Migrations are additive, but still require deliberate acknowledgement for the selected local DB.
if(!args.includes('--migrate'))throw Error(`Artifacts verified in ${payload}. Re-run with --migrate to apply additive migrations to your selected local DATABASE_URL and start this exact release.`);
const database=new URL(process.env.DATABASE_URL);
if(!['localhost','127.0.0.1','[::1]'].includes(database.hostname))throw Error('release:local requires a local database.');
await run('npm',['--prefix','apps/backend','run','migrate'],{cwd:payload});
const port=Number(process.env.PORT || 8080),origin=`http://localhost:${port}`;
try{await fetch(origin+'/health',{signal:AbortSignal.timeout(500)});throw Error('Local port is already in use.');}catch(e){if(e.message==='Local port is already in use.')throw e;}
const env={...process.env,NODE_ENV:'development',SIM_TEST_MODE:'',ALLOWED_DOMAINS:`localhost:${port}`,CORS_ORIGINS:origin};
const child=spawn(process.execPath,['apps/backend/server.js'],{cwd:payload,env,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
await healthy(origin+'/health',child);
const actual=await fetch(origin+'/version').then(r=>r.json());
if(actual.status!=='matched'||actual.commit!==release.commit){child.kill();throw Error('Running release identity failed verification.');}
console.log(`Openfund ${version} · ${release.commit}\n${origin}/en/prop/dashboard\nPayload: ${payload}`);
await new Promise(resolve=>child.on('exit',code=>{process.exitCode=code || 0;resolve();}));
