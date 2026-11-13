/* Guard: the Vite build output in react/ is generated (npm run build:web,
   emptyOutDir) and must never be tracked. A tracked copy is always stale:
   every build deletes and rewrites the content-hashed files, which leaves
   the working tree dirty and makes frontend pull requests conflict.
   .gitignore cannot stop a forced or pre-existing add, so this test does. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

test('generated react/ build output is not tracked by Git', () => {
  const tracked = execFileSync('git', ['ls-files', '--', 'react/'], { encoding: 'utf8' }).trim()
  assert.equal(tracked, '', `react/ is generated output; untrack it with git rm -r --cached react/\n${tracked.split('\n').slice(0, 5).join('\n')}`)
})
