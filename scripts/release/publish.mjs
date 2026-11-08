import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { root,git,json,run,sha256 } from './lib.mjs';
const version=process.env.RELEASE_VERSION,sha=git('rev-parse','HEAD'),tag=`v${version}`,repo=process.env.GITHUB_REPOSITORY;
if(process.env.GITHUB_REF!=='refs/heads/main'||!repo||process.env.GITHUB_SHA!==sha)throw Error('Publish only from the exact main release workflow commit.');
const dir=path.join(root,'output/releases',tag),m=json(path.join(dir,'release-manifest.json'));
if(!m.official||m.commit!==sha||m.verification.status!=='passed'||json(path.join(dir,'verification.json')).status!=='passed')throw Error('Release gates did not pass for this source.');
const archive=`openfund-${tag}.tar.gz`;
if(fs.readFileSync(path.join(dir,'SHA256SUMS'),'utf8').trim()!==`${sha256(fs.readFileSync(path.join(dir,archive)))}  ${archive}`)throw Error('Release archive verification failed.');
const remote=execFileSync('git',['ls-remote','origin',`refs/tags/${tag}`,`refs/tags/${tag}^{}`],{encoding:'utf8'}).trim();
if(remote){
 const lines=remote.split('\n'),target=(lines.find(line=>line.endsWith('^{}'))||lines[0]).split(/\s/)[0];
 if(target!==sha)throw Error('Existing immutable tag points to a different commit.');
}else{
 await run('git',['-c','user.name=Openfund Release','-c','user.email=release@users.noreply.github.com','tag','-a',tag,sha,'-m',`Openfund ${tag} · ${sha}`]);
 await run('git',['push','origin',`refs/tags/${tag}`]);
}
let release;
try{release=JSON.parse(execFileSync('gh',['release','view',tag,'--repo',repo,'--json','isDraft,url'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));}catch{}
if(release && !release.isDraft){console.log(`Release already published; immutable assets preserved: ${release.url}`);process.exit(0);}
if(!release)await run('gh',['release','create',tag,'--repo',repo,'--verify-tag','--draft','--title',`Openfund ${tag}`,'--generate-notes']);
const notesFile=path.join(dir,'release-status.md');
fs.writeFileSync(notesFile,`Source: ${sha}\nVersion: ${tag}\nVerification: passed (see verification.json).\nDeployment: NOT DEPLOYED at publication. The chained deploy job waits for production approval, then verifies the live manifest.\nPerpetual execution remains disabled.\n`);
for(const file of [archive,'SHA256SUMS','release-manifest.json','verification.json','release-status.md'])await run('gh',['release','upload',tag,path.join(dir,file),'--repo',repo,'--clobber']);
await run('gh',['release','edit',tag,'--repo',repo,'--draft=false']);
console.log(`Published ${tag} from ${sha}; deployment not_deployed.`);
