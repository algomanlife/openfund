import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {nextVersion,validateEnv,sha256,writeJson,treeHash,filesIn,root} from '../lib.mjs';
import {verify} from '../verify.mjs';
test('version allocation preserves tags, increments all change categories and handles numeric ordering',()=>{
 assert.equal(nextVersion([]),'0.1.0');
 assert.equal(nextVersion(['v0.1.0'],'fix(wallet): connect'),'0.1.1');
 assert.equal(nextVersion(['v0.1.0'],'feat(journal): reports'),'0.2.0');
 assert.equal(nextVersion(['v0.1.0'],'feat!: changed contract'),'1.0.0');
 assert.equal(nextVersion(['v1.9.0','v1.10.0','invalid'],'docs: update'),'1.10.1');
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
