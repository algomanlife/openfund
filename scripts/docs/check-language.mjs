import fs from 'node:fs'
import { createRequire } from 'node:module'
import { files, upstream } from './files.mjs'
const require = createRequire(new URL('../../apps/web-react/package.json', import.meta.url))
/* TypeScript 7 (the compiler used by `npm run typecheck`) no longer ships the
   stable JavaScript API; this scanner uses the pinned 6.x API alias. */
const ts = require('typescript-js-api')
// Persian/Arabic letters and numerals are preserved inside application strings,
// but cannot appear in first-party documentation or explanatory prose.
const nonEnglish = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u
const problems=[]
function check(file,text,offset=0) {
  const match=nonEnglish.exec(text)
  if (match) {
    const source=fs.readFileSync(file,'utf8')
    const line=source.slice(0,offset+match.index).split('\n').length
    problems.push(`${file}:${line}: translate explanatory text into English`)
  }
}
let prose=0, source=0
for (const file of files) {
  if (file === 'vendor/vela/docs/user/localization.md') {
    // Upstream reference table lists native language names as localization data.
    const text=fs.readFileSync(file,'utf8').replace(/```[\s\S]*?```/g, match => match.replace(/[^\n]/g, ' ')).replace(/^\|[^\n]*\|$/gm, match => match.replace(/[\u0600-\u06ff]+/g, '[native language name]'))
    check(file,text);prose++;continue
  }
  if (/\.(md|mmd)$/i.test(file) || (/\.txt$/i.test(file) && file.startsWith('docs/'))) {
    check(file,fs.readFileSync(file,'utf8'));prose++;continue
  }
  if (file.startsWith('docs/assets/') && /\.svg$/.test(file)) {
    const text=fs.readFileSync(file,'utf8')
    for(const match of text.matchAll(/<(?:text|title|desc)\b[^>]*>([\s\S]*?)<\/(?:text|title|desc)>/g)) check(file,match[1],match.index)
    prose++;continue
  }
  // Original upstream comments, licenses and generated bundles are not rewritten.
  if (upstream(file) || /^(dist|react)\//.test(file) || /\.min\./.test(file)) continue
  if (/\.(?:[cm]?js|tsx?)$/.test(file)) {
    const text=fs.readFileSync(file,'utf8')
    const scanner=ts.createScanner(ts.ScriptTarget.Latest,false,ts.LanguageVariant.Standard,text)
    for(let kind=scanner.scan();kind!==ts.SyntaxKind.EndOfFileToken;kind=scanner.scan()) {
      if ([ts.SyntaxKind.SingleLineCommentTrivia,ts.SyntaxKind.MultiLineCommentTrivia].includes(kind)) check(file,scanner.getTokenText(),scanner.getTokenPos())
    }
    const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true)
    function walk(node) {
      if (ts.isCallExpression(node)) {
        const callee=node.expression
        const name=ts.isIdentifier(callee)?callee.text:ts.isPropertyAccessExpression(callee)?callee.name.text:''
        if (['test','it','describe','R','check','ok'].includes(name)) {
          const arg=node.arguments[0]
          if(arg&&(ts.isStringLiteral(arg)||ts.isNoSubstitutionTemplateLiteral(arg)))check(file,arg.text,arg.getStart(ast))
        }
      }
      ts.forEachChild(node,walk)
    }
    walk(ast);source++
  } else if (/\.(py|sh|css|html|ya?ml)$/.test(file)) {
    const text=fs.readFileSync(file,'utf8')
    const pattern=/\.(py|sh|ya?ml)$/.test(file)?/^\s*#.*$/gm:/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g
    for (const match of text.matchAll(pattern))check(file,match[0],match.index)
    source++
  }
}
if(problems.length){console.error(problems.join('\n'));process.exit(1)}
console.log(`English documentation: ${prose} prose/diagram files and ${source} first-party source files checked; application localization strings preserved.`)
