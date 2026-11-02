import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
export const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {encoding:'utf8'}).split('\0'))].filter(f => f && fs.existsSync(f) && fs.statSync(f).isFile())
export const upstream = f => /^(vendor|third_party)\//.test(f)
export const markdown = files.filter(f => /\.md$/i.test(f) && !upstream(f))
