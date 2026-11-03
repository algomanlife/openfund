import fs from 'node:fs';
import { git, nextVersion } from './lib.mjs';
const sha=git('rev-parse','HEAD');
const tags=git('tag','--merged',sha,'--list','v*').split('\n').filter(t=>/^v\d+\.\d+\.\d+$/.test(t));
const exact=git('tag','--points-at',sha).split('\n').find(t=>/^v\d+\.\d+\.\d+$/.test(t));
const latest=tags.sort((a,b)=>a.localeCompare(b,'en',{numeric:true})).at(-1);
const version=exact?.slice(1) || nextVersion(tags,git('log','--format=%B',latest?`${latest}..${sha}`:sha));
if(process.env.GITHUB_ENV)fs.appendFileSync(process.env.GITHUB_ENV,`RELEASE_VERSION=${version}\n`);
console.log(version);
