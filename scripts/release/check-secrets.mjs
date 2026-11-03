import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function exactSecretScan(runs,sha) {
  return runs.find(run=>run.name==='Secret scan' && run.head_sha===sha && run.app?.slug==='github-actions' && run.status==='completed' && run.conclusion==='success');
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const repo=process.env.GITHUB_REPOSITORY,sha=process.env.GITHUB_SHA;
  if(!repo||!/^[a-f0-9]{40}$/.test(sha||''))throw Error('An exact GitHub source commit is required.');
  let verified;
  for(let attempt=0;attempt<60;attempt++) {
    const data=JSON.parse(execFileSync('gh',['api',`repos/${repo}/commits/${sha}/check-runs?per_page=100`],{encoding:'utf8'}));
    verified=exactSecretScan(data.check_runs,sha);
    if(verified)break;
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  if(!verified)throw Error('The required main CI Secret scan has not passed for this exact commit. Publication is blocked.');
  console.log(`Verified required CI Secret scan ${verified.id} for ${sha}: ${verified.html_url}`);
}
