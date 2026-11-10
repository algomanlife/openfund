import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {nextVersion,requestedPatchVersion,validateEnv,sha256,writeJson,treeHash,filesIn,root} from '../lib.mjs';
import {verify} from '../verify.mjs';
import {exactSecretScan} from '../check-secrets.mjs';
import {runtimeCmsUrl,runtimeConfigScript,depayWidgetApproved} from '../../../apps/backend/runtime-config.js';
test('runtime CMS origin stays outside the immutable frontend and rejects unsafe production URLs',()=>{
 assert.equal(runtimeCmsUrl({CMS_PUBLIC_URL:'https://cms.openfi.cloud'},true),'https://cms.openfi.cloud');
 assert.equal(runtimeCmsUrl({VITE_DIRECTUS_HOST:'openfund-cms.onrender.com'},true),'https://openfund-cms.onrender.com');
 for(const raw of ['', 'http://localhost:8055', 'https://user:pass@cms.openfi.cloud', 'https://cms.openfi.cloud/path'])
  assert.throws(()=>runtimeCmsUrl({CMS_PUBLIC_URL:raw},true));
 const script=runtimeConfigScript({CMS_PUBLIC_URL:'https://cms.openfi.cloud',VITE_WALLETCONNECT_PROJECT_ID:'public-id'},true);
 assert.match(script,/cms\.openfi\.cloud/);
 assert.match(script,/public-id/);
 assert.doesNotMatch(script,/localhost/);
});
test('the external payment widget is enabled only with an https URL and a Subresource Integrity hash',()=>{
 const hash='sha384-'+'A'.repeat(64);
 const base={VITE_DEPAY_WIDGET:'1',VITE_DEPAY_WIDGET_URL:'https://integrate.depay.com/widgets/v13.js',VITE_DEPAY_WIDGET_INTEGRITY:hash};
 assert.equal(depayWidgetApproved(base),true);
 for(const over of [{VITE_DEPAY_WIDGET:'0'},{VITE_DEPAY_WIDGET_URL:'http://integrate.depay.com/w.js'},{VITE_DEPAY_WIDGET_URL:''},{VITE_DEPAY_WIDGET_INTEGRITY:''},{VITE_DEPAY_WIDGET_INTEGRITY:'md5-abc'},{VITE_DEPAY_WIDGET_URL:'https://u:p@integrate.depay.com/w.js'}])
  assert.equal(depayWidgetApproved({...base,...over}),false);
 const script=runtimeConfigScript({CMS_PUBLIC_URL:'https://cms.openfi.cloud',...base},true);
 assert.match(script,/depayWidgetIntegrity/);
 const off=runtimeConfigScript({CMS_PUBLIC_URL:'https://cms.openfi.cloud',VITE_DEPAY_WIDGET:'1',VITE_DEPAY_WIDGET_URL:base.VITE_DEPAY_WIDGET_URL},true);
 assert.doesNotMatch(off,/integrate\.depay\.com/);
});
test('version allocation preserves tags, increments all change categories and handles numeric ordering',()=>{
 assert.equal(nextVersion([]),'0.1.0');
 assert.equal(nextVersion(['v0.1.0'],'fix(wallet): connect'),'0.1.1');
 assert.equal(nextVersion(['v0.1.0'],'feat(journal): reports'),'0.2.0');
 assert.equal(nextVersion(['v0.1.0'],'feat!: changed contract'),'1.0.0');
 assert.equal(nextVersion(['v1.9.0','v1.10.0','invalid'],'docs: update'),'1.10.1');
});
test('explicit patch release cannot skip, reuse or change the release line',()=>{
 assert.equal(requestedPatchVersion('v0.4.3','0.4.4'),'0.4.4');
 for(const value of ['0.4.3','0.4.5','0.5.0','1.0.0'])assert.throws(()=>requestedPatchVersion('v0.4.3',value));
});
test('release tests reject missing, shared and remote databases',()=>{
 for(const url of [undefined,'postgres://localhost/openfund_dev','postgres://db.example/openfund_ci'])assert.throws(()=>validateEnv({DATABASE_URL:url}));
 validateEnv({DATABASE_URL:'postgresql://localhost/openfund_release_ci'});
 assert.throws(()=>validateEnv({DATABASE_URL:'postgres://localhost/openfund',ALLOWED_DOMAINS:'example',SIM_TEST_MODE:'1'},'production'));
});
test('payload verification rejects financial/runtime source tampering and version mismatches',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'openfund-release-test-'));
 try{
 fs.mkdirSync(path.join(dir,'react'));fs.writeFileSync(path.join(dir,'react/index.html'),'<html>actual bundle</html>');fs.mkdirSync(path.join(dir,'apps'));fs.writeFileSync(path.join(dir,'apps/backend.js'),'original');
 const m={tag:'v0.1.0',commit:'a'.repeat(40),frontend:{id:treeHash(path.join(dir,'react'))}};
 writeJson(path.join(dir,'release-manifest.json'),m);writeJson(path.join(dir,'react/release-manifest.json'),m);
 writeJson(path.join(dir,'file-checksums.json'),Object.fromEntries(filesIn(dir).map(f=>[f,sha256(fs.readFileSync(path.join(dir,f)))])));
 assert.equal(verify(dir,{version:'v0.1.0',commit:'a'.repeat(40)}).tag,'v0.1.0');
 assert.throws(()=>verify(dir,{version:'v0.1.1'}),/identity/);
 fs.writeFileSync(path.join(dir,'apps/backend.js'),'tampered');assert.throws(()=>verify(dir),/checksum/);
 fs.writeFileSync(path.join(dir,'react/index.html'),'stale');assert.throws(()=>verify(dir),/Frontend/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('publication refuses feature branches and unverified artifacts before creating tags',()=>{
 assert.throws(()=>execFileSync(process.execPath,['scripts/release/publish.mjs'],{cwd:root,env:{...process.env,GITHUB_REF:'refs/heads/feature'},stdio:'pipe'}));
});

test('manual publication requires the successful trusted CI secret check on the exact source commit',()=>{
 const sha='a'.repeat(40),scan={id:42,name:'Secret scan',head_sha:sha,app:{slug:'github-actions'},status:'completed',conclusion:'success'};
 assert.equal(exactSecretScan([scan],sha).id,42);
 for(const altered of [{...scan,head_sha:'b'.repeat(40)},{...scan,conclusion:'failure'},{...scan,status:'in_progress'},{...scan,app:{slug:'untrusted'}},{...scan,name:'Other scan'}])assert.equal(exactSecretScan([altered],sha),undefined);
 assert.equal(exactSecretScan([],sha),undefined);
});

test('release assets download through the API endpoint with bounded retries', async () => {
  const { releaseAssetBytes } = await import('../lib.mjs');
  const calls = [];
  const flaky = async (url, init) => {
    calls.push({ url, accept: init.headers.Accept });
    return calls.length < 3 ? new Response('gateway', { status: 504 }) : new Response('{"ok":true}', { status: 200 });
  };
  const bytes = await releaseAssetBytes('o/r', 42, { fetchImpl: flaky, delayMs: 1 });
  assert.equal(bytes.toString(), '{"ok":true}');
  assert.equal(calls.length, 3, 'two 504 responses are retried');
  assert.equal(calls[0].url, 'https://api.github.com/repos/o/r/releases/assets/42');
  assert.equal(calls[0].accept, 'application/octet-stream');
  let notFound = 0;
  await assert.rejects(releaseAssetBytes('o/r', 1, { fetchImpl: async () => { notFound++; return new Response('', { status: 404 }); }, delayMs: 1 }), /404/);
  assert.equal(notFound, 1, 'a 404 is not retried');
  await assert.rejects(releaseAssetBytes('o/r', 1, { attempts: 2, fetchImpl: async () => new Response('', { status: 504 }), delayMs: 1 }), /Cannot read release asset 1/);
});
