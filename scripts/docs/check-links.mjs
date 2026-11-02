import fs from 'node:fs'
import path from 'node:path'
import {markdown,files} from './files.mjs'
const root=process.cwd(), problems=[]
let links=0,images=0
const slug=s=>s.toLowerCase().replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N}_\-\s]/gu,'').replace(/ /g,'-')
function anchors(file) {
  const text=fs.readFileSync(file,'utf8').replace(/```[\s\S]*?```/g,'')
  const seen=new Map(), result=new Set()
  for(const match of text.matchAll(/^#{1,6}\s+(.+?)(?:\s+#+)?$/gm)) {
    const base=slug(match[1]), n=seen.get(base)||0
    result.add(n?`${base}-${n}`:base);seen.set(base,n+1)
  }
  for(const match of text.matchAll(/\b(?:id|name)=["']([^"']+)["']/g))result.add(match[1])
  return result
}
function check(file,target,isImage=false) {
  target=target.trim().replace(/^<|>$/g,'').replace(/\\([()])/g,'$1')
  if (!target || /^(?:https?:|mailto:|data:|tel:|plugin:|app:|codex:|\/\/)/i.test(target)) return
  // Application hash routes, not Markdown headings.
  if(target.startsWith('#/'))return
  let [url,fragment]=target.split('#')
  try {url=decodeURIComponent(url.split('?')[0]);fragment=fragment&&decodeURIComponent(fragment)} catch {problems.push(`${file}: malformed link ${target}`);return}
  const absolute=url.startsWith('/')?path.join(root,url.slice(1)):path.resolve(path.dirname(file),url||path.basename(file))
  if(!absolute.startsWith(root+path.sep)&&absolute!==root){problems.push(`${file}: link escapes repository ${target}`);return}
  if(!fs.existsSync(absolute)){problems.push(`${file}: missing ${isImage?'image':'target'} ${target}`);return}
  if(fragment&&/\.md$/i.test(absolute)&&!anchors(absolute).has(fragment))problems.push(`${file}: missing heading ${target}`)
  links++;if(isImage)images++
}
for(const file of markdown) {
  const text=fs.readFileSync(file,'utf8').replace(/```[\s\S]*?```/g,'')
  for(const m of text.matchAll(/(!?)\[[^\]\n]*\]\((<[^>]+>|[^\s)]+)(?:\s+["'][^\n]*?["'])?\)/g))check(file,m[2],m[1]==='!')
  for(const m of text.matchAll(/^\s*\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm))check(file,m[1])
  for(const m of text.matchAll(/<(img|a|source)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/g))check(file,m[2],m[1]!=='a')
}
// Validate image manifests and approved logo fidelity, beyond Markdown references.
const manifest='docs/assets/screenshots/manifest.json'
if(fs.existsSync(manifest)) {
  const data=JSON.parse(fs.readFileSync(manifest,'utf8'))
  for(const item of data.screenshots)check(manifest,item.file,true)
}
for(const name of ['mark.svg','mark-mint.svg','mark-lime.svg']) {
 const target=`docs/assets/brand/${name}`
 if(!fs.existsSync(target)||!fs.readFileSync(target).equals(fs.readFileSync(`brand/logos/${name}`)))problems.push(`${target}: approved logo differs from source`)
}
for(const file of files.filter(f=>f.startsWith('docs/assets/')&&f.endsWith('.svg'))) {
 const content=fs.readFileSync(file,'utf8')
 for(const m of content.matchAll(/\b(?:href|xlink:href)=["']([^"']+)["']/g))if(!m[1].startsWith('#'))check(file,m[1],true)
}
if(problems.length){console.error(problems.join('\n'));process.exit(1)}
console.log(`Documentation links and image paths: ${markdown.length} first-party Markdown files, ${links} local targets (${images} images); approved logos match byte-for-byte. External HTTP references are not availability-probed.`)
