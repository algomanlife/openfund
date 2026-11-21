/* Dependency-free helpers shared by the documentation gates
   (check-readme, check-retired, check-fonts). Node built-ins only, so the
   gates run before `npm ci` and in any checkout. */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

export const root = process.env.DOCS_ROOT || process.cwd()

/** Tracked files plus untracked, non-ignored files (same set as files.mjs). */
export function repoFiles() {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
  return [...new Set(out.split('\0'))].filter(f => f && fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).isFile())
}

/** Upstream or vendored code: preserved verbatim, never rewritten by our gates. */
export const upstream = f => /^(vendor|third_party|packages\/openfund-protocol)\//.test(f) ||
  /^apps\/web-react\/public\/assets\/vendor\//.test(f) || /\.min\.js$/.test(f) || /(^|\/)package-lock\.json$/.test(f) || /(^|\/)node_modules\//.test(f)

export const TEXT_EXT = /\.(css|scss|html?|m?js|cjs|jsx|tsx?|json|md|ya?ml|svg|txt|py|sh|toml|xml|conf|tmpl|template|envsh)$/i
export const ARCHIVE_EXT = /\.(zip|docx|pptx|xlsx)$/i
export const read = f => fs.readFileSync(path.join(root, f), 'utf8')
export const readBytes = f => fs.readFileSync(path.join(root, f))

/** Minimal ZIP reader (stored + deflate) for archives and OOXML documents. */
export function zipEntries(buffer) {
  let eocd = -1
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) return []
  const count = buffer.readUInt16LE(eocd + 10)
  let p = buffer.readUInt32LE(eocd + 16)
  const entries = []
  for (let n = 0; n < count && buffer.readUInt32LE(p) === 0x02014b50; n++) {
    const method = buffer.readUInt16LE(p + 10), size = buffer.readUInt32LE(p + 20)
    const nameLen = buffer.readUInt16LE(p + 28), extraLen = buffer.readUInt16LE(p + 30), commentLen = buffer.readUInt16LE(p + 32)
    const local = buffer.readUInt32LE(p + 42)
    const name = buffer.toString('utf8', p + 46, p + 46 + nameLen)
    entries.push({ name, data() {
      const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
      const raw = buffer.subarray(start, start + size)
      return method === 8 ? zlib.inflateRawSync(raw) : method === 0 ? raw : Buffer.alloc(0)
    } })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

/** Line number (1-based) of a character offset. */
export const lineOf = (text, index) => text.slice(0, index).split('\n').length

export function report(name, problems, okMessage) {
  if (problems.length) {
    console.error(problems.map(p => '✖ ' + p).join('\n'))
    console.error(`\n${name}: ${problems.length} problem(s)`)
    process.exit(1)
  }
  console.log(okMessage)
}
