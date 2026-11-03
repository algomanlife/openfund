import { execFileSync } from 'node:child_process';
import { writeJson } from './lib.mjs';
const tag=process.argv[2],repo=process.env.GITHUB_REPOSITORY || 'algomanlife/openfund';
const report='output/deployment-status.json';
let state={tag,status:'not_deployed',startedAt:new Date().toISOString()};
try {
 if(process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_ENVIRONMENT!=='production')throw Error('Deployment requires the main workflow and production approval environment.');
 const policy=JSON.parse(execFileSync('gh',['api',`repos/${repo}/environments/production`],{encoding:'utf8'}));
 if(!policy.protection_rules?.some(r=>r.type==='required_reviewers'&&r.reviewers?.length))throw Error('Production has no required reviewer. Configure approval before deploying.');
 if(!/^v\d+\.\d+\.\d+$/.test(tag || ''))throw Error('Select an exact official release tag.');
 for(const key of ['RENDER_API_TOKEN','RENDER_SERVICE_ID','RELEASE_PUBLIC_URL'])if(!process.env[key])throw Error(`Configure ${key} in the production environment.`);
 const publicUrl=new URL(process.env.RELEASE_PUBLIC_URL);
 if(publicUrl.protocol!=='https:')throw Error('Production diagnostics require HTTPS.');
 const metadata=JSON.parse(execFileSync('gh',['release','view',tag,'--repo',repo,'--json','isDraft,assets'],{encoding:'utf8'}));
 if(metadata.isDraft)throw Error('Cannot deploy a draft release.');
 const asset=metadata.assets.find(a=>a.name==='release-manifest.json');
 if(!asset)throw Error('Release manifest missing.');
 const source=await fetch(asset.url,{signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('Release manifest unavailable');return r.json()});
 if(source.tag!==tag||!source.official||source.verification.status!=='passed')throw Error('Release identity or gates invalid.');
 const headers={Authorization:`Bearer ${process.env.RENDER_API_TOKEN}`,'Content-Type':'application/json'};
 const endpoint=`https://api.render.com/v1/services/${encodeURIComponent(process.env.RENDER_SERVICE_ID)}`;
 const serviceResponse=await fetch(endpoint,{headers,signal:AbortSignal.timeout(15000)});
 if(!serviceResponse.ok)throw Error(`Render service lookup failed (${serviceResponse.status}).`);
 const service=await serviceResponse.json();
 if(service.autoDeploy!=='no' && service.autoDeployTrigger!=='off')throw Error('Disable live Render auto-deploy before using approved releases.');
 state={...state,commit:source.commit,status:'deploying'};writeJson(report,state);
 const response=await fetch(endpoint+'/deploys',{method:'POST',headers,body:JSON.stringify({commitId:source.commit,clearCache:'clear'}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`Render deploy request failed (${response.status}).`);
 const deployment=await response.json();state.deployId=deployment.id;writeJson(report,state);
 let live=false;
 for(let i=0;i<120;i++){
  const response=await fetch(endpoint+'/deploys/'+encodeURIComponent(deployment.id),{headers,signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`Render deployment lookup failed (${response.status}).`);
  const data=await response.json();
  if(data.status==='live'){live=true;break;}
  if(['build_failed','update_failed','canceled','pre_deploy_failed','deactivated'].includes(data.status))throw Error(`Render deploy ended: ${data.status}`);
  await new Promise(resolve=>setTimeout(resolve,10000));
 }
 if(!live)throw Error('Render deploy polling timed out.');
 const [backend,frontend]=await Promise.all([fetch(new URL('/version',publicUrl),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Backend identity unavailable');return r.json()}),fetch(new URL('/react/release-manifest.json',publicUrl),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Frontend identity unavailable');return r.json()})]);
 if(backend.status!=='matched'||backend.commit!==source.commit||frontend.commit!==source.commit||frontend.version!==source.version||frontend.frontend.id!==source.frontend.id||backend.backend?.id!==source.backend.id)throw Error('Live frontend/backend do not match the selected release.');
 // CMS is an independent service. An app deploy cannot certify the whole platform without its health evidence.
 if(!process.env.RELEASE_CMS_URL)throw Error('Application identity verified; RELEASE_CMS_URL is required for full platform deployment acceptance.');
 if(!(await fetch(new URL('/server/health',process.env.RELEASE_CMS_URL),{signal:AbortSignal.timeout(15000)})).ok)throw Error('CMS health check failed.');
 state={...state,status:'deployed',finishedAt:new Date().toISOString(),url:publicUrl.origin,cms:'healthy',scope:'API/frontend exact manifest; existing CMS image and additive migration startup'};
} catch(error){state={...state,status:state.status==='deploying'?'failed_or_partial':'blocked',error:error.message};process.exitCode=1;}
writeJson(report,state);console.log(JSON.stringify(state,null,2));
