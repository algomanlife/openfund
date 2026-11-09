import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { candidateSource } from './candidate-source.mjs';
import { sha256, writeJson } from './lib.mjs';
import { verify } from './verify.mjs';

const repo=process.env.GITHUB_REPOSITORY || 'algomanlife/openfund';
const sha=process.env.GITHUB_SHA;
const report='output/deployment-status.json';
let state={status:'not_deployed',commit:sha,official:false,startedAt:new Date().toISOString()};
const gh=(...args)=>execFileSync('gh',args,{encoding:'utf8'}).trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
  if(process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_ENVIRONMENT!=='production')throw Error('Candidate deployment requires main and the protected production environment.');
  const policy=JSON.parse(gh('api',`repos/${repo}/environments/production`));
  if(!policy.protection_rules?.some(rule=>rule.type==='required_reviewers'&&rule.reviewers?.length))throw Error('Production reviewer protection is missing.');
  for(const key of ['RENDER_API_TOKEN','RENDER_SERVICE_ID','RELEASE_PUBLIC_URL','RELEASE_CMS_URL'])if(!process.env[key])throw Error(`Configure ${key} in the production environment.`);
  const candidate=await candidateSource(sha);
  const runs=JSON.parse(gh('run','list','--repo',repo,'--workflow','Unified release','--branch','main','--commit',sha,'--limit','20','--json','databaseId,status,conclusion,headSha'));
  const run=runs.find(run=>run.headSha===sha&&run.status==='completed'&&run.conclusion==='success');
  if(!run)throw Error('The exact main commit has no successful unified candidate package run.');
  const dir=path.resolve('output/candidate-deploy');fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
  gh('run','download',String(run.databaseId),'--repo',repo,'--name','official-release-candidate','--dir',dir);
  const releaseDir=path.join(dir,`v${candidate.version}`);
  const archive=`openfund-v${candidate.version}.tar.gz`;
  const source=JSON.parse(fs.readFileSync(path.join(releaseDir,'release-manifest.json'),'utf8'));
  if(source.commit!==sha||source.version!==candidate.version||source.official!==false||source.verification?.status!=='passed')throw Error('Candidate package identity or verification is invalid.');
  const sums=fs.readFileSync(path.join(releaseDir,'SHA256SUMS'),'utf8').trim();
  if(sums!==`${sha256(fs.readFileSync(path.join(releaseDir,archive)))}  ${archive}`)throw Error('Candidate archive digest mismatch.');
  const payload=path.join(dir,'payload');fs.mkdirSync(payload,{recursive:true});
  execFileSync('tar',['-xzf',path.join(releaseDir,archive),'-C',payload]);
  verify(payload,{version:`v${candidate.version}`,commit:sha});
  const headers={Authorization:`Bearer ${process.env.RENDER_API_TOKEN}`,'Content-Type':'application/json'};
  const endpoint=`https://api.render.com/v1/services/${encodeURIComponent(process.env.RENDER_SERVICE_ID)}`;
  const serviceResponse=await fetch(endpoint,{headers,signal:AbortSignal.timeout(15000)});
  if(!serviceResponse.ok)throw Error(`Render service lookup failed (${serviceResponse.status}).`);
  const service=await serviceResponse.json();
  if(service.autoDeploy!=='no'&&service.autoDeployTrigger!=='off')throw Error('Disable Render auto-deploy before candidate deployment.');
  const origin=new URL(process.env.RELEASE_PUBLIC_URL);
  if(origin.protocol!=='https:')throw Error('Public diagnostics require HTTPS.');
  const identities=()=>Promise.all([
    fetch(new URL('/version',origin),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Backend identity unavailable.');return r.json()}),
    fetch(new URL('/react/release-manifest.json',origin),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Frontend identity unavailable.');return r.json()}),
  ]);
  const matches=([back,front])=>back.status==='matched'&&back.commit===sha&&front.commit===sha&&front.version===candidate.version&&front.official===false&&front.frontend.id===source.frontend.id&&back.backend?.id===source.backend.id;
  state={...state,status:'deploying',version:candidate.version,packageRun:run.databaseId};writeJson(report,state);
  let already=false;try{already=matches(await identities());}catch{/* deploy exact candidate */}
  if(!already){
    const response=await fetch(endpoint+'/deploys',{method:'POST',headers,body:JSON.stringify({commitId:sha,clearCache:'clear'}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error(`Render deploy request failed (${response.status}).`);
    const deployment=await response.json();state.deployId=deployment.id;writeJson(report,state);
    let live=false;
    for(let i=0;i<120;i++){
      const response=await fetch(endpoint+'/deploys/'+encodeURIComponent(deployment.id),{headers,signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error(`Render deployment lookup failed (${response.status}).`);
      const data=await response.json();
      if(data.status==='live'){live=true;break;}
      if(['build_failed','update_failed','canceled','pre_deploy_failed','deactivated'].includes(data.status))throw Error(`Render deploy ended: ${data.status}`);
      await sleep(10000);
    }
    if(!live)throw Error('Render deploy polling timed out.');
  }
  let verified=false;
  for(let i=0;i<30;i++){try{if(matches(await identities())){verified=true;break;}}catch{/* retry transient public reads */}if(i<29)await sleep(5000);}
  if(!verified)throw Error('Live frontend/backend differ from the verified candidate package.');
  if(!(await fetch(new URL('/server/health',process.env.RELEASE_CMS_URL),{signal:AbortSignal.timeout(15000)})).ok)throw Error('CMS health check failed.');
  state={...state,status:'deployed',finishedAt:new Date().toISOString(),url:origin.origin,cms:'healthy'};
}catch(error){state={...state,status:state.status==='deploying'?'failed_or_partial':'blocked',error:error.message};process.exitCode=1;}
writeJson(report,state);console.log(JSON.stringify(state,null,2));
