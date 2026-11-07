import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { root, git, run, validateEnv, healthy, json, writeJson, sha256, filesIn, semver, treeHash } from './lib.mjs';
import { manifest } from './manifest.mjs';
import { verify } from './verify.mjs';
import { runtimeCmsUrl } from '../../apps/backend/runtime-config.js';
const candidate = process.argv.includes('--candidate');
if (Number(process.versions.node.split('.')[0]) !== 22) throw Error('Release builds require Node.js 22.');
const version = process.env.RELEASE_VERSION || '0.1.0';
if (!semver.test(version)) throw Error('Set RELEASE_VERSION to MAJOR.MINOR.PATCH.');
validateEnv(process.env);
if (!process.env.CMS_PUBLIC_URL) throw Error('Release candidate requires CMS_PUBLIC_URL for real public CMS acceptance.');
const cmsOrigin = runtimeCmsUrl(process.env);
for (const route of [
  '/server/health',
  '/items/ui_messages?fields=key,namespace,translations.language_code,translations.value&filter[status][_eq]=published&limit=1',
  '/items/home_content?fields=status,translations.language_code,translations.headline',
]) {
  const response = await fetch(new URL(route, cmsOrigin), {signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw Error(`CMS release preflight failed: ${route.split('?')[0]} returned ${response.status}.`);
  if (route.startsWith('/items/')) {
    const data = (await response.json()).data;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.translations?.some(t => t.language_code === 'fa') || !row.translations.some(t => t.language_code === 'en'))
      throw Error(`CMS release preflight failed: ${route.split('?')[0]} lacks visible fa/en rows.`);
  }
}
const commit = git('rev-parse','HEAD');
if (!candidate) {
  if (git('status','--porcelain','--untracked-files=normal')) throw Error('Official builds require a clean checkout. Use --candidate for an explicitly unofficial preview.');
  if (!process.env.GITHUB_ACTIONS || process.env.GITHUB_REF !== 'refs/heads/main' || process.env.GITHUB_SHA !== commit) throw Error('Official releases are built by the main-branch GitHub release workflow only.');
}
const port = Number(process.env.RELEASE_TEST_PORT || 8288);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid RELEASE_TEST_PORT.');
const base = `http://localhost:${port}`;
try { await fetch(base+'/health',{signal:AbortSignal.timeout(500)}); throw Error('Release test port is already occupied.'); } catch(e) { if(e.message==='Release test port is already occupied.') throw e; }
const env = {...process.env,RELEASE_VERSION:version,RELEASE_SOURCE_COMMIT:commit,NODE_ENV:'test',SIM_TEST_MODE:'1',PORT:String(port),ALLOWED_DOMAINS:`localhost:5173,localhost:${port}`,CORS_ORIGINS:`http://localhost:5173,http://localhost:${port}`,TEST_BACKEND_URL:base,TEST_FRONTEND_URL:base+'/react',
  /* candidate-gate-only values (SIM_TEST_MODE test server, never production):
     the admin suite needs a token; the purchase suite needs a test receiver;
     the strict CSP must allow the local Directus origin the test frontend
     fetches (intercepted by the browser gates) */
  ADMIN_API_TOKEN: process.env.ADMIN_API_TOKEN || 'release-candidate-admin-token',
  PURCHASE_PAYMENT_RECEIVER: process.env.PURCHASE_PAYMENT_RECEIVER || '0x000000000000000000000000000000000000c1a1',
  CSP_EXTRA_CONNECT: process.env.CSP_EXTRA_CONNECT || 'http://localhost:8055',
  // Keep the visual matrix deterministic while live market access is checked separately.
  POLISH_CHART_FIXTURE: '1'};
// Public deployment choices are supplied by /react/runtime-config.js. The
// signed frontend must never vary with the build machine's VITE_* variables.
for (const key of Object.keys(env)) if (key.startsWith('VITE_')) delete env[key];
// Official frontend/API stay same-origin; inherited private development env files are forbidden.
for (const f of ['.env','.env.local','.env.production','.env.production.local']) if(fs.existsSync(path.join(root,'apps/web-react',f))) throw Error(`Remove local build overrides from the release checkout: apps/web-react/${f}`);
if (process.env.VITE_BACKEND_URL) throw Error('Official/candidate packages must use the same-origin backend, not VITE_BACKEND_URL.');
const output=path.join(root,'output/releases',`v${version}`), stages=[];
if(fs.existsSync(output)){
  const previous=path.join(root,'output/release-attempts',`v${version}-${Date.now()}`);
  fs.mkdirSync(path.dirname(previous),{recursive:true});fs.renameSync(output,previous);
}
fs.mkdirSync(output,{recursive:true});
let server;
const gate = async (name,command,args=[], overrides={}) => {
  const startedAt=new Date().toISOString();
  try { await run(command,args,{env:{...env,...overrides}}); stages.push({name,status:'passed',startedAt,finishedAt:new Date().toISOString()}); }
  catch(error){stages.push({name,status:'failed',startedAt});throw error;}
};
try {
  await gate('root-lockfile-install','npm',['ci','--include=dev','--no-audit','--no-fund']);
  await gate('web-lockfile-install','npm',['ci','--include=dev','--prefix','apps/web-react','--no-audit','--no-fund']);
  await gate('backend-lockfile-install','npm',['ci','--include=dev','--prefix','apps/backend','--no-audit','--no-fund']);
  for(const task of ['validate:blueprint','docs:check','typecheck','test:web','test:charts','test:release']) await gate(task,'npm',['run',task]);
  await gate('frontend-production-build','npm',['run','build:web'],{NODE_ENV:'production'});
  const frontendHash=treeHash(path.join(root,'react'));
  await gate('frontend-reproducibility-build','npm',['run','build:web'],{NODE_ENV:'production'});
  if(treeHash(path.join(root,'react'))!==frontendHash) throw Error('Repeated frontend build content differs.');
  manifest({version,commit,official:!candidate,verification:{status:'in_progress',stages}});
  for (const task of ['migrate','migrate','seed-plans']) await gate(task,'npm',['--prefix','apps/backend','run',task]);
  server=spawn(process.execPath,['apps/backend/server.js'],{cwd:root,env,stdio:['ignore',fs.openSync(path.join(output,'backend-test.log'),'w'),'inherit']});
  server.on('error',error=>console.error(error.message));
  await healthy(base+'/health',server);
  for(const task of ['test:backend','test:browser:audit','test:browser:completion','test:browser:layout','test:browser:charts','test:browser:polish','test:browser:website','test:browser:release','test:browser:routes','test:browser:challenge']) await gate(task,'npm',['run',task]);
  // A second run explicitly covers the authenticated geometry matrix.
  await run('npm',['run','test:browser:layout'],{env:{...env,TEST_LAYOUT_AUTH:'1'}});
  stages.push({name:'authenticated-layout',status:'passed'});
  const verification={status:'passed',source:process.env.GITHUB_ACTIONS?'github-actions':'local-candidate',runUrl:process.env.GITHUB_RUN_ID?`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:null,stages};
  const m=manifest({version,commit,official:!candidate,verification});
  const payload=path.join(output,'payload');
  fs.rmSync(payload,{recursive:true,force:true});fs.mkdirSync(payload,{recursive:true});
  // Preserve the exact application layout. Only tracked backend/third-party sources enter the payload.
  for(const file of git('ls-files','apps/backend','third_party/luxalgo-trade-journal','LICENSE','NOTICE','render.yaml').split('\n').filter(Boolean)) {
    if(/(?:^|\/)(?:\.env(?:\.|$)|node_modules\/)/.test(file))throw Error('Unsafe payload path.');
    const target=path.join(payload,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);
  }
  fs.cpSync(path.join(root,'react'),path.join(payload,'react'),{recursive:true});
  fs.copyFileSync(path.join(root,'release-manifest.json'),path.join(payload,'release-manifest.json'));
  fs.copyFileSync(path.join(root,'CHANGELOG.md'),path.join(payload,'CHANGELOG.md'));
  const sums=Object.fromEntries(filesIn(payload).map(file=>[file,sha256(fs.readFileSync(path.join(payload,file)))]));
  writeJson(path.join(payload,'file-checksums.json'),sums);verify(payload,{version:`v${version}`,commit});
  writeJson(path.join(output,'verification.json'),verification);
  fs.copyFileSync(path.join(root,'release-manifest.json'),path.join(output,'release-manifest.json'));
  const archive=`openfund-v${version}.tar.gz`;
  await run('tar',['-czf',path.join(output,archive),'-C',payload,'.']);
  fs.writeFileSync(path.join(output,'SHA256SUMS'),`${sha256(fs.readFileSync(path.join(output,archive)))}  ${archive}\n`);
  console.log(`Packaged ${m.official?'official release':'UNOFFICIAL CANDIDATE'} v${version} from ${commit}. Deployment: not_deployed. Output: ${output}`);
} catch(error){writeJson(path.join(output,'verification.json'),{status:'failed',stages,error:error.message});throw error;}
finally {server?.kill('SIGTERM');}
