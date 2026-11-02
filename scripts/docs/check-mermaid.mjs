import fs from 'node:fs'
import {JSDOM} from 'jsdom'
const dom=new JSDOM('<!doctype html><html><body></body></html>')
globalThis.window=dom.window
globalThis.document=dom.window.document
const {default:mermaid}=await import('mermaid')
import { files, markdown } from './files.mjs'
mermaid.initialize({startOnLoad:false,securityLevel:'strict'})
let count=0
for(const file of [...markdown,...files.filter(f=>f.endsWith('.mmd')&&!f.startsWith('vendor/'))]) {
 const text=fs.readFileSync(file,'utf8')
 const diagrams=file.endsWith('.mmd')?[text]:[...text.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)].map(m=>m[1])
 for(const diagram of diagrams) {
  try {await mermaid.parse(diagram);count++} catch(error) {console.error(`${file}: ${error.message}`);process.exitCode=1}
 }
}
if(!process.exitCode)console.log(`Mermaid syntax: ${count} diagrams parsed with the pinned Mermaid package.`)
