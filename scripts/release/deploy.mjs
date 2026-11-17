import { execFileSync } from 'node:child_process';
import { writeJson,releaseAssetBytes } from './lib.mjs';
import { autoDeployOff, webMatches, backstageMatches, backstageVerified } from './deploy-checks.mjs';
const tag=process.argv[2],repo=process.env.GITHUB_REPOSITORY || 'algomanlife/openfund';
const report='output/deployment-status.json';
let state={tag,status:'not_deployed',startedAt:new Date().toISOString()};
try {
 if(process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_ENVIRONMENT!=='production')throw Error('Deployment requires the main workflow and production approval environment.');
 const policy=JSON.parse(execFileSync('gh',['api',`repos/${repo}/environments/production`],{encoding:'utf8'}));
 if(!policy.protection_rules?.some(r=>r.type==='required_reviewers'&&r.reviewers?.length))throw Error('Production has no required reviewer. Configure approval before deploying.');
 if(!/^v\d+\.\d+\.\d+$/.test(tag || ''))throw Error('Select an exact official release tag.');
 /* one release, one commit on every Render service: Web/API and Backstage */
 for(const key of ['RENDER_API_TOKEN','RENDER_SERVICE_ID','RELEASE_PUBLIC_URL','RENDER_BACKSTAGE_SERVICE_ID','RELEASE_BACKSTAGE_URL'])if(!process.env[key])throw Error(`Configure ${key} in the production environment.`);
 const backstageUrl=new URL(process.env.RELEASE_BACKSTAGE_URL);
 if(backstageUrl.protocol!=='https:')throw Error('Backstage diagnostics require HTTPS.');
 const publicUrl=new URL(process.env.RELEASE_PUBLIC_URL);
 if(publicUrl.protocol!=='https:')throw Error('Production diagnostics require HTTPS.');
 const metadata=JSON.parse(execFileSync('gh',['release','view',tag,'--repo',repo,'--json','isDraft,isPrerelease,assets'],{encoding:'utf8'}));
 if(metadata.isDraft)throw Error('Cannot deploy a draft release.');
 if(metadata.isPrerelease)throw Error('Cannot deploy a prerelease.');
 // A delayed run must never replace a newer production release; going back
 // to an older release is an explicit rollback decision.
 const latest=JSON.parse(execFileSync('gh',['release','view','--repo',repo,'--json','tagName'],{encoding:'utf8'})).tagName;
 if(tag!==latest&&process.env.RELEASE_ROLLBACK!=='true')throw Error(`${tag} is not the latest release (${latest}); dispatch with rollback=true to roll back.`);
 const apiRelease=JSON.parse(execFileSync('gh',['api',`repos/${repo}/releases/tags/${tag}`],{encoding:'utf8'}));
 const asset=apiRelease.assets.find(a=>a.name==='release-manifest.json');
 if(!asset)throw Error('Release manifest missing.');
 const source=JSON.parse((await releaseAssetBytes(repo,asset.id)).toString('utf8'));
 if(source.tag!==tag||!source.official||source.verification.status!=='passed')throw Error('Release identity or gates invalid.');
 const headers={Authorization:`Bearer ${process.env.RENDER_API_TOKEN}`,'Content-Type':'application/json'};
 const endpoint=`https://api.render.com/v1/services/${encodeURIComponent(process.env.RENDER_SERVICE_ID)}`;
 const serviceResponse=await fetch(endpoint,{headers,signal:AbortSignal.timeout(15000)});
 if(!serviceResponse.ok)throw Error(`Render service lookup failed (${serviceResponse.status}).`);
 const service=await serviceResponse.json();
 const backstageEndpoint=`https://api.render.com/v1/services/${encodeURIComponent(process.env.RENDER_BACKSTAGE_SERVICE_ID)}`;
 const backstageResponse=await fetch(backstageEndpoint,{headers,signal:AbortSignal.timeout(15000)});
 if(!backstageResponse.ok)throw Error(`Render Backstage service lookup failed (${backstageResponse.status}).`);
 const backstageService=await backstageResponse.json();
 /* both checked before either deploys: a service that deploys itself on push
    (cd057fa, 2026-11-17) splits the platform across commits */
 if(!autoDeployOff(service))throw Error('Disable live Render auto-deploy on the Web/API service before using approved releases.');
 if(!autoDeployOff(backstageService))throw Error('Disable live Render auto-deploy on the Backstage service before using approved releases.');
 const backstageHealth=()=>fetch(new URL('/health',backstageUrl),{cache:'no-store',signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('Backstage health unavailable');return r.json()});
 /* deploy one Render service at the release commit and wait until it is live */
 const deployService=async(serviceEndpoint,label)=>{
  const response=await fetch(serviceEndpoint+'/deploys',{method:'POST',headers,body:JSON.stringify({commitId:source.commit,clearCache:'clear'}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`Render ${label} deploy request failed (${response.status}).`);
  const deployment=await response.json();
  for(let i=0;i<120;i++){
   const r=await fetch(serviceEndpoint+'/deploys/'+encodeURIComponent(deployment.id),{headers,signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error(`Render ${label} deployment lookup failed (${r.status}).`);
   const data=await r.json();
   if(data.status==='live')return deployment.id;
   if(['build_failed','update_failed','canceled','pre_deploy_failed','deactivated'].includes(data.status))throw Error(`Render ${label} deploy ended: ${data.status}`);
   await new Promise(res=>setTimeout(res,10000));
  }
  throw Error(`Render ${label} deploy polling timed out.`);
 };
 const liveIdentity=()=>Promise.all([fetch(new URL('/version',publicUrl),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Backend identity unavailable');return r.json()}),fetch(new URL('/react/release-manifest.json',publicUrl),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Frontend identity unavailable');return r.json()})]);
 const matches=identity=>webMatches(source,identity);
 // Idempotent retry: production already serves exactly this release.
 const current=await liveIdentity().catch(()=>null);
 const alreadyLive=!!current&&matches(current);
 if(alreadyLive){state={...state,commit:source.commit,status:'verifying',deployId:'none (already live)'};}
 else {
 state={...state,commit:source.commit,status:'deploying'};writeJson(report,state);
 state.deployId=await deployService(endpoint,'Web/API');writeJson(report,state);
 }
 // Render may report the new instance live before the public CDN serves its
 // updated frontend assets. Allow the exact release identity to converge.
 let verified=false;
 for(let i=0;i<30;i++){
  try{if(matches(await liveIdentity())){verified=true;break;}}catch{/* retry transient public reads */}
  if(i<29)await new Promise(resolve=>setTimeout(resolve,5000));
 }
 if(!verified)throw Error('Live frontend/backend do not match the selected release.');
 /* Backstage at the same commit (after the Web/API it reads from) */
 state={...state,commit:source.commit,status:'deploying',backstage:'deploying'};writeJson(report,state);
 let renderConfirmed=null;
 if(!backstageMatches(source,await backstageHealth().catch(()=>null))){state.backstageDeployId=await deployService(backstageEndpoint,'Backstage');renderConfirmed=source.commit;writeJson(report,state);}
 let backstageOk=false;
 for(let i=0;i<30;i++){
  try{if(backstageVerified(source,await backstageHealth(),renderConfirmed)){backstageOk=true;break;}}catch{/* retry */}
  if(i<29)await new Promise(resolve=>setTimeout(resolve,5000));
 }
 if(!backstageOk)throw Error('Backstage does not run the selected release commit.');
 state.backstage='verified';
 // CMS is an independent service. An app deploy cannot certify the whole platform without its health evidence.
 if(!process.env.RELEASE_CMS_URL)throw Error('Application identity verified; RELEASE_CMS_URL is required for full platform deployment acceptance.');
 if(!(await fetch(new URL('/server/health',process.env.RELEASE_CMS_URL),{signal:AbortSignal.timeout(15000)})).ok)throw Error('CMS health check failed.');
 state={...state,status:'deployed',finishedAt:new Date().toISOString(),url:publicUrl.origin,cms:'healthy',scope:'API/frontend exact manifest and Backstage at the same commit; existing CMS image and additive migration startup'};
} catch(error){state={...state,status:state.status==='deploying'?'failed_or_partial':'blocked',error:error.message};process.exitCode=1;}
writeJson(report,state);console.log(JSON.stringify(state,null,2));
